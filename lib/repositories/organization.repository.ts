import { BaseRepository } from './base'
import type {
  Organization,
  OrgWithMembership,
  MemberWithProfile,
  OrganizationInvitation,
  OrganizationRole,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  CreateInvitationInput,
  MemberRole,
  Permission,
} from '@/lib/organizations/types'

const ORG_COLS =
  'id, name, slug, type, parent_id, status, logo_url, primary_color, website, country, timezone, locale, currency, api_quota_daily, api_quota_monthly, settings, metadata, trial_ends_at, verified_at, created_at, updated_at'

const INVITATION_COLS =
  'id, organization_id, email, role, token, invited_by, status, expires_at, accepted_at, accepted_by, message, created_at, updated_at'

const ROLE_COLS =
  'id, organization_id, name, description, is_system, permissions, created_at, updated_at'

export class OrganizationRepository extends BaseRepository {
  // ── Organizations ──────────────────────────────────────────────────────────

  async findById(orgId: string): Promise<Organization> {
    const { data, error } = await this.db
      .from('organizations')
      .select(ORG_COLS)
      .eq('id', orgId)
      .single()
    if (error) throw new Error(`Organization not found: ${error.message}`)
    return data
  }

  async findBySlug(
    slug: string
  ): Promise<Pick<Organization, 'id' | 'name' | 'slug' | 'type' | 'logo_url' | 'primary_color' | 'status'> | null> {
    const { data, error } = await this.db
      .from('organizations')
      .select('id, name, slug, type, logo_url, primary_color, status')
      .eq('slug', slug.toLowerCase())
      .maybeSingle()
    if (error) throw new Error(`Lookup failed: ${error.message}`)
    return data
  }

  async findChildrenByParentId(parentId: string): Promise<Organization[]> {
    const { data, error } = await this.db
      .from('organizations')
      .select(ORG_COLS)
      .eq('parent_id', parentId)
      .order('name', { ascending: true })
    if (error) throw new Error(`Failed to fetch children: ${error.message}`)
    return data ?? []
  }

  async slugExists(slug: string): Promise<boolean> {
    const { data } = await this.db
      .from('organizations')
      .select('id')
      .eq('slug', slug.toLowerCase())
      .maybeSingle()
    return data !== null
  }

  async insert(
    input: CreateOrganizationInput,
    slug: string
  ): Promise<Organization> {
    const { data, error } = await this.db
      .from('organizations')
      .insert({
        name:          input.name,
        slug:          slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        type:          input.type,
        parent_id:     input.parent_id ?? null,
        logo_url:      input.logo_url ?? null,
        primary_color: input.primary_color ?? '#4F46E5',
        website:       input.website ?? null,
        country:       input.country ?? 'KE',
        timezone:      input.timezone ?? 'Africa/Nairobi',
        locale:        input.locale ?? 'en-KE',
        currency:      input.currency ?? 'KES',
        settings:      input.settings ?? {},
        status:        'trial',
      })
      .select(ORG_COLS)
      .single()
    if (error) throw new Error(`Failed to create organization: ${error.message}`)
    return data
  }

  async deleteById(orgId: string): Promise<void> {
    await this.db.from('organizations').delete().eq('id', orgId)
  }

  async update(orgId: string, input: UpdateOrganizationInput): Promise<Organization> {
    const { data, error } = await this.db
      .from('organizations')
      .update(input)
      .eq('id', orgId)
      .select(ORG_COLS)
      .single()
    if (error) throw new Error(`Failed to update organization: ${error.message}`)
    return data
  }

  async findOrgSnapshotForAudit(
    orgId: string
  ): Promise<Pick<Organization, 'name' | 'logo_url' | 'primary_color' | 'website' | 'settings'> | null> {
    const { data } = await this.db
      .from('organizations')
      .select('name, logo_url, primary_color, website, settings')
      .eq('id', orgId)
      .single()
    return data
  }

  async findApiQuota(
    orgId: string
  ): Promise<Pick<Organization, 'api_quota_daily' | 'status'> | null> {
    const { data } = await this.db
      .from('organizations')
      .select('api_quota_daily, status')
      .eq('id', orgId)
      .single()
    return data
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async findMembership(
    orgId: string,
    userId: string
  ): Promise<{ role: string; status: string } | null> {
    const { data } = await this.db
      .from('organization_members')
      .select('role, status')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    return data
  }

  async findMemberRole(
    orgId: string,
    userId: string
  ): Promise<{ role: string } | null> {
    const { data } = await this.db
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    return data
  }

  async findUserOrganizations(userId: string): Promise<OrgWithMembership[]> {
    const { data, error } = await this.db
      .from('organization_members')
      .select(`
        role, status, joined_at,
        organizations!inner (${ORG_COLS})
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
    if (error) throw new Error(`Failed to fetch user organizations: ${error.message}`)

    return (data ?? []).map((row) => ({
      ...(row.organizations as unknown as Organization),
      membership: {
        role:      row.role,
        status:    row.status,
        joined_at: row.joined_at,
      },
    }))
  }

  async listMembers(orgId: string): Promise<MemberWithProfile[]> {
    const { data, error } = await this.db
      .from('organization_members')
      .select(`
        id, organization_id, user_id, role, status, invited_by, joined_at, last_active_at, metadata, created_at, updated_at,
        user:user_id (id, email, raw_user_meta_data)
      `)
      .eq('organization_id', orgId)
      .neq('status', 'removed')
      .order('created_at', { ascending: true })
    if (error) throw new Error(`Failed to fetch members: ${error.message}`)

    return (data ?? []).map((row) => {
      const userMeta =
        (
          row.user as { raw_user_meta_data?: { full_name?: string; avatar_url?: string } } | null
        )?.raw_user_meta_data ?? {}
      return {
        id:              row.id,
        organization_id: row.organization_id,
        user_id:         row.user_id,
        role:            row.role,
        status:          row.status as 'active' | 'suspended' | 'removed',
        invited_by:      row.invited_by,
        joined_at:       row.joined_at,
        last_active_at:  row.last_active_at,
        metadata:        row.metadata as Record<string, unknown>,
        created_at:      row.created_at,
        updated_at:      row.updated_at,
        user: {
          id:         row.user_id,
          email:      (row.user as { email?: string } | null)?.email ?? '',
          full_name:  userMeta.full_name ?? null,
          avatar_url: userMeta.avatar_url ?? null,
        },
      }
    })
  }

  async insertMember(params: {
    organization_id: string
    user_id: string
    role: string
    status: string
    joined_at: string
  }): Promise<void> {
    const { error } = await this.db.from('organization_members').insert(params)
    if (error) throw new Error(`Failed to add owner: ${error.message}`)
  }

  async updateMemberRole(orgId: string, userId: string, role: string): Promise<void> {
    const { error } = await this.db
      .from('organization_members')
      .update({ role })
      .eq('organization_id', orgId)
      .eq('user_id', userId)
    if (error) throw new Error(`Failed to update role: ${error.message}`)
  }

  async updateMemberStatus(orgId: string, userId: string, status: string): Promise<void> {
    const { error } = await this.db
      .from('organization_members')
      .update({ status })
      .eq('organization_id', orgId)
      .eq('user_id', userId)
    if (error) throw new Error(`Failed to update member status: ${error.message}`)
  }

  async countActiveByRole(orgId: string, roleName: string): Promise<number> {
    const { count } = await this.db
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('role', roleName)
      .eq('status', 'active')
    return count ?? 0
  }

  async findExistingMember(
    orgId: string,
    userId: string
  ): Promise<{ id: string; role: string } | null> {
    const { data } = await this.db
      .from('organization_members')
      .select('id, role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle()
    return data
  }

  async upsertMember(params: {
    organization_id: string
    user_id: string
    role: string
    status: string
  }): Promise<void> {
    const { error } = await this.db
      .from('organization_members')
      .update({ role: params.role, status: params.status })
      .eq('organization_id', params.organization_id)
      .eq('user_id', params.user_id)
    if (error) throw new Error(`Failed to update member: ${error.message}`)
  }

  // ── Invitations ────────────────────────────────────────────────────────────

  async findPendingInvitation(orgId: string, email: string): Promise<{ id: string; status: string } | null> {
    const { data } = await this.db
      .from('organization_invitations')
      .select('id, status')
      .eq('organization_id', orgId)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle()
    return data
  }

  async revokeInvitationById(invitationId: string): Promise<void> {
    await this.db
      .from('organization_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId)
  }

  async insertInvitation(input: CreateInvitationInput): Promise<OrganizationInvitation> {
    const { data, error } = await this.db
      .from('organization_invitations')
      .insert({
        organization_id: input.organization_id,
        email:           input.email.toLowerCase(),
        role:            input.role,
        invited_by:      input.invited_by,
        message:         input.message ?? null,
      })
      .select(INVITATION_COLS)
      .single()
    if (error) throw new Error(`Failed to create invitation: ${error.message}`)
    return data
  }

  async findInvitationByToken(
    token: string
  ): Promise<{ id: string; organization_id: string; email: string; role: string; status: string; expires_at: string } | null> {
    const { data, error } = await this.db
      .from('organization_invitations')
      .select('id, organization_id, email, role, status, expires_at')
      .eq('token', token)
      .maybeSingle()
    if (error) throw new Error(`Failed to fetch invitation: ${error.message}`)
    return data
  }

  async findInvitationById(
    invitationId: string
  ): Promise<{ organization_id: string; status: string } | null> {
    const { data } = await this.db
      .from('organization_invitations')
      .select('organization_id, status')
      .eq('id', invitationId)
      .maybeSingle()
    return data
  }

  async updateInvitationStatus(
    invitationId: string,
    updates: { status: string; accepted_at?: string; accepted_by?: string }
  ): Promise<void> {
    await this.db
      .from('organization_invitations')
      .update(updates)
      .eq('id', invitationId)
  }

  async listInvitations(orgId: string): Promise<OrganizationInvitation[]> {
    const { data, error } = await this.db
      .from('organization_invitations')
      .select(INVITATION_COLS)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Failed to fetch invitations: ${error.message}`)
    return data ?? []
  }

  async findInvitationPreview(token: string): Promise<{
    role: string
    expires_at: string
    status: string
    organizations: unknown
    invited_by: string
  } | null> {
    const { data } = await this.db
      .from('organization_invitations')
      .select(`
        role, expires_at, status,
        organizations!inner (name),
        invited_by
      `)
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle()
    return data
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  async findFreePlanId(): Promise<string | null> {
    const { data } = await this.db
      .from('subscription_plans')
      .select('id')
      .eq('name', 'free')
      .single()
    return data?.id ?? null
  }

  async insertSubscription(params: {
    organization_id: string
    plan_id: string
    status: string
    current_period_start: string
    current_period_end: string
    trial_end: string
  }): Promise<void> {
    await this.db.from('organization_subscriptions').insert(params)
  }

  async findOrgFeatures(
    organizationId: string
  ): Promise<{ status: string; subscription_plans: unknown } | null> {
    const { data } = await this.db
      .from('organization_subscriptions')
      .select(`
        status,
        subscription_plans!inner (name, features)
      `)
      .eq('organization_id', organizationId)
      .maybeSingle()
    return data
  }

  // ── Roles ──────────────────────────────────────────────────────────────────

  async findMemberRoleForPermissions(
    orgId: string,
    userId: string
  ): Promise<{ role: string; status: string } | null> {
    const { data } = await this.db
      .from('organization_members')
      .select('role, status')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle()
    return data
  }

  async findCustomRolePermissions(
    orgId: string,
    roleName: string
  ): Promise<{ permissions: unknown } | null> {
    const { data } = await this.db
      .from('organization_roles')
      .select('permissions')
      .eq('organization_id', orgId)
      .eq('name', roleName)
      .maybeSingle()
    return data
  }

  async getUserRoleInOrg(orgId: string, userId: string): Promise<MemberRole | null> {
    const { data } = await this.db
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    return (data?.role as MemberRole) ?? null
  }

  async listAvailableRoles(organizationId: string): Promise<{
    name: string
    description: string | null
    is_system: boolean
    permissions: Permission[]
  }[]> {
    const { data, error } = await this.db
      .from('organization_roles')
      .select('name, description, is_system, permissions')
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .order('is_system', { ascending: false })
      .order('name')
    if (error) throw new Error(`Failed to list roles: ${error.message}`)
    return (data ?? []).map((r) => ({
      ...r,
      permissions: r.permissions as Permission[],
    }))
  }

  async insertRole(params: {
    organization_id: string
    name: string
    description: string | null
    is_system: boolean
    permissions: Permission[]
  }): Promise<OrganizationRole> {
    const { data, error } = await this.db
      .from('organization_roles')
      .insert(params)
      .select(ROLE_COLS)
      .single()
    if (error) throw new Error(`Failed to create role: ${error.message}`)
    return { ...data, permissions: data.permissions as Permission[] }
  }

  async findRoleById(
    roleId: string,
    orgId: string
  ): Promise<{ is_system: boolean; name: string; permissions: unknown } | null> {
    const { data } = await this.db
      .from('organization_roles')
      .select('is_system, name, permissions')
      .eq('id', roleId)
      .eq('organization_id', orgId)
      .maybeSingle()
    return data
  }

  async updateRole(
    roleId: string,
    input: { name?: string; description?: string; permissions?: Permission[] }
  ): Promise<OrganizationRole> {
    const { data, error } = await this.db
      .from('organization_roles')
      .update(input)
      .eq('id', roleId)
      .select(ROLE_COLS)
      .single()
    if (error) throw new Error(`Failed to update role: ${error.message}`)
    return { ...data, permissions: data.permissions as Permission[] }
  }

  async deleteRoleById(roleId: string): Promise<void> {
    await this.db.from('organization_roles').delete().eq('id', roleId)
  }

  // ── Usage ──────────────────────────────────────────────────────────────────

  async findDailyUsage(
    orgId: string,
    sinceIso: string
  ): Promise<{ quantity: number }[]> {
    const { data } = await this.db
      .from('usage_events')
      .select('quantity')
      .eq('organization_id', orgId)
      .eq('event_type', 'api.request')
      .gte('recorded_at', sinceIso)
    return data ?? []
  }

  async insertUsageEvent(params: {
    organization_id: string
    user_id: string | null
    api_key_id: string | null
    event_type: string
    resource: string | null
    quantity: number
    cost_tokens: number
    cost_units: number
    metadata: Record<string, unknown>
  }): Promise<void> {
    await this.db.from('usage_events').insert(params)
  }
}
