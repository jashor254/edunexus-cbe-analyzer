// lib/infrastructure/analytics.ts
// Usage recording for metering, billing, and analytics.
// Reads ctx.environmentConfig.analytics to decide what to track and tag.
// The environment tag on each row is what separates sandbox from live
// in dashboards and billing aggregations.

import { repos } from '@/lib/repositories'
import type { RequestContext } from '@/lib/environment/types'

export type RecordUsageParams = {
  event_type:    string
  resource?:     string
  quantity?:     number
  cost_tokens?:  number
  cost_units?:   number
  metadata?:     Record<string, unknown>
}

export async function recordUsage(
  ctx: RequestContext,
  params: RecordUsageParams
): Promise<void> {
  if (!ctx.environmentConfig.analytics.trackUsage) return

  await repos.analytics.insertUsageEvent(ctx, params)
}
