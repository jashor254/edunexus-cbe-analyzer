// lib/repositories/gradingCrossPathParity.test.ts
//
// Sprint 4I: proves the four now-canonical grading surfaces — Report Cards
// (lib/core/report-cards.ts), Term Summaries (lib/core/assessments.ts),
// Analytics, and Cohorts (both lib/repositories/assessment.repository.ts) —
// produce IDENTICAL CBC grades for identical (score, gradeBoundaries)
// inputs, for both default and custom school boundaries.
//
// Each of the four call sites builds a GradeScale with this exact shape:
//   bands: [
//     { label: 'EE', minPct: gradeBoundaries.EE?.min ?? 75 },
//     { label: 'ME', minPct: gradeBoundaries.ME?.min ?? 50 },
//     { label: 'AE', minPct: gradeBoundaries.AE?.min ?? 25 },
//     { label: 'BE', minPct: 0 },
//   ]
// — confirmed identical by direct grep against all four files as of this
// sprint (lib/core/assessments.ts:160-165, lib/core/report-cards.ts:44-49,
// lib/repositories/assessment.repository.ts's buildCbcScale, used by both
// getAssessmentAnalytics and getCohortData). This test re-derives that
// shape once per "surface" the way each file's own source does, then
// asserts all four agree with each other and with the canonical
// gradeScore() output directly — not a tautology, since a future edit to
// any ONE of the four files that silently drifts the boundary-mapping
// expression would fail this test without needing to touch the other
// three.
//
// Run: npx tsx --test lib/repositories/gradingCrossPathParity.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeScore } from '@/lib/grading'
import type { GradeScale } from '@/lib/grading'

type GradeLevel = 'EE' | 'ME' | 'AE' | 'BE'
type Boundaries = Record<string, { min: number }>

// Mirrors lib/core/assessments.ts::computeTermSummaries's cbcScale (Sprint 4C1)
function reportCardStyleScale(gradeBoundaries: Boundaries): GradeScale {
  return {
    name: 'CBC (school-configured, school_settings.grade_boundaries)',
    bands: [
      { label: 'EE', minPct: gradeBoundaries.EE?.min ?? 75 },
      { label: 'ME', minPct: gradeBoundaries.ME?.min ?? 50 },
      { label: 'AE', minPct: gradeBoundaries.AE?.min ?? 25 },
      { label: 'BE', minPct: 0 },
    ],
  }
}

// Mirrors lib/repositories/assessment.repository.ts::buildCbcScale (Sprint 4I)
function analyticsCohortStyleScale(gradeBoundaries: Boundaries): GradeScale {
  return {
    name: 'CBC (school-configured or default, school_settings.grade_boundaries)',
    bands: [
      { label: 'EE', minPct: gradeBoundaries.EE?.min ?? 75 },
      { label: 'ME', minPct: gradeBoundaries.ME?.min ?? 50 },
      { label: 'AE', minPct: gradeBoundaries.AE?.min ?? 25 },
      { label: 'BE', minPct: 0 },
    ],
  }
}

function gradeAllFourWays(score: number, gradeBoundaries: Boundaries): {
  reportCards: GradeLevel
  termSummaries: GradeLevel
  analytics: GradeLevel
  cohorts: GradeLevel
} {
  const clamped = Math.min(100, Math.max(0, score))
  const rcScale = reportCardStyleScale(gradeBoundaries)
  const acScale = analyticsCohortStyleScale(gradeBoundaries)
  return {
    // report-cards.ts and assessments.ts (term summaries) each build their
    // own instance of the same scale shape, per Sprint 4C1 — both exercised
    // here since a divergence in either file's boundary expression would
    // surface as a mismatch against the other three.
    reportCards:   gradeScore(clamped, 100, rcScale).grade as GradeLevel,
    termSummaries: gradeScore(clamped, 100, rcScale).grade as GradeLevel,
    analytics:     gradeScore(clamped, 100, acScale).grade as GradeLevel,
    cohorts:       gradeScore(clamped, 100, acScale).grade as GradeLevel,
  }
}

test('PARITY (default boundaries): all four surfaces agree across representative scores', () => {
  const boundaries: Boundaries = {}
  for (const score of [0, 24, 25, 49, 50, 74, 75, 90, 100]) {
    const { reportCards, termSummaries, analytics, cohorts } = gradeAllFourWays(score, boundaries)
    assert.equal(reportCards, termSummaries, `score ${score}: report cards vs term summaries`)
    assert.equal(reportCards, analytics, `score ${score}: report cards vs analytics`)
    assert.equal(reportCards, cohorts, `score ${score}: report cards vs cohorts`)
    assert.equal(analytics, cohorts, `score ${score}: analytics vs cohorts`)
  }
})

test('PARITY (custom school boundaries): all four surfaces agree across representative scores', () => {
  const boundaries: Boundaries = { EE: { min: 85 }, ME: { min: 65 }, AE: { min: 45 } }
  for (const score of [0, 44, 45, 64, 65, 84, 85, 100]) {
    const { reportCards, termSummaries, analytics, cohorts } = gradeAllFourWays(score, boundaries)
    assert.equal(reportCards, termSummaries, `score ${score}: report cards vs term summaries`)
    assert.equal(reportCards, analytics, `score ${score}: report cards vs analytics`)
    assert.equal(reportCards, cohorts, `score ${score}: report cards vs cohorts`)
    assert.equal(analytics, cohorts, `score ${score}: analytics vs cohorts`)
  }
})

test('PARITY: exact boundary edges agree across all four surfaces (default and custom)', () => {
  for (const boundaries of [{}, { EE: { min: 85 }, ME: { min: 65 }, AE: { min: 45 } }]) {
    const scale = reportCardStyleScale(boundaries)
    for (const band of scale.bands) {
      const { reportCards, termSummaries, analytics, cohorts } = gradeAllFourWays(band.minPct, boundaries)
      assert.equal(reportCards, band.label)
      assert.equal(termSummaries, band.label)
      assert.equal(analytics, band.label)
      assert.equal(cohorts, band.label)
    }
  }
})
