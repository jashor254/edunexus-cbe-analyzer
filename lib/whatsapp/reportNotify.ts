// lib/whatsapp/reportNotify.ts
// Sends "report ready" WhatsApp notification to a parent via Meta Cloud API.
// Uses the approved edunexus_student_alert template (type: "Academic Report Ready").

import { sendWhatsAppTemplate } from './client'
import { repos } from '@/lib/repositories'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://edunexus.co.ke'

export type ReportWhatsAppParams = {
  studentId:    string
  parentPhone:  string
  parentName:   string
  studentName:  string
  teacherName:  string
  grade:        number
  term:         number
  year:         number
  signupToken?: string
  userId?:      string | null
}

export async function sendReportWhatsApp(params: ReportWhatsAppParams): Promise<{ success: boolean; error?: string }> {
  try {
    const dedupKey = `report_${params.studentId}_${params.term}_${params.year}`

    const existing = await repos.notifications.isDuplicate('report_ready', dedupKey, 'whatsapp')

    if (existing) return { success: true }

    const link = params.signupToken
      ? `${APP_URL}/parent-join?student=${params.studentId}&token=${params.signupToken}`
      : `${APP_URL}/dashboard`

    // Deliberately makes no claim about email — this WhatsApp send happens
    // independently of the email channel (assessmentPipeline.ts fires both
    // in parallel, and either can be disabled/fail on its own), so this
    // message must never assert something about a channel it can't confirm.
    const messageSnip =
      `${params.studentName}'s Grade ${params.grade} Learner Blueprint is ready. ` +
      `Your child's personalised report covers who they are becoming, how they learn, ` +
      `and which future opportunities are opening up. ` +
      `${params.signupToken ? 'Create your EduNexus parent account to access the Learning Compass for your child.' : 'View on your dashboard.'}`

    const result = await sendWhatsAppTemplate({
      to:           params.parentPhone,
      templateName: 'edunexus_student_alert',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.parentName },
            { type: 'text', text: params.studentName },
            { type: 'text', text: params.teacherName },
            { type: 'text', text: 'Learner Blueprint Ready' },
            { type: 'text', text: messageSnip.substring(0, 200) },
            { type: 'text', text: link },
          ],
        },
      ],
    })

    await repos.notifications.insertNotificationLog({
      user_id:       params.userId ?? null,
      type:          'report_ready',
      reference_id:  dedupKey,
      channel:       'whatsapp',
      phone_number:  params.parentPhone,
      success:       result.success,
      error_message: result.error ?? null,
    })

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sendReportWhatsApp]', message)
    return { success: false, error: message }
  }
}
