import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id, full_name, school')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    const { data: alerts, error } = await db
      .from('student_alerts')
      .select(`
        *,
        students(name, grade)
      `)
      .eq('teacher_id', teacher.id)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })

    if (error) return apiError('Failed to fetch alerts')

    // Categorize
    const critical = (alerts || []).filter((a: any) =>
      a.alert_type === 'inactive' || a.alert_type === 'holiday_inactive'
    )
    const warning = (alerts || []).filter((a: any) =>
      a.alert_type === 'declining_scores' || a.alert_type === 'repeated_struggles'
    )
    const overdue = (alerts || []).filter((a: any) =>
      a.alert_type === 'assignment_overdue'
    )

    return apiSuccess({ alerts: alerts || [], critical, warning, overdue })
  } catch (e: any) {
    console.error('[teacher/alerts GET]', e.message)
    return apiError('Internal server error')
  }
}

export async function POST(req: Request) {
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

    const body = await req.json()
    const { alertId, action } = body

    if (!alertId) return apiError('alertId is required', 400)

    if (action === 'resolve') {
      const { error } = await db
        .from('student_alerts')
        .update({ is_resolved: true })
        .eq('id', alertId)
        .eq('teacher_id', teacher.id)

      if (error) return apiError('Failed to resolve alert')
      return apiSuccess({ resolved: true })
    }

    return apiError('Unknown action', 400)
  } catch (e: any) {
    console.error('[teacher/alerts POST]', e.message)
    return apiError('Internal server error')
  }
}
