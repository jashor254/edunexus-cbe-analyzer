// app/api/sow/learning-areas/route.ts
// GET: Return learning areas (subjects) for a given grade + curriculum mode
// Query params: grade (e.g. "Grade 7", "Form 3"), mode (e.g. "cbc_junior", "844_form3")

import { createClient } from '@/utils/supabase/server'
import { repos } from '@/lib/repositories'
import { CurriculumService } from '@/lib/curriculum/service'
import { resolveCurriculumType } from '@/lib/curriculum/curriculumMode'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import type { CurriculumMode } from '@/lib/sow/types'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const url = new URL(req.url)
    const grade = url.searchParams.get('grade')?.trim()
    const mode = url.searchParams.get('mode')?.trim() as CurriculumMode | null

    if (!grade || !mode) return apiBadRequest('Missing grade or mode')

    if (!resolveCurriculumType(mode)) return apiBadRequest(`Unknown mode: ${mode}`)

    // Curriculum data is teacher-only — students and parents have no access
    const teacher = await repos.teachers.findTeacherByUserId(user.id)
    if (!teacher) return apiForbidden()

    const areas = await CurriculumService.resolveLearningAreasForGrade(mode, grade)

    const response = apiSuccess({ areas })
    response.headers.set('Cache-Control', 'private, max-age=600, stale-while-revalidate=120')
    return response
  } catch (err: unknown) {
    console.error('[sow/learning-areas]', err)
    return apiError(err instanceof Error ? err.message : 'Failed to load learning areas')
  }
}
