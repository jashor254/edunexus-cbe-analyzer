// lib/iam/roles.ts
// Custom role management (per-org).
import { repos } from '@/lib/repositories'
import { assertPermission } from './permissions'
import { writeAuditLog } from './audit'
import type { OrganizationRole, Permission } from '@/lib/organizations/types'

/**
 * Create a custom role for an organization.
 */
export async function createCustomRole(
  organizationId: string,
  callerId: string,
  input: {
    name: string
    description?: string
    permissions: Permission[]
  }
): Promise<OrganizationRole> {
  await assertPermission(callerId, organizationId, 'roles:manage')

  const data = await repos.organizations.insertRole({
    organization_id: organizationId,
    name:            input.name,
    description:     input.description ?? null,
    is_system:       false,
    permissions:     input.permissions,
  })

  await writeAuditLog({
    organization_id: organizationId,
    user_id:         callerId,
    action:          'role.created',
    resource_type:   'role',
    resource_id:     data.id,
    new_values:      { name: input.name, permissions: input.permissions },
  })

  return { ...data, permissions: data.permissions as Permission[] }
}

/**
 * Update a custom role's permissions.
 */
export async function updateCustomRole(
  roleId: string,
  callerId: string,
  organizationId: string,
  input: { name?: string; description?: string; permissions?: Permission[] }
): Promise<OrganizationRole> {
  await assertPermission(callerId, organizationId, 'roles:manage')

  const existing = await repos.organizations.findRoleById(roleId, organizationId)

  if (!existing) throw new Error('Role not found')
  if (existing.is_system) throw new Error('System roles cannot be modified')

  const data = await repos.organizations.updateRole(roleId, input)

  await writeAuditLog({
    organization_id: organizationId,
    user_id:         callerId,
    action:          'role.updated',
    resource_type:   'role',
    resource_id:     roleId,
    old_values:      { name: existing.name, permissions: existing.permissions },
    new_values:      input,
  })

  return data
}

/**
 * Delete a custom role. Fails if any member currently has this role.
 */
export async function deleteCustomRole(
  roleId: string,
  callerId: string,
  organizationId: string
): Promise<void> {
  await assertPermission(callerId, organizationId, 'roles:manage')

  const existing = await repos.organizations.findRoleById(roleId, organizationId)

  if (!existing) throw new Error('Role not found')
  if (existing.is_system) throw new Error('System roles cannot be deleted')

  // Check for active members with this role
  const count = await repos.organizations.countActiveByRole(organizationId, existing.name)

  if (count > 0) {
    throw new Error(`Cannot delete role — ${count} active member(s) have this role. Reassign them first.`)
  }

  await repos.organizations.deleteRoleById(roleId)

  await writeAuditLog({
    organization_id: organizationId,
    user_id:         callerId,
    action:          'role.deleted',
    resource_type:   'role',
    resource_id:     roleId,
    old_values:      { name: existing.name },
  })
}
