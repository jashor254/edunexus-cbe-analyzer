// app/api/sow/list/route.ts
// GET: List teacher's schemes with LP + RoW progress data

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
} from '@/lib/api/response'

export interface SchemeWithProgress {
  id:                 string
  learning_area:      string
  grade:              string
  term:               number
  year:               number
  status:             string
  total_lessons:      number
  total_weeks:        number
  lessons_per_week:   number
  school:             string
  curriculum_mode:    string
  created_at:         string
  lesson_plans_count: number
  latest_lp_week:     number | null
  row_count:          number
}

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

    const { data: schemes, error } = await db
      .from('schemes_of_work')
      .select(
        'id, school, grade, learning_area, term, year, curriculum_mode, total_lessons, total_weeks, lessons_per_week, created_at, status'
      )
      .eq('teacher_id', teacher.id)
      .in('status', ['active', 'saved'])
      .order('term', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[sow/list]', error)
      return apiError('Failed to fetch schemes')
    }

    const schemesWithProgress = await Promise.all(
      (schemes ?? []).map(async (s) => {
        const [lpCountRes, lpLatestRes, rowCountRes] = await Promise.all([
          db
            .from('lesson_plans')
            .select('id', { count: 'exact', head: true })
            .eq('sow_id', s.id),
          db
            .from('lesson_plans')
            .select('week_number')
            .eq('sow_id', s.id)
            .order('week_number', { ascending: false })
            .limit(1)
            .maybeSingle(),
          db
            .from('records_of_work')
            .select('id', { count: 'exact', head: true })
            .eq('scheme_id', s.id),
        ])

        return {
          id:                 s.id,
          learning_area:      s.learning_area,
          grade:              s.grade,
          term:               s.term,
          year:               s.year,
          status:             s.status,
          total_lessons:      s.total_lessons ?? 0,
          total_weeks:        s.total_weeks ?? 0,
          lessons_per_week:   s.lessons_per_week ?? 4,
          school:             s.school,
          curriculum_mode:    s.curriculum_mode,
          created_at:         s.created_at,
          lesson_plans_count: lpCountRes.count ?? 0,
          latest_lp_week:     (lpLatestRes.data as any)?.week_number ?? null,
          row_count:          rowCountRes.count ?? 0,
        } satisfies SchemeWithProgress
      })
    )

    const response = apiSuccess({ schemes: schemesWithProgress })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'List failed'
    console.error('[sow/list]', err)
    return apiError(msg)
  }
}
