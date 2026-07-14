// lib/assessments/analyticsStats.test.ts
//
// Pure unit tests — no DB, no env vars. Phase D
// (docs/architecture/academic-evidence-layer.md §8): median, mode, and
// gradeToPoints, the three additive traditional-analytics statistics
// added to ClassOverview.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { median, mode, computeStudentRiskLevel } from './analyticsStats'
import { gradeToPoints } from './gradeCalculator'

test('median of an odd-length array is the middle value', () => {
  assert.equal(median([70, 50, 90]), 70)
})

test('median of an even-length array averages the two middle values', () => {
  assert.equal(median([50, 60, 70, 80]), 65)
})

test('median of an empty array is 0, never NaN or a thrown error', () => {
  assert.equal(median([]), 0)
})

test('mode returns the most frequent value', () => {
  assert.equal(mode(['ME', 'ME', 'EE', 'BE']), 'ME')
})

test('mode ties are broken by first-seen order, deterministically', () => {
  assert.equal(mode(['EE', 'ME']), 'EE')
})

test('mode of an empty array is null', () => {
  assert.equal(mode([]), null)
})

test('gradeToPoints maps every CBC and 8-4-4 grade this codebase actually produces', () => {
  assert.equal(gradeToPoints('EE'), 4)
  assert.equal(gradeToPoints('ME'), 3)
  assert.equal(gradeToPoints('AE'), 2)
  assert.equal(gradeToPoints('BE'), 1)
  assert.equal(gradeToPoints('A'), 12)
  assert.equal(gradeToPoints('E'), 1)
})

test('gradeToPoints returns null for an unrecognized label, never a guessed value', () => {
  assert.equal(gradeToPoints('Z'), null)
  assert.equal(gradeToPoints(''), null)
})

// ── computeStudentRiskLevel ──────────────────────────────────────────────────

test('an inactive student with a consistently weak record is high risk', () => {
  const scores = [{ Mathematics: 1, English: 1 }, { Mathematics: 1.5, English: 1 }]
  assert.equal(computeStudentRiskLevel(false, scores), 'high')
})

test('a student whose latest check was weak but whose overall record is strong is NOT misclassified as high risk — the whole point of averaging instead of latest-only', () => {
  const scores = [
    { Mathematics: 3.8, English: 3.9 }, // strong
    { Mathematics: 3.7, English: 3.8 }, // strong
    { Mathematics: 1.2, English: 1.1 }, // one weak latest check
  ]
  // Average is well above the 2.5 medium/low boundary, even though the
  // most recent single assessment alone would have signaled high risk
  // under the old "latest assessment only" logic.
  assert.equal(computeStudentRiskLevel(true, scores), 'low')
})

test('an active student with no assessment history at all defaults to low risk, not a fabricated score', () => {
  assert.equal(computeStudentRiskLevel(true, []), 'low')
})

test('an inactive student with no assessment history is medium risk (inactivity alone is a signal, absent any score)', () => {
  assert.equal(computeStudentRiskLevel(false, []), 'medium')
})
