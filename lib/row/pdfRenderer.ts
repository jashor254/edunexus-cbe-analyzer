// lib/row/pdfRenderer.ts
// HTML → browser print renderer for Record of Work.
// Portrait A4, 6-column: Date | Strand | Sub-Strand | Work Done | Reflection | Signature

import { toTitleCase } from '@/lib/utils/formatters'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ROWEntry {
  week_number:   number
  lesson_number: number
  date_taught?:  string | null
  strand:        string
  sub_strand:    string
  work_done:     string
  reflection:    string
}

export interface RecordOfWork {
  teacher_name:  string
  school:        string
  grade:         string
  learning_area: string
  term:          number | string
  year:          number | string
  entries:       ROWEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string | number | undefined | null): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '<span class="placeholder">dd/mm/yyyy</span>'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return esc(raw)
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtTerm(term: number | string): string {
  const s = String(term)
  return s.toLowerCase().startsWith('term') ? s : `Term ${s}`
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildPage(row: RecordOfWork): string {
  const school      = toTitleCase(row.school)
  const teacherName = toTitleCase(row.teacher_name)
  const term        = fmtTerm(row.term)

  const done  = row.entries.filter(e => e.work_done?.trim()).length
  const total = row.entries.length

  const bodyRows = row.entries.map((e, i) => `
    <tr class="${i % 2 === 1 ? 'alt' : ''}">
      <td class="col-date">${fmtDate(e.date_taught)}</td>
      <td class="col-strand">${esc(e.strand)}</td>
      <td class="col-sub">${esc(e.sub_strand)}</td>
      <td class="col-work">${esc(e.work_done)}</td>
      <td class="col-ref">${esc(e.reflection)}</td>
      <td class="col-sig"></td>
    </tr>`
  ).join('')

  return `
  <div class="header-block">
    <div class="doc-title">RECORD OF WORK COVERED</div>
    <table class="meta-table">
      <tr>
        <td class="ml">School:</td>   <td class="mv">${esc(school)}</td>
        <td class="ml">Subject:</td>  <td class="mv">${esc(row.learning_area)}</td>
      </tr>
      <tr>
        <td class="ml">Grade:</td>    <td class="mv">${esc(row.grade)}</td>
        <td class="ml">Teacher:</td>  <td class="mv">${esc(teacherName)}</td>
      </tr>
      <tr>
        <td class="ml">Term:</td>     <td class="mv">${esc(term)}</td>
        <td class="ml">Year:</td>     <td class="mv">${esc(row.year)}</td>
      </tr>
    </table>
  </div>

  <table class="row-table">
    <thead>
      <tr>
        <th class="col-date">Date</th>
        <th class="col-strand">Strand</th>
        <th class="col-sub">Sub-Strand</th>
        <th class="col-work">Work Done</th>
        <th class="col-ref">Reflection</th>
        <th class="col-sig">Signature</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="row-status">
    Record continues as lessons are completed — ${done} of ${total} lessons recorded
  </div>

  <div class="footer">EduNexus · For Kenyan Teachers</div>`
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; }

  /* ── Header block ── */
  .header-block { margin-bottom: 12px; }
  .doc-title {
    font-size: 13pt; font-weight: 900; text-align: center;
    text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;
  }
  .meta-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
  .meta-table td { padding: 5px 8px; border: 1px solid #cbd5e1; font-size: 10pt; }
  .ml { font-weight: 700; width: 18%; background: #f8fafc; }
  .mv { width: 32%; }

  /* ── ROW table ── */
  .row-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .col-date   { width: 20mm; }
  .col-strand { width: 32mm; }
  .col-sub    { width: 32mm; }
  .col-work   { width: 52mm; }
  .col-ref    { width: 22mm; }
  .col-sig    { width: 22mm; }

  thead tr { background: #1e293b; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  th {
    padding: 7px 6px; text-align: left; font-size: 9pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #334155;
  }
  td {
    padding: 6px 6px; border: 1px solid #cbd5e1; vertical-align: top;
    font-size: 10pt; line-height: 1.45; min-height: 50px;
  }
  tr.alt td { background: #f8fafc; }
  .center { text-align: center; }
  .sub { font-size: 8pt; color: #64748b; }
  .placeholder { color: #9CA3AF; font-style: italic; }

  /* ── Status + Footer ── */
  .row-status {
    margin-top: 12px; padding-top: 8px; border-top: 1px solid #E5E7EB;
    font-size: 8pt; color: #9CA3AF; font-style: italic; text-align: center;
  }
  .footer { margin-top: 6px; font-size: 8pt; color: #94a3b8; text-align: right; }

  /* ── Print ── */
  @media print {
    .no-print { display: none !important; }
    @page { size: A4 portrait; margin: 15mm; }
    body { font-size: 10pt; }
    thead tr { background: #1e293b !important; color: #fff !important;
               -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr { page-break-inside: avoid; }
  }
`

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateROWHTML(row: RecordOfWork): string {
  const body = buildPage(row)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Record of Work — ${esc(row.learning_area)} ${esc(row.grade)} Term ${esc(row.term)} ${esc(row.year)}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="no-print" style="text-align:right;padding:10px 16px 0;">
    <button onclick="window.print()"
      style="background:#1e293b;color:#fff;border:none;padding:9px 20px;border-radius:6px;
             font-size:10pt;cursor:pointer;font-weight:700;">
      Print / Save as PDF
    </button>
  </div>
  <div style="padding:15mm;">
    ${body}
  </div>
</body>
</html>`
}

export function downloadROWAsPDF(row: RecordOfWork): void {
  const html = generateROWHTML(row)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 800)
}
