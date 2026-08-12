// lib/learnerBlueprint/gradeBand.test.ts
//
// Run: npx tsx --test lib/learnerBlueprint/gradeBand.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractGradeLevel,
  getGradeBand,
  isJuniorBand,
  isSeniorBand,
  pathwayIsStillOpen,
  gradeBandFraming,
  futurePageTitle,
  futurePageQuestion,
  resolveGradeBand,
} from './gradeBand'

test('CBE class names resolve to the right band, including a stream suffix', () => {
  assert.equal(getGradeBand('Grade 7'), 'grade_7_8')
  assert.equal(getGradeBand('Grade 8 Blue'), 'grade_7_8')
  assert.equal(getGradeBand('Grade 9Y'), 'grade_9')
  assert.equal(getGradeBand('Grade 10 East'), 'grade_10')
  assert.equal(getGradeBand('Grade 11'), 'grade_11_12')
  assert.equal(getGradeBand('grade 12'), 'grade_11_12')
})

test('8-4-4 Form names are not treated as unknown — a Form 3 learner is senior, not junior', () => {
  // A school mid-transition has both vocabularies on its roll. Before this,
  // "Form 3" matched the grade regex and produced grade 3 → 'unknown', which
  // silently gave a senior learner the neutral (effectively junior) framing.
  assert.equal(extractGradeLevel('Form 1'), 9)
  assert.equal(extractGradeLevel('Form 4'), 12)
  assert.equal(getGradeBand('Form 3'), 'grade_11_12')
  assert.equal(getGradeBand('Form 4 North'), 'grade_11_12')
  assert.equal(isSeniorBand(getGradeBand('Form 3')), true)
})

test('unrecognisable or absent class names yield unknown, never a guessed stage', () => {
  assert.equal(getGradeBand(null), 'unknown')
  assert.equal(getGradeBand(''), 'unknown')
  assert.equal(getGradeBand('Alpha Stream'), 'unknown')
  assert.equal(getGradeBand('Grade 99'), 'unknown')
  assert.equal(getGradeBand('Form 9'), 'unknown')
  assert.equal(getGradeBand('Grade 3'), 'unknown', 'primary grades are outside the Blueprint’s stages')
})

test('junior and senior partition the known bands, and unknown belongs to neither', () => {
  assert.deepEqual(
    (['grade_7_8', 'grade_9', 'grade_10', 'grade_11_12'] as const).map(isJuniorBand),
    [true, true, false, false],
  )
  assert.deepEqual(
    (['grade_7_8', 'grade_9', 'grade_10', 'grade_11_12'] as const).map(isSeniorBand),
    [false, false, true, true],
  )
  assert.equal(isJuniorBand('unknown'), false)
  assert.equal(isSeniorBand('unknown'), false)
})

test('pathway is open only while the learner can still affect their placement', () => {
  assert.equal(pathwayIsStillOpen('grade_7_8'), true)
  assert.equal(pathwayIsStillOpen('grade_9'), true)
  // The core asymmetry: a placed learner must never be shown a readiness gap
  // against a pathway they are already in and cannot easily leave.
  assert.equal(pathwayIsStillOpen('grade_10'), false)
  assert.equal(pathwayIsStillOpen('grade_11_12'), false)
  assert.equal(pathwayIsStillOpen('unknown'), false, 'never speculate about placement when the stage is unknown')
})

test('every band has its own framing, title and question — no band falls through to another’s copy', () => {
  const bands = ['grade_7_8', 'grade_9', 'grade_10', 'grade_11_12', 'unknown'] as const

  for (const band of bands) {
    assert.ok(gradeBandFraming(band).length > 0, `${band} has no framing`)
    assert.ok(futurePageQuestion(band).length > 0, `${band} has no page question`)
  }

  assert.equal(new Set(bands.map(gradeBandFraming)).size, bands.length, 'two bands share framing copy')
  assert.equal(new Set(bands.map(futurePageQuestion)).size, bands.length, 'two bands share a page question')
})

test('Grade 7-8 framing says the work already counts toward placement', () => {
  // The single most under-communicated fact in Kenyan junior school: SBA from
  // these grades feeds the placement score, and families are rarely told.
  assert.match(gradeBandFraming('grade_7_8'), /already counts/)
})

test('senior bands get a destination-shaped page title, junior bands an emergence-shaped one', () => {
  assert.equal(futurePageTitle('grade_10'), 'Where This Could Lead')
  assert.equal(futurePageTitle('grade_11_12'), 'Where This Could Lead')
  assert.equal(futurePageTitle('grade_7_8'), 'What May Be Emerging')
  assert.equal(futurePageTitle('grade_9'), 'What May Be Emerging')
  assert.equal(futurePageTitle('unknown'), 'What May Be Emerging')
})

test('resolveGradeBand prefers the composed band and re-derives only for older snapshots', () => {
  // The composed band always wins, even where the class name would disagree —
  // the snapshot records the stage the learner was at when it was taken.
  assert.equal(resolveGradeBand('grade_11_12', 'Grade 7'), 'grade_11_12')

  // Snapshots predating the field carry no band; fall back to the class name
  // they did record rather than defaulting everyone to one stage.
  assert.equal(resolveGradeBand(undefined, 'Grade 10 East'), 'grade_10')
  assert.equal(resolveGradeBand(undefined, null), 'unknown')
})
