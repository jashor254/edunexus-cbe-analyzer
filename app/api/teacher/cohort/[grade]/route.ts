import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { getCohortData } from '@/lib/assessments/cohortQueries'

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const cohort = await getCohortData(teacher.id, grade, term, year)
    if (!cohort) return apiNotFound('No cohort data found for this grade / term / year')

    return apiSuccess({ cohort })
  } catch (e: unknown) {
    console.error('[cohort GET]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to fetch cohort data')
  }
}
