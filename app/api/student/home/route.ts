// app/api/student/home/route.ts
// Single endpoint powering the learner Home surface (Phase 7 — Learner Home
// Convergence). Thin route: auth + delegate to
// lib/studentHome/composeStudentHome.ts, which composes the view model from
// existing canonical reads only (Projection, assignments, approved+delivered
// Blueprint actions, Compass sessions) — no new intelligence here.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { composeStudentHome, StudentProfileNotFoundError } from '@/lib/studentHome/composeStudentHome'

export type { LearnerHomeView as StudentHomeData } from '@/lib/studentHome/types'

export async function GET(): Promise<Response> {
  try {
    const auth = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(auth)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiError('Unauthenticated', 401)
      throw err
    }

    const data = await composeStudentHome(userId)
    return apiSuccess(data)
  } catch (err) {
    if (err instanceof StudentProfileNotFoundError) return apiError('No student profile found', 404)
    const msg = err instanceof Error ? err.message : String(err)
    return apiError(msg, 500)
  }
}
