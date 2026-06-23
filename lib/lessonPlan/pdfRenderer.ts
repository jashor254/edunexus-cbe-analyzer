import type { LessonPlanRecord } from './types'
import { isKiswahiliSubject } from '@/lib/curriculum/subjectUtils'
import { toTitleCase } from '@/lib/utils/formatters'

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bullets(items: string[]): string {
  if (!items?.length) return '—'
  return `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
}

function nl2p(text: string | null | undefined): string {
  if (!text) return '&nbsp;'
  return esc(text)
    .split('\n')
    .map(l => `<p>${l}</p>`)
    .join('')
}

function extendedBullets(text: string | null | undefined): string {
  if (!text) return '—'
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => l.replace(/^[-•*\d]+[.)]\s*/, ''))
  if (!lines.length) return '—'
  return `<ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`
}

interface LessonPlanMeta {
  teacherName: string
  tscNumber: string
  school: string
  learningArea: string
  grade: string
  term: string | number
  year: number
}

function buildLessonPlanHTML(plan: LessonPlanRecord, meta: LessonPlanMeta, nextPlan?: LessonPlanRecord): string {
  const sw = isKiswahiliSubject(meta.learningArea)
  const school = toTitleCase(meta.school)
  const teacherName = toTitleCase(meta.teacherName)

  const labels = sw ? {
    title:              'MPANGO WA SOMO',
    outcomes:           'Malengo Maalum ya Somo',
    outcomesIntro:      'Mwishoni mwa somo, mwanafunzi aweze:',
    keyInquiry:         'Maswali ya Msingi ya Uchunguzi',
    resources:          'Vifaa vya Kufundishia / Kujifunzia',
    organisation:       'Mpangilio wa Kujifunza',
    introduction:       'Utangulizi / Kuanzisha Somo (Dak. 5)',
    development:        'Uendelezaji wa Somo',
    step1:              'Hatua ya 1 (Dak. 10):',
    step2:              'Hatua ya 2 (Dak. 10):',
    step3:              'Hatua ya 3 (Dak. 10):',
    conclusion:         'Hitimisho (Dak. 5)',
    extended:           'Shughuli za Ziada',
    reflection:         'Tafakuri ya Mwalimu / Maoni',
    strand:             'Mada:',
    subStrand:          'Mada Ndogo:',
    weekLesson:         'Wiki / Somo:',
    weekLabel:          'Wiki',
    lessonLabel:        'Somo',
    footer:             'EduNexus · For Kenyan Teachers',
  } : {
    title:              'LESSON PLAN',
    outcomes:           'Specific Learning Outcomes',
    outcomesIntro:      'By the end of the lesson, the learner should be able to:',
    keyInquiry:         'Key Inquiry Questions',
    resources:          'Teaching / Learning Resources',
    organisation:       'Organisation of Learning',
    introduction:       'Introduction / Getting Started (5 mins)',
    development:        'Lesson Development',
    step1:              'Step 1 (10 mins):',
    step2:              'Step 2 (10 mins):',
    step3:              'Step 3 (10 mins):',
    conclusion:         'Conclusion / Hitimisho (5 mins)',
    extended:           'Extended Activities',
    reflection:         'Reflection of the Lesson / Maoni',
    strand:             'Strand:',
    subStrand:          'Sub-strand:',
    weekLesson:         'Week / Lesson:',
    weekLabel:          'Week',
    lessonLabel:        'Lesson',
    footer:             'EduNexus · For Kenyan Teachers',
  }

  return `
  <div class="plan-page">
    <div class="plan-title">${labels.title}</div>

    <table class="header-table">
      <tr>
        <td class="header-cell"><span class="header-label">${sw ? 'SHULE' : 'SCHOOL'}</span><span class="header-value">${esc(school)}</span></td>
        <td class="header-cell"><span class="header-label">${sw ? 'DARASA' : 'GRADE'}</span><span class="header-value">${esc(meta.grade)}</span></td>
        <td class="header-cell"><span class="header-label">${sw ? 'SOMO' : 'SUBJECT'}</span><span class="header-value">${esc(meta.learningArea)}</span></td>
        <td class="header-cell"><span class="header-label">${sw ? 'TAREHE' : 'DATE'}</span><span class="header-value">${esc(plan.taught_date || '')}&nbsp;</span></td>
        <td class="header-cell"><span class="header-label">${sw ? 'WAKATI' : 'TIME'}</span><span class="header-value header-placeholder">_______</span></td>
        <td class="header-cell"><span class="header-label">${sw ? 'WANAFUNZI' : 'ROLL'}</span><span class="header-value header-placeholder">_______</span></td>
      </tr>
    </table>

    <table class="meta-table">
      <tr>
        <td class="meta-label">${labels.strand}</td>
        <td class="meta-value">${esc(plan.strand)}</td>
        <td class="meta-label">${labels.weekLesson}</td>
        <td class="meta-value">${labels.weekLabel} ${plan.week_number}, ${labels.lessonLabel} ${plan.lesson_number}</td>
      </tr>
      <tr>
        <td class="meta-label">${labels.subStrand}</td>
        <td class="meta-value" colspan="3">${esc(plan.sub_strand)}</td>
      </tr>
    </table>

    <div class="section">
      <div class="section-title">${labels.outcomes}</div>
      <div class="section-body">
        <p class="section-intro">${labels.outcomesIntro}</p>
        ${bullets(plan.learning_outcomes as string[])}
      </div>
    </div>

    <div class="section">
      <div class="section-title">${labels.keyInquiry}</div>
      <div class="section-body">
        <ol>${(plan.key_inquiry_questions as string[]).map(q => `<li>${esc(q)}</li>`).join('')}</ol>
      </div>
    </div>

    <div class="section">
      <div class="section-title">${labels.resources}</div>
      <div class="section-body">
        ${bullets(plan.learning_resources as string[])}
      </div>
    </div>

    <div class="section">
      <div class="section-title">${labels.organisation}</div>
      <div class="section-body">${nl2p(plan.organisation_of_learning)}</div>
    </div>

    <div class="section">
      <div class="section-title">${labels.introduction}</div>
      <div class="section-body">${nl2p(plan.introduction)}</div>
    </div>

    <div class="section">
      <div class="section-title">${labels.development}</div>
      <div class="section-body">
        <div class="step"><span class="step-label">${labels.step1}</span> ${nl2p(plan.step_1)}</div>
        <div class="step"><span class="step-label">${labels.step2}</span> ${nl2p(plan.step_2)}</div>
        <div class="step"><span class="step-label">${labels.step3}</span> ${nl2p(plan.step_3)}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">${labels.conclusion}</div>
      <div class="section-body">${nl2p(plan.conclusion)}</div>
    </div>

    <div class="section">
      <div class="section-title">${labels.extended}</div>
      <div class="section-body">${extendedBullets(plan.extended_activities)}</div>
    </div>

    <div class="section reflection-section">
      <div class="section-title">${labels.reflection}</div>
      <div class="section-body reflection-body">
        <p class="reflection-draft-note">${sw ? '(Kujaza baada ya kufundisha)' : '(To be completed after teaching)'}</p>
        <p class="reflection-prompt">${sw ? 'Lengo gani la kujifunza halikufikiwa kikamilifu?' : 'Which learning outcome was not fully achieved?'}</p>
        <div class="reflection-line"></div>
        <div class="reflection-line"></div>
        <div class="reflection-line"></div>
        <p class="reflection-prompt">${sw ? 'Nitafanya nini tofauti katika somo lijalo?' : 'What will I do differently in the next lesson?'}</p>
        <div class="reflection-line"></div>
        <div class="reflection-line"></div>
        <div class="reflection-line"></div>
      </div>
    </div>

    ${nextPlan ? `
    <div class="next-lesson-preview">
      <div class="next-lesson-label">${sw ? 'SOMO LIJALO' : 'NEXT LESSON PREVIEW'}</div>
      <div class="next-lesson-body">
        <span><strong>${sw ? 'Mada Ndogo' : 'Sub-strand'}:</strong> ${esc(nextPlan.sub_strand)}</span>
        <span><strong>${sw ? 'Wiki / Somo' : 'Week / Lesson'}:</strong> ${sw ? 'Wiki' : 'Week'} ${nextPlan.week_number}, ${sw ? 'Somo' : 'Lesson'} ${nextPlan.lesson_number}</span>
      </div>
    </div>` : ''}

    <div class="plan-footer">
      <span>${esc(teacherName)} &nbsp;|&nbsp; TSC No: ${esc(meta.tscNumber)} &nbsp;|&nbsp; Term ${meta.term} ${meta.year}</span>
      <span>${labels.footer}</span>
    </div>
  </div>`
}

export function generateLessonPlanHTML(
  plans: LessonPlanRecord[],
  meta: LessonPlanMeta
): string {
  const pages = plans
    .map((plan, i) => {
      const page = buildLessonPlanHTML(plan, meta, plans[i + 1])
      return i < plans.length - 1
        ? page + '<div class="page-break"></div>'
        : page
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Lesson Plan — ${esc(meta.learningArea)} ${esc(meta.grade)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; }

    .page-break { page-break-after: always; break-after: page; }

    .plan-page { padding: 12mm 14mm; max-width: 210mm; }

    .plan-title {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      letter-spacing: 3px;
      color: #1e3a5f;
      border-bottom: 3px solid #1e3a5f;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }

    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .header-cell {
      border: 1px solid #999;
      padding: 4px 6px;
      text-align: left;
    }
    .header-label {
      display: block;
      font-size: 7pt;
      font-weight: bold;
      color: #555;
      text-transform: uppercase;
    }
    .header-value {
      display: block;
      font-size: 9.5pt;
      font-weight: bold;
      min-height: 16px;
    }
    .header-placeholder {
      color: #9CA3AF;
      font-style: italic;
      font-weight: normal;
    }

    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .meta-label {
      font-weight: bold;
      font-size: 9pt;
      padding: 4px 8px 4px 0;
      width: 18%;
      white-space: nowrap;
    }
    .meta-value {
      font-size: 9.5pt;
      padding: 4px;
      border-bottom: 1px solid #ccc;
    }

    .section {
      margin-bottom: 8px;
      border: 1px solid #ddd;
      border-radius: 2px;
    }
    .section-title {
      background: #1e3a5f;
      color: #fff;
      font-size: 9pt;
      font-weight: bold;
      padding: 4px 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section-body {
      padding: 6px 10px;
      font-size: 9.5pt;
      line-height: 1.5;
    }
    .section-body p { margin: 2px 0; }
    .section-intro { font-style: italic; margin-bottom: 4px; color: #444; }
    ul, ol { margin: 0; padding-left: 18px; }
    ul li, ol li { margin-bottom: 2px; }

    .step { margin-bottom: 6px; }
    .step-label { font-weight: bold; }

    .reflection-section .section-title { background: #374151; }
    .reflection-draft-note { font-size: 7.5pt; color: #9ca3af; font-style: italic; margin-bottom: 6px; }
    .reflection-prompt {
      font-size: 9px;
      color: #6B7280;
      font-style: italic;
      margin-bottom: 4px;
      margin-top: 6px;
    }
    .reflection-body { min-height: 40px; }
    .reflection-line {
      border-bottom: 1px solid #D1D5DB;
      height: 24px;
      margin-bottom: 8px;
    }

    .next-lesson-preview {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 2px;
      padding: 8px 10px;
      margin-top: 8px;
    }
    .next-lesson-label {
      font-size: 7pt;
      font-weight: bold;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .next-lesson-body {
      font-size: 8pt;
      color: #374151;
      display: flex;
      gap: 20px;
    }

    .plan-footer {
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px solid #ccc;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #666;
    }

    @media print {
      .no-print { display: none !important; }
      @page {
        size: A4 portrait;
        margin: 8mm;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:right;padding:12px 16px;">
    <button onclick="window.print()"
      style="background:#1e3a5f;color:#fff;border:none;padding:10px 22px;border-radius:6px;
             font-size:10pt;cursor:pointer;font-weight:bold;">
      Print / Save as PDF
    </button>
  </div>
  ${pages}
</body>
</html>`
}

export function downloadLessonPlanPDF(
  plans: LessonPlanRecord[],
  meta: LessonPlanMeta
): void {
  const html = generateLessonPlanHTML(plans, meta)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 800)
}
