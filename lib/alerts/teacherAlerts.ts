// lib/alerts/teacherAlerts.ts
//
// Teacher-raised learner alerts. Creating an alert also notifies the
// learner's parent by email and/or WhatsApp (lib/notifications/notify.ts),
// with the teacher's own free-text message — so the right to create one is
// the right to message that family under the EduNexus name.
//
// Before this module, POST /api/teacher/alerts checked only that the caller
// HAD a teacher record (any signed-in user can create one) and then accepted
// any studentId: any account could message any learner's parent. The
// educational relationship is now required first, via the same canonical
// teacher→learner check the compass, holiday-return and evidence routes use.

import { createServiceClient } from '@/utils/supabase/service'
import { resolveTeacherOwnership } from '@/lib/compass/ownership'
import { notifyAlertCreated } from '@/lib/notifications/notify'
import { logger } from '@/lib/observability/logger'
import type { AlertType } from '@/lib/email/templates'

/** Mirrors the student_alerts.alert_type CHECK constraint. */
export const TEACHER_ALERT_TYPES = [
  'inactive', 'declining_scores', 'assignment_overdue', 'repeated_struggles', 'holiday_inactive',
] as const satisfies readonly AlertType[]

export type CreateTeacherAlertInput = {
  /** The authenticated caller — never taken from the request body. */
  userId:    string
  /** Resolved server-side from userId by the caller, never from the request. */
  teacherId: string
  studentId: string
  alertType: AlertType
  message:   string
}

export type CreateTeacherAlertResult =
  | { status: 'created'; alertId: string }
  | { status: 'forbidden' }

type CreateTeacherAlertDeps = {
  /** Injected only by tests — production always uses the service client. */
  db?: ReturnType<typeof createServiceClient>
}

export async function createTeacherAlert(
  input: CreateTeacherAlertInput,
  deps: CreateTeacherAlertDeps = {}
): Promise<CreateTeacherAlertResult> {
  // Authorization BEFORE any write or notification: no row, no message.
  const ownership = await resolveTeacherOwnership(input.userId, input.studentId)
  if (!ownership.allowed) return { status: 'forbidden' }

  const db = deps.db ?? createServiceClient()
  const { data: alert, error } = await db
    .from('student_alerts')
    .insert({
      student_id:  input.studentId,
      teacher_id:  input.teacherId,
      alert_type:  input.alertType,
      message:     input.message,
      is_resolved: false,
    })
    .select('id')
    .single()

  if (error || !alert) throw new Error(`createTeacherAlert: insert failed: ${error?.message ?? 'no row returned'}`)

  // Delivery stays fire-and-forget, as before — a slow email/WhatsApp send
  // never blocks the teacher's response — but a failure is logged, not lost.
  notifyAlertCreated(alert.id).catch(err =>
    logger.error('createTeacherAlert: parent notification failed', { service: 'teacher-alerts', alert_id: alert.id }, err)
  )

  return { status: 'created', alertId: alert.id }
}
