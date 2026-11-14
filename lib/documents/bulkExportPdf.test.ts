// lib/documents/bulkExportPdf.test.ts
//
// Regression: a bulk export that included lesson plans failed outright with
// "Invalid border style: 1" — the lesson-plan card style used the CSS
// shorthand `border: 1`, which @react-pdf/renderer cannot parse (it accepts
// `borderWidth` / `borderStyle` / `borderColor`). The Scheme of Work and
// Record of Work sections did not use it, so exports without lesson plans
// worked and the failure only appeared when a teacher ticked "lesson plans".
//
// These tests render real PDFs with the real library from synthetic data.
// No network, no database, no AI.
//
// Run: npx tsx --test lib/documents/bulkExportPdf.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateBulkExportPDF, type ExportScheme } from './bulkExportPdf'

type Lesson = { week: number; lesson: number; date: string | null }

function scheme(id: string, area: string, lessons: Lesson[], planCount: number): ExportScheme {
  return {
    meta: {
      id, school: 'Synthetic Example School', grade: 'Grade 8', learning_area: area, term: 2, year: 2026,
      curriculum_mode: 'cbc_junior', total_lessons: lessons.length, total_weeks: 6,
      teacher_name: 'Synthetic Teacher', tsc_number: '000000',
      lessons: lessons.map(l => ({ week: l.week, lesson: l.lesson, strand: 'Strand', substrand: 'Sub-strand', learningOutcomes: ['identify hazards'], learningResources: ['Class textbook'] })),
    },
    lessonPlans: lessons.slice(0, planCount).map((l, i) => ({
      id: `${id}-lp-${i}`, sow_id: id, teacher_id: 't', week_number: l.week, lesson_number: l.lesson,
      strand: 'Strand', sub_strand: 'Sub-strand', learning_outcomes: ['identify hazards', 'explain safety rules'],
      key_inquiry_questions: ['Why is safety important?'], learning_resources: ['Class textbook', 'Chart'],
      organisation_of_learning: 'Classroom — groups of 4', introduction: 'Learners answer an opening question.',
      step_1: 'Learners discuss hazard symbols in groups.', step_2: 'Learners prepare a safety chart.', step_3: 'Learners role-play first aid.',
      conclusion: 'Learners summarise the lesson.', extended_activities: '- Draw a poster\n- Write three rules\n- Ask a parent',
      reflection: 'Were learners able to identify hazards?', status: 'generated', taught_date: l.date,
      generated_at: '2026-05-01T00:00:00Z', created_at: '2026-05-01T00:00:00Z',
    })),
    recordOfWork: {
      rowId: `${id}-row`, schemeId: id, school: 'Synthetic Example School', grade: 'Grade 8', learningArea: area, term: '2', year: 2026,
      curriculumMode: 'cbc_junior', teacherName: 'Synthetic Teacher',
      entries: lessons.map(l => ({
        week: l.week, lesson: l.lesson, date_taught: l.date, strand: 'Strand', substrand: 'Sub-strand',
        activities_summary: ['Learners discuss hazard symbols in groups.'], reflection: '', remarks: '', learning_outcomes: ['identify hazards'],
      })),
    },
  }
}

const LESSONS: Lesson[] = [
  { week: 1, lesson: 1, date: '2026-05-04' }, { week: 1, lesson: 2, date: null },
  { week: 2, lesson: 1, date: null }, { week: 2, lesson: 2, date: null },
]

/** Number of page objects in a PDF buffer ("/Type /Page", not "/Type /Pages"). */
function pageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length
}

test('PDF-001 lesson plans only: renders a valid PDF (previously threw "Invalid border style: 1")', async () => {
  const pdf = await generateBulkExportPDF([scheme('s1', 'Integrated Science', LESSONS, 4)], { sow: false, lessonPlans: true, recordOfWork: false })
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-')
  assert.ok(pdf.length > 2000, 'non-trivial document')
  assert.ok(pageCount(pdf) >= 2, `cover + at least one lesson-plan page, got ${pageCount(pdf)}`)
})

test('PDF-002 all three sections together render', async () => {
  const pdf = await generateBulkExportPDF([scheme('s1', 'Integrated Science', LESSONS, 4)], { sow: true, lessonPlans: true, recordOfWork: true })
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-')
  const withoutPlans = await generateBulkExportPDF([scheme('s1', 'Integrated Science', LESSONS, 4)], { sow: true, lessonPlans: false, recordOfWork: true })
  assert.ok(pageCount(pdf) > pageCount(withoutPlans), 'including lesson plans adds pages')
})

test('PDF-003 multiple schemes (English and Kiswahili) with lesson plans render', async () => {
  const pdf = await generateBulkExportPDF(
    [scheme('s1', 'Integrated Science', LESSONS, 4), scheme('s2', 'Kiswahili', LESSONS, 2)],
    { sow: true, lessonPlans: true, recordOfWork: true },
  )
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-')
})

test('PDF-004 a scheme with no lesson plans still renders when lesson plans are requested', async () => {
  const pdf = await generateBulkExportPDF([scheme('s1', 'Integrated Science', LESSONS, 0)], { sow: true, lessonPlans: true, recordOfWork: true })
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-')
})

test('PDF-005 sections without lesson plans keep working (no regression)', async () => {
  const pdf = await generateBulkExportPDF([scheme('s1', 'Integrated Science', LESSONS, 4)], { sow: true, lessonPlans: false, recordOfWork: true })
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-')
})
