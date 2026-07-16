// app/api/reports/report-card/mine/route.ts
// Lists the Core learners the caller is a registered guardian for, plus each
// school's current term — drives the report-card selector on
// app/(parent)/report-card. Ownership is the same learner_guardians link
// used by GET /api/reports/report-card. No separate ownership check beyond
// authentication is needed here — the query is inherently self-scoped by
// user.id, same as the original.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { repos } from '@/lib/repositories'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'

export async function GET() {
  try {
    const supabase = await createClient()

    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const learners = await repos.schools.listGuardianLearners(userId)
    const schoolIds = [...new Set(learners.map(l => l.school_id))]
    const currentTerms = await repos.schools.findCurrentTermsForSchools(schoolIds)
    const termBySchool = new Map(currentTerms.map(t => [t.school_id, t.id]))

    const withTerms = learners.map(learner => ({
      ...learner,
      currentTermId: termBySchool.get(learner.school_id) ?? null,
    }))

    return apiSuccess({ learners: withTerms })
  } catch (err) {
    console.error('[reports/report-card/mine GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
