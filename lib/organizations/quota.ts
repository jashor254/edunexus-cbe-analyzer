// lib/organizations/quota.ts
// Quota enforcement for API access and feature gating.
import { repos } from '@/lib/repositories'
import { startOfDayUTC } from '@/lib/i18n/formats'

export type QuotaCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string; limit: number; used: number }

/**
 * Check whether an org is within its daily API quota.
 * Call this before processing any API request.
 */
export async function checkApiQuota(
  organizationId: string,
  requestedQuantity = 1
): Promise<QuotaCheckResult> {
  // Get org quota
  const org = await repos.organizations.findApiQuota(organizationId)

  if (!org) return { allowed: false, reason: 'Organization not found', limit: 0, used: 0 }
  if (org.status === 'suspended') {
    return { allowed: false, reason: 'Organization is suspended', limit: 0, used: 0 }
  }

  const usage = await repos.organizations.findDailyUsage(
    organizationId,
    startOfDayUTC().toISOString()
  )

  const used = usage.reduce((sum, row) => sum + row.quantity, 0)

  if (used + requestedQuantity > org.api_quota_daily) {
    return {
      allowed: false,
      reason:  'Daily API quota exceeded',
      limit:   org.api_quota_daily,
      used,
    }
  }

  return { allowed: true }
}

/**
 * Record a usage event for billing / analytics.
 */
export async function recordUsage(params: {
  organization_id: string
  user_id?: string
  api_key_id?: string
  event_type: string
  resource?: string
  quantity?: number
  cost_tokens?: number
  cost_units?: number
  metadata?: Record<string, unknown>
}): Promise<void> {
  await repos.organizations.insertUsageEvent({
    organization_id: params.organization_id,
    user_id:         params.user_id ?? null,
    api_key_id:      params.api_key_id ?? null,
    event_type:      params.event_type,
    resource:        params.resource ?? null,
    quantity:        params.quantity ?? 1,
    cost_tokens:     params.cost_tokens ?? 0,
    cost_units:      params.cost_units ?? 0,
    metadata:        params.metadata ?? {},
  })
}

/**
 * Get the current plan's feature set for an org.
 * Used to gate features in components and API routes.
 */
export async function getOrgFeatures(organizationId: string): Promise<{
  features: string[]
  plan: string
  status: string
}> {
  const data = await repos.organizations.findOrgFeatures(organizationId)

  if (!data) {
    return { features: [], plan: 'free', status: 'unknown' }
  }

  const raw = data.subscription_plans
  const plan = (Array.isArray(raw) ? raw[0] : raw) as { name: string; features: string[] } | null

  return {
    features: plan?.features ?? [],
    plan:     plan?.name ?? 'free',
    status:   data.status,
  }
}

/**
 * Check whether an org has a specific feature enabled.
 */
export async function hasFeature(
  organizationId: string,
  feature: string
): Promise<boolean> {
  const { features } = await getOrgFeatures(organizationId)
  return features.includes(feature)
}
