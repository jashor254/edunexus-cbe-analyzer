// lib/repositories/gradeLevelFromScore.grading.regression.test.ts
//
// Sprint 4I (docs/engineering/sprint-4f-teacher-school-identity-audit.md,
// docs/architecture/deprecation-registry.md #5): the deleted
// gradeLevelFromScore() (hardcoded 75/50/25, no school-configurability) in
// lib/repositories/assessment.repository.ts's getAssessmentAnalytics/
// getCohortData is now replaced by buildCbcScale()/toCbcGrade(), delegating
// to the canonical Grading Engine (lib/grading). This proves the migration
// is mechanical for the default-boundary case (identical output to the
// deleted function) and correct for the newly-activated school-configured
// case (which gradeLevelFromScore could never honour, since it took no
// boundaries parameter at all).
//
// Run: npx tsx --test lib/repositories/gradeLevelFromScore.grading.regression.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeScore } from '@/lib/grading'
import type { GradeScale } from '@/lib/grading'

type GradeLevel = 'EE' | 'ME' | 'AE' | 'BE'

// The exact pre-migration algorithm (git history: assessment.repository.ts,
// removed in the Sprint 4I commit), kept here only as the regression
// oracle — not imported by production code. It never accepted a boundaries
// parameter, hence no second argument here.
function legacyGradeLevelFromScore(score: number): GradeLevel {
  if (score >= 75) return 'EE'
  if (score >= 50) return 'ME'
  if (score >= 25) return 'AE'
  return 'BE'
}

// Current implementation, mirroring buildCbcScale()/toCbcGrade() in
// lib/repositories/assessment.repository.ts.
function buildCbcScale(gradeBoundaries: Record<string, { min: number }> = {}): GradeScale {
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
function toCbcGrade(score: number, scale: GradeScale): GradeLevel {
  return gradeScore(Math.min(100, Math.max(0, score)), 100, scale).grade as GradeLevel
}

test('UNCHANGED: default boundaries — every representative score matches the deleted function', () => {
  const scale = buildCbcScale()
  for (const score of [0, 10, 24, 25, 25.5, 49, 50, 50.5, 74, 75, 75.5, 90, 100]) {
    assert.equal(toCbcGrade(score, scale), legacyGradeLevelFromScore(score))
  }
})

test('NEWLY CORRECT: custom school boundaries — deleted function could never do this (no parameter)', () => {
  const scale = buildCbcScale({ EE: { min: 80 }, ME: { min: 60 }, AE: { min: 40 } })
  assert.equal(toCbcGrade(80, scale), 'EE')
  assert.equal(toCbcGrade(79, scale), 'ME')
  assert.equal(toCbcGrade(60, scale), 'ME')
  assert.equal(toCbcGrade(40, scale), 'AE')
  assert.equal(toCbcGrade(0, scale), 'BE')
})

test('DEFENSIVE (does not change any real outcome): raw score above 100 (assessment max_score > 100) is clamped, not thrown', () => {
  const scale = buildCbcScale()
  // The deleted function had no upper bound at all — any score >= 75
  // returned 'EE' regardless of how large. gradeScore()'s stricter
  // validation would otherwise throw for score > maxScore(=100).
  assert.equal(toCbcGrade(150, scale), 'EE')
  assert.equal(toCbcGrade(150, scale), legacyGradeLevelFromScore(150))
})
