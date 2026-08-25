// lib/career/clinicReport844Compatibility.integration.test.ts
//
// 8-4-4 Career Intelligence compatibility fix — end-to-end proof through
// buildClinicReport() (lib/career/clinicReportBuilder.ts), the function that
// previously hardcoded "CBC Senior"/"CBC Junior" and could surface CBC
// Senior School pathway vocabulary (STEM/Social Sciences/Arts & Sports
// Science/Business) to an 8-4-4/KCSE learner.
//
// Covers:
//   Test A — CBC Junior (Grade 8) is unchanged: still "CBC Junior", CBC
//            pathway semantics still apply where present.
//   Test B — CBC Senior (Grade 11) is unchanged: still "CBC Senior", CBC
//            pathway semantics still apply where present.
//   Test C — 8-4-4 Form 3 (curriculum_type='844', grade 11) never contains
//            "CBC Senior", "CBC Junior", or any CBC pathway name anywhere
//            in the built report, and still produces valid subject/capability
//            data (the report is not broken, just correctly framed).
//   Test E — an unrecorded (null) curriculum_type never silently reads as
//            CBC.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test lib/career/clinicReport844Compatibility.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { buildClinicReport } from './clinicReportBuilder'

const SYNTHETIC_MARKER = 'SYNTHETIC_844_COMPAT_TEST'
const db = createServiceClient()

const createdStudentIds: string[] = []
const createdAssessmentIds: string[] = []

after(async () => {
  if (createdAssessmentIds.length) await db.from('assessments').delete().in('id', createdAssessmentIds)
  if (createdStudentIds.length) await db.from('students').delete().in('id', createdStudentIds)
})

async function makeStudent(label: string, grade: number, curriculum_type: string | null): Promise<string> {
  const { data, error } = await db.from('students')
    .insert({ name: `${SYNTHETIC_MARKER} ${label}`, grade, curriculum_type })
    .select('id').single()
  if (error || !data) throw new Error(`makeStudent failed: ${error?.message}`)
  createdStudentIds.push(data.id)
  return data.id
}

async function makeAssessment(studentId: string, grade: number, subject_scores: Record<string, number>): Promise<void> {
  const { data, error } = await db.from('assessments')
    .insert({ student_id: studentId, term: 1, year: 2026, grade, subject_scores })
    .select('id').single()
  if (error || !data) throw new Error(`makeAssessment failed: ${error?.message}`)
  createdAssessmentIds.push(data.id)
}

/** Flattens every string value reachable from the report into one haystack for a leakage scan. */
function flattenStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach(v => flattenStrings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach(v => flattenStrings(v, out))
  return out
}

test('Test A — CBC Junior (Grade 8) is unchanged: label is CBC Junior', async () => {
  const studentId = await makeStudent('CBC Junior', 8, 'cbc')
  await makeAssessment(studentId, 8, { mathematics: 3, english: 3, integrated_science: 3 })

  const report = await buildClinicReport(studentId, db)

  assert.equal(report.section, 'junior')
  assert.equal(report.curriculumLabel, 'Grade 8 — CBC Junior')
  assert.equal(report.cbcPathwayAdmissible, true)
})

test('Test B — CBC Senior (Grade 11) is unchanged: label is CBC Senior, pathway vocabulary still admissible', async () => {
  const studentId = await makeStudent('CBC Senior', 11, 'cbc')
  await makeAssessment(studentId, 11, { mathematics: 3, english: 3, biology: 3, chemistry: 3, physics: 3 })

  const report = await buildClinicReport(studentId, db)

  assert.equal(report.section, 'senior')
  assert.equal(report.curriculumLabel, 'Grade 11 — CBC Senior')
  assert.equal(report.cbcPathwayAdmissible, true)
})

test('Test C — 8-4-4 Form 3 (grade 11): correct label, valid matches, and zero CBC vocabulary anywhere in the report', async () => {
  const studentId = await makeStudent('8-4-4 Form 3', 11, '844')
  await makeAssessment(studentId, 11, {
    mathematics: 3, english: 3, kiswahili: 3,
    biology: 3, chemistry: 3, physics: 3,
    business_studies: 3, history_and_government: 3,
  })

  const report = await buildClinicReport(studentId, db)

  // Correct framing
  assert.equal(report.curriculumLabel, '8-4-4 Form 3')
  assert.equal(report.cbcPathwayAdmissible, false)
  assert.equal(report.recommended_pathway, null, 'CBC pathway must not be exposed for an 8-4-4 learner')
  assert.equal(report.futureOpportunities, undefined, 'the CBC-pathway-keyed future-opportunities table must not be attached')

  // Report still produces valid, usable data — this is a framing fix, not a degradation
  assert.ok(report.top_subjects.length > 0, 'the report must still surface real subject data')
  assert.ok(report.overall_score > 0)
  const scoredSubjects = new Set([...report.top_subjects, ...report.weak_subjects].map(s => s.subject))
  assert.ok(
    [...scoredSubjects].some(s => s === 'business_studies' || s === 'history_and_government'),
    'Business Studies / History & Government must appear among the scored subjects, not be silently dropped',
  )

  // Zero-tolerance leakage scan across every string in the built report
  const haystack = flattenStrings(report).join(' ␞ ')
  assert.ok(!haystack.includes('CBC Senior'), 'no "CBC Senior" anywhere in the report')
  assert.ok(!haystack.includes('CBC Junior'), 'no "CBC Junior" anywhere in the report')
  for (const cbcPathwayName of ['STEM', 'Social Sciences', 'Arts & Sports Science']) {
    assert.ok(!haystack.includes(cbcPathwayName), `no CBC pathway name "${cbcPathwayName}" anywhere in the report`)
  }
})

test('Test E — an unrecognised curriculum_type (e.g. igcse) never silently reads as CBC', async () => {
  // students.curriculum_type is NOT NULL at the schema level, so the reachable
  // "unknown" state is an unrecognised value, not a null row — the resolver's
  // defensive null-handling is proven separately at the pure-function level
  // in lib/curriculum/gradeLabel.test.ts.
  const studentId = await makeStudent('Unknown curriculum', 11, 'igcse')
  await makeAssessment(studentId, 11, { mathematics: 3, english: 3 })

  const report = await buildClinicReport(studentId, db)

  assert.equal(report.cbcPathwayAdmissible, false, 'an unrecognised curriculum must never be treated as CBC-pathway-admissible')
  assert.ok(!report.curriculumLabel.includes('CBC'), 'the label must not guess CBC for an unrecognised curriculum_type')
  assert.equal(report.recommended_pathway, null)
})
