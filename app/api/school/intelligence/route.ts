// GET /api/school/intelligence
// Returns the full principal dashboard for the authenticated teacher's school.
// The teacher must belong to a school via the Core School `school_users` table.
// All output is anonymised — no individual student PII.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { repos } from '@/lib/repositories'
import { buildPrincipalDashboard } from '@/lib/school/intelligence'
import type { PrincipalDashboard } from '@/lib/school/types'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'

type IntelligenceResponse = {
  dashboard: PrincipalDashboard
}

export async function GET(): Promise<Response> {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    // Caller must be a teacher (this endpoint is teacher/school-staff facing,
    // not for parents — school_users also has a 'parent' role).
    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    const schoolUser = await repos.schools.findSchoolUserByUserId(userId)
    if (!schoolUser) return apiError('Teacher is not associated with a school', 403)

    const dashboard = await buildPrincipalDashboard(schoolUser.school_id)

    return apiSuccess<IntelligenceResponse>({ dashboard })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[school/intelligence]', msg)
    return apiError('Failed to load school intelligence')
  }
}
