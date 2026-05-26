// lib/email/templates.ts
// HTML email templates for parent-teacher notifications.
// Returns plain HTML strings (not React) so they work in any Node context.

export type AlertType =
  | 'inactive'
  | 'declining_scores'
  | 'assignment_overdue'
  | 'repeated_struggles'
  | 'holiday_inactive'

type CbcLevel = 1 | 2 | 3 | 4

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://edunexus.co.ke'

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>EduNexus</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    a { color: #14b8a6; text-decoration: none; }
    @media (max-width: 600px) {
      .wrapper { padding: 16px !important; }
      .card    { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="background:#f0f4f8;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0f4f8;">
    <tr><td class="wrapper" style="padding:32px 16px;">
      <!-- Logo bar -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;margin:0 auto 20px;">
        <tr><td style="text-align:center;padding-bottom:16px;">
          <span style="font-size:22px;font-weight:900;color:#1a2744;letter-spacing:-0.5px;">
            Edu<span style="color:#14b8a6;">Nexus</span>
          </span>
          <span style="font-size:11px;color:#64748b;display:block;margin-top:2px;letter-spacing:1px;text-transform:uppercase;">Kenya CBC Education Platform</span>
        </td></tr>
      </table>
      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;margin:0 auto;">
        <tr><td class="card" style="background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e2e8f0;">
          ${content}
        </td></tr>
      </table>
      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;margin:20px auto 0;">
        <tr><td style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;line-height:1.6;">
          You received this notification because your child's teacher uses EduNexus.<br/>
          EduNexus &mdash; Empowering Kenyan Education &nbsp;|&nbsp; <a href="${BASE_URL}" style="color:#14b8a6;">edunexus.co.ke</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function ctaButton(label: string, href: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;">
    <tr><td style="text-align:center;">
      <a href="${href}" target="_blank"
         style="display:inline-block;background:#14b8a6;color:#ffffff;font-weight:700;font-size:15px;
                padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.2px;">
        ${label}
      </a>
    </td></tr>
  </table>`
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`
}

// ---------------------------------------------------------------------------
// Template 1 — Assignment marked
// ---------------------------------------------------------------------------

function cbcLevelBadge(level: CbcLevel): { label: string; bg: string; color: string } {
  const map: Record<CbcLevel, { label: string; bg: string; color: string }> = {
    1: { label: 'Level 1 — Below Expectation', bg: '#fee2e2', color: '#dc2626' },
    2: { label: 'Level 2 — Approaching',       bg: '#fef3c7', color: '#d97706' },
    3: { label: 'Level 3 — Meets Expectation', bg: '#dcfce7', color: '#16a34a' },
    4: { label: 'Level 4 — Exceeds',           bg: '#f3e8ff', color: '#7c3aed' },
  }
  return map[level]
}

export type AssignmentMarkedParams = {
  parentName: string
  studentName: string
  subject: string
  topic: string
  score: number
  maxScore: number
  cbcLevel: CbcLevel
  teacherFeedback: string | null
  teacherName: string
  teacherSchool: string
  assignmentId: string
  deepLink: string
}

export function assignmentMarkedEmail(p: AssignmentMarkedParams): { subject: string; html: string } {
  const badge = cbcLevelBadge(p.cbcLevel)
  const percentage = p.maxScore > 0 ? Math.round((p.score / p.maxScore) * 100) : 0
  const feedbackHtml = p.teacherFeedback
    ? `<p style="font-size:15px;color:#374151;line-height:1.7;background:#f8fafc;border-left:3px solid #14b8a6;padding:12px 16px;border-radius:0 8px 8px 0;margin:0;">${p.teacherFeedback.replace(/\n/g, '<br/>')}</p>`
    : `<p style="font-size:14px;color:#94a3b8;font-style:italic;margin:0;">No written feedback provided.</p>`

  const compassTip = (p.cbcLevel === 1 || p.cbcLevel === 2)
    ? `${divider()}
       <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
         <tr>
           <td style="background:#eff6ff;border-radius:10px;padding:16px 20px;">
             <p style="font-size:13px;color:#1d4ed8;font-weight:700;margin:0 0 4px;">💡 Helpful Suggestion</p>
             <p style="font-size:13px;color:#1e40af;line-height:1.6;margin:0;">
               ${p.studentName} is working toward meeting expectations. The <strong>Learning Compass</strong> on EduNexus
               has personalised practice activities that can help them improve. Encourage them to spend
               15–20 minutes on it each day.
             </p>
           </td>
         </tr>
       </table>`
    : ''

  const content = `
  <h1 style="font-size:20px;font-weight:900;color:#1a2744;margin:0 0 6px;">Assignment Marked</h1>
  <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Hi ${p.parentName}, here is an update on ${p.studentName}'s work.</p>

  <!-- Assignment details -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:24px;">
    <tr>
      <td>
        <p style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Subject</p>
        <p style="font-size:16px;font-weight:700;color:#1a2744;margin:0 0 16px;">${p.subject}</p>
        <p style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Topic / Assignment</p>
        <p style="font-size:15px;color:#374151;margin:0;">${p.topic}</p>
      </td>
    </tr>
  </table>

  <!-- Score + CBC level -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
    <tr>
      <td width="50%" style="padding-right:8px;">
        <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center;">
          <p style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Score</p>
          <p style="font-size:28px;font-weight:900;color:#1a2744;margin:0;">${p.score}<span style="font-size:16px;color:#94a3b8;">/${p.maxScore}</span></p>
          <p style="font-size:13px;color:#64748b;margin:4px 0 0;">${percentage}%</p>
        </div>
      </td>
      <td width="50%" style="padding-left:8px;">
        <div style="background:${badge.bg};border-radius:10px;padding:16px;text-align:center;">
          <p style="font-size:12px;font-weight:700;color:${badge.color};text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">CBC Level</p>
          <p style="font-size:22px;font-weight:900;color:${badge.color};margin:0;">L${p.cbcLevel}</p>
          <p style="font-size:12px;color:${badge.color};margin:4px 0 0;font-weight:600;">${badge.label.split(' — ')[1]}</p>
        </div>
      </td>
    </tr>
  </table>

  <!-- Teacher feedback -->
  <p style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Teacher's Feedback</p>
  ${feedbackHtml}

  ${compassTip}

  ${ctaButton('View Full Assignment', p.deepLink)}

  ${divider()}
  <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">
    Marked by <strong style="color:#64748b;">${p.teacherName}</strong> &mdash; ${p.teacherSchool}
  </p>`

  return {
    subject: `${p.studentName}'s ${p.subject} assignment has been marked — ${p.score}/${p.maxScore}`,
    html: shell(content),
  }
}

// ---------------------------------------------------------------------------
// Template 2 — Alert created
// ---------------------------------------------------------------------------

const ALERT_SUBJECTS: Record<AlertType, (studentName: string) => string> = {
  inactive:             (n) => `Action needed: ${n} hasn't been active on EduNexus`,
  declining_scores:     (n) => `Heads up: ${n}'s scores need attention`,
  assignment_overdue:   (n) => `Reminder: ${n} has overdue work`,
  repeated_struggles:   (n) => `${n} needs some extra support`,
  holiday_inactive:     (n) => `Holiday reminder for ${n}`,
}

const ALERT_HEADINGS: Record<AlertType, string> = {
  inactive:           'Activity Alert',
  declining_scores:   'Score Trend Alert',
  assignment_overdue: 'Overdue Assignment',
  repeated_struggles: 'Learning Support Needed',
  holiday_inactive:   'Holiday Engagement Reminder',
}

const ALERT_ACTIONS: Record<AlertType, string[]> = {
  inactive: [
    'Log into EduNexus and encourage your child to complete their pending activities.',
    'Set aside 20–30 minutes each day for your child to practise on Learning Compass.',
  ],
  declining_scores: [
    'Review recent assignments together and identify which topics are challenging.',
    'Use the Learning Compass for targeted practice in the struggling areas.',
  ],
  assignment_overdue: [
    'Remind your child to complete and submit the overdue assignment as soon as possible.',
    'Reach out to the teacher if your child needs extra time or support.',
  ],
  repeated_struggles: [
    'Consider extra revision sessions focusing on the areas your child finds difficult.',
    'The Learning Compass on EduNexus provides personalised practice — encourage daily use.',
  ],
  holiday_inactive: [
    'Encourage your child to use EduNexus during the holiday to keep their skills sharp.',
    'Even 15–20 minutes of daily practice prevents learning loss over the break.',
  ],
}

const ALERT_BADGE_COLORS: Record<AlertType, { bg: string; color: string; emoji: string }> = {
  inactive:           { bg: '#fee2e2', color: '#dc2626', emoji: '🔴' },
  declining_scores:   { bg: '#fef3c7', color: '#d97706', emoji: '🟡' },
  assignment_overdue: { bg: '#fef3c7', color: '#d97706', emoji: '📋' },
  repeated_struggles: { bg: '#eff6ff', color: '#1d4ed8', emoji: '📚' },
  holiday_inactive:   { bg: '#fef3c7', color: '#d97706', emoji: '🌤️' },
}

export type AlertCreatedParams = {
  parentName: string
  studentName: string
  alertType: AlertType
  message: string
  teacherName: string
  school: string
  deepLink: string
}

export function alertCreatedEmail(p: AlertCreatedParams): { subject: string; html: string } {
  const alertType = (ALERT_SUBJECTS[p.alertType] ? p.alertType : 'inactive') as AlertType
  const subject   = ALERT_SUBJECTS[alertType](p.studentName)
  const heading   = ALERT_HEADINGS[alertType]
  const actions   = ALERT_ACTIONS[alertType]
  const colors    = ALERT_BADGE_COLORS[alertType]

  const actionsHtml = actions
    .map((a, i) => `<li style="margin-bottom:8px;font-size:14px;color:#374151;line-height:1.6;"><strong style="color:#1a2744;">${i + 1}.</strong> ${a}</li>`)
    .join('')

  const content = `
  <!-- Alert type badge -->
  <div style="display:inline-block;background:${colors.bg};color:${colors.color};font-size:12px;font-weight:700;padding:5px 14px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:16px;">
    ${colors.emoji} ${heading}
  </div>

  <h1 style="font-size:20px;font-weight:900;color:#1a2744;margin:0 0 6px;">${subject}</h1>
  <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Hi ${p.parentName}, your child's teacher has sent you a message about <strong style="color:#374151;">${p.studentName}</strong>.</p>

  <!-- Teacher message -->
  <p style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Message from Teacher</p>
  <div style="background:#f8fafc;border-left:3px solid #14b8a6;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:24px;">
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0;">${p.message.replace(/\n/g, '<br/>')}</p>
  </div>

  <!-- What you can do -->
  <p style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">What You Can Do</p>
  <ul style="padding-left:0;list-style:none;margin:0 0 24px;">
    ${actionsHtml}
  </ul>

  ${ctaButton('Open EduNexus', p.deepLink)}

  ${divider()}
  <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">
    Sent by <strong style="color:#64748b;">${p.teacherName}</strong> &mdash; ${p.school}
  </p>`

  return { subject, html: shell(content) }
}
