// GET: List lesson plans for a SOW, optionally filtered by week
// Query params: ?sowId=xxx&week=3
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url)
    const sowId = searchParams.get('sowId')
    const week = searchParams.get('week')

    if (!sowId) return apiBadRequest('sowId is required')

    // Verify teacher owns SOW
    const { data: sow } = await db
      .from('schemes_of_work')
      .select('id, school, grade, learning_area, term, year, teacher_name, tsc_number, timeline, breaks')
      .eq('id', sowId)
      .eq('teacher_id', teacher.id)
      .single()
    if (!sow) return apiForbidden()

    let query = db
      .from('lesson_plans')
      .select('*')
      .eq('sow_id', sowId)
      .eq('teacher_id', user.id)
      .order('week_number')
      .order('lesson_number')

    if (week) query = query.eq('week_number', parseInt(week))

    const { data: plans, error } = await query
    if (error) return apiError('Failed to fetch lesson plans')

    return apiSuccess({ plans: plans || [], sow })
  } catch (err: any) {
    console.error('[lesson-plans/list]', err)
    return apiError(err.message || 'List failed')
  }
}
