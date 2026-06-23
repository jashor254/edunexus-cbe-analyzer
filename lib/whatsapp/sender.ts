// lib/whatsapp/sender.ts
// WhatsApp notification senders — mirrors lib/email/sender.ts in structure.
// Never throws. One channel failing never blocks the other.
//
// Templates must be created and approved in Meta Business Manager first.
// See docs/whatsapp-setup.md for exact template content to submit.

import { sendWhatsAppTemplate, type WhatsAppResult } from './client'
import { createServiceClient } from '@/utils/supabase/service'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://edunexus.co.ke'

// Template names registered in Meta Business Manager
const TEMPLATE_ASSIGNMENT_MARKED = 'edunexus_assignment_marked'
const TEMPLATE_STUDENT_ALERT     = 'edunexus_student_alert'
// Template: edunexus_academy_reflect  (Category: UTILITY, Language: English)
// Register in Meta Business Manager with body (must not start or end with a variable):
//   Hello Mwalimu {{1}}! 👋
//   You completed a lesson in the EduNexus AI Academy but haven't reflected yet.
//   Module: *{{2}}*
//   Take 2 minutes to reflect on what you tried in class and unlock your next XP bonus.
//   Reflect here: {{3}}
//   Keep growing — EduNexus AI Academy 🎓
// Variables: {{1}} = first name, {{2}} = module title, {{3}} = module URL
const TEMPLATE_ACADEMY_REFLECT   = 'edunexus_academy_reflect'

// Owner phone for internal platform alerts (milestone hits, health issues)
const OWNER_PHONE = process.env.OWNER_WHATSAPP_NUMBER ?? '254141799322'

const CBC_LEVEL_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'L1 - Below Expectation',
  2: 'L2 - Approaching',
  3: 'L3 - Meets Expectation',
  4: 'L4 - Exceeds Expectation',
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  inactive:             'Inactivity Alert',
  declining_scores:     'Declining Scores',
  assignment_overdue:   'Overdue Assignment',
  repeated_struggles:   'Learning Support Needed',
  holiday_inactive:     'Holiday Engagement',
}

// ---------------------------------------------------------------------------
// Internal helpers (same pattern as email/sender.ts)
// ---------------------------------------------------------------------------

async function isDuplicate(type: string, referenceId: string): Promise<boolean> {
  const db = createServiceClient()
  const { data } = await db
    .from('notification_log')
    .select('id')
    .eq('type', type)
    .eq('reference_id', referenceId)
    .eq('channel', 'whatsapp')
    .eq('success', true)
    .limit(1)
    .maybeSingle()
  return data !== null
}

async function logAttempt(params: {
  userId:      string | null
  type:        string
  referenceId: string
  phoneNumber: string
  success:     boolean
  errorMessage?: string
}): Promise<void> {
  const db = createServiceClient()
  await db.from('notification_log').insert({
    user_id:       params.userId,
    type:          params.type,
    reference_id:  params.referenceId,
    channel:       'whatsapp',
    phone_number:  params.phoneNumber,
    success:       params.success,
    error_message: params.errorMessage ?? null,
  })
}

// ---------------------------------------------------------------------------
// sendAssignmentMarkedWhatsApp
// ---------------------------------------------------------------------------

export type AssignmentMarkedWhatsAppParams = {
  submissionId:    string
  parentPhone:     string
  parentName:      string
  studentName:     string
  subject:         string
  score:           number
  maxScore:        number
  cbcLevel:        1 | 2 | 3 | 4
  teacherFeedback: string | null
  teacherName:     string
  assignmentId:    string
  userId?:         string | null
}

export async function sendAssignmentMarkedWhatsApp(
  params: AssignmentMarkedWhatsAppParams
): Promise<WhatsAppResult> {
  try {
    const duplicate = await isDuplicate('assignment_marked', params.submissionId)
    if (duplicate) return { success: true }

    const percentage = params.maxScore > 0
      ? Math.round((params.score / params.maxScore) * 100)
      : 0
    const levelLabel   = CBC_LEVEL_LABELS[params.cbcLevel]
    const feedbackText = params.teacherFeedback
      ? (params.teacherFeedback.length > 120
        ? params.teacherFeedback.slice(0, 117) + '...'
        : params.teacherFeedback)
      : 'No written feedback.'
    const deepLink = `${APP_URL}/dashboard/assignments/${params.assignmentId}`

    // Template body variables (must match order in Meta Business Manager)
    // Body: "Hi {{1}}! {{2}}'s *{{3}}* assignment was marked by {{4}}.\n\nScore: *{{5}}/{{6}}* ({{7}}%)\nCBC Level: {{8}}\n\nFeedback: {{9}}\n\n{{10}}"
    const result = await sendWhatsAppTemplate({
      to:           params.parentPhone,
      templateName: TEMPLATE_ASSIGNMENT_MARKED,
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.parentName },
            { type: 'text', text: params.studentName },
            { type: 'text', text: params.subject },
            { type: 'text', text: params.teacherName },
            { type: 'text', text: String(params.score) },
            { type: 'text', text: String(params.maxScore) },
            { type: 'text', text: String(percentage) },
            { type: 'text', text: levelLabel },
            { type: 'text', text: feedbackText },
            { type: 'text', text: deepLink },
          ],
        },
      ],
    })

    await logAttempt({
      userId:       params.userId ?? null,
      type:         'assignment_marked',
      referenceId:  params.submissionId,
      phoneNumber:  params.parentPhone,
      success:      result.success,
      errorMessage: result.error,
    })

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sendAssignmentMarkedWhatsApp]', message)
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// sendAlertCreatedWhatsApp
// ---------------------------------------------------------------------------

export type AlertCreatedWhatsAppParams = {
  alertId:     string
  parentPhone: string
  parentName:  string
  studentName: string
  alertType:   string
  message:     string
  teacherName: string
  userId?:     string | null
}

export async function sendAlertCreatedWhatsApp(
  params: AlertCreatedWhatsAppParams
): Promise<WhatsAppResult> {
  try {
    const duplicate = await isDuplicate('alert_created', params.alertId)
    if (duplicate) return { success: true }

    const alertLabel   = ALERT_TYPE_LABELS[params.alertType] ?? 'Teacher Alert'
    const messageSnip  = params.message.length > 200
      ? params.message.slice(0, 197) + '...'
      : params.message
    const deepLink = `${APP_URL}/dashboard/alerts`

    // Template body variables
    // Body: "Hi {{1}}! {{2}}'s teacher {{3}} has sent an alert.\n\nType: {{4}}\n\n{{5}}\n\n{{6}}"
    const result = await sendWhatsAppTemplate({
      to:           params.parentPhone,
      templateName: TEMPLATE_STUDENT_ALERT,
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.parentName },
            { type: 'text', text: params.studentName },
            { type: 'text', text: params.teacherName },
            { type: 'text', text: alertLabel },
            { type: 'text', text: messageSnip },
            { type: 'text', text: deepLink },
          ],
        },
      ],
    })

    await logAttempt({
      userId:       params.userId ?? null,
      type:         'alert_created',
      referenceId:  params.alertId,
      phoneNumber:  params.parentPhone,
      success:      result.success,
      errorMessage: result.error,
    })

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sendAlertCreatedWhatsApp]', message)
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// sendWelcomeMessage — freeform text, sent once at opt-in time.
// Meta permits freeform outbound messages to numbers that have just opted in
// via a business flow. All subsequent business-initiated messages must use
// approved templates.
// ---------------------------------------------------------------------------

export async function sendWelcomeMessage(
  phone: string,
  studentName: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token         = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !token) {
    return { success: false, error: 'WhatsApp not configured' }
  }

  const messageBody =
    `Welcome to EduNexus! 🎉\n\n` +
    `You'll now receive WhatsApp updates about ` +
    `${studentName}'s learning.\n\n` +
    `We'll message you when:\n` +
    `• Work is marked by the teacher\n` +
    `• Teacher sends an alert\n` +
    `• ${studentName} needs your support\n\n` +
    `Full reports always in your email too.\n\n` +
    `To turn off: edunexus.co.ke/settings\n` +
    `— EduNexus 🇰🇪`

  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to:                phone.replace(/^\+/, ''),
          type:              'text',
          text:              { body: messageBody },
        }),
      }
    )

    const data = (await res.json()) as {
      messages?: Array<{ id: string }>
      error?:    { message: string; code: number }
    }

    if (!res.ok || data.error) {
      return { success: false, error: data.error?.message ?? `HTTP ${res.status}` }
    }

    const db = createServiceClient()
    await db.from('notification_log').insert({
      channel:             'whatsapp',
      type:                'welcome',
      reference_id:        studentId,
      phone_number:        phone,
      whatsapp_message_id: data.messages?.[0]?.id ?? null,
      success:             true,
    })

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// ---------------------------------------------------------------------------
// notifyOwnerMilestone — free-form alert to owner when a user count milestone
// is crossed. Uses the same freeform path as sendWelcomeMessage (no template
// approval needed since this is owner → owner, not business → customer).
// ---------------------------------------------------------------------------

export type MilestoneAlertParams = {
  milestone: number
  totalTeachers: number
  activeTeachers: number
  totalStudents: number
}

export async function notifyOwnerMilestone(
  params: MilestoneAlertParams
): Promise<{ success: boolean; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token         = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !token) {
    return { success: false, error: 'WhatsApp not configured' }
  }

  const body =
    `🎉 *EduNexus Milestone Hit!*\n\n` +
    `You just crossed *${params.milestone} teachers* on the platform!\n\n` +
    `📊 *Live Stats*\n` +
    `👩‍🏫 Total teachers: *${params.totalTeachers}*\n` +
    `✅ Active (30d): *${params.activeTeachers}*\n` +
    `🎓 Students: *${params.totalStudents}*\n\n` +
    `Keep pushing mkuu 🇰🇪🚀\n— EduNexus System`

  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to:                OWNER_PHONE.replace(/^\+/, ''),
          type:              'text',
          text:              { body },
        }),
      }
    )

    const data = (await res.json()) as {
      messages?: Array<{ id: string }>
      error?:    { message: string; code: number }
    }

    if (!res.ok || data.error) {
      return { success: false, error: data.error?.message ?? `HTTP ${res.status}` }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// ---------------------------------------------------------------------------
// sendAcademyReflectionNudge
// ---------------------------------------------------------------------------

export type AcademyReflectionNudgeParams = {
  teacherId:   string
  lessonId:    string
  phone:       string
  teacherName: string
  moduleTitle: string
  moduleSlug:  string
  userId?:     string | null
}

export async function sendAcademyReflectionNudge(
  params: AcademyReflectionNudgeParams
): Promise<WhatsAppResult> {
  const referenceId = `academy_reflect_${params.teacherId}_${params.lessonId}`
  try {
    const dup = await isDuplicate('academy_reflection_nudge', referenceId)
    if (dup) return { success: true }

    const firstName  = params.teacherName.split(' ')[0]
    const moduleUrl  = `${APP_URL}/teacher/academy/module/${params.moduleSlug}`

    const result = await sendWhatsAppTemplate({
      to: params.phone,
      templateName: TEMPLATE_ACADEMY_REFLECT,
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: firstName },
            { type: 'text', text: params.moduleTitle },
            { type: 'text', text: moduleUrl },
          ],
        },
      ],
    })

    await logAttempt({
      userId:      params.userId ?? null,
      type:        'academy_reflection_nudge',
      referenceId,
      phoneNumber: params.phone,
      success:     result.success,
      errorMessage: result.error,
    })

    return result
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
