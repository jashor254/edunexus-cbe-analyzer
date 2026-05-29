// lib/whatsapp/reportNotify.ts
// Sends "report ready" WhatsApp notification to a parent via Meta Cloud API.
// Uses the approved edunexus_student_alert template (type: "Academic Report Ready").

import { sendWhatsAppTemplate } from './client'
import { createServiceClient } from '@/utils/supabase/service'

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
    const db = createServiceClient()

    const dedupKey = `report_${params.studentId}_${params.term}_${params.year}`
    const { data: existing } = await db
      .from('notification_log')
      .select('id')
      .eq('type', 'report_ready')
      .eq('reference_id', dedupKey)
      .eq('channel', 'whatsapp')
      .eq('success', true)
      .limit(1)
      .maybeSingle()

    if (existing) return { success: true }

    const link = params.signupToken
      ? `${APP_URL}/parent-join?student=${params.studentId}&token=${params.signupToken}`
      : `${APP_URL}/dashboard`

    const messageSnip =
      `${params.studentName}'s Grade ${params.grade} Academic Clinic Report is ready. ` +
      `Your child's personalised 7-page report covers subject performance, pathway analysis, ` +
      `and a 3-week holiday action plan. Full report sent to your email. ` +
      `${params.signupToken ? 'Create your EduNexus parent account to access AI tutoring for your child.' : 'View on your dashboard.'}`

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
            { type: 'text', text: 'Academic Report Ready' },
            { type: 'text', text: messageSnip.substring(0, 200) },
            { type: 'text', text: link },
          ],
        },
      ],
    })

    await db.from('notification_log').insert({
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
