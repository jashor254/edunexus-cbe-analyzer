// app/api/sow/grades/route.ts
// GET: Return grades for a given curriculum mode
// Query params: mode (e.g. "cbc_junior", "cbc_senior", "844_form3")

import { createClient } from '@/utils/supabase/server'
import { repos } from '@/lib/repositories'
import { CurriculumService } from '@/lib/curriculum/service'
import { resolveCurriculumType } from '@/lib/curriculum/curriculumMode'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiForbidden } from '@/lib/api/response'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const url = new URL(req.url)
    const mode = url.searchParams.get('mode')?.trim()
    if (!mode) return apiBadRequest('Missing mode')

    if (!resolveCurriculumType(mode)) return apiBadRequest(`Unknown mode: ${mode}`)

    // Curriculum data is teacher-only — students and parents have no access
    const teacher = await repos.teachers.findTeacherByUserId(user.id)
    if (!teacher) return apiForbidden()

    const grades = await CurriculumService.resolveGradesForMode(mode)

    const response = apiSuccess({ grades })
    response.headers.set('Cache-Control', 'private, max-age=600, stale-while-revalidate=120')
    return response
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load grades'
    return apiError(message)
  }
}
