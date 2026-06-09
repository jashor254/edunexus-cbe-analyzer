// lib/sow/pdfGenerator.ts
// Generates HTML for printing/downloading as PDF.
// Follows KNEC SOW template format.

import type { SOWPreviewData, GeneratedLesson, BreakItem } from './types'

const NAMED_BREAK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'August Holiday':    { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  'Half Term':         { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
  'October Holiday':   { bg: '#FCE7F3', text: '#9D174D', border: '#EC4899' },
  'Games Day':         { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
  'Public Holiday':    { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
  'Revision Week':     { bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6' },
  'Exam Week':         { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
}

const BREAK_FALLBACK = [
  { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
  { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
  { bg: '#FCE7F3', text: '#9D174D', border: '#EC4899' },
  { bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6' },
]

function buildBreakColorMap(breaks: BreakItem[]): Record<string, { bg: string; text: string; border: string }> {
  const names = [...new Set(breaks.map(b => b.title))]
  return Object.fromEntries(
    names.map((name, i) => [
      name,
      NAMED_BREAK_COLORS[name] ?? BREAK_FALLBACK[i % BREAK_FALLBACK.length],
    ])
  )
}

export function generateSOWHtml(data: SOWPreviewData): string {
  const { meta, lessons } = data
  const isKcse = meta.curriculumMode.startsWith('844')

  const termLabels = {
    strand:    isKcse ? 'TOPIC'     : 'STRAND',
    substrand: isKcse ? 'SUBTOPIC'  : 'SUBSTRAND',
    outcomes:  isKcse ? 'SPECIFIC OBJECTIVES' : 'SPECIFIC LEARNING OUTCOMES',
  }

  const sortedBreaks: BreakItem[] = [...(data.breaks ?? [])].sort((a, b) =>
    a.startWeek !== b.startWeek ? a.startWeek - b.startWeek : a.startLesson - b.startLesson
  )

  const breakColorMap = buildBreakColorMap(sortedBreaks)
  const rowParts: string[] = []
  let bi = 0

  function breakRowHtml(b: BreakItem): string {
    const wkRange = b.startWeek === b.endWeek
      ? `Wk ${b.startWeek}`
      : `Wk ${b.startWeek}–${b.endWeek}`
    const c = breakColorMap[b.title] ?? BREAK_FALLBACK[0]
    return `
    <tr style="background-color:${c.bg};border-left:4px solid ${c.border};">
      <td class="cell-center" style="color:${c.text};font-weight:700;">${b.startWeek}</td>
      <td class="cell-center" style="color:${c.text};">—</td>
      <td colspan="8" style="padding:5px 8px;">
        <span style="display:inline-block;background:${c.border};color:#fff;font-size:7pt;font-weight:900;padding:1px 6px;border-radius:3px;letter-spacing:0.5px;">BREAK</span>
        <strong style="color:${c.text};margin-left:6px;">${escHtml(b.title)}</strong>
        <span style="color:${c.text};font-size:7pt;margin-left:6px;opacity:0.7;">${escHtml(wkRange)}</span>
      </td>
    </tr>`
  }

  for (const l of lessons) {
    while (bi < sortedBreaks.length && sortedBreaks[bi].endWeek < l.week) {
      rowParts.push(breakRowHtml(sortedBreaks[bi++]))
    }
    rowParts.push(`
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
    </tr>`)
  }
  while (bi < sortedBreaks.length) {
    rowParts.push(breakRowHtml(sortedBreaks[bi++]))
  }

  const rows = rowParts.join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Scheme of Work — ${escHtml(meta.learningArea)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; background: #fff; }
    .page { padding: 16mm 12mm; }

    /* Cover page */
    .cover {
      page-break-after: always;
      border: 2px solid #1a3c5e;
      padding: 24mm 20mm;
      min-height: 240mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .cover-title {
      text-align: center;
      font-size: 18pt;
      font-weight: bold;
      letter-spacing: 2px;
      margin-bottom: 6mm;
    }
    .cover-subtitle {
      text-align: center;
      font-size: 11pt;
      color: #1a3c5e;
      margin-bottom: 10mm;
      font-weight: bold;
    }
    .cover-divider { border: none; border-top: 1.5px solid #1a3c5e; margin: 6mm 0; }
    .cover-section { margin-bottom: 8mm; }
    .cover-row {
      display: flex;
      align-items: baseline;
      margin-bottom: 5mm;
      gap: 6mm;
    }
    .cover-label {
      font-size: 9pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #555;
      width: 52mm;
      flex-shrink: 0;
    }
    .cover-value { font-size: 10pt; border-bottom: 1px solid #999; flex: 1; min-height: 5mm; }
    .cover-branding {
      text-align: center;
      font-size: 7.5pt;
      color: #888;
      margin-top: 8mm;
    }

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

    /* Break row colors now applied via inline styles */

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

  <!-- Print button (hidden on print) -->
  <div class="no-print" style="text-align:right;padding:8px 12mm 0;">
    <button onclick="window.print()"
      style="background:#0d7c66;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-size:10pt;cursor:pointer;font-weight:bold;">
      Print / Save as PDF
    </button>
  </div>

  <!-- ── Cover page ──────────────────────────────────────────────────────── -->
  <div class="page">
    <div class="cover">

      <div>
        <div class="cover-title">SCHEME OF WORK</div>

        <hr class="cover-divider" />

        <div class="cover-section">
          <div class="cover-row">
            <span class="cover-label">Subject</span>
            <span class="cover-value">${escHtml(meta.learningArea)}</span>
          </div>
          <div class="cover-row">
            <span class="cover-label">Grade / Form</span>
            <span class="cover-value">${escHtml(meta.grade)}</span>
          </div>
          <div class="cover-row">
            <span class="cover-label">Term</span>
            <span class="cover-value">Term ${escHtml(meta.term)} · ${meta.year}</span>
          </div>
          <div class="cover-row">
            <span class="cover-label">School</span>
            <span class="cover-value">${escHtml(meta.school)}</span>
          </div>
        </div>

        <hr class="cover-divider" />

        <div class="cover-section">
          <div class="cover-row">
            <span class="cover-label">Teacher's Name</span>
            <span class="cover-value">${escHtml(meta.teacherName || '')}</span>
          </div>
          <div class="cover-row">
            <span class="cover-label">TSC Number</span>
            <span class="cover-value">${escHtml(meta.tscNumber || '')}</span>
          </div>
          <div class="cover-row">
            <span class="cover-label">Signature</span>
            <span class="cover-value"></span>
          </div>
          <div class="cover-row">
            <span class="cover-label">Date</span>
            <span class="cover-value"></span>
          </div>
        </div>

        <hr class="cover-divider" />
      </div>

      <div class="cover-branding">EduNexus &mdash; edunexus.co.ke</div>
    </div>
  </div>

  <!-- ── SOW Table page ──────────────────────────────────────────────────── -->
  <div class="page">

    <!-- Header -->
    <div class="header-title">SCHEME OF WORK</div>
    <div class="header-sub">${escHtml(meta.learningArea)} · ${escHtml(meta.grade)} · Term ${escHtml(meta.term)} ${meta.year}</div>

    <!-- Meta info -->
    <div class="meta-grid">
      <div class="meta-item"><strong>School</strong>${escHtml(meta.school)}</div>
      <div class="meta-item"><strong>Subject</strong>${escHtml(meta.learningArea)}</div>
      <div class="meta-item"><strong>Grade / Form</strong>${escHtml(meta.grade)}</div>
      <div class="meta-item"><strong>Term</strong>Term ${escHtml(meta.term)}</div>
      <div class="meta-item"><strong>Year</strong>${meta.year}</div>
      <div class="meta-item"><strong>Textbook</strong>${escHtml(meta.textbook || '—')}</div>
      <div class="meta-item"><strong>Total Lessons</strong>${meta.totalLessons}</div>
      <div class="meta-item"><strong>Total Weeks</strong>${meta.totalWeeks}</div>
      <div class="meta-item"><strong>Date</strong>${escHtml(meta.generatedDate)}</div>
    </div>

    <!-- SOW Table -->
    <table>
      <thead>
        <tr>
          <th style="width:28px">WEEK</th>
          <th style="width:28px">LESSON</th>
          <th style="width:85px">${termLabels.strand}</th>
          <th style="width:85px">${termLabels.substrand}</th>
          <th style="width:130px">LESSON LEARNING OUTCOMES</th>
          <th style="width:130px">LEARNING EXPERIENCES</th>
          <th style="width:110px">KEY INQUIRY QUESTIONS</th>
          <th style="width:100px">LEARNING RESOURCES</th>
          <th style="width:90px">ASSESSMENT METHODS</th>
          <th style="width:75px">REFLECTION</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <!-- Summary footer -->
    <div class="summary">
      <span>Total Lessons: <strong>${meta.totalLessons}</strong></span>
      <span>Generated by EduNexus · ${escHtml(meta.generatedDate)}</span>
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

  const sortedBreaksText: BreakItem[] = [...(data.breaks ?? [])].sort((a, b) =>
    a.startWeek !== b.startWeek ? a.startWeek - b.startWeek : a.startLesson - b.startLesson
  )
  let bi = 0

  for (const l of lessons) {
    while (bi < sortedBreaksText.length && sortedBreaksText[bi].endWeek < l.week) {
      const b = sortedBreaksText[bi++]
      const wkRange = b.startWeek === b.endWeek ? `Wk ${b.startWeek}` : `Wk ${b.startWeek}–${b.endWeek}`
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      lines.push(`[BREAK]  ${b.title}  (${wkRange})`)
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      lines.push('')
    }
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

  // Inject any breaks that fall after the last lesson
  while (bi < sortedBreaksText.length) {
    const b = sortedBreaksText[bi++]
    const wkRange = b.startWeek === b.endWeek ? `Wk ${b.startWeek}` : `Wk ${b.startWeek}–${b.endWeek}`
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`[BREAK]  ${b.title}  (${wkRange})`)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
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
