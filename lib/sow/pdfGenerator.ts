// lib/sow/pdfGenerator.ts
// Generates HTML for printing/downloading as PDF.
// Follows KNEC SOW template format.

import type { SOWPreviewData, GeneratedLesson } from './types'

export function generateSOWHtml(data: SOWPreviewData): string {
  const { meta, lessons, breaks } = data

  const rows = lessons
    .map(
      (l: GeneratedLesson) => `
    <tr>
      <td class="cell-center">${l.week}</td>
      <td class="cell-center">${l.lesson}</td>
      <td>${escHtml(l.strand)}</td>
      <td>${escHtml(l.substrand)}</td>
      <td>${bulletList(l.learningOutcomes)}</td>
      <td>${bulletList(l.learningExperiences)}</td>
      <td>${bulletList(l.keyInquiryQuestions)}</td>
      <td>${bulletList(l.learningResources)}</td>
      <td>${bulletList(l.assessmentMethods)}</td>
      <td>${escHtml(l.reflection || '')}</td>
    </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Scheme of Work — ${escHtml(meta.learningArea)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; background: #fff; }
    .page { padding: 16mm 12mm; }

    /* Header */
    .header-title { text-align: center; font-size: 13pt; font-weight: bold; margin-bottom: 2px; }
    .header-sub   { text-align: center; font-size: 10pt; margin-bottom: 12px; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 14px;
      border: 1px solid #333;
      padding: 8px;
    }
    .meta-item { font-size: 8.5pt; }
    .meta-item strong { display: block; font-size: 7.5pt; text-transform: uppercase; color: #555; }

    /* Table */
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th {
      background: #1a3c5e;
      color: #fff;
      font-size: 7.5pt;
      padding: 5px 4px;
      text-align: left;
      border: 1px solid #aaa;
    }
    td {
      font-size: 7.5pt;
      padding: 4px;
      border: 1px solid #bbb;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #f5f8ff; }
    .cell-center { text-align: center; }
    ul { margin: 0; padding-left: 14px; }
    ul li { margin-bottom: 2px; }

    /* Summary */
    .summary {
      margin-top: 12px;
      font-size: 8pt;
      color: #444;
      border-top: 1px solid #ccc;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
    }

    /* Print */
    @media print {
      .no-print { display: none !important; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Print button (hidden on print) -->
    <div class="no-print" style="text-align:right;margin-bottom:12px;">
      <button onclick="window.print()"
        style="background:#0d7c66;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-size:10pt;cursor:pointer;font-weight:bold;">
        Print / Save as PDF
      </button>
    </div>

    <!-- Header -->
    <div class="header-title">KENYA MINISTRY OF EDUCATION</div>
    <div class="header-sub">SCHEME OF WORK — ${escHtml(meta.curriculumMode.startsWith('cbc') ? 'CBC COMPETENCY-BASED CURRICULUM' : '8-4-4 KCSE CURRICULUM')}</div>

    <!-- Meta info -->
    <div class="meta-grid">
      <div class="meta-item"><strong>School</strong>${escHtml(meta.school)}</div>
      <div class="meta-item"><strong>Learning Area / Subject</strong>${escHtml(meta.learningArea)}</div>
      <div class="meta-item"><strong>Grade / Form</strong>${escHtml(meta.grade)}</div>
      <div class="meta-item"><strong>Term</strong>Term ${escHtml(meta.term)}</div>
      <div class="meta-item"><strong>Year</strong>${meta.year}</div>
      <div class="meta-item"><strong>Textbook</strong>${escHtml(meta.textbook || '—')}</div>
      <div class="meta-item"><strong>Total Lessons</strong>${meta.totalLessons}</div>
      <div class="meta-item"><strong>Total Weeks</strong>${meta.totalWeeks}</div>
      <div class="meta-item"><strong>Generated</strong>${escHtml(meta.generatedDate)}</div>
    </div>

    <!-- SOW Table -->
    <table>
      <thead>
        <tr>
          <th style="width:30px">WK</th>
          <th style="width:30px">LSN</th>
          <th style="width:90px">Strand / Topic</th>
          <th style="width:90px">Substrand / Subtopic</th>
          <th style="width:130px">Learning Outcomes</th>
          <th style="width:130px">Learning Experiences</th>
          <th style="width:110px">Key Inquiry Questions</th>
          <th style="width:100px">Learning Resources</th>
          <th style="width:90px">Assessment Methods</th>
          <th style="width:80px">Reflection</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <!-- Summary footer -->
    <div class="summary">
      <span>Total Lessons: <strong>${meta.totalLessons}</strong></span>
      <span>AI Quality Score: <strong>${Math.round(meta.averageConfidence * 100)}%</strong></span>
      <span>KICD Aligned · Generated by EduNexus AI · ${escHtml(meta.generatedDate)}</span>
    </div>
  </div>
</body>
</html>`
}

export function downloadSOWAsText(data: SOWPreviewData): string {
  const { meta, lessons } = data
  const lines: string[] = []

  lines.push('SCHEME OF WORK')
  lines.push('==============')
  lines.push(`School:        ${meta.school}`)
  lines.push(`Learning Area: ${meta.learningArea}`)
  lines.push(`Grade/Form:    ${meta.grade}`)
  lines.push(`Term:          ${meta.term}`)
  lines.push(`Year:          ${meta.year}`)
  lines.push(`Textbook:      ${meta.textbook || '—'}`)
  lines.push(`Total Lessons: ${meta.totalLessons}`)
  lines.push(`Generated:     ${meta.generatedDate}`)
  lines.push('')

  for (const l of lessons) {
    lines.push(`─────────────────────────────────────`)
    lines.push(`Week ${l.week}, Lesson ${l.lesson}`)
    lines.push(`Strand:    ${l.strand}`)
    lines.push(`Substrand: ${l.substrand}`)
    lines.push('')
    lines.push('Learning Outcomes:')
    l.learningOutcomes.forEach(o => lines.push(`  • ${o}`))
    lines.push('')
    lines.push('Learning Experiences:')
    l.learningExperiences.forEach(e => lines.push(`  • ${e}`))
    lines.push('')
    lines.push('Key Inquiry Questions:')
    l.keyInquiryQuestions.forEach(q => lines.push(`  • ${q}`))
    lines.push('')
    lines.push('Learning Resources:')
    l.learningResources.forEach(r => lines.push(`  • ${r}`))
    lines.push('')
    lines.push('Assessment Methods:')
    l.assessmentMethods.forEach(a => lines.push(`  • ${a}`))
    lines.push('')
    lines.push(`Core Competencies: ${l.coreCompetencies}`)
    lines.push(`Values:            ${l.values}`)
    lines.push(`PCI Links:         ${l.pciLinks}`)
    if (l.reflection) lines.push(`Reflection: ${l.reflection}`)
    lines.push('')
  }

  return lines.join('\n')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bulletList(items: string[]): string {
  if (!items || items.length === 0) return '—'
  return `<ul>${items.map(i => `<li>${escHtml(i)}</li>`).join('')}</ul>`
}
