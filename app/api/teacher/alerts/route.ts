import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { createTeacherAlert, TEACHER_ALERT_TYPES } from '@/lib/alerts/teacherAlerts'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'

const AlertActionSchema = z.union([
  z.object({
    action:    z.literal('create'),
    studentId: z.string().uuid(),
    alertType: z.enum(TEACHER_ALERT_TYPES),
    // Bounded: this text is delivered to the parent by email/WhatsApp.
    message:   z.string().min(1).max(1000),
  }),
  z.object({
    action:  z.literal('resolve'),
    alertId: z.string().uuid(),
  }),
])

export async function GET() {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    const db = createServiceClient()

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
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    const db = createServiceClient()

    const parsed = AlertActionSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    if (parsed.data.action === 'create') {
      const { studentId, alertType, message } = parsed.data

      const result = await createTeacherAlert({ userId, teacherId: teacher.id, studentId, alertType, message })
      if (result.status === 'forbidden') return apiForbidden()

      return apiSuccess({ alert: { id: result.alertId } })
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
