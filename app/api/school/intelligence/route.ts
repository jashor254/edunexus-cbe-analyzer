// GET /api/school/intelligence
// Returns the full principal dashboard for the authenticated teacher's school.
// The teacher must belong to a school via the Core School `school_users` table.
// All output is anonymised — no individual student PII.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { repos } from '@/lib/repositories'
import { buildPrincipalDashboard } from '@/lib/school/intelligence'
import type { PrincipalDashboard } from '@/lib/school/types'

type IntelligenceResponse = {
  dashboard: PrincipalDashboard
}

export async function GET(): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    // Caller must be a teacher (this endpoint is teacher/school-staff facing,
    // not for parents — school_users also has a 'parent' role).
    const teacher = await repos.teachers.findTeacherByUserId(user.id)
    if (!teacher) return apiForbidden()

    const schoolUser = await repos.schools.findSchoolUserByUserId(user.id)
    if (!schoolUser) return apiError('Teacher is not associated with a school', 403)

    const dashboard = await buildPrincipalDashboard(schoolUser.school_id)

    return apiSuccess<IntelligenceResponse>({ dashboard })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[school/intelligence]', msg)
    return apiError('Failed to load school intelligence')
  }
}
