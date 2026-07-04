import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { notifyAlertCreated } from '@/lib/notifications/notify'

const AlertActionSchema = z.union([
  z.object({
    action:    z.literal('create'),
    studentId: z.string().uuid(),
    alertType: z.string().min(1),
    message:   z.string().min(1),
  }),
  z.object({
    action:  z.literal('resolve'),
    alertId: z.string().uuid(),
  }),
])

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
    type Alert = { alert_type: string }
    const critical = (alerts || []).filter((a: Alert) =>
      a.alert_type === 'inactive' || a.alert_type === 'holiday_inactive'
    )
    const warning = (alerts || []).filter((a: Alert) =>
      a.alert_type === 'declining_scores' || a.alert_type === 'repeated_struggles'
    )
    const overdue = (alerts || []).filter((a: Alert) =>
      a.alert_type === 'assignment_overdue'
    )

    return apiSuccess({ alerts: alerts || [], critical, warning, overdue })
  } catch (e: unknown) {
    console.error('[teacher/alerts GET]', e instanceof Error ? e.message : String(e))
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

    const parsed = AlertActionSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    if (parsed.data.action === 'create') {
      const { studentId, alertType, message } = parsed.data

      const { data: alert, error } = await db
        .from('student_alerts')
        .insert({
          student_id: studentId,
          teacher_id: teacher.id,
          alert_type: alertType,
          message,
          is_resolved: false,
        })
        .select('id')
        .single()

      if (error || !alert) return apiError('Failed to create alert')

      notifyAlertCreated(alert.id)
        .catch(err => console.error('[notify] alert:', err))

      return apiSuccess({ alert })
    }

    const { error } = await db
      .from('student_alerts')
      .update({ is_resolved: true })
      .eq('id', parsed.data.alertId)
      .eq('teacher_id', teacher.id)

    if (error) return apiError('Failed to resolve alert')
    return apiSuccess({ resolved: true })
  } catch (e: unknown) {
    console.error('[teacher/alerts POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
