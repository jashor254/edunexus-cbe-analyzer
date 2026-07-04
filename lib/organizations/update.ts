// lib/organizations/update.ts
import { repos } from '@/lib/repositories'
import { writeAuditLog } from '@/lib/iam/audit'
import { publishEvent } from '@/lib/events'
import type { Organization, UpdateOrganizationInput } from './types'

/**
 * Update organization settings/branding. Caller must be owner or admin.
 */
export async function updateOrganization(
  orgId: string,
  userId: string,
  input: UpdateOrganizationInput
): Promise<Organization> {
  // Verify caller has admin+ access
  const member = await repos.organizations.findMemberRole(orgId, userId)
  if (!member || !['owner', 'admin'].includes(member.role)) {
    throw new Error('Access denied — owner or admin required')
  }

  // Capture old values for audit
  const old = await repos.organizations.findOrgSnapshotForAudit(orgId)

  const org = await repos.organizations.update(orgId, input)

  await writeAuditLog({
    organization_id: orgId,
    user_id:         userId,
    action:          'organization.updated',
    resource_type:   'organization',
    resource_id:     orgId,
    old_values:      old ?? undefined,
    new_values:      input,
  })

  return org
}

/**
 * Transfer organization ownership to another member.
 * Only the current owner can do this.
 */
export async function transferOwnership(
  orgId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<void> {
  // Verify current owner
  const ownerMember = await repos.organizations.findMemberRole(orgId, currentOwnerId)
  if (!ownerMember || ownerMember.role !== 'owner') {
    throw new Error('Only the current owner can transfer ownership')
  }

  // Verify new owner is an active member
  const newMember = await repos.organizations.findMemberRole(orgId, newOwnerId)
  if (!newMember) {
    throw new Error('New owner must be an active member of the organization')
  }

  // Atomic swap: demote current owner → admin, promote new owner → owner
  await Promise.all([
    repos.organizations.updateMemberRole(orgId, currentOwnerId, 'admin'),
    repos.organizations.updateMemberRole(orgId, newOwnerId, 'owner'),
  ])

  await writeAuditLog({
    organization_id: orgId,
    user_id:         currentOwnerId,
    action:          'organization.ownership_transferred',
    resource_type:   'organization',
    resource_id:     orgId,
    old_values:      { owner: currentOwnerId },
    new_values:      { owner: newOwnerId },
  })
}

/**
 * Update a member's role. Caller must be owner or admin.
 * Cannot demote an owner without transferOwnership().
 */
export async function updateMemberRole(
  orgId: string,
  callerId: string,
  targetUserId: string,
  newRole: string
): Promise<void> {
  const caller = await repos.organizations.findMemberRole(orgId, callerId)
  if (!caller || !['owner', 'admin'].includes(caller.role)) {
    throw new Error('Access denied')
  }

  const target = await repos.organizations.findMemberRole(orgId, targetUserId)
  if (!target) throw new Error('Member not found')
  if (target.role === 'owner' && caller.role !== 'owner') {
    throw new Error('Only the owner can change the owner role')
  }
  if (newRole === 'owner') {
    throw new Error('Use transferOwnership() to assign the owner role')
  }

  await repos.organizations.updateMemberRole(orgId, targetUserId, newRole)

  await writeAuditLog({
    organization_id: orgId,
    user_id:         callerId,
    action:          'member.role_updated',
    resource_type:   'member',
    resource_id:     targetUserId,
    old_values:      { role: target.role },
    new_values:      { role: newRole },
  })

  void publishEvent({
    event_type:      'organization.member.role_changed',
    resource_type:   'member',
    resource_id:     targetUserId,
    actor_id:        callerId,
    organization_id: orgId,
    payload: {
      organization_id: orgId,
      user_id:         targetUserId,
      old_role:        target.role,
      new_role:        newRole,
    },
  }).catch(err => console.error('[events] organization.member.role_changed:', err instanceof Error ? err.message : String(err)))
}

/**
 * Remove a member from the organization.
 */
export async function removeMember(
  orgId: string,
  callerId: string,
  targetUserId: string
): Promise<void> {
  const caller = await repos.organizations.findMemberRole(orgId, callerId)
  if (!caller || !['owner', 'admin'].includes(caller.role)) {
    throw new Error('Access denied')
  }

  const target = await repos.organizations.findMemberRole(orgId, targetUserId)
  if (!target) throw new Error('Member not found')
  if (target.role === 'owner') throw new Error('Cannot remove the organization owner')

  await repos.organizations.updateMemberStatus(orgId, targetUserId, 'removed')

  await writeAuditLog({
    organization_id: orgId,
    user_id:         callerId,
    action:          'member.removed',
    resource_type:   'member',
    resource_id:     targetUserId,
    old_values:      { role: target.role, status: 'active' },
    new_values:      { status: 'removed' },
  })

  void publishEvent({
    event_type:      'organization.member.removed',
    resource_type:   'member',
    resource_id:     targetUserId,
    actor_id:        callerId,
    organization_id: orgId,
    payload: {
      organization_id: orgId,
      user_id:         targetUserId,
    },
  }).catch(err => console.error('[events] organization.member.removed:', err instanceof Error ? err.message : String(err)))
}
