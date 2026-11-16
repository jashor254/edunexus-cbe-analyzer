// GET /api/cron/auto-publish-holiday-plans
// STATUS (HLG-05): DISABLED BY DEFAULT and NO LONGER SCHEDULED (removed from
// vercel.json). See isHolidayAutoPublishEnabled() below.
// Originally: runs daily. A draft holiday plan a teacher never reviews would
// otherwise never reach a parent — same failure mode as topical assessments
// (teachers don't reliably do extra steps). After 3 days untouched, auto-publish it.
//
// GET is what Vercel Cron actually calls (it always issues a GET request to
// the scheduled path — see friday-generation/route.ts and
// generate-record-of-work/route.ts for the same convention), authenticated
// the same way those routes are: `Authorization: Bearer CRON_SECRET`. POST
// is kept, unchanged, for manual invocation/testing (its `x-cron-secret`
// header check predates this fix and is left as-is — smallest possible diff).

import { apiSuccess, apiUnauthorized, apiError } from '@/lib/api/response'
import { timingSafeEqualString } from '@/lib/api/secretCompare'
import { repos } from '@/lib/repositories'
import { emitHolidayPlanPublished } from '@/lib/holiday/planner'

const DRAFT_GRACE_DAYS = 3

// HLG-05 containment — automatic publication of holiday plans is DISABLED by
// default. A teacher-unreviewed plan must never become parent-/learner-visible
// unless this mechanism is deliberately switched on. The ONLY enabling value is
// the exact string 'true' (lowercase, no whitespace) in
// HOLIDAY_AUTO_PUBLISH_ENABLED; unset, empty, 'TRUE', '1', 'yes', ' true' and
// every other value mean disabled. Read per request, never cached.
// When disabled the handler returns BEFORE any repository call: nothing is
// selected, published, or emitted. Auth (CRON_SECRET) is still checked first,
// so unauthorized callers get 401 whether or not the flag is on. Both GET and
// POST share publishStaleHolidayPlans(), so both are gated identically.
// (This file may only export route handlers — Next.js — so the flag stays
// internal; tests drive it through GET/POST.)
function isHolidayAutoPublishEnabled(): boolean {
  return process.env.HOLIDAY_AUTO_PUBLISH_ENABLED === 'true'
}

// HLG-05B — authentication fails CLOSED when the server-side secret is not
// usably configured. Previously GET compared the Authorization header against
// the template `Bearer ${process.env.CRON_SECRET}`; with CRON_SECRET unset that
// template becomes the literal "Bearer undefined", so any caller sending that
// header authenticated. A secret that is unset, empty, whitespace-only, or the
// literal strings "undefined"/"null" (the classic result of a missing or
// mis-templated environment variable) is treated as "not configured": no
// request authenticates. A well-formed secret is compared exactly as before
// (timing-safe, no trimming). The secret is never logged or returned.
function configuredCronSecret(): string | null {
  const secret = process.env.CRON_SECRET
  if (typeof secret !== 'string') return null
  const trimmed = secret.trim()
  if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return null
  return secret
}

function isAuthorizedGet(req: Request): boolean {
  const secret = configuredCronSecret()
  if (secret === null) return false
  return timingSafeEqualString(req.headers.get('authorization'), `Bearer ${secret}`)
}

function isAuthorizedPost(req: Request): boolean {
  const secret = configuredCronSecret()
  if (secret === null) return false
  return timingSafeEqualString(req.headers.get('x-cron-secret'), secret)
}

async function publishStaleHolidayPlans(): Promise<{ published: number; disabled?: true }> {
  if (!isHolidayAutoPublishEnabled()) return { published: 0, disabled: true }

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
    if (!isAuthorizedGet(req)) return apiUnauthorized()

    return apiSuccess(await publishStaleHolidayPlans())
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/auto-publish-holiday-plans]', msg)
    return apiError('Failed to auto-publish holiday plans')
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    if (!isAuthorizedPost(req)) return apiUnauthorized()

    return apiSuccess(await publishStaleHolidayPlans())
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/auto-publish-holiday-plans]', msg)
    return apiError('Failed to auto-publish holiday plans')
  }
}
