// lib/organizations/create.ts
import { repos } from '@/lib/repositories'
import { generateOrgSlug } from './utils'
import { writeAuditLog } from '@/lib/iam/audit'
import type { CreateOrganizationInput, Organization } from './types'

/**
 * Create a new organization and make the creator the owner.
 * Automatically creates a free-tier subscription.
 */
export async function createOrganization(
  input: CreateOrganizationInput,
  creatorUserId: string
): Promise<Organization> {
  const slug = input.slug ?? (await generateOrgSlug(input.name))

  const org = await repos.organizations.insert(input, slug)

  // Add creator as owner
  try {
    await repos.organizations.insertMember({
      organization_id: org.id,
      user_id:         creatorUserId,
      role:            'owner',
      status:          'active',
      joined_at:       new Date().toISOString(),
    })
  } catch (err) {
    // Roll back org creation to maintain consistency
    await repos.organizations.deleteById(org.id)
    throw err
  }

  // Create free-tier subscription
  const freePlanId = await repos.organizations.findFreePlanId()
  if (freePlanId) {
    await repos.organizations.insertSubscription({
      organization_id:       org.id,
      plan_id:               freePlanId,
      status:                'trialing',
      current_period_start:  new Date().toISOString(),
      current_period_end:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      trial_end:             new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  await writeAuditLog({
    organization_id: org.id,
    user_id:         creatorUserId,
    action:          'organization.created',
    resource_type:   'organization',
    resource_id:     org.id,
    new_values:      { name: org.name, type: org.type, slug: org.slug },
  })

  return org
}

/**
 * Check whether a slug is available.
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const exists = await repos.organizations.slugExists(slug)
  return !exists
}
