// lib/paperIntelligence/upload.test.ts
//
// Mark first, file after: a reviewed paper is filed to exactly one place.
// Every collaborator is mocked — no DB, no network. Proves: topical files
// through the shared mark path and closes a quick paper; termly files one
// subject (converted to the assessment's maximum) and never touches the
// assignment-mark path; a second upload to a different place is refused;
// adaptive papers, unreviewed papers, another class's assessment and a
// locked assessment are refused.
//
// Run: npm test -- lib/paperIntelligence/upload.test.ts

import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import type { ScriptMarkRow } from './scriptMarks'

class FakeLockedError extends Error {}

type Paper = { id: string; title: string; subject: string; topic: string | null; substrand_id: string | null; class_id: string; max_score: number; origin: string; status: string; is_adaptive: boolean }
let paper: Paper
let existingUpload: { destination: string; classAssessmentId: string | null; subject: string | null; uploadedAt: string; learnerCount: number } | null
let marks: ScriptMarkRow[]
let recorded: Array<{ submissionId: string; score: number }>
let merged: Array<{ subject: string; entries: Array<{ studentId: string; score: number }> }>
let mergeRefused: Array<{ studentId: string; studentName: string; reason: string }>
let mergeThrow: Error | null
let assessment: Record<string, unknown> | null
let updates: Array<{ table: string; values: Record<string, unknown> }>
let upserts: Array<{ table: string; values: Record<string, unknown> }>

function mark(submission_id: string, rubric_id: string, final_mark: number | null, status: ScriptMarkRow['status'] = 'confirmed'): ScriptMarkRow {
  return {
    id: `${submission_id}-${rubric_id}`, submission_id, assignment_id: 'p1', rubric_id, evidence_id: null, recognized_answer: '', points: [],
    proposed_mark: 0, plausible_mark: 0, max_mark: 30, recognition_confidence: null, grading_confidence: null, uncertain: false,
    rationale: null, page_numbers: [], status, final_mark, created_at: '',
  }
}

mock.module('./uploadStore', {
  namedExports: {
    PaperNotFoundError: class extends Error {},
    findPaper: async () => ({
      id: paper.id, title: paper.title, subject: paper.subject, topic: paper.topic, substrandId: paper.substrand_id,
      classId: paper.class_id, maxScore: paper.max_score, origin: paper.origin, status: paper.status, isAdaptive: paper.is_adaptive,
    }),
    findExistingUpload: async () => existingUpload,
    closePaper: async (id: string) => { updates.push({ table: 'assignments', values: { id, status: 'closed' } }) },
    recordUpload: async (row: Record<string, unknown>) => { upserts.push({ table: 'paper_mark_uploads', values: row }) },
  },
})
mock.module('@/lib/assignments/markSubmission', {
  namedExports: {
    recordSubmissionMark: async (input: { target: { submissionId: string }; score: number }) => {
      recorded.push({ submissionId: input.target.submissionId, score: input.score })
      return { submission: { id: input.target.submissionId, student_id: 'x' }, followUp: async () => {} }
    },
  },
})
mock.module('@/lib/assessments/getters', { namedExports: { getAssessmentById: async () => assessment } })
mock.module('@/lib/assessments/mutations', {
  namedExports: {
    AssessmentLockedError: FakeLockedError,
    createAssessment: async () => ({ ...assessment, id: 'new-assessment' }),
    mergeSubjectMarks: async (input: { subject: string; entries: Array<{ studentId: string; score: number }> }) => {
      if (mergeThrow) throw mergeThrow
      merged.push({ subject: input.subject, entries: input.entries })
      return { written: input.entries.length - mergeRefused.length, refused: mergeRefused }
    },
    triggerLearnerModelUpdates: async () => {},
  },
})
mock.module('@/lib/assessments/evidence', { namedExports: { recordAssessmentEvidence: async () => {} } })
mock.module('./rubrics', { namedExports: { findRubricsForAssignment: async () => [{ id: 'r1' }, { id: 'r2' }] } })
mock.module('./scriptMarks', { namedExports: { findScriptMarksForAssignment: async () => marks } })
mock.module('./reviewContext', {
  namedExports: {
    findReviewSubmissions: async () => [
      { submissionId: 's1', studentId: 'st1', classId: 'c1', name: 'Amani' },
      { submissionId: 's2', studentId: 'st2', classId: 'c1', name: 'Bravin' },
      { submissionId: 's3', studentId: 'st3', classId: 'c1', name: 'Chebet' },
      { submissionId: 's4', studentId: 'st4', classId: 'c1', name: 'Dorcas' },
    ],
  },
})

let upload: typeof import('./upload')
before(async () => { upload = await import('./upload') })
beforeEach(() => {
  paper = { id: 'p1', title: 'Fractions test', subject: 'Mathematics', topic: 'Fractions', substrand_id: null, class_id: 'c1', max_score: 50, origin: 'paper_marking', status: 'draft', is_adaptive: false }
  existingUpload = null
  // s1 complete 37/50 · s2 complete 20/50 · s3 one question unreviewed · s4 over the paper's maximum
  marks = [
    mark('s1', 'r1', 20), mark('s1', 'r2', 17),
    mark('s2', 'r1', 10), mark('s2', 'r2', 10),
    mark('s3', 'r1', 5), mark('s3', 'r2', null, 'proposed'),
    mark('s4', 'r1', 30), mark('s4', 'r2', 30),
  ]
  recorded = []; merged = []; mergeRefused = []; mergeThrow = null; updates = []; upserts = []
  assessment = { id: 'as1', class_id: 'c1', teacher_id: 't1', max_score: 100, subjects: ['English'], is_published: false }
})

const base = { assignmentId: 'p1', teacherId: 't1', teacherUserId: 'u1' }

test('readiness separates complete, unreviewed and over-the-maximum scripts', async () => {
  const r = await upload.getUploadReadiness('p1')
  assert.deepEqual(r.complete.map(c => [c.learnerName, c.total]), [['Amani', 37], ['Bravin', 20]])
  assert.equal(r.incomplete, 1)
  assert.deepEqual(r.overMarkedOutOf, [{ submissionId: 's4', learnerName: 'Dorcas', total: 60 }])
  assert.equal(r.rosterCount, 4)
})

test('topical files every complete script through the shared mark path and closes a quick paper', async () => {
  const out = await upload.uploadPaperMarks({ ...base, target: { destination: 'topical' } })
  assert.deepEqual(recorded, [{ submissionId: 's1', score: 37 }, { submissionId: 's2', score: 20 }])
  assert.deepEqual(merged, [], 'a topical upload never writes an assessment')
  assert.equal(out.followUps.length, 2)
  assert.deepEqual(updates.map(u => [u.table, u.values.status]), [['assignments', 'closed']])
  assert.equal(upserts[0].table, 'paper_mark_uploads')
  assert.equal(upserts[0].values.destination, 'topical')
  assert.equal(upserts[0].values.learnerCount, 2)
})

test('topical leaves a teacher’s own (standard) assignment status alone', async () => {
  paper = { ...paper, origin: 'standard', status: 'active' }
  await upload.uploadPaperMarks({ ...base, target: { destination: 'topical' } })
  assert.deepEqual(updates, [])
})

test('termly files one subject, converted to the assessment maximum, and never the assignment-mark path', async () => {
  const out = await upload.uploadPaperMarks({ ...base, target: { destination: 'termly', subject: 'Mathematics', assessmentId: 'as1' } })
  assert.deepEqual(recorded, [], 'no assignment-mark evidence on a termly upload')
  assert.deepEqual(merged, [{ subject: 'Mathematics', entries: [
    { studentId: 'st1', studentName: 'Amani', score: 74 },
    { studentId: 'st2', studentName: 'Bravin', score: 40 },
  ] }])
  assert.deepEqual(out.filed.map(f => [f.learnerName, f.total, f.filedScore]), [['Amani', 37, 74], ['Bravin', 20, 40]])
  assert.equal(out.followUps.length, 1)
  assert.deepEqual(updates, [], 'a termly-filed quick paper stays hidden (draft)')
  assert.equal(upserts[0].values.destination, 'termly')
  assert.equal(upserts[0].values.classAssessmentId, 'as1')
  assert.equal(upserts[0].values.subject, 'Mathematics')
})

test('a learner the merge refuses is reported, not counted as filed', async () => {
  mergeRefused = [{ studentId: 'st2', studentName: 'Bravin', reason: 'Another learner named "Bravin" already has marks in this assessment.' }]
  const out = await upload.uploadPaperMarks({ ...base, target: { destination: 'termly', subject: 'Mathematics', assessmentId: 'as1' } })
  assert.deepEqual(out.filed.map(f => f.learnerName), ['Amani'])
  assert.deepEqual(out.refused.map(r => r.learnerName), ['Bravin'])
  assert.equal(upserts[0].values.learnerCount, 1)
})

test('a paper already filed topical cannot be filed termly — no double filing', async () => {
  existingUpload = { destination: 'topical', classAssessmentId: null, subject: null, uploadedAt: 'x', learnerCount: 2 }
  await assert.rejects(
    upload.uploadPaperMarks({ ...base, target: { destination: 'termly', subject: 'Mathematics', assessmentId: 'as1' } }),
    (e: Error) => e instanceof upload.UploadError && /already uploaded to a topical assignment/.test(e.message),
  )
  assert.deepEqual([recorded.length, merged.length, upserts.length], [0, 0, 0])
})

test('a paper filed into one termly assessment cannot be filed into another', async () => {
  existingUpload = { destination: 'termly', classAssessmentId: 'as-other', subject: 'Mathematics', uploadedAt: 'x', learnerCount: 2 }
  await assert.rejects(upload.uploadPaperMarks({ ...base, target: { destination: 'termly', subject: 'Mathematics', assessmentId: 'as1' } }), upload.UploadError)
  assert.deepEqual(merged, [])
})

test('re-uploading to the same place is allowed and re-files', async () => {
  existingUpload = { destination: 'termly', classAssessmentId: 'as1', subject: 'Mathematics', uploadedAt: 'x', learnerCount: 1 }
  const out = await upload.uploadPaperMarks({ ...base, target: { destination: 'termly', subject: 'Mathematics', assessmentId: 'as1' } })
  assert.equal(out.filed.length, 2)
})

test('refuses an adaptive paper, a paper with nothing reviewed, another class’s assessment, and a locked assessment', async () => {
  paper = { ...paper, is_adaptive: true }
  await assert.rejects(upload.uploadPaperMarks({ ...base, target: { destination: 'topical' } }), /Adaptive/)

  paper = { ...paper, is_adaptive: false }
  marks = [mark('s1', 'r1', 4, 'proposed')]
  await assert.rejects(upload.uploadPaperMarks({ ...base, target: { destination: 'topical' } }), /No script is fully reviewed/)

  marks = [mark('s1', 'r1', 20), mark('s1', 'r2', 17)]
  assessment = { ...assessment, class_id: 'another-class' }
  await assert.rejects(upload.uploadPaperMarks({ ...base, target: { destination: 'termly', subject: 'Mathematics', assessmentId: 'as1' } }), /different class/)

  assessment = { ...assessment, class_id: 'c1' }
  mergeThrow = new FakeLockedError('This assessment is locked')
  await assert.rejects(
    upload.uploadPaperMarks({ ...base, target: { destination: 'termly', subject: 'Mathematics', assessmentId: 'as1' } }),
    (e: Error) => e instanceof upload.UploadError && /locked/.test(e.message),
  )
  assert.equal(upserts.length, 0, 'nothing is recorded as uploaded when filing fails')
})

test('a new termly assessment can be created on the spot for a first upload', async () => {
  const out = await upload.uploadPaperMarks({ ...base, target: { destination: 'termly', subject: 'Mathematics', newAssessment: { assessmentType: 'endterm', term: '3', year: 2026, maxScore: 100 } } })
  assert.equal(out.classAssessmentId, 'new-assessment')
  assert.equal(merged.length, 1)
})
