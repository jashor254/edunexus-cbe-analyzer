// GET /api/cron/auto-publish-holiday-plans
// Runs daily. A draft holiday plan a teacher never reviews would otherwise
// never reach a parent — same failure mode as topical assessments (teachers
// don't reliably do extra steps). After 3 days untouched, auto-publish it.
//
// GET is what Vercel Cron actually calls (it always issues a GET request to
// the scheduled path — see friday-generation/route.ts and
// generate-record-of-work/route.ts for the same convention), authenticated
// the same way those routes are: `Authorization: Bearer CRON_SECRET`. POST
// is kept, unchanged, for manual invocation/testing (its `x-cron-secret`
// header check predates this fix and is left as-is — smallest possible diff).

import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiUnauthorized, apiError } from '@/lib/api/response'
import { timingSafeEqualString } from '@/lib/api/secretCompare'
import { repos } from '@/lib/repositories'
import { emitHolidayPlanPublished } from '@/lib/holiday/planner'

const DRAFT_GRACE_DAYS = 3

async function publishStaleHolidayPlans(): Promise<{ published: number }> {
  void createServiceClient() // ensures env is configured before any repo call

  const cutoff = new Date(Date.now() - DRAFT_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const stale  = await repos.learnerIntelligence.findDraftHolidayPlansOlderThan(cutoff)

  if (stale.length === 0) return { published: 0 }

  await repos.learnerIntelligence.publishHolidayPlanIds(stale.map(p => p.id))

  // One event per plan — each can belong to a different teacher/term/year,
  // and `trigger: 'auto'` is what distinguishes this fallback from a
  // teacher-approved publish in the audit trail (see emitHolidayPlanPublished).
  for (const plan of stale) {
    emitHolidayPlanPublished({
      teacherId:  plan.teacher_id,
      term:       plan.term,
      year:       plan.year,
      studentIds: [plan.student_id],
      trigger:    'auto',
    })
  }

  return { published: stale.length }
}

export async function GET(req: Request): Promise<Response> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!timingSafeEqualString(authHeader, `Bearer ${process.env.CRON_SECRET}`)) return apiUnauthorized()

    return apiSuccess(await publishStaleHolidayPlans())
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/auto-publish-holiday-plans]', msg)
    return apiError('Failed to auto-publish holiday plans')
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const cronSecret = req.headers.get('x-cron-secret')
    if (!timingSafeEqualString(cronSecret, process.env.CRON_SECRET)) return apiUnauthorized()

    return apiSuccess(await publishStaleHolidayPlans())
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/auto-publish-holiday-plans]', msg)
    return apiError('Failed to auto-publish holiday plans')
  }
}
