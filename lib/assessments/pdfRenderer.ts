import type { ClassAssessment, LearnerMark } from './types'

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface MarksheetMeta {
  teacherName: string
  school: string
}

export function generateMarksheetHTML(
  assessment: ClassAssessment,
  marks: LearnerMark[],
  meta: MarksheetMeta
): string {
  const sorted = [...marks].sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
  const maxTotal = assessment.subjects.length * assessment.max_score

  const classTotal  = sorted.reduce((s, m) => s + (m.total_marks || 0), 0)
  const classAvg    = sorted.length > 0 ? Math.round((classTotal / sorted.length) * 10) / 10 : 0
  const highestMark = sorted.length > 0 ? (sorted[0].total_marks || 0) : 0
  const lowestMark  = sorted.length > 0 ? (sorted[sorted.length - 1].total_marks || 0) : 0

  const subjectHeaders = assessment.subjects
    .map((s) => `<th class="sub-th">${esc(s)}</th>`)
    .join('')

  const subjectAvgs = assessment.subjects.map((subj) => {
    const scores = sorted
      .map((m) => Number(m.subject_scores[subj]) || 0)
      .filter((_, i) => sorted[i].subject_scores[subj] !== undefined)
    const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0
    return `<td class="avg-cell">${Math.round(avg * 10) / 10}</td>`
  }).join('')

  const rows = sorted.map((m, i) => {
    const subjectCells = assessment.subjects
      .map((s) => `<td class="score-cell">${m.subject_scores[s] !== undefined ? m.subject_scores[s] : '—'}</td>`)
      .join('')

    const rowClass = i % 2 === 0 ? 'row-even' : 'row-odd'
    const pos = m.position || '—'

    return `
      <tr class="${rowClass}">
        <td class="num-cell">${i + 1}</td>
        <td class="name-cell">${esc(m.student_name)}</td>
        <td class="adm-cell">${esc(m.admission_number)}</td>
        ${subjectCells}
        <td class="total-cell">${m.total_marks !== null ? m.total_marks : '—'}</td>
        <td class="pos-cell">${pos}</td>
      </tr>`
  }).join('')

  const typeLabel: Record<string, string> = {
    opener: 'Opener', cat: 'CAT', midterm: 'Midterm',
    endterm: 'End Term', exam: 'Exam', assignment: 'Assignment',
  }
  const typeStr = typeLabel[assessment.assessment_type] || assessment.assessment_type

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Marksheet — ${esc(assessment.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; background: #fff; }

    .no-print { text-align: right; padding: 10px 16px; }
    .no-print button {
      background: #1e3a5f; color: #fff; border: none;
      padding: 9px 20px; border-radius: 6px;
      font-size: 10pt; cursor: pointer; font-weight: bold;
    }

    .page { padding: 10mm 12mm; max-width: 297mm; }

    .doc-title {
      text-align: center; font-size: 15pt; font-weight: bold;
      letter-spacing: 3px; color: #1e3a5f;
      border-bottom: 3px solid #1e3a5f;
      padding-bottom: 5px; margin-bottom: 8px;
      text-transform: uppercase;
    }

    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1px solid #999; }
    .meta-table td { border: 1px solid #999; padding: 4px 7px; }
    .meta-label { font-size: 7pt; font-weight: bold; color: #555; text-transform: uppercase; display: block; }
    .meta-value { font-size: 9.5pt; font-weight: bold; display: block; min-height: 16px; }

    .marksheet-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .marksheet-table th, .marksheet-table td {
      border: 1px solid #ccc; padding: 3px 5px;
    }
    thead tr { background: #1e3a5f; color: #fff; }
    .marksheet-table th { font-size: 7.5pt; font-weight: bold; text-align: center; }

    .num-cell  { text-align: center; width: 28px; }
    .name-cell { text-align: left; min-width: 120px; font-weight: bold; }
    .adm-cell  { text-align: center; width: 55px; font-size: 7.5pt; }
    .sub-th    { text-align: center; min-width: 55px; font-size: 7pt; }
    .score-cell { text-align: center; }
    .total-cell { text-align: center; font-weight: bold; background: #f0f9ff; }
    .pos-cell   { text-align: center; font-weight: bold; background: #f0fff4; }

    .row-even { background: #fff; }
    .row-odd  { background: #f9fafb; }

    .avg-row td { background: #fffde7; font-weight: bold; font-size: 8pt; text-align: center; border-top: 2px solid #ccc; }
    .avg-label { text-align: center !important; font-style: italic; }

    .footer-stats {
      display: flex; gap: 24px; font-size: 8pt; color: #444;
      border-top: 1px solid #ccc; padding-top: 6px; margin-top: 6px;
    }
    .footer-stats span { font-weight: bold; color: #1e3a5f; }

    .doc-footer {
      margin-top: 10px; padding-top: 5px; border-top: 1px solid #ccc;
      display: flex; justify-content: space-between;
      font-size: 7.5pt; color: #666;
    }

    @media print {
      .no-print { display: none !important; }
      @page { size: A4 landscape; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="page">
    <div class="doc-title">Class Marksheet</div>

    <table class="meta-table">
      <tr>
        <td><span class="meta-label">School</span><span class="meta-value">${esc(meta.school)}</span></td>
        <td><span class="meta-label">Teacher</span><span class="meta-value">${esc(meta.teacherName)}</span></td>
        <td><span class="meta-label">Assessment</span><span class="meta-value">${esc(assessment.title)}</span></td>
        <td><span class="meta-label">Type</span><span class="meta-value">${typeStr}</span></td>
        <td><span class="meta-label">Term / Year</span><span class="meta-value">Term ${assessment.term} · ${assessment.year}</span></td>
        <td><span class="meta-label">Max Score</span><span class="meta-value">${assessment.max_score} per subject</span></td>
      </tr>
    </table>

    <table class="marksheet-table">
      <thead>
        <tr>
          <th class="num-cell">#</th>
          <th class="name-cell" style="text-align:left">Name</th>
          <th class="adm-cell">Adm No</th>
          ${subjectHeaders}
          <th class="total-cell">Total<br/><small>/${maxTotal}</small></th>
          <th class="pos-cell">Pos.</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="avg-row">
          <td colspan="3" class="avg-label">Class Average</td>
          ${subjectAvgs}
          <td>${classAvg}</td>
          <td>—</td>
        </tr>
      </tbody>
    </table>

    <div class="footer-stats">
      <div>Students: <span>${sorted.length}</span></div>
      <div>Class Average: <span>${classAvg} / ${maxTotal}</span></div>
      <div>Highest: <span>${highestMark}</span></div>
      <div>Lowest: <span>${lowestMark}</span></div>
    </div>

    <div class="doc-footer">
      <span>${esc(meta.school)} &nbsp;|&nbsp; Term ${assessment.term} ${assessment.year}</span>
      <span>Generated by EduNexus &middot; edunexus.co.ke</span>
    </div>
  </div>
</body>
</html>`
}

export function openMarksheetPDF(
  assessment: ClassAssessment,
  marks: LearnerMark[],
  meta: MarksheetMeta
): void {
  const html = generateMarksheetHTML(assessment, marks, meta)
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
