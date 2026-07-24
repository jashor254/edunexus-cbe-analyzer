// lib/learnerIntelligence/careerMode.pure.test.ts
//
// Career Intelligence Canonicalization Phase 1 — proves careerModeForGrade()
// preserves the exact boundary every call site used before this sprint
// (grade >= 7 && grade <= 9 = 'exploration', everything else = 'planning'),
// across the full range actually seen in this platform (CBC Junior Grade 7
// through Senior/8-4-4 Form 4, plus one grade below and above that range).
//
// Run: npx tsx --test lib/learnerIntelligence/careerMode.pure.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { careerModeForGrade } from './careerIntelligence'

function oldBoundary(grade: number): 'exploration' | 'planning' {
  return grade >= 7 && grade <= 9 ? 'exploration' : 'planning'
}

test('careerModeForGrade matches the pre-refactor boundary for grades 6-13', () => {
  for (let grade = 6; grade <= 13; grade++) {
    assert.equal(
      careerModeForGrade(grade),
      oldBoundary(grade),
      `grade ${grade} should decide the same mode as the old inline check`,
    )
  }
})

test('careerModeForGrade: Junior (7-9) is exploration, everything else is planning', () => {
  assert.equal(careerModeForGrade(6), 'planning')
  assert.equal(careerModeForGrade(7), 'exploration')
  assert.equal(careerModeForGrade(8), 'exploration')
  assert.equal(careerModeForGrade(9), 'exploration')
  assert.equal(careerModeForGrade(10), 'planning')
  assert.equal(careerModeForGrade(13), 'planning')
})
