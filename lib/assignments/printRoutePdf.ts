// lib/assignments/printRoutePdf.ts
//
// Printable Adaptive Assignments pilot — combines an APPROVED print run's
// three route bodies plus the roster routing into one printable HTML
// document: a teacher-only routing sheet first, then the three route
// copies. No ZIP, no per-learner stored PDF, no server-side PDF binary —
// the existing, proven browser-print (`window.print()`) pattern is reused
// (8 other usages of @media print already exist in this codebase; see the
// Adaptive Assignment Domain audit §9), matching the locked instruction to
// avoid new batch/ZIP infrastructure for the pilot.
//
// Student-facing pages (everything after the routing sheet) never contain:
// the route name, the evidence band, or any capability/weakness language —
// only title/subject/instructions/tasks/due date/school/class info, per the
// locked "learner-facing pages must not display these labels" rule. The
// routing sheet is the ONE page in this document carrying route labels and
// evidence notes, and it is visually marked "Teacher copy only".

import type { PrintRunRow, PrintRouteRow, PrintRoute } from '@/lib/repositories/assignmentPrintRun.repository'
import { ROUTE_LABEL } from './printRoutes'

export type PrintMode = 'grouped' | 'named'

export type PrintRouteDocumentOptions = {
  run: PrintRunRow
  routes: PrintRouteRow[]
  /** student_id -> display name, resolved by the caller (repos.assignments.listClassRoster) — the route rows themselves only store student_id. */
  studentNames: Record<string, string>
  meta: { school?: string; grade?: string; teacherName?: string; className?: string }
  mode: PrintMode
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const SHARED_STYLE = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11pt;color:#111}
.sheet{padding:18mm 20mm;page-break-after:always}
.sheet:last-child{page-break-after:auto}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #111;padding-bottom:10px;margin-bottom:14px}
.title{font-size:15pt;font-weight:bold;margin-bottom:3px}
.subtitle{font-size:9.5pt;color:#555}
.school{font-size:8.5pt;color:#777;margin-top:2px}
.badge{padding:5px 14px;border-radius:5px;font-weight:bold;font-size:11pt;border:1.5px solid #999}
.teacher-only-badge{background:#fef2f2;color:#991b1b;border-color:#fca5a5}
.info-row{display:flex;gap:18px;padding:8px 0;border-bottom:1px solid #e0e0e0;margin-bottom:16px;flex-wrap:wrap}
.info-cell{display:flex;flex-direction:column;min-width:120px}
.info-label{font-size:7.5pt;color:#999;text-transform:uppercase;letter-spacing:.5px}
.info-val{font-weight:bold;font-size:10.5pt;border-bottom:1px solid #aaa;min-width:140px;padding-bottom:1px}
.task-instructions{background:#f7f7f7;border-left:3px solid #0d9488;padding:9px 13px;margin-bottom:14px;font-size:10.5pt;line-height:1.6}
.route-scaffold{background:#eff6ff;border:1px dashed #93c5fd;padding:8px 12px;margin-bottom:8px;font-size:9.5pt;color:#1d4ed8;border-radius:4px}
.route-scaffold-example{background:#f0fdf4;border-color:#86efac;color:#166534}
.route-extension{background:#fffbeb;border:1px dashed #fcd34d;padding:8px 12px;margin:14px 0 8px;font-size:9.5pt;color:#92400e;border-radius:4px}
.answer-lines{margin:8px 0 16px}
.ans-line{border-bottom:1px solid #ccc;height:22px;margin-bottom:2px}
table.roster{width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:10px}
table.roster th{background:#0b1530;color:#fff;text-align:left;padding:6px 8px;font-size:8.5pt;text-transform:uppercase}
table.roster td{padding:6px 8px;border-bottom:1px solid #e5e5e5}
.route-count{font-size:9.5pt;margin:4px 0}
.footer{margin-top:20px;font-size:7.5pt;color:#bbb;text-align:center}
@media print{.sheet{padding:14mm 16mm}}
`

function renderHeader(title: string, subtitle: string, meta: PrintRouteDocumentOptions['meta'], badge: { text: string; teacherOnly?: boolean }): string {
  return `
    <div class="top">
      <div>
        <div class="title">${escapeHtml(title)}</div>
        <div class="subtitle">${escapeHtml(subtitle)}</div>
        ${meta.school ? `<div class="school">${escapeHtml(meta.school)}${meta.grade ? ` &middot; Grade ${escapeHtml(meta.grade)}` : ''}${meta.className ? ` &middot; ${escapeHtml(meta.className)}` : ''}</div>` : ''}
      </div>
      ${badge.text ? `<div class="badge${badge.teacherOnly ? ' teacher-only-badge' : ''}">${escapeHtml(badge.text)}</div>` : ''}
    </div>
  `
}

function renderRoutingSheet(opts: PrintRouteDocumentOptions): string {
  const { run, routes, meta, studentNames } = opts
  const counts: Record<PrintRoute, number> = { guided: 0, core: 0, extension: 0 }
  for (const r of routes) counts[r.route]++

  const rows = routes
    .slice()
    .sort((a, b) => (studentNames[a.student_id] ?? '').localeCompare(studentNames[b.student_id] ?? ''))
    .map(r => `
      <tr>
        <td>${escapeHtml(studentNames[r.student_id] ?? r.student_id)}</td>
        <td>${ROUTE_LABEL[r.route]}</td>
        <td>${r.source === 'teacher_override' ? 'Teacher override' : 'Suggested'}</td>
        <td>${r.evidence_note ? escapeHtml(r.evidence_note) : '&mdash;'}</td>
      </tr>
    `).join('')

  return `
    <div class="sheet">
      ${renderHeader(run.assignment_snapshot.title, `${run.assignment_snapshot.subject} &middot; Teacher routing sheet`, meta, { text: 'Teacher copy only', teacherOnly: true })}
      <p style="font-size:9.5pt;color:#666;margin-bottom:10px">This page is for the teacher only — never distribute to learners or parents. It records which printable route each learner received and why, approved on ${new Date(run.approved_at ?? run.generated_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}.</p>
      <div class="route-count">Guided Practice: <strong>${counts.guided}</strong> &middot; Core Practice: <strong>${counts.core}</strong> &middot; Extension Practice: <strong>${counts.extension}</strong></div>
      <table class="roster">
        <thead><tr><th>Student</th><th>Route</th><th>Source</th><th>Basis</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">EduNexus &middot; edunexus.co.ke &middot; adaptation_version ${escapeHtml(run.adaptation_version)}</div>
    </div>
  `
}

function renderRouteCopy(opts: PrintRouteDocumentOptions, route: PrintRoute, studentName: string | null): string {
  const { run, meta } = opts
  const body = run.route_content[route].html
  return `
    <div class="sheet">
      ${renderHeader(run.assignment_snapshot.title, `${run.assignment_snapshot.subject} &middot; ${run.assignment_snapshot.topic}`, meta, { text: '' })}
      <div class="info-row">
        <div class="info-cell">
          <span class="info-label">Student Name</span>
          <span class="info-val">${studentName ? escapeHtml(studentName) : '&nbsp;'.repeat(30)}</span>
        </div>
        <div class="info-cell">
          <span class="info-label">Due Date</span>
          <span class="info-val" style="font-weight:normal">${escapeHtml(new Date(run.assignment_snapshot.due_date).toLocaleDateString('en-KE', { dateStyle: 'medium' }))}</span>
        </div>
      </div>
      ${body}
    </div>
  `
}

/**
 * The full combined printable document: routing sheet, then either one
 * grouped master copy per route (photocopy N times — the default,
 * minimizes paper handling for a 40-50 learner class) or one named copy
 * per learner (`mode: 'named'`, only when operationally necessary).
 */
export function buildPrintRouteDocument(opts: PrintRouteDocumentOptions): string {
  const sheets: string[] = [renderRoutingSheet(opts)]

  if (opts.mode === 'named') {
    const byRoute = opts.routes.slice().sort((a, b) => a.route.localeCompare(b.route))
    for (const r of byRoute) {
      sheets.push(renderRouteCopy(opts, r.route, opts.studentNames[r.student_id] ?? null))
    }
  } else {
    (['guided', 'core', 'extension'] as PrintRoute[]).forEach(route => {
      if (opts.routes.some(r => r.route === route)) {
        sheets.push(renderRouteCopy(opts, route, null))
      }
    })
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>${escapeHtml(opts.run.assignment_snapshot.title)} — Printable Routes</title>
<style>${SHARED_STYLE}</style>
</head>
<body>${sheets.join('')}</body>
</html>`
}
