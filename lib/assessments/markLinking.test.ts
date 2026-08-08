// lib/assessments/markLinking.test.ts
//
// Marks entered through the teacher gradebook were written with
// `student_id: null` — every one of them. `bulkSaveMarks` resolved the learner
// only through `students.admission_number`, a column that does not exist, and
// the repository read swallowed the error and returned an empty list. Nothing
// failed loudly. The marks simply belonged to nobody, so
// `recordAssessmentEvidence` produced no Evidence, and Projection — and
// therefore Blueprint, Career Intelligence and Adaptive Learning — never moved
// from a teacher's own marks. `upsertMarksCSV` never set `student_id` at all.
//
// It survived because the one integration test that covered this path set
// `student_id` by hand afterwards (lib/assessments/evidencePurpose.integration
// .test.ts, "student_id only resolves via admission number in bulkSaveMarks;
// set it directly for this test's purposes"), so the linking itself was never
// the thing under test. It is here.
//
// Run: npx tsx --test lib/assessments/markLinking.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMarkLinker, normaliseLearnerName, type LinkableLearner } from './markLinking'

const ROSTER: LinkableLearner[] = [
  { id: 'margaret', name: 'MARGARET WAIRIMU', external_id: 'ADM/2026/014', upi: null },
  { id: 'keziah',   name: 'KEZIAH WAIRIMU',   external_id: null,           upi: 'UPI-77201' },
  { id: 'marion',   name: 'Marion Wairimu',   external_id: null,           upi: null },
]

test('links a mark to the learner whose name it carries', () => {
  const link = buildMarkLinker(ROSTER)
  assert.equal(link({ studentName: 'MARGARET WAIRIMU' }), 'margaret')
})

test('name matching ignores case, spacing and punctuation', () => {
  const link = buildMarkLinker(ROSTER)
  assert.equal(link({ studentName: 'margaret wairimu' }), 'margaret')
  assert.equal(link({ studentName: '  Margaret   Wairimu ' }), 'margaret')
  assert.equal(link({ studentName: "Margaret  Wairimu." }), 'margaret')
})

test('distinguishes learners who share a surname', () => {
  const link = buildMarkLinker(ROSTER)
  assert.equal(link({ studentName: 'KEZIAH WAIRIMU' }), 'keziah')
  assert.equal(link({ studentName: 'Marion Wairimu' }), 'marion')
  assert.notEqual(link({ studentName: 'KEZIAH WAIRIMU' }), 'margaret')
})

test('an explicit identifier outranks the typed name', () => {
  const link = buildMarkLinker(ROSTER)
  assert.equal(link({ studentName: 'M. Wairimu', admNo: 'ADM/2026/014' }), 'margaret')
  assert.equal(link({ studentName: 'typo', admNo: 'UPI-77201' }), 'keziah')
})

test('an unrecognised identifier falls back to the name', () => {
  const link = buildMarkLinker(ROSTER)
  assert.equal(link({ studentName: 'MARGARET WAIRIMU', admNo: 'NOT-A-REAL-ADM' }), 'margaret')
})

test('a learner not on this roster links to nobody', () => {
  const link = buildMarkLinker(ROSTER)
  assert.equal(link({ studentName: 'Hamisi Ossan' }), null,
    'a mark must never attach to a learner outside the class it was saved against')
})

test('a duplicated name on one roster resolves to null, never a guess', () => {
  const link = buildMarkLinker([
    { id: 'twin-a', name: 'John Otieno', external_id: 'ADM-1', upi: null },
    { id: 'twin-b', name: 'John Otieno', external_id: 'ADM-2', upi: null },
  ])
  assert.equal(link({ studentName: 'John Otieno' }), null,
    'attaching marks to the wrong child is worse than attaching them to none')
  assert.equal(link({ studentName: 'John Otieno', admNo: 'ADM-2' }), 'twin-b',
    'the identifier still disambiguates them')
})

test('reversed name order is not assumed to be the same person', () => {
  const link = buildMarkLinker(ROSTER)
  assert.equal(link({ studentName: 'Wairimu Margaret' }), null)
})

test('an empty roster links nothing rather than throwing', () => {
  const link = buildMarkLinker([])
  assert.equal(link({ studentName: 'MARGARET WAIRIMU', admNo: 'ADM/2026/014' }), null)
})

test('a blank name on the roster is not a match target', () => {
  const link = buildMarkLinker([{ id: 'blank', name: '   ', external_id: null, upi: null }])
  assert.equal(link({ studentName: '' }), null)
  assert.equal(link({ studentName: '   ' }), null)
})

test('normaliseLearnerName collapses the forms a teacher actually types', () => {
  assert.equal(normaliseLearnerName('  MARGARET   WAIRIMU  '), 'margaret wairimu')
  assert.equal(normaliseLearnerName("O'Brien, Mary"), 'o brien mary')
})
