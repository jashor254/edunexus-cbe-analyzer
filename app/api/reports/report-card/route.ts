// app/api/reports/report-card/route.ts
// Lets a parent view their child's published Core report card. Core's
// Learner model has no auth-user link of its own (see
// lib/compass/ownership.ts's note on Core identity convergence being out of
// scope pre-Phase 11) — learner_guardians.user_id is the only existing
// bridge, so that's the ownership check reused here (via the canonical
// `requireParent`, which checks both the legacy students.parent_user_id link
// and Core's learner_guardians — the legacy check can never spuriously match
// here since `learnerId` is a Core learners.id, a disjoint UUID space from
// students.id, so this is not a weakening of the guardian-link check).
// Same "same response for not-found vs not-yours" discipline as
// app/api/reports/clinic/[reportId]/url/route.ts.

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { getReportCard } from '@/lib/core/report-cards'
import { requireParent } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { asLearnerId } from '@/lib/core/identityTypes'

const QuerySchema = z.object({
  learnerId: z.string().uuid(),
  termId:    z.string().uuid(),
})

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    const parsed = QuerySchema.safeParse({
      learnerId: req.nextUrl.searchParams.get('learnerId'),
      termId:    req.nextUrl.searchParams.get('termId'),
    })
    if (!parsed.success) return apiBadRequest('learnerId and termId (uuid) are required')
    const { learnerId, termId } = parsed.data

    try {
      await requireParent(supabase, asLearnerId(learnerId))
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (isEduNexusError(err)) return apiForbidden()
      throw err
    }

    const report = await getReportCard(learnerId, termId)
    if (!report || !report.is_published) return apiError('Report card not available', 404)

    return apiSuccess({ report })
  } catch (err) {
    console.error('[reports/report-card GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
