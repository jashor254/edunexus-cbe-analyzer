// ─────────────────────────────────────────────────────────────────────────────
// lib/organizations/types.ts
// All types for the multi-tenancy + IAM layer.
// ─────────────────────────────────────────────────────────────────────────────

export type OrgType =
  | 'school'
  | 'district'
  | 'county'
  | 'ministry'
  | 'publisher'
  | 'university'
  | 'ngo'
  | 'developer'

export type OrgStatus =
  | 'active'
  | 'trial'
  | 'suspended'
  | 'churned'
  | 'pending_verification'

export type MemberRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'billing_admin'
  | 'developer'
  | 'viewer'
  | string   // custom roles

export type MemberStatus = 'active' | 'suspended' | 'removed'

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export type ApiKeyStatus = 'active' | 'revoked' | 'expired'

export type ApiKeyEnvironment = 'live' | 'sandbox'

export type Permission =
  | 'org:read'
  | 'org:update'
  | 'org:delete'
  | 'org:transfer'
  | 'members:invite'
  | 'members:remove'
  | 'members:update_role'
  | 'billing:read'
  | 'billing:update'
  | 'api:use'
  | 'api:manage'
  | 'schools:manage'
  | 'analytics:read'
  | 'audit:read'
  | 'roles:manage'

// ── Database row shapes ───────────────────────────────────────────────────────

export type Organization = {
  id: string
  name: string
  slug: string
  type: OrgType
  parent_id: string | null
  status: OrgStatus
  logo_url: string | null
  primary_color: string
  website: string | null
  country: string
  timezone: string
  locale: string
  currency: string
  api_quota_daily: number
  api_quota_monthly: number
  settings: Record<string, unknown>
  metadata: Record<string, unknown>
  trial_ends_at: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export type OrganizationMember = {
  id: string
  organization_id: string
  user_id: string
  role: MemberRole
  status: MemberStatus
  invited_by: string | null
  joined_at: string | null
  last_active_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type OrganizationRole = {
  id: string
  organization_id: string | null
  name: string
  description: string | null
  is_system: boolean
  permissions: Permission[]
  created_at: string
  updated_at: string
}

export type OrganizationInvitation = {
  id: string
  organization_id: string
  email: string
  role: MemberRole
  token: string
  invited_by: string
  status: InvitationStatus
  expires_at: string
  accepted_at: string | null
  accepted_by: string | null
  message: string | null
  created_at: string
  updated_at: string
}

export type ApiKey = {
  id: string
  organization_id: string
  created_by: string
  name: string
  description: string | null
  key_prefix: string
  key_hash: string
  scopes: string[]
  status: ApiKeyStatus
  environment: ApiKeyEnvironment
  last_used_at: string | null
  expires_at: string | null
  rate_limit_rpm: number
  rate_limit_rpd: number
  created_at: string
  updated_at: string
}

// ── Input/output types for lib functions ──────────────────────────────────────

export type CreateOrganizationInput = {
  name: string
  slug?: string
  type: OrgType
  parent_id?: string
  logo_url?: string
  primary_color?: string
  website?: string
  country?: string
  timezone?: string
  locale?: string
  currency?: string
  settings?: Record<string, unknown>
}

export type UpdateOrganizationInput = Partial<
  Pick<
    Organization,
    | 'name'
    | 'logo_url'
    | 'primary_color'
    | 'website'
    | 'timezone'
    | 'locale'
    | 'currency'
    | 'settings'
    | 'metadata'
  >
>

export type CreateInvitationInput = {
  organization_id: string
  email: string
  role: MemberRole
  message?: string
  invited_by: string
}

export type CreateApiKeyInput = {
  organization_id: string
  created_by: string
  name: string
  description?: string
  scopes?: string[]
  environment?: ApiKeyEnvironment
  expires_at?: string
  rate_limit_rpm?: number
  rate_limit_rpd?: number
}

export type CreateApiKeyResult = {
  api_key: ApiKey
  raw_key: string  // only returned once at creation; never stored
}

export type OrgWithMembership = Organization & {
  membership: Pick<OrganizationMember, 'role' | 'status' | 'joined_at'>
}

export type MemberWithProfile = OrganizationMember & {
  user: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
}
