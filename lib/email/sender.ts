// lib/email/sender.ts
// Resend-backed email sender with deduplication via notification_log.
// Never throws — always returns { success, error? }.

import { resend, getEmailFrom } from '@/lib/resend-client'
import { repos } from '@/lib/repositories'
import {
  assignmentMarkedEmail,
  alertCreatedEmail,
  type AlertType,
} from './templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://edunexus.co.ke'

type SendResult = { success: boolean; error?: string }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function isDuplicate(type: string, referenceId: string): Promise<boolean> {
  return repos.notifications.isDuplicate(type, referenceId, 'email')
}

async function logAttempt(params: {
  userId: string | null
  type: string
  referenceId: string
  emailAddress: string
  success: boolean
  errorMessage?: string
}): Promise<void> {
  await repos.notifications.insertNotificationLog({
    user_id:       params.userId,
    type:          params.type,
    reference_id:  params.referenceId,
    channel:       'email',
    email_address: params.emailAddress,
    success:       params.success,
    error_message: params.errorMessage ?? null,
  })
}

// ---------------------------------------------------------------------------
// sendAssignmentMarkedEmail
// ---------------------------------------------------------------------------

export type AssignmentMarkedEmailParams = {
  submissionId: string
  parentEmail: string
  parentName: string
  studentName: string
  subject: string
  topic: string
  score: number
  maxScore: number
  cbcLevel?: 1 | 2 | 3 | 4
  teacherFeedback: string | null
  teacherName: string
  teacherSchool: string
  assignmentId: string
  userId?: string | null
}

export async function sendAssignmentMarkedEmail(
  params: AssignmentMarkedEmailParams
): Promise<SendResult> {
  try {
    const duplicate = await isDuplicate('assignment_marked', params.submissionId)
    if (duplicate) return { success: true }

    const cbcLevel = (params.cbcLevel ?? deriveCbcLevel(params.score, params.maxScore)) as 1 | 2 | 3 | 4
    const deepLink = `${APP_URL}/dashboard/assignments/${params.assignmentId}`

    const { subject, html } = assignmentMarkedEmail({
      parentName:      params.parentName,
      studentName:     params.studentName,
      subject:         params.subject,
      topic:           params.topic,
      score:           params.score,
      maxScore:        params.maxScore,
      cbcLevel,
      teacherFeedback: params.teacherFeedback,
      teacherName:     params.teacherName,
      teacherSchool:   params.teacherSchool,
      assignmentId:    params.assignmentId,
      deepLink,
    })

    const { error } = await resend.emails.send({
      from:    getEmailFrom(),
      to:      params.parentEmail,
      subject,
      html,
    })

    if (error) {
      await logAttempt({
        userId:       params.userId ?? null,
        type:         'assignment_marked',
        referenceId:  params.submissionId,
        emailAddress: params.parentEmail,
        success:      false,
        errorMessage: error.message,
      })
      return { success: false, error: error.message }
    }

    await logAttempt({
      userId:       params.userId ?? null,
      type:         'assignment_marked',
      referenceId:  params.submissionId,
      emailAddress: params.parentEmail,
      success:      true,
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sendAssignmentMarkedEmail]', message)
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// sendAlertCreatedEmail
// ---------------------------------------------------------------------------

export type AlertCreatedEmailParams = {
  alertId: string
  parentEmail: string
  parentName: string
  studentName: string
  alertType: string
  message: string
  teacherName: string
  school: string
  userId?: string | null
}

export async function sendAlertCreatedEmail(
  params: AlertCreatedEmailParams
): Promise<SendResult> {
  try {
    const duplicate = await isDuplicate('alert_created', params.alertId)
    if (duplicate) return { success: true }

    const deepLink = `${APP_URL}/dashboard/alerts`

    const { subject, html } = alertCreatedEmail({
      parentName:  params.parentName,
      studentName: params.studentName,
      alertType:   params.alertType as AlertType,
      message:     params.message,
      teacherName: params.teacherName,
      school:      params.school,
      deepLink,
    })

    const { error } = await resend.emails.send({
      from:    getEmailFrom(),
      to:      params.parentEmail,
      subject,
      html,
    })

    if (error) {
      await logAttempt({
        userId:       params.userId ?? null,
        type:         'alert_created',
        referenceId:  params.alertId,
        emailAddress: params.parentEmail,
        success:      false,
        errorMessage: error.message,
      })
      return { success: false, error: error.message }
    }

    await logAttempt({
      userId:       params.userId ?? null,
      type:         'alert_created',
      referenceId:  params.alertId,
      emailAddress: params.parentEmail,
      success:      true,
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sendAlertCreatedEmail]', message)
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveCbcLevel(score: number, maxScore: number): 1 | 2 | 3 | 4 {
  if (maxScore === 0) return 1
  const pct = (score / maxScore) * 100
  if (pct >= 80) return 4
  if (pct >= 60) return 3
  if (pct >= 40) return 2
  return 1
}
