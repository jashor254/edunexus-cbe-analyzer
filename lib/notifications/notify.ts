// lib/notifications/notify.ts
// Central notification orchestrator. Fires email + WhatsApp in parallel.
// Neither function ever throws — all errors are caught and logged internally.
// Routes call these fire-and-forget via .catch().

import { createServiceClient } from '@/utils/supabase/service'
import { sendAssignmentMarkedEmail, sendAlertCreatedEmail } from '@/lib/email/sender'
import {
  sendAssignmentMarkedWhatsApp,
  sendAlertCreatedWhatsApp,
} from '@/lib/whatsapp/sender'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getLevelDisplay(
  score:          number,
  maxScore:       number,
  curriculumType: string
): string {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0

  if (curriculumType === '844') {
    if (pct >= 80) return 'Grade A'
    if (pct >= 75) return 'Grade A-'
    if (pct >= 70) return 'Grade B+'
    if (pct >= 65) return 'Grade B'
    if (pct >= 60) return 'Grade B-'
    if (pct >= 55) return 'Grade C+'
    if (pct >= 50) return 'Grade C'
    if (pct >= 45) return 'Grade C-'
    if (pct >= 40) return 'Grade D+'
    return 'Grade D'
  }

  if (curriculumType === 'igcse') {
    if (pct >= 90) return 'Grade A*'
    if (pct >= 80) return 'Grade A'
    if (pct >= 70) return 'Grade B'
    if (pct >= 60) return 'Grade C'
    if (pct >= 50) return 'Grade D'
    return 'Grade E'
  }

  // CBC default (also covers null / 'cbc')
  if (pct >= 75) return 'Level 4'
  if (pct >= 55) return 'Level 3'
  if (pct >= 40) return 'Level 2'
  return 'Level 1'
}

function deriveCbcLevel(score: number, maxScore: number): 1 | 2 | 3 | 4 {
  if (maxScore === 0) return 1
  const pct = (score / maxScore) * 100
  if (pct >= 80) return 4
  if (pct >= 60) return 3
  if (pct >= 40) return 2
  return 1
}

// ---------------------------------------------------------------------------
// notifyAssignmentMarked
// ---------------------------------------------------------------------------

export async function notifyAssignmentMarked(
  submissionId: string,
  assignmentId: string
): Promise<void> {
  try {
    const db = createServiceClient()

    // 1. Submission
    const { data: submission } = await db
      .from('assignment_submissions')
      .select('id, student_id, score, teacher_feedback, status')
      .eq('id', submissionId)
      .single()

    if (!submission) return

    // 2. Assignment
    const { data: assignment } = await db
      .from('assignments')
      .select('id, title, max_score, class_id, teacher_id')
      .eq('id', assignmentId)
      .single()

    if (!assignment) return

    // 3 & 4. Student + parent data in one query
    const { data: student } = await db
      .from('students')
      .select('id, name, grade, curriculum_type, parent_email, notification_email, parent_phone, notification_whatsapp, whatsapp_opted_in, parent_first_name')
      .eq('id', submission.student_id)
      .single()

    if (!student) return

    const hasEmail    = student.notification_email && student.parent_email
    const hasWhatsApp = student.notification_whatsapp && student.whatsapp_opted_in && student.parent_phone

    if (!hasEmail && !hasWhatsApp) return

    // 5. Teacher
    const { data: teacher } = await db
      .from('teachers')
      .select('full_name, school')
      .eq('id', assignment.teacher_id)
      .single()

    // Resolve parent name — prefer stored first name, fall back to class_students→auth
    let parentName: string = student.parent_first_name ?? ''

    if (!parentName) {
      const { data: classStudent } = await db
        .from('class_students')
        .select('parent_id')
        .eq('student_id', submission.student_id)
        .eq('class_id', assignment.class_id)
        .maybeSingle()

      if (classStudent?.parent_id) {
        const { data: { user: parentAuthUser } } = await db.auth.admin.getUserById(
          classStudent.parent_id
        )
        const meta = parentAuthUser?.user_metadata as Record<string, string> | undefined
        parentName = meta?.full_name ?? meta?.name ?? 'Parent'
      } else {
        parentName = 'Parent'
      }
    }

    // 6. Derived values
    const score    = (submission.score as number) ?? 0
    const maxScore = (assignment.max_score as number) ?? 100
    const cbcLevel = deriveCbcLevel(score, maxScore)

    const teacherName   = (teacher?.full_name as string) ?? 'Your Teacher'
    const teacherSchool = (teacher?.school    as string) ?? ''

    // 7. Fire both channels in parallel
    const sends: Promise<unknown>[] = []

    if (hasWhatsApp) {
      sends.push(
        sendAssignmentMarkedWhatsApp({
          submissionId,
          parentPhone:     student.parent_phone as string,
          parentName,
          studentName:     student.name as string,
          subject:         assignment.title as string,
          score,
          maxScore,
          cbcLevel,
          teacherFeedback: (submission.teacher_feedback as string) ?? null,
          teacherName,
          assignmentId,
        })
      )
    }

    if (hasEmail) {
      sends.push(
        sendAssignmentMarkedEmail({
          submissionId,
          parentEmail:     student.parent_email as string,
          parentName,
          studentName:     student.name as string,
          subject:         assignment.title as string,
          topic:           assignment.title as string,
          score,
          maxScore,
          cbcLevel,
          teacherFeedback: (submission.teacher_feedback as string) ?? null,
          teacherName,
          teacherSchool,
          assignmentId,
        })
      )
    }

    await Promise.allSettled(sends)
  } catch (err) {
    console.error('[notifyAssignmentMarked]', err instanceof Error ? err.message : err)
  }
}

// ---------------------------------------------------------------------------
// notifyAlertCreated
// ---------------------------------------------------------------------------

export async function notifyAlertCreated(alertId: string): Promise<void> {
  try {
    const db = createServiceClient()

    // 1. Alert
    const { data: alert } = await db
      .from('student_alerts')
      .select('id, student_id, alert_type, message, teacher_id')
      .eq('id', alertId)
      .single()

    if (!alert) return

    // 2 & 3. Student + parent data
    const { data: student } = await db
      .from('students')
      .select('id, name, grade, parent_email, notification_email, parent_phone, notification_whatsapp, whatsapp_opted_in, parent_first_name')
      .eq('id', alert.student_id)
      .single()

    if (!student) return

    const hasEmail    = student.notification_email && student.parent_email
    const hasWhatsApp = student.notification_whatsapp && student.whatsapp_opted_in && student.parent_phone

    if (!hasEmail && !hasWhatsApp) return

    // 4. Teacher
    const { data: teacher } = await db
      .from('teachers')
      .select('full_name, school, user_id')
      .eq('id', alert.teacher_id)
      .single()

    // Resolve parent name
    let parentName: string = student.parent_first_name ?? ''

    if (!parentName) {
      const { data: classStudent } = await db
        .from('class_students')
        .select('parent_id')
        .eq('student_id', alert.student_id)
        .limit(1)
        .maybeSingle()

      if (classStudent?.parent_id) {
        const { data: { user: parentAuthUser } } = await db.auth.admin.getUserById(
          classStudent.parent_id
        )
        const meta = parentAuthUser?.user_metadata as Record<string, string> | undefined
        parentName = meta?.full_name ?? meta?.name ?? 'Parent'
      } else {
        parentName = 'Parent'
      }
    }

    const teacherName   = (teacher?.full_name as string) ?? 'Your Teacher'
    const teacherSchool = (teacher?.school    as string) ?? ''
    const userId        = teacher?.user_id as string | undefined

    // 5. Fire both channels in parallel
    const sends: Promise<unknown>[] = []

    if (hasWhatsApp) {
      sends.push(
        sendAlertCreatedWhatsApp({
          alertId,
          parentPhone: student.parent_phone as string,
          parentName,
          studentName: student.name as string,
          alertType:   alert.alert_type as string,
          message:     alert.message as string,
          teacherName,
          userId,
        })
      )
    }

    if (hasEmail) {
      sends.push(
        sendAlertCreatedEmail({
          alertId,
          parentEmail: student.parent_email as string,
          parentName,
          studentName: student.name as string,
          alertType:   alert.alert_type as string,
          message:     alert.message as string,
          teacherName,
          school:      teacherSchool,
          userId,
        })
      )
    }

    await Promise.allSettled(sends)
  } catch (err) {
    console.error('[notifyAlertCreated]', err instanceof Error ? err.message : err)
  }
}
