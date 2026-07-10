// lib/holiday/packRenderer.ts
// Printable Adaptive Learning Pack — Adaptive Learning v2 Architecture §5
// (docs/architecture/adaptive-learning-v2-architecture.md, FROZEN).
//
// Not a "simplified" or "offline mode" of the digital experience — it
// renders from the exact same HolidayPlanData (lib/holiday/planner.ts,
// Wave 2, now Projection-sourced) and AdaptiveTask (lib/adaptiveLearning/
// recommend.ts, Wave 1) output a digital learner would see. Extends the
// existing assignment renderer (lib/assignments/pdfRenderer.ts) — reuses
// its LEVELS palette, buildTasks/buildEnrichmentTasks question sets, and
// its parent-acknowledgement section shape — rather than building a
// second rendering engine.

import { LEVELS, buildTasks, buildEnrichmentTasks, buildOutcomeGroundedTasks } from '@/lib/assignments/pdfRenderer'
import type { HolidayPlanData, HolidayWeek } from './types'
import type { AdaptiveTask } from '@/lib/adaptiveLearning/recommend'

const REFLECTION_PROMPTS = [
  'What was easy this holiday?',
  'What was hard? What would help?',
  'What do you want your teacher to know when Term starts?',
]

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function weekOverviewRow(week: HolidayWeek): string {
  return `
<tr>
  <td class="w-num">${week.week}</td>
  <td>
    <div class="w-label">${escapeHtml(week.label)}${week.is_rest_week ? ' <span class="rest-tag">Rest</span>' : ''}</div>
    <div class="w-task">${escapeHtml(week.student_task)}</div>
    <div class="w-parent"><strong>Parent:</strong> ${escapeHtml(week.parent_action)}</div>
  </td>
  <td class="w-check"><div class="checkbox"></div></td>
</tr>`
}

/** One adaptive-exercise page for a task, reusing the same question sets the digital/classroom channels use. */
function exercisePage(task: AdaptiveTask): string {
  const level = task.level ?? 3
  const lbl = LEVELS[level as 1 | 2 | 3 | 4]
  const isEnrichment = task.taskStyle === 'enrichment'
  const outcomes = task.curriculum?.learningOutcomes ?? []
  const isCurriculumGrounded = !isEnrichment && outcomes.length > 0
  const tasks = isCurriculumGrounded
    ? buildOutcomeGroundedTasks(outcomes, level as 1 | 2 | 3 | 4)
    : isEnrichment
      ? buildEnrichmentTasks(task.subject)
      : buildTasks(task.subject, task.action, level as 1 | 2 | 3 | 4)

  return `
<div class="page">
  <div class="ex-header">
    <div class="ex-title">${escapeHtml(task.subject)}</div>
    <div class="badge" style="background:${lbl.bg};color:${lbl.colour};border:1.5px solid ${lbl.border}">Level ${level} — ${lbl.name}</div>
  </div>
  <div class="ex-why"><strong>Why this:</strong> ${escapeHtml(task.observation)}</div>
  <div class="ex-goal"><strong>Goal:</strong> ${escapeHtml(task.action)}</div>
  <div class="curriculum-status ${isCurriculumGrounded ? 'grounded' : 'ungrounded'}">
    ${isCurriculumGrounded
      ? '✓ Grounded in the official curriculum Specific Learning Outcomes for this sub-strand.'
      : escapeHtml(task.curriculumNotice ?? 'No curriculum outcome data available for this sub-strand — general practice only.')}
  </div>
  ${tasks.map((t, i) => `
  <div class="question">
    <div class="q-num">Question ${i + 1}${t.marks !== null ? `<span class="q-marks">(${t.marks} mark${t.marks !== 1 ? 's' : ''})</span>` : ''}</div>
    <div class="q-text">${t.question}</div>
    ${Array.from({ length: t.lines }, () => '<div class="ans-line"></div>').join('')}
  </div>`).join('')}
</div>`
}

function reflectionPage(): string {
  return `
<div class="page">
  <div class="ex-header"><div class="ex-title">My Reflection</div></div>
  ${REFLECTION_PROMPTS.map(p => `
  <div class="question">
    <div class="q-text">${p}</div>
    <div class="ans-line"></div><div class="ans-line"></div><div class="ans-line"></div>
  </div>`).join('')}
</div>`
}

function progressTrackerPage(weeks: HolidayWeek[]): string {
  return `
<div class="page">
  <div class="ex-header"><div class="ex-title">Progress Tracker</div></div>
  <div class="tracker-note">Tick a box each week you complete your work.</div>
  <div class="tracker-grid">
    ${weeks.map(w => `
    <div class="tracker-cell">
      <div class="checkbox big"></div>
      <div class="tracker-label">Week ${w.week}</div>
    </div>`).join('')}
  </div>
</div>`
}

function returnChecklistPage(studentName: string): string {
  return `
<div class="page">
  <div class="ex-header"><div class="ex-title">Return Checklist</div></div>
  <div class="checklist">
    <div class="checklist-item"><div class="checkbox"></div> All exercises attempted</div>
    <div class="checklist-item"><div class="checkbox"></div> Reflection page completed</div>
    <div class="checklist-item"><div class="checkbox"></div> Parent has seen and signed below</div>
    <div class="checklist-item"><div class="checkbox"></div> Pack returned to teacher</div>
  </div>
  <div class="parent-section">
    <div class="parent-title">Parent / Guardian Acknowledgement</div>
    <div class="parent-note">I have seen ${escapeHtml(studentName)}'s completed holiday pack.</div>
    <div class="sig-row">
      <div class="sig">Parent Signature</div>
      <div class="sig">Date</div>
      <div class="sig">Comment (optional)</div>
    </div>
  </div>
  <div class="teacher-section">
    <div class="parent-title">Teacher Comment (on return)</div>
    <div class="teacher-lines"><div class="ans-line"></div><div class="ans-line"></div></div>
  </div>
  <div class="footer">EduNexus &nbsp;·&nbsp; edunexus.co.ke</div>
</div>`
}

/**
 * Renders a complete Printable Adaptive Learning Pack: weekly plan overview,
 * one adaptive-exercise page per AdaptiveTask, a reflection page, a
 * progress tracker, and the return checklist that becomes the physical
 * intake artifact for Holiday Return (Wave 5) — the Evidence Loop closure
 * for households with no smartphone.
 */
export function generateHolidayPackHTML(plan: HolidayPlanData, tasks: AdaptiveTask[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(plan.student_name)} — ${escapeHtml(plan.holiday_period)} Learning Pack</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11pt;color:#111}
.page{padding:18mm 20mm;page-break-after:always}
.page:last-child{page-break-after:auto}
.cover-title{font-size:20pt;font-weight:bold;margin-bottom:6px}
.cover-sub{font-size:11pt;color:#555;margin-bottom:18px}
.cover-note{background:#f7f7f7;border-left:3px solid #0d9488;padding:10px 14px;font-size:10pt;line-height:1.5;margin-bottom:18px}
table{width:100%;border-collapse:collapse}
td{vertical-align:top;padding:10px 8px;border-bottom:1px solid #e0e0e0}
.w-num{font-weight:bold;font-size:13pt;width:28px}
.w-label{font-weight:bold;font-size:10.5pt;margin-bottom:3px}
.rest-tag{font-size:8pt;color:#16a34a;border:1px solid #86efac;background:#f0fdf4;padding:1px 6px;border-radius:3px}
.w-task{font-size:9.5pt;margin-bottom:3px}
.w-parent{font-size:9pt;color:#666}
.w-check{width:36px}
.checkbox{width:16px;height:16px;border:1.5px solid #555;border-radius:3px}
.checkbox.big{width:22px;height:22px;margin:0 auto 4px}
.ex-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:14px}
.ex-title{font-size:15pt;font-weight:bold;text-transform:capitalize}
.badge{padding:4px 12px;border-radius:5px;font-weight:bold;font-size:10pt;white-space:nowrap}
.ex-why,.ex-goal{font-size:9.5pt;color:#444;margin-bottom:8px;line-height:1.4}
.curriculum-status{font-size:8pt;padding:5px 10px;margin-bottom:14px;border-radius:3px}
.curriculum-status.grounded{background:#f0fdf4;color:#166534;border:1px solid #86efac}
.curriculum-status.ungrounded{background:#fffbeb;color:#92400e;border:1px solid #fcd34d}
.question{margin:16px 0;page-break-inside:avoid}
.q-num{font-weight:bold;font-size:11pt;margin-bottom:5px}
.q-marks{font-size:8.5pt;color:#777;font-weight:normal;margin-left:6px}
.q-text{font-size:10.5pt;margin-bottom:8px;line-height:1.5}
.ans-line{border-bottom:1px solid #ccc;height:22px;margin-bottom:2px}
.tracker-note{font-size:9.5pt;color:#666;margin-bottom:16px}
.tracker-grid{display:flex;flex-wrap:wrap;gap:20px}
.tracker-cell{text-align:center;width:70px}
.tracker-label{font-size:9pt;color:#555}
.checklist-item{display:flex;align-items:center;gap:10px;font-size:10.5pt;margin-bottom:10px}
.parent-section,.teacher-section{margin-top:24px;border-top:2px dashed #bbb;padding-top:14px}
.parent-title{font-size:10.5pt;font-weight:bold;margin-bottom:6px}
.parent-note{font-size:9pt;color:#666;margin-bottom:14px}
.sig-row{display:flex;gap:32px}
.sig{flex:1;border-bottom:1px solid #555;padding-top:22px;font-size:8.5pt;color:#777}
.teacher-lines{margin-top:8px}
.footer{margin-top:20px;font-size:7.5pt;color:#bbb;text-align:center}
@media print{.page{padding:14mm 16mm}}
</style>
</head>
<body>

<div class="page">
  <div class="cover-title">${escapeHtml(plan.student_name)}'s ${escapeHtml(plan.holiday_period)} Learning Pack</div>
  <div class="cover-sub">Grade ${plan.grade}</div>
  <div class="cover-note">${escapeHtml(plan.parent_summary)}</div>
  ${plan.career_note ? `<div class="cover-note">${escapeHtml(plan.career_note)}</div>` : ''}
  <table>
    <tbody>
      ${plan.weeks.map(weekOverviewRow).join('')}
    </tbody>
  </table>
</div>

${tasks.map(exercisePage).join('')}

${reflectionPage()}

${progressTrackerPage(plan.weeks)}

${returnChecklistPage(plan.student_name)}
</body>
</html>`
}
