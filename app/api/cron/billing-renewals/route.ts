// GET /api/cron/billing-renewals
// Runs daily at 01:00 UTC.
// Downgrades orgs whose trial has expired to free plan.
// Also marks subscriptions as 'past_due' when period has ended with no renewal.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { logger } from '@/lib/observability/logger'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db  = createServiceClient()
  const now = new Date().toISOString()
  let downgrades = 0
  let past_due   = 0

  try {
    // 1. Expired trials → cancel + switch to free
    const { data: expiredTrials } = await db
      .from('organization_subscriptions')
      .select('id, organization_id, plan_id')
      .eq('status', 'trialing')
      .lt('trial_ends_at', now)

    if (expiredTrials?.length) {
      const { data: freePlan } = await db
        .from('subscription_plans')
        .select('id, api_quota_daily, api_quota_monthly')
        .eq('name', 'free')
        .single()

      if (freePlan) {
        const trialIds = expiredTrials.map(s => s.id)
        const orgIds   = expiredTrials.map(s => s.organization_id)

        // Bulk update — single query instead of 2 queries per expired trial
        await Promise.all([
          db.from('organization_subscriptions')
            .update({ plan_id: freePlan.id, status: 'active', updated_at: now })
            .in('id', trialIds),
          db.from('organizations')
            .update({
              api_quota_daily:   freePlan.api_quota_daily,
              api_quota_monthly: freePlan.api_quota_monthly,
              updated_at:        now,
            })
            .in('id', orgIds),
        ])

        downgrades = expiredTrials.length
      }
    }

    // 2. Active subscriptions past period end → mark past_due
    const { data: overdue } = await db
      .from('organization_subscriptions')
      .select('id')
      .eq('status', 'active')
      .not('current_period_end', 'is', null)
      .lt('current_period_end', now)

    if (overdue?.length) {
      await db
        .from('organization_subscriptions')
        .update({ status: 'past_due', updated_at: now })
        .in('id', overdue.map(s => s.id))

      past_due = overdue.length
    }

    logger.info('billing-renewals completed', { downgrades, past_due })
    return NextResponse.json({ ok: true, downgrades, past_due })
  } catch (err) {
    logger.error('billing-renewals failed', { error: err })
    return NextResponse.json({ error: 'Billing renewals failed' }, { status: 500 })
  }
}
