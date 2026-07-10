// app/api/sow/kicd-context/route.ts
// GET: Return KICD enrichment data for AI generation context
// Query params: subject (learning area name, partial match)

import { createClient } from '@/utils/supabase/server'
import { repos } from '@/lib/repositories'
import { CurriculumService } from '@/lib/curriculum/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiForbidden } from '@/lib/api/response'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const url = new URL(req.url)
    const subject = url.searchParams.get('subject')?.trim()
    if (!subject) return apiBadRequest('Missing subject')

    // Curriculum data is teacher-only — students and parents have no access
    const teacher = await repos.teachers.findTeacherByUserId(user.id)
    if (!teacher) return apiForbidden()

    const context = await CurriculumService.resolveKicdContext(subject)

    return apiSuccess(context)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load KICD context'
    return apiError(message)
  }
}
