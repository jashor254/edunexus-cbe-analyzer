// lib/email/reportEmail.ts
// Sends parent report email with PDF attachment via Resend.

import { resend, getEmailFrom } from '@/lib/resend-client'
import { repos } from '@/lib/repositories'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://edunexus.co.ke'

type SendResult = { success: boolean; error?: string }

export type ReportEmailParams = {
  studentId:   string
  parentEmail: string
  parentName:  string
  studentName: string
  grade:       number
  term:        number
  year:        number
  pdfBuffer:   Buffer
  signupToken?: string
  userId?:     string | null
}

export async function sendReportEmail(params: ReportEmailParams): Promise<SendResult> {
  try {
    // Deduplicate: one report email per student per term/year
    const dedupKey = `report_${params.studentId}_${params.term}_${params.year}`

    const existing = await repos.notifications.isDuplicate('report_ready', dedupKey, 'email')

    if (existing) return { success: true }

    const signupLink = params.signupToken
      ? `${APP_URL}/parent-join?student=${params.studentId}&token=${params.signupToken}`
      : `${APP_URL}/dashboard`

    const { error } = await resend.emails.send({
      from:    getEmailFrom(),
      to:      params.parentEmail,
      subject: `${params.studentName}'s Learner Blueprint — Term ${params.term}, ${params.year}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:#1a2744;padding:32px 40px;text-align:center">
      <p style="color:#f59e0b;font-size:11px;letter-spacing:3px;margin:0 0 8px">EDUNEXUS</p>
      <h1 style="color:#fff;margin:0;font-size:24px">Learner Blueprint</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:14px">Personalised Learner Intelligence Report</p>
    </div>
    <div style="padding:40px">
      <p style="color:#1e293b;font-size:16px;margin:0 0 16px">Dear ${params.parentName},</p>
      <p style="color:#475569;line-height:1.7;margin:0 0 24px">
        <strong>${params.studentName}</strong>'s Grade ${params.grade} Learner Blueprint for
        Term ${params.term}, ${params.year} is ready. The full report is attached to this email.
      </p>
      <div style="background:#f0f7ff;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="color:#1a2744;font-weight:bold;margin:0 0 8px">What's inside the Learner Blueprint:</p>
        <ul style="color:#475569;margin:0;padding-left:20px;line-height:2">
          <li>Learner Snapshot — growth stage, strengths & Future Readiness Score</li>
          <li>Learning Intelligence — how your child learns, not just what they scored</li>
          <li>Behaviour Profile — consistency, engagement, persistence & confidence</li>
          <li>Parent Action Plan — this week, this month, this term</li>
          <li>Pathway Readiness — STEM, Social Sciences & Arts explained in plain language</li>
          <li>Career Intelligence — top 3 emerging directions with why they fit</li>
        </ul>
      </div>
      <div style="text-align:center;margin:32px 0">
        <a href="${signupLink}" style="background:#1a2744;color:#f59e0b;text-decoration:none;padding:16px 36px;border-radius:12px;font-weight:bold;font-size:16px;display:inline-block">
          ${params.signupToken ? 'Set Up Your Parent Account' : 'View on EduNexus'}
        </a>
      </div>
      ${params.signupToken ? `
      <p style="color:#94a3b8;font-size:13px;text-align:center;margin:0">
        New to EduNexus? Click above to create your account and access your child's personalised Learning Compass.
        This link expires in 7 days.
      </p>` : ''}
    </div>
    <div style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center">
      <p style="color:#94a3b8;font-size:12px;margin:0">EduNexus Learner Blueprint · edunexus.co.ke · Made in Kenya 🇰🇪</p>
    </div>
  </div>
</body>
</html>`,
      attachments: [{
        filename: `EduNexus_Report_${params.studentName.replace(/\s+/g, '_')}_Term${params.term}_${params.year}.pdf`,
        content:  params.pdfBuffer,
      }],
    })

    const success = !error
    await repos.notifications.insertNotificationLog({
      user_id:       params.userId ?? null,
      type:          'report_ready',
      reference_id:  dedupKey,
      channel:       'email',
      email_address: params.parentEmail,
      success,
      error_message: error?.message ?? null,
    })

    return success ? { success: true } : { success: false, error: error?.message }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sendReportEmail]', message)
    return { success: false, error: message }
  }
}
