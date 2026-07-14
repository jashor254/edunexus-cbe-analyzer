// app/api/reports/report-card/route.ts
// Lets a parent view their child's published Core report card. Core's
// Learner model has no auth-user link of its own (see
// lib/compass/ownership.ts's note on Core identity convergence being out of
// scope pre-Phase 11) — learner_guardians.user_id is the only existing
// bridge, so that's the ownership check reused here. Same "same response for
// not-found vs not-yours" discipline as app/api/reports/clinic/[reportId]/url/route.ts.

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { getReportCard } from '@/lib/core/report-cards'
import { repos } from '@/lib/repositories'

const QuerySchema = z.object({
  learnerId: z.string().uuid(),
  termId:    z.string().uuid(),
})

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const parsed = QuerySchema.safeParse({
      learnerId: req.nextUrl.searchParams.get('learnerId'),
      termId:    req.nextUrl.searchParams.get('termId'),
    })
    if (!parsed.success) return apiBadRequest('learnerId and termId (uuid) are required')
    const { learnerId, termId } = parsed.data

    const guardianLink = await repos.schools.findGuardianLink(learnerId, user.id)
    if (!guardianLink) return apiForbidden()

    const report = await getReportCard(learnerId, termId)
    if (!report || !report.is_published) return apiError('Report card not available', 404)

    return apiSuccess({ report })
  } catch (err) {
    console.error('[reports/report-card GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
