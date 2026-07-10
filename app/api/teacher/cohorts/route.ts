import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { getTeacherCohorts } from '@/lib/assessments/cohortQueries'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const cohorts = await getTeacherCohorts(teacher.id)
    return apiSuccess({ cohorts })
  } catch (e: unknown) {
    console.error('[teacher/cohorts GET]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to fetch cohorts')
  }
}
