// POST /api/cron/auto-publish-holiday-plans
// Runs daily. A draft holiday plan a teacher never reviews would otherwise
// never reach a parent — same failure mode as topical assessments (teachers
// don't reliably do extra steps). After 3 days untouched, auto-publish it.
// Protected by cron secret.

import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiUnauthorized, apiError } from '@/lib/api/response'
import { timingSafeEqualString } from '@/lib/api/secretCompare'
import { repos } from '@/lib/repositories'

const DRAFT_GRACE_DAYS = 3

export async function POST(req: Request): Promise<Response> {
  try {
    const cronSecret = req.headers.get('x-cron-secret')
    if (!timingSafeEqualString(cronSecret, process.env.CRON_SECRET)) return apiUnauthorized()

    void createServiceClient() // ensures env is configured before any repo call

    const cutoff = new Date(Date.now() - DRAFT_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const stale  = await repos.learnerIntelligence.findDraftHolidayPlansOlderThan(cutoff)

    if (stale.length === 0) return apiSuccess({ published: 0 })

    await repos.learnerIntelligence.publishHolidayPlanIds(stale.map(p => p.id))

    return apiSuccess({ published: stale.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/auto-publish-holiday-plans]', msg)
    return apiError('Failed to auto-publish holiday plans')
  }
}
