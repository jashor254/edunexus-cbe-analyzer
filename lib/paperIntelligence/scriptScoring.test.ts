// lib/paperIntelligence/scriptScoring.test.ts
// Pure unit tests — no DB, no network, no SDK import.
// Run with: npm test -- lib/paperIntelligence/scriptScoring.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scorePoints, pointMerit, type ClassifiedPoint } from './scriptScoring'

function pt(text: string, classification: ClassifiedPoint['classification'], explained = false): ClassifiedPoint {
  return { text, classification, explained, matchedAnswer: null, note: null }
}

// "Any 5×1 = 5" (Phase 0 Q1a shape)
const ANY_5x1 = { maxMarks: 5, pointsRequired: 5, marksPerPoint: 1 }
// "Any 4×2 = 8" (Phase 0 Q4 shape — name + explanation)
const ANY_4x2 = { maxMarks: 8, pointsRequired: 4, marksPerPoint: 2 }

test('scheme matches earn; a plausible point earns only in the if-accepted total', () => {
  // Phase 0 Learner 1, Q1a: four listed traits + "Courage" (real trait, not listed).
  const r = scorePoints([
    pt('Patient', 'matches_scheme'), pt('Self confidences', 'matches_scheme'), pt('Honesty', 'matches_scheme'),
    pt('Self control', 'matches_scheme'), pt('Courage', 'plausible_not_in_scheme'),
  ], ANY_5x1)
  assert.equal(r.proposedMark, 4)
  assert.equal(r.plausibleMark, 5)
  assert.equal(r.points[4].awarded, 0)
  assert.equal(r.points[4].merit, 1)
})

test('only the first N points count — wrong ones use up a slot too', () => {
  const r = scorePoints([
    pt('a', 'incorrect'), pt('b', 'matches_scheme'), pt('c', 'matches_scheme'), pt('d', 'matches_scheme'),
    pt('e', 'matches_scheme'), pt('f (6th)', 'matches_scheme'), pt('g (7th)', 'matches_scheme'),
  ], ANY_5x1)
  assert.equal(r.proposedMark, 4)
  assert.deepEqual(r.points.map(p => p.counted), [true, true, true, true, true, false, false])
  assert.equal(r.points[5].awarded, 0)
})

test('2-mark points: a bare name earns 1, a correct explanation earns the second', () => {
  // Phase 0 Q4: names only, no explanations → capped at 1 each.
  const namesOnly = scorePoints([
    pt('Honesty', 'matches_scheme'), pt('Accountability', 'matches_scheme'), pt('Integrity', 'matches_scheme'), pt('Fairness', 'matches_scheme'),
  ], ANY_4x2)
  assert.equal(namesOnly.proposedMark, 4)

  const explained = scorePoints([
    pt('Honesty — leaders keep promises', 'matches_scheme', true), pt('Integrity', 'matches_scheme'),
  ], ANY_4x2)
  assert.equal(explained.proposedMark, 3)
  assert.deepEqual(explained.points.map(p => p.merit), [2, 1])
})

test('incorrect points earn nothing in either total, even when "explained"', () => {
  const r = scorePoints([pt('Drought — causes famine', 'incorrect', true)], ANY_4x2)
  assert.equal(r.proposedMark, 0)
  assert.equal(r.plausibleMark, 0)
  assert.equal(r.points[0].merit, 0)
})

test('totals can never exceed max on a consistent rubric', () => {
  const many = Array.from({ length: 12 }, (_, i) => pt(`p${i}`, 'matches_scheme', true))
  const r = scorePoints(many, ANY_4x2)
  assert.equal(r.proposedMark, 8)
  assert.equal(r.plausibleMark, 8)
})

test('a blank answer scores 0 / 0', () => {
  const r = scorePoints([], ANY_5x1)
  assert.deepEqual([r.proposedMark, r.plausibleMark, r.points.length], [0, 0, 0])
})

test('Prototype 01 rubric (no N×M): each correct point earns 1, up to max', () => {
  const r = scorePoints(
    [pt('a', 'matches_scheme', true), pt('b', 'matches_scheme'), pt('c', 'matches_scheme'), pt('d', 'matches_scheme')],
    { maxMarks: 3, pointsRequired: null, marksPerPoint: null },
  )
  assert.equal(r.proposedMark, 3)
  assert.equal(r.points[3].counted, false)
})

test('pointMerit', () => {
  assert.equal(pointMerit('matches_scheme', false, 1), 1)
  assert.equal(pointMerit('matches_scheme', true, 1), 1)
  assert.equal(pointMerit('plausible_not_in_scheme', true, 2), 2)
  assert.equal(pointMerit('matches_scheme', false, 3), 1)
  assert.equal(pointMerit('matches_scheme', true, 3), 3)
  assert.equal(pointMerit('incorrect', true, 2), 0)
})
