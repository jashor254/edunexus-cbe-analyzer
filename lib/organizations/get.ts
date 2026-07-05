// lib/organizations/get.ts
import { repos } from '@/lib/repositories'
import type { Organization, OrgWithMembership, MemberWithProfile } from './types'

/**
 * Get all organizations the user is an active member of.
 */
export async function getUserOrganizations(userId: string): Promise<OrgWithMembership[]> {
  return repos.organizations.findUserOrganizations(userId)
}

/**
 * Get a single organization by ID. Verifies the user is an active member.
 */
export async function getOrganization(
  orgId: string,
  userId: string
): Promise<Organization> {
  // Verify membership
  const member = await repos.organizations.findMembership(orgId, userId)
  if (!member) throw new Error('Access denied')

  return repos.organizations.findById(orgId)
}

/**
 * Get an organization by slug (public — no auth required for basic info).
 */
export async function getOrganizationBySlug(slug: string): Promise<Pick<Organization, 'id' | 'name' | 'slug' | 'type' | 'logo_url' | 'primary_color' | 'status'>> {
  const data = await repos.organizations.findBySlug(slug)
  if (!data) throw new Error('Organization not found')
  return data
}

/**
 * List members of an organization with their profile data.
 */
export async function getOrganizationMembers(
  orgId: string,
  userId: string
): Promise<MemberWithProfile[]> {
  // Caller must be an active member
  const caller = await repos.organizations.findMemberRole(orgId, userId)
  if (!caller) throw new Error('Access denied')

  return repos.organizations.listMembers(orgId)
}

/**
 * Get the org hierarchy (children of a parent).
 */
export async function getOrganizationChildren(
  parentId: string,
  userId: string
): Promise<Organization[]> {
  // Verify caller is a member of the parent org
  const member = await repos.organizations.findMemberRole(parentId, userId)
  if (!member) throw new Error('Access denied')

  return repos.organizations.findChildrenByParentId(parentId)
}
