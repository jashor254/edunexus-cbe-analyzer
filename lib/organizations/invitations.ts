// lib/organizations/invitations.ts
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { writeAuditLog } from '@/lib/iam/audit'
import { publishEvent } from '@/lib/events'
import type { CreateInvitationInput, OrganizationInvitation } from './types'

/**
 * Send an invitation to join an organization.
 * Caller must be owner or admin.
 */
export async function createInvitation(
  input: CreateInvitationInput
): Promise<OrganizationInvitation> {
  // Verify caller has permission to invite
  const caller = await repos.organizations.findMemberRole(input.organization_id, input.invited_by)
  if (!caller || !['owner', 'admin'].includes(caller.role)) {
    throw new Error('Access denied — owner or admin required to invite')
  }

  // Check if there's already a pending invitation for this email
  const existingInvite = await repos.organizations.findPendingInvitation(
    input.organization_id,
    input.email
  )

  if (existingInvite) {
    // Revoke the old pending invite before creating a new one
    await repos.organizations.revokeInvitationById(existingInvite.id)
  }

  const invitation = await repos.organizations.insertInvitation(input)

  await writeAuditLog({
    organization_id: input.organization_id,
    user_id:         input.invited_by,
    action:          'member.invited',
    resource_type:   'invitation',
    resource_id:     invitation.id,
    new_values:      { email: input.email, role: input.role },
  })

  return invitation
}

/**
 * Accept an invitation by token.
 * The accepting user's auth session provides identity.
 */
export async function acceptInvitation(
  token: string,
  acceptingUserId: string,
  acceptingUserEmail: string
): Promise<{ organization_id: string; role: string }> {
  const invitation = await repos.organizations.findInvitationByToken(token)
  if (!invitation) throw new Error('Invitation not found')
  if (invitation.status !== 'pending') throw new Error(`Invitation is ${invitation.status}`)
  if (new Date(invitation.expires_at) < new Date()) {
    await repos.organizations.updateInvitationStatus(invitation.id, { status: 'expired' })
    throw new Error('Invitation has expired')
  }

  // Email must match (case-insensitive)
  if (invitation.email.toLowerCase() !== acceptingUserEmail.toLowerCase()) {
    throw new Error('This invitation was sent to a different email address')
  }

  // Check if user is already an existing member
  const existing = await repos.organizations.findExistingMember(
    invitation.organization_id,
    acceptingUserId
  )

  if (existing) {
    // Update their role to the invited role if different
    if (existing.role !== invitation.role) {
      await repos.organizations.upsertMember({
        organization_id: invitation.organization_id,
        user_id:         acceptingUserId,
        role:            invitation.role,
        status:          'active',
      })
    }
  } else {
    // Add them as a new member
    await repos.organizations.insertMember({
      organization_id: invitation.organization_id,
      user_id:         acceptingUserId,
      role:            invitation.role,
      status:          'active',
      joined_at:       new Date().toISOString(),
    })
  }

  // Mark invitation accepted
  await repos.organizations.updateInvitationStatus(invitation.id, {
    status:      'accepted',
    accepted_at: new Date().toISOString(),
    accepted_by: acceptingUserId,
  })

  await writeAuditLog({
    organization_id: invitation.organization_id,
    user_id:         acceptingUserId,
    action:          'member.joined',
    resource_type:   'invitation',
    resource_id:     invitation.id,
    new_values:      { role: invitation.role },
  })

  void publishEvent({
    event_type:      'organization.member.joined',
    resource_type:   'member',
    resource_id:     acceptingUserId,
    actor_id:        acceptingUserId,
    organization_id: invitation.organization_id,
    payload: {
      organization_id: invitation.organization_id,
      user_id:         acceptingUserId,
      role:            invitation.role,
    },
    idempotency_key: `organization.member.joined:${invitation.organization_id}:${acceptingUserId}`,
  }).catch(err => console.error('[events] organization.member.joined:', err instanceof Error ? err.message : String(err)))

  return {
    organization_id: invitation.organization_id,
    role:            invitation.role,
  }
}

/**
 * Revoke a pending invitation.
 */
export async function revokeInvitation(
  invitationId: string,
  callerId: string
): Promise<void> {
  const invitation = await repos.organizations.findInvitationById(invitationId)
  if (!invitation) throw new Error('Invitation not found')
  if (invitation.status !== 'pending') throw new Error(`Cannot revoke a ${invitation.status} invitation`)

  const caller = await repos.organizations.findMemberRole(invitation.organization_id, callerId)
  if (!caller || !['owner', 'admin'].includes(caller.role)) {
    throw new Error('Access denied')
  }

  await repos.organizations.revokeInvitationById(invitationId)

  await writeAuditLog({
    organization_id: invitation.organization_id,
    user_id:         callerId,
    action:          'invitation.revoked',
    resource_type:   'invitation',
    resource_id:     invitationId,
  })
}

/**
 * List all invitations for an organization.
 */
export async function previewInvitation(token: string): Promise<{
  organization_name: string
  role: string
  invited_by_email: string
  expires_at: string
} | null> {
  const data = await repos.organizations.findInvitationPreview(token)
  if (!data) return null
  if (new Date(data.expires_at) < new Date()) return null

  const rawOrg = data.organizations
  const orgName = (Array.isArray(rawOrg) ? rawOrg[0] : rawOrg) as { name: string } | null

  // Fetch inviter email — requires service client admin API
  const supabase = createServiceClient()
  const { data: inviter } = await supabase.auth.admin.getUserById(data.invited_by as string)

  return {
    organization_name: orgName?.name ?? 'Unknown Organization',
    role:              data.role as string,
    invited_by_email:  inviter.user?.email ?? 'someone',
    expires_at:        data.expires_at as string,
  }
}

export async function listInvitations(
  orgId: string,
  callerId: string
): Promise<OrganizationInvitation[]> {
  const caller = await repos.organizations.findMemberRole(orgId, callerId)
  if (!caller || !['owner', 'admin'].includes(caller.role)) {
    throw new Error('Access denied')
  }

  return repos.organizations.listInvitations(orgId)
}
