// app/api/sow/grades/route.ts
// GET: Return grades for a given curriculum mode
// Query params: mode (e.g. "cbc_junior", "cbc_senior", "844_form3")

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiForbidden } from '@/lib/api/response'

const MODE_TO_CURRICULUM_TYPE: Record<string, string> = {
  cbc_senior: 'cbc_senior',
  cbc_junior: 'cbc_junior',
  '844_form3': '844',
  '844_form4': '844',
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const url = new URL(req.url)
    const mode = url.searchParams.get('mode')?.trim()
    if (!mode) return apiBadRequest('Missing mode')

    const curriculumType = MODE_TO_CURRICULUM_TYPE[mode]
    if (!curriculumType) return apiBadRequest(`Unknown mode: ${mode}`)

    const db = createServiceClient()

    // Curriculum data is teacher-only — students and parents have no access
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!teacher) return apiForbidden()

    const { data: levels, error: lvlErr } = await db
      .from('sow_levels')
      .select('id')
      .eq('curriculum_type', curriculumType)
      .order('order_index')
      .limit(1)

    if (lvlErr || !levels?.length) return apiSuccess({ grades: [] })

    const { data: grades, error: grErr } = await db
      .from('sow_grades')
      .select('id, level_id, name, numeric_grade, order_index')
      .eq('level_id', levels[0].id)
      .eq('is_active', true)
      .order('numeric_grade')

    if (grErr) return apiError('Failed to load grades')

    const response = apiSuccess({ grades: grades || [] })
    response.headers.set('Cache-Control', 'private, max-age=600, stale-while-revalidate=120')
    return response
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load grades'
    return apiError(message)
  }
}
