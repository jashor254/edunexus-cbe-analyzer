import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { getTeacherCohorts } from '@/lib/assessments/cohortQueries'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
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

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    const cohorts = await getTeacherCohorts(teacher.id)
    return apiSuccess({ cohorts })
  } catch (e: unknown) {
    console.error('[teacher/cohorts GET]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to fetch cohorts')
  }
}
