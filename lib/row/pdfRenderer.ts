// lib/row/pdfRenderer.ts
// HTML → browser print renderer for Record of Work.
// Portrait A4, 5-column: Date | Wk/Lesson | Work Done | Reflection | Signature

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ROWEntry {
  week_number:   number
  lesson_number: number
  date_taught?:  string | null
  strand:        string
  sub_strand:    string
  objectives:    string | string[]
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
  if (!raw) return '—'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtObjectives(v: string | string[] | undefined | null): string {
  if (!v) return ''
  const items = Array.isArray(v) ? v.filter(Boolean) : [v]
  if (!items.length) return ''
  return items.join(' ')
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildPage(row: RecordOfWork): string {
  const bodyRows = row.entries.map((e, i) => {
    const objText = fmtObjectives(e.objectives)
    return `
    <tr class="${i % 2 === 1 ? 'alt' : ''}">
      <td class="col-date">${esc(fmtDate(e.date_taught))}</td>
      <td class="col-wk center">Wk ${e.week_number}<br/><span class="sub">L${e.lesson_number}</span></td>
      <td class="col-work">
        <div class="wd-strand"><span class="lbl">Strand:</span> ${esc(e.strand)}</div>
        <div class="wd-sub"><span class="lbl">Sub-Strand:</span> ${esc(e.sub_strand)}</div>
        ${objText ? `<div class="wd-obj"><span class="lbl">Objectives:</span> ${esc(objText)}</div>` : ''}
      </td>
      <td class="col-ref">${esc(e.reflection)}</td>
      <td class="col-sig"></td>
    </tr>`
  }).join('')

  return `
  <div class="header-block">
    <div class="doc-title">RECORD OF WORK COVERED</div>
    <table class="meta-table">
      <tr>
        <td class="ml">School:</td>   <td class="mv">${esc(row.school)}</td>
        <td class="ml">Subject:</td>  <td class="mv">${esc(row.learning_area)}</td>
      </tr>
      <tr>
        <td class="ml">Grade:</td>    <td class="mv">${esc(row.grade)}</td>
        <td class="ml">Teacher:</td>  <td class="mv">${esc(row.teacher_name)}</td>
      </tr>
      <tr>
        <td class="ml">Term:</td>     <td class="mv">${esc(row.term)}</td>
        <td class="ml">Year:</td>     <td class="mv">${esc(row.year)}</td>
      </tr>
    </table>
  </div>

  <table class="row-table">
    <thead>
      <tr>
        <th class="col-date">Date</th>
        <th class="col-wk">Wk / Lesson</th>
        <th class="col-work">Work Done</th>
        <th class="col-ref">Reflection</th>
        <th class="col-sig">Signature</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="footer">EduNexus · edunexus.co.ke</div>`
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
  .col-date  { width: 25mm; }
  .col-wk    { width: 20mm; }
  .col-work  { width: 90mm; }
  .col-ref   { width: 35mm; }
  .col-sig   { width: 20mm; }

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

  /* ── Work Done cell ── */
  .lbl { font-weight: 700; }
  .wd-strand, .wd-sub { margin-bottom: 3px; }
  .wd-obj { margin-top: 4px; color: #1e293b; }

  /* ── Footer ── */
  .footer { margin-top: 10px; font-size: 8pt; color: #94a3b8; text-align: right; }

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
