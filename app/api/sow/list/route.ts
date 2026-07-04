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
import { timedQuery } from '@/lib/observability/queryTiming'

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

    const { data: schemes, error } = await timedQuery('schemes_of_work', 'listByTeacher', async () => db
      .from('schemes_of_work')
      .select(
        'id, school, grade, learning_area, term, year, curriculum_mode, total_lessons, total_weeks, lessons_per_week, created_at, status'
      )
      .eq('teacher_id', teacher.id)
      .in('status', ['active', 'saved'])
      .order('term', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50))

    if (error) {
      console.error('[sow/list]', error)
      return apiError('Failed to fetch schemes')
    }

    if (!schemes?.length) return apiSuccess({ schemes: [] })

    // Batch fetch LP counts, latest weeks, and RoW counts — 3 queries total instead of 3N
    const sowIds = schemes.map(s => s.id)

    const [{ data: lpRows }, { data: lpWeekRows }, { data: rowRows }] = await Promise.all([
      db.from('lesson_plans').select('sow_id').in('sow_id', sowIds),
      db.from('lesson_plans').select('sow_id, week_number').in('sow_id', sowIds).order('week_number', { ascending: false }),
      db.from('records_of_work').select('scheme_id').in('scheme_id', sowIds),
    ])

    // Aggregate in memory
    const lpCountBySow: Record<string, number> = {}
    for (const r of lpRows ?? []) {
      lpCountBySow[r.sow_id] = (lpCountBySow[r.sow_id] ?? 0) + 1
    }

    const latestWeekBySow: Record<string, number> = {}
    for (const r of lpWeekRows ?? []) {
      // lpWeekRows is ordered desc — first encounter per sow_id is the latest
      if (!(r.sow_id in latestWeekBySow)) {
        latestWeekBySow[r.sow_id] = r.week_number as number
      }
    }

    const rowCountBySow: Record<string, number> = {}
    for (const r of rowRows ?? []) {
      rowCountBySow[r.scheme_id] = (rowCountBySow[r.scheme_id] ?? 0) + 1
    }

    const schemesWithProgress: SchemeWithProgress[] = schemes.map(s => ({
      id:                 s.id,
      learning_area:      s.learning_area,
      grade:              s.grade,
      term:               s.term,
      year:               s.year,
      status:             s.status,
      total_lessons:      s.total_lessons  ?? 0,
      total_weeks:        s.total_weeks    ?? 0,
      lessons_per_week:   s.lessons_per_week ?? 4,
      school:             s.school,
      curriculum_mode:    s.curriculum_mode,
      created_at:         s.created_at,
      lesson_plans_count: lpCountBySow[s.id]   ?? 0,
      latest_lp_week:     latestWeekBySow[s.id] ?? null,
      row_count:          rowCountBySow[s.id]   ?? 0,
    }))

    const response = apiSuccess({ schemes: schemesWithProgress })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'List failed'
    console.error('[sow/list]', err)
    return apiError(msg)
  }
}
