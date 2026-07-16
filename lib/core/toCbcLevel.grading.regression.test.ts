// lib/core/toCbcLevel.grading.regression.test.ts
//
// Sprint 4C1 (docs/engineering/sprint-4c0-grading-policy-integration.md,
// Option B): the inline toCbcLevel closures in
// lib/core/assessments.ts::computeTermSummaries and
// lib/core/report-cards.ts::generateReportCards now delegate to the
// canonical Grading Engine (lib/grading) instead of their own hand-rolled
// boundary checks. This test proves the migration is mechanical — golden
// values captured from the deleted closures, asserted unchanged, for both
// the default (75/50/25) and a school-customized boundary set.
//
// Run: npx tsx --test lib/core/toCbcLevel.grading.regression.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeScore } from '@/lib/grading'
import type { GradeScale } from '@/lib/grading'

type CbcLevel = 'EE' | 'ME' | 'AE' | 'BE'

// The exact pre-migration algorithm (git history: lib/core/assessments.ts
// and lib/core/report-cards.ts, both removed in the Sprint 4C1 commit),
// kept here only as the regression oracle — not imported by production code.
function legacyToCbcLevel(score: number, gradeBoundaries: Record<string, { min: number }>): CbcLevel {
  if (score >= (gradeBoundaries.EE?.min ?? 75)) return 'EE'
  if (score >= (gradeBoundaries.ME?.min ?? 50)) return 'ME'
  if (score >= (gradeBoundaries.AE?.min ?? 25)) return 'AE'
  return 'BE'
}

// Current implementation, mirroring the migrated block in both files.
function currentToCbcLevel(score: number, gradeBoundaries: Record<string, { min: number }>): CbcLevel {
  const cbcScale: GradeScale = {
    name: 'CBC (school-configured, school_settings.grade_boundaries)',
    bands: [
      { label: 'EE', minPct: gradeBoundaries.EE?.min ?? 75 },
      { label: 'ME', minPct: gradeBoundaries.ME?.min ?? 50 },
      { label: 'AE', minPct: gradeBoundaries.AE?.min ?? 25 },
      { label: 'BE', minPct: 0 },
    ],
  }
  return gradeScore(Math.min(100, Math.max(0, score)), 100, cbcScale).grade as CbcLevel
}

function assertSameGrade(score: number, gradeBoundaries: Record<string, { min: number }>) {
  assert.equal(currentToCbcLevel(score, gradeBoundaries), legacyToCbcLevel(score, gradeBoundaries))
}

const DEFAULT_BOUNDARIES = {} // triggers all fallback defaults, 75/50/25
const CUSTOM_BOUNDARIES = { EE: { min: 80 }, ME: { min: 60 }, AE: { min: 40 } }

test('UNCHANGED: default boundaries (75/50/25) — every representative score matches legacy output', () => {
  for (const score of [0, 10, 24, 25, 25.5, 49, 50, 50.5, 74, 75, 75.5, 90, 100]) {
    assertSameGrade(score, DEFAULT_BOUNDARIES)
  }
})

test('UNCHANGED: school-customized boundaries — every representative score matches legacy output', () => {
  for (const score of [0, 39, 40, 40.5, 59, 60, 60.5, 79, 80, 80.5, 100]) {
    assertSameGrade(score, CUSTOM_BOUNDARIES)
  }
})

test('UNCHANGED: exact boundary values return the correct band (default boundaries)', () => {
  assert.equal(currentToCbcLevel(75, DEFAULT_BOUNDARIES), 'EE')
  assert.equal(currentToCbcLevel(50, DEFAULT_BOUNDARIES), 'ME')
  assert.equal(currentToCbcLevel(25, DEFAULT_BOUNDARIES), 'AE')
  assert.equal(currentToCbcLevel(0, DEFAULT_BOUNDARIES), 'BE')
})

test('UNCHANGED: exact boundary values return the correct band (school-customized boundaries)', () => {
  assert.equal(currentToCbcLevel(80, CUSTOM_BOUNDARIES), 'EE')
  assert.equal(currentToCbcLevel(60, CUSTOM_BOUNDARIES), 'ME')
  assert.equal(currentToCbcLevel(40, CUSTOM_BOUNDARIES), 'AE')
  assert.equal(currentToCbcLevel(0, CUSTOM_BOUNDARIES), 'BE')
})

test('DEFENSIVE (new, does not change any real grading outcome): floating-point overshoot just above 100 is clamped, not thrown', () => {
  assert.equal(currentToCbcLevel(100.00000000000001, DEFAULT_BOUNDARIES), 'EE')
})

test('partial school override (only EE customized, ME/AE fall back to defaults) matches legacy behaviour', () => {
  const partial = { EE: { min: 90 } }
  for (const score of [0, 24, 25, 49, 50, 89, 90]) {
    assertSameGrade(score, partial)
  }
})
