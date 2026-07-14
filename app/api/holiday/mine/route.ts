// app/api/holiday/mine/route.ts
// The student-facing counterpart to the Blueprint's holiday-guidance section
// (lib/learnerIntelligence/blueprint.ts) — same relevance window, same
// underlying repository call, just returned directly instead of folded into
// a Blueprint insight.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { resolveCompassStudentAccess } from '@/lib/compass/ownership'
import { repos } from '@/lib/repositories'
import { HOLIDAY_PLAN_RELEVANCE_DAYS } from '@/lib/holiday/types'

export async function GET(req: Request): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    if (!studentId) return apiBadRequest('studentId required')

    const ownership = await resolveCompassStudentAccess(user.id, studentId)
    if (!ownership.allowed) return apiForbidden()

    const since = new Date(Date.now() - HOLIDAY_PLAN_RELEVANCE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const plan = await repos.learnerIntelligence.findPublishedHolidayPlan(studentId, since)

    return apiSuccess({ plan })
  } catch (err) {
    console.error('[holiday/mine GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
