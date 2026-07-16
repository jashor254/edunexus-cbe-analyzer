import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { getAssessmentAnalytics } from '@/lib/assessments/analytics'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'
import { resolveTeacherGradeBoundaries } from '@/lib/core/school'

export async function GET(req: Request) {
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

    const url            = new URL(req.url)
    const term           = url.searchParams.get('term')   ?? undefined
    const yearRaw        = url.searchParams.get('year')
    const year           = yearRaw ? parseInt(yearRaw, 10) : undefined
    const assessmentType = url.searchParams.get('type')   ?? undefined

    const gradeBoundaries = await resolveTeacherGradeBoundaries(teacher.id)
    const analytics = await getAssessmentAnalytics(teacher.id, { term, year, assessmentType }, gradeBoundaries)
    return apiSuccess({ analytics })
  } catch (e: unknown) {
    console.error('[teacher/analytics GET]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to fetch analytics')
  }
}
