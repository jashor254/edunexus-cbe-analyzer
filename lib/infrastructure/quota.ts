// lib/infrastructure/quota.ts
// Quota enforcement for inbound API requests.
// Reads limits from ctx.environmentConfig.quota — never hardcodes environment names.
// Billed environments (billing.enabled = true) check the org's plan quota from the DB.
// Non-billed environments use the config quota directly.

import { repos } from '@/lib/repositories'
import { startOfDayUTC } from '@/lib/i18n/formats'
import type { RequestContext } from '@/lib/environment/types'

export type QuotaResult =
  | { allowed: true }
  | { allowed: false; reason: string; limit: number; used: number }

export async function enforceQuota(
  ctx: RequestContext,
  quantity = 1
): Promise<QuotaResult> {
  const { quota, billing } = ctx.environmentConfig
  const since = startOfDayUTC().toISOString()

  let dailyLimit: number

  if (billing.enabled) {
    const org = await repos.billing.findOrgQuotaWithStatus(ctx.orgId)

    if (!org) return { allowed: false, reason: 'Organization not found', limit: 0, used: 0 }
    if (org.status === 'suspended') {
      return { allowed: false, reason: 'Organization is suspended', limit: 0, used: 0 }
    }
    dailyLimit = org.api_quota_daily
  } else {
    dailyLimit = quota.daily
  }

  const rows = await repos.billing.findDailyUsageByEnvironment(ctx.orgId, ctx.environment, 'api.request', since)
  const used = rows.reduce((sum, r) => sum + (r.quantity as number), 0)

  if (used + quantity > dailyLimit) {
    return {
      allowed: false,
      reason:  `Daily API quota exceeded`,
      limit:   dailyLimit,
      used,
    }
  }

  return { allowed: true }
}
