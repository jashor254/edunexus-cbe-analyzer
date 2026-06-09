// app/api/sow/learning-areas/route.ts
// GET: Return learning areas (subjects) for a given grade + curriculum mode
// Query params: grade (e.g. "Grade 7", "Form 3"), mode (e.g. "cbc_junior", "844_form3")

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiBadRequest,
} from '@/lib/api/response'
import type { CurriculumMode } from '@/lib/sow/types'

const MODE_TO_CURRICULUM_TYPE: Record<string, string> = {
  cbc_senior: 'cbc_senior',
  cbc_junior: 'cbc_junior',
  '844_form3': '844',
  '844_form4': '844',
}

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

    const curriculumType = MODE_TO_CURRICULUM_TYPE[mode]
    if (!curriculumType) return apiBadRequest(`Unknown mode: ${mode}`)

    const db = createServiceClient()

    // 1. Find the primary level for this curriculum type
    const { data: levels, error: lvlErr } = await db
      .from('sow_levels')
      .select('id')
      .eq('curriculum_type', curriculumType)
      .order('order_index')
      .limit(1)

    if (lvlErr || !levels?.length) {
      console.error('[sow/learning-areas] level lookup:', lvlErr)
      return apiSuccess({ areas: [] })
    }

    // 2. Find the grade row — match on name starting with the given grade string
    //    Handles both "Grade 7" and "Grade 7 (JSS)" in the DB
    const { data: gradeRows, error: grErr } = await db
      .from('sow_grades')
      .select('id')
      .eq('level_id', levels[0].id)
      .eq('is_active', true)
      .ilike('name', `${grade}%`)
      .order('order_index')
      .limit(1)

    if (grErr || !gradeRows?.length) {
      console.error('[sow/learning-areas] grade lookup:', grErr, { grade, curriculumType })
      return apiSuccess({ areas: [] })
    }

    // 3. Fetch learning areas for that grade
    const { data: areas, error: aErr } = await db
      .from('sow_learning_areas')
      .select('id, name')
      .eq('grade_id', gradeRows[0].id)
      .order('order_index')

    if (aErr) {
      console.error('[sow/learning-areas] areas fetch:', aErr)
      return apiError('Failed to load subjects')
    }

    const response = apiSuccess({ areas: areas || [] })
    response.headers.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=120')
    return response
  } catch (err: unknown) {
    console.error('[sow/learning-areas]', err)
    return apiError(err instanceof Error ? err.message : 'Failed to load learning areas')
  }
}
