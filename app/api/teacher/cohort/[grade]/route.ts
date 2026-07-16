import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { getCohortData } from '@/lib/assessments/cohortQueries'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'
import { resolveTeacherGradeBoundaries } from '@/lib/core/school'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ grade: string }> }
) {
  try {
    const { grade: gradeParam } = await params
    const grade = parseInt(gradeParam, 10)
    if (isNaN(grade) || grade < 7 || grade > 12) return apiBadRequest('Invalid grade')

    const url  = new URL(req.url)
    const term = url.searchParams.get('term')
    const year = parseInt(url.searchParams.get('year') ?? '', 10)

    if (!term || !['1', '2', '3'].includes(term)) return apiBadRequest('term must be 1, 2 or 3')
    if (isNaN(year)) return apiBadRequest('year is required')

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

    const gradeBoundaries = await resolveTeacherGradeBoundaries(teacher.id)
    const cohort = await getCohortData(teacher.id, grade, term, year, gradeBoundaries)
    if (!cohort) return apiNotFound('No cohort data found for this grade / term / year')

    return apiSuccess({ cohort })
  } catch (e: unknown) {
    console.error('[cohort GET]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to fetch cohort data')
  }
}
