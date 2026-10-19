// lib/assessments/subjectMarkMerge.test.ts
//
// Filing one marked paper into a termly assessment must set exactly one
// subject per learner and never touch another subject, never unlink a learner,
// and never overwrite a different child's row that happens to share a name.
//
// Run: npm test -- lib/assessments/subjectMarkMerge.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSubjectIntoMarks, convertScore, type ExistingAssessmentMark } from './subjectMarkMerge'

const existing: ExistingAssessmentMark[] = [
  { student_name: 'Amani Wanjiru', admission_number: '101', student_id: 's1', subject_scores: { English: 60, Kiswahili: 55 } },
  { student_name: 'brian otieno', admission_number: null, student_id: null, subject_scores: { English: 40 } },
  { student_name: 'Faith Njeri', admission_number: null, student_id: 's9', subject_scores: { English: 70 } },
]

test('adds the subject to a linked learner and keeps every other subject', () => {
  const { rows, refused } = mergeSubjectIntoMarks(existing, 'Mathematics', [{ studentId: 's1', studentName: 'Amani Wanjiru', score: 42 }])
  assert.deepEqual(refused, [])
  assert.deepEqual(rows, [{
    student_name: 'Amani Wanjiru',
    admission_number: '101',
    student_id: 's1',
    subject_scores: { English: 60, Kiswahili: 55, Mathematics: 42 },
  }])
})

test('matches an unlinked row by name, keeps its stored spelling, and links it', () => {
  const { rows } = mergeSubjectIntoMarks(existing, 'Mathematics', [{ studentId: 's2', studentName: 'Brian Otieno', score: 30 }])
  assert.equal(rows[0].student_name, 'brian otieno', 'the stored name is the upsert key — keeping it updates the same row')
  assert.equal(rows[0].student_id, 's2')
  assert.deepEqual(rows[0].subject_scores, { English: 40, Mathematics: 30 })
})

test('re-filing the same subject replaces only that subject', () => {
  const { rows } = mergeSubjectIntoMarks(
    [{ ...existing[0], subject_scores: { English: 60, Mathematics: 10 } }],
    'Mathematics',
    [{ studentId: 's1', studentName: 'Amani Wanjiru', score: 44 }],
  )
  assert.deepEqual(rows[0].subject_scores, { English: 60, Mathematics: 44 })
})

test('a learner with no row yet gets a new row with just this subject', () => {
  const { rows } = mergeSubjectIntoMarks(existing, 'Mathematics', [{ studentId: 's5', studentName: 'Chege Kamau', score: 12 }])
  assert.deepEqual(rows, [{ student_name: 'Chege Kamau', admission_number: null, student_id: 's5', subject_scores: { Mathematics: 12 } }])
})

test('refuses a name match onto a row linked to a different learner', () => {
  const { rows, refused } = mergeSubjectIntoMarks(existing, 'Mathematics', [{ studentId: 's7', studentName: 'Faith Njeri', score: 50 }])
  assert.deepEqual(rows, [])
  assert.equal(refused.length, 1)
  assert.equal(refused[0].studentId, 's7')
})

test('refuses the second of two paper learners who would write the same row', () => {
  const { rows, refused } = mergeSubjectIntoMarks([], 'Mathematics', [
    { studentId: 'a', studentName: 'John Mwangi', score: 10 },
    { studentId: 'b', studentName: 'JOHN  MWANGI', score: 20 },
  ])
  assert.equal(rows.length, 1)
  assert.equal(refused.length, 1)
  assert.equal(refused[0].studentId, 'b')
})

test('convertScore is the identity when the paper and assessment share a maximum', () => {
  assert.equal(convertScore(37, 50, 50), 37)
})

test('convertScore scales proportionally and rounds to a whole mark', () => {
  assert.equal(convertScore(37, 50, 100), 74)
  assert.equal(convertScore(33, 80, 100), 41) // 41.25
  assert.equal(convertScore(0, 40, 100), 0)
})

test('convertScore rejects a paper marked out of zero', () => {
  assert.throws(() => convertScore(5, 0, 100))
})
