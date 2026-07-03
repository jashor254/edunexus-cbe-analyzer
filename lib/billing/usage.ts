import { repos } from '@/lib/repositories'
import type { UsageSummary, Invoice } from './types'

export async function getUsageSummary(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<UsageSummary> {
  const [quota, events] = await Promise.all([
    repos.billing.findOrgQuota(organizationId),
    repos.billing.findUsageEvents(organizationId, periodStart, periodEnd),
  ])

  const quota_daily   = quota.api_quota_daily   ?? 100
  const quota_monthly = quota.api_quota_monthly ?? 1000

  const by_event_type: Record<string, number> = {}
  let total_api_requests = 0
  let total_ai_tokens    = 0

  for (const ev of events) {
    const qty = ev.quantity as number
    const type = ev.event_type as string
    by_event_type[type] = (by_event_type[type] ?? 0) + qty

    if (type === 'api.request') total_api_requests += qty
    if (type === 'ai.tokens')   total_ai_tokens    += qty
  }

  // Today's usage for daily %
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayEvents = await repos.billing.findTodayUsage(organizationId, 'api.request', today)
  const today_api = todayEvents.reduce((s, r) => s + (r.quantity as number), 0)

  const period = `${periodStart.toISOString().slice(0, 10)} – ${periodEnd.toISOString().slice(0, 10)}`

  return {
    period,
    total_api_requests,
    total_ai_tokens,
    by_event_type,
    quota_daily,
    quota_monthly,
    percent_daily_used:   quota_daily   > 0 ? Math.round((today_api            / quota_daily)   * 100) : 0,
    percent_monthly_used: quota_monthly > 0 ? Math.round((total_api_requests   / quota_monthly) * 100) : 0,
  }
}

export async function getInvoices(
  organizationId: string,
  limit = 12
): Promise<Invoice[]> {
  return repos.billing.findInvoices(organizationId, limit)
}

export { startOfMonthUTC as getCurrentMonthStart } from '@/lib/i18n/formats'
