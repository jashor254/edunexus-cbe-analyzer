// GET /api/cron/quota-alerts
// Runs hourly. Publishes quota-warning events for orgs approaching limits.
// Consumers (WhatsApp / email) subscribe to org.quota.warning via event bus.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { publishEvent } from '@/lib/events/publish'
import { logger } from '@/lib/observability/logger'
import { timingSafeEqualString } from '@/lib/api/secretCompare'

const DAILY_WARN_PCT  = 80   // warn at 80% of daily quota
const MONTHLY_WARN_PCT = 85  // warn at 85% of monthly quota

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!timingSafeEqualString(secret, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  let alerts = 0

  try {
    // Pull all active orgs with their quotas
    const { data: orgs } = await db
      .from('organizations')
      .select('id, api_quota_daily, api_quota_monthly')
      .eq('status', 'active')

    if (!orgs?.length) {
      return NextResponse.json({ ok: true, alerts: 0 })
    }

    const orgIds = orgs.map(o => o.id)

    // Today's usage per org
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const thisMonth = new Date()
    thisMonth.setUTCDate(1)
    thisMonth.setUTCHours(0, 0, 0, 0)

    const { data: usage } = await db
      .from('usage_events')
      .select('organization_id, quantity')
      .in('organization_id', orgIds)
      .eq('event_type', 'api.request')
      .gte('recorded_at', thisMonth.toISOString())

    // Aggregate per org
    const dailyUsage   = new Map<string, number>()
    const monthlyUsage = new Map<string, number>()

    const todayStr = today.toISOString()

    for (const ev of usage ?? []) {
      const orgId = ev.organization_id as string
      const qty   = ev.quantity as number
      monthlyUsage.set(orgId, (monthlyUsage.get(orgId) ?? 0) + qty)
      // We can't filter by date in this query easily — approximate by checking if recorded_at >= today
      // The actual per-day check happens in checkApiQuota; this is just an alerting approximation
    }

    // Daily usage (separate query, last 24h)
    const { data: dailyData } = await db
      .from('usage_events')
      .select('organization_id, quantity')
      .in('organization_id', orgIds)
      .eq('event_type', 'api.request')
      .gte('recorded_at', todayStr)

    for (const ev of dailyData ?? []) {
      const orgId = ev.organization_id as string
      dailyUsage.set(orgId, (dailyUsage.get(orgId) ?? 0) + (ev.quantity as number))
    }

    for (const org of orgs) {
      const daily   = dailyUsage.get(org.id)   ?? 0
      const monthly = monthlyUsage.get(org.id) ?? 0

      const dailyPct   = org.api_quota_daily   > 0 ? (daily   / org.api_quota_daily)   * 100 : 0
      const monthlyPct = org.api_quota_monthly > 0 ? (monthly / org.api_quota_monthly) * 100 : 0

      if (dailyPct >= DAILY_WARN_PCT || monthlyPct >= MONTHLY_WARN_PCT) {
        await publishEvent({
          organization_id: org.id,
          event_type:      'org.quota.warning',
          resource_type:   'organization',
          resource_id:     org.id,
          payload: {
            daily_used:   daily,
            daily_quota:  org.api_quota_daily,
            daily_pct:    Math.round(dailyPct),
            monthly_used: monthly,
            monthly_quota:org.api_quota_monthly,
            monthly_pct:  Math.round(monthlyPct),
          },
        })
        alerts++
      }
    }

    logger.info('quota-alerts completed', { orgs_checked: orgs.length, alerts })
    return NextResponse.json({ ok: true, orgs_checked: orgs.length, alerts })
  } catch (err) {
    logger.error('quota-alerts failed', { error: err })
    return NextResponse.json({ error: 'Quota alerts failed' }, { status: 500 })
  }
}
