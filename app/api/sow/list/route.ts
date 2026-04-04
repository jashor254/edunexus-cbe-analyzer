// app/api/sow/list/route.ts
// GET: List teacher's saved schemes of work

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
} from '@/lib/api/response'

export async function GET() {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    // ── Fetch schemes ─────────────────────────────────────────────────────────
    const { data: schemes, error } = await db
      .from('schemes_of_work')
      .select(
        'id, school, grade, learning_area, term, year, curriculum_mode, total_lessons, average_confidence, created_at, status'
      )
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[sow/list]', error)
      return apiError('Failed to fetch schemes')
    }

    return apiSuccess({ schemes: schemes || [] })
  } catch (err: any) {
    console.error('[sow/list]', err)
    return apiError(err.message || 'List failed')
  }
}
