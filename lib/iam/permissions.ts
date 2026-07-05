// lib/iam/permissions.ts
// Permission definitions and role-to-permission mapping.
import { repos } from '@/lib/repositories'
import type { Permission, MemberRole } from '@/lib/organizations/types'

// System role permission matrix (mirrors what's seeded in organization_roles)
const SYSTEM_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: [
    'org:read','org:update','org:delete','org:transfer',
    'members:invite','members:remove','members:update_role',
    'billing:read','billing:update',
    'api:use','api:manage',
    'schools:manage','analytics:read','audit:read','roles:manage',
  ],
  admin: [
    'org:read','org:update',
    'members:invite','members:remove','members:update_role',
    'billing:read',
    'api:use','api:manage',
    'schools:manage','analytics:read','audit:read','roles:manage',
  ],
  member:        ['org:read','api:use','analytics:read'],
  billing_admin: ['org:read','billing:read','billing:update'],
  developer:     ['org:read','api:use','api:manage'],
  viewer:        ['org:read','analytics:read'],
}

/**
 * Get the effective permissions for a user in an organization.
 * Checks system roles first, then custom org roles.
 */
export async function getUserPermissions(
  userId: string,
  organizationId: string
): Promise<Permission[]> {
  const member = await repos.organizations.findMemberRoleForPermissions(organizationId, userId)

  if (!member || member.status !== 'active') return []

  // Check system role permissions first
  if (member.role in SYSTEM_ROLE_PERMISSIONS) {
    return SYSTEM_ROLE_PERMISSIONS[member.role]
  }

  // Custom role — look up in organization_roles
  const role = await repos.organizations.findCustomRolePermissions(organizationId, member.role)

  return (role?.permissions ?? []) as Permission[]
}

/**
 * Check if a user has a specific permission in an organization.
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, organizationId)
  return permissions.includes(permission)
}

/**
 * Assert a permission — throws 403 if denied.
 * Use this in API routes for clean guard logic.
 */
export async function assertPermission(
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<void> {
  const allowed = await hasPermission(userId, organizationId, permission)
  if (!allowed) {
    throw new Error(`Permission denied: ${permission}`)
  }
}

/**
 * Get the user's role in an organization, or null if not a member.
 */
export async function getUserRole(
  userId: string,
  organizationId: string
): Promise<MemberRole | null> {
  return repos.organizations.getUserRoleInOrg(organizationId, userId)
}

/**
 * List all roles available to an organization (system + custom).
 */
export async function listAvailableRoles(organizationId: string): Promise<{
  name: string
  description: string | null
  is_system: boolean
  permissions: Permission[]
}[]> {
  return repos.organizations.listAvailableRoles(organizationId)
}
