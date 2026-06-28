// GET /api/school/intelligence
// Returns the full principal dashboard for the authenticated teacher's school.
// The teacher must belong to a school (school_name on their teacher record).
// All output is anonymised — no individual student PII.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
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

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id, school_name')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    const schoolId = teacher.school_name as string | null
    if (!schoolId) return apiError('Teacher is not associated with a school', 403)

    const dashboard = await buildPrincipalDashboard(schoolId)

    return apiSuccess<IntelligenceResponse>({ dashboard })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[school/intelligence]', msg)
    return apiError('Failed to load school intelligence')
  }
}
