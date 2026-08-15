// lib/email/sender.ts
// Resend-backed email sender with deduplication via notification_log.
// Never throws — always returns { success, error? }.

import { resend, getEmailFrom } from '@/lib/resend-client'
import { repos } from '@/lib/repositories'
import {
  assignmentMarkedEmail,
  alertCreatedEmail,
  teacherInviteEmail,
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

// ---------------------------------------------------------------------------
// sendTeacherInviteEmail — Phase 2, admin-provisioned teacher activation
// ---------------------------------------------------------------------------

export type TeacherInviteEmailInput = {
  schoolUserId: string
  toEmail: string
  schoolName: string
  invitedByName: string
  actionUrl: string
  isNewAccount: boolean
  userId?: string | null
}

// Deliberately NOT deduplicated via notification_log's isDuplicate — unlike
// a per-event parent notification, re-sending a teacher invite is a
// legitimate admin action (the "invite" button in /teacher/core-team is
// also the "resend invite" button; there's no separate control), so every
// call really does send. Still logged for the same observability the other
// senders in this file get.
export async function sendTeacherInviteEmail(input: TeacherInviteEmailInput): Promise<SendResult> {
  try {
    const { subject, html } = teacherInviteEmail({
      schoolName:    input.schoolName,
      invitedByName: input.invitedByName,
      actionUrl:     input.actionUrl,
      isNewAccount:  input.isNewAccount,
    })

    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to:   input.toEmail,
      subject,
      html,
    })

    if (error) {
      await logAttempt({
        userId:       input.userId ?? null,
        type:         'teacher_invite',
        referenceId:  input.schoolUserId,
        emailAddress: input.toEmail,
        success:      false,
        errorMessage: error.message,
      })
      return { success: false, error: error.message }
    }

    await logAttempt({
      userId:       input.userId ?? null,
      type:         'teacher_invite',
      referenceId:  input.schoolUserId,
      emailAddress: input.toEmail,
      success:      true,
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sendTeacherInviteEmail]', message)
    return { success: false, error: message }
  }
}

function deriveCbcLevel(score: number, maxScore: number): 1 | 2 | 3 | 4 {
  if (maxScore === 0) return 1
  const pct = (score / maxScore) * 100
  if (pct >= 80) return 4
  if (pct >= 60) return 3
  if (pct >= 40) return 2
  return 1
}
