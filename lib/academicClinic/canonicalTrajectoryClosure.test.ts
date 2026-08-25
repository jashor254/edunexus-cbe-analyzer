// lib/academicClinic/canonicalTrajectoryClosure.test.ts
//
// Phase 2.2 (Learner Report Architecture — canonical trajectory closure).
//
// Proves the original bug is closed: assessmentPipeline.ts (the pipeline
// that actually emails/WhatsApps the Clinic PDF to parents) hardcodes an
// empty assessments-history array, which — under the PRE-Phase-2.2
// algorithm — permanently dead-coded the multi-point trend branch, making
// 'IMPROVING' structurally unreachable in that path regardless of how much
// real improvement the learner's evidence showed. generateClinicalOverview()
// now accepts an optional canonicalGrowth parameter (Projection's
// already-computed growth.trend + risk.overallRiskLevel) that, when
// supplied, bypasses the empty-history problem entirely — trajectory no
// longer depends on the assessments array at all. This file proves that
// exact scenario end to end, plus the full sparse/zero-evidence,
// multi-trend, and legacy-fallback matrix.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/canonicalTrajectoryClosure.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateClinicalOverview } from './reportGenerator'
import type { SubjectProgress } from './types'

const SUBJECTS: SubjectProgress[] = [
  { subject: 'mathematics', displayName: 'Mathematics', level: 3, trend: 'stable', velocity: 0, previousScores: [] },
  { subject: 'english', displayName: 'English', level: 3, trend: 'stable', velocity: 0, previousScores: [] },
]

// ── THE ORIGINAL BUG, closed ─────────────────────────────────────────────────

test('ORIGINAL BUG CLOSED: with the exact empty-history shape assessmentPipeline.ts passes ([]), IMPROVING is now reachable via canonicalGrowth', () => {
  // This is assessmentPipeline.ts's literal call shape: assessments = [].
  // Pre-Phase-2.2, this made the multi-point branch permanently dead and
  // trajectory could never be 'IMPROVING' here, no matter what.
  const overview = generateClinicalOverview('Test Student', SUBJECTS, [], { trend: 'improving', riskLevel: 'normal' })
  assert.equal(overview.trajectory, 'IMPROVING',
    'IMPROVING must now be reachable even with an empty assessments array, because trajectory no longer depends on it when canonicalGrowth is supplied')
})

test('ORIGINAL BUG CONFIRMED (regression baseline): the same empty-history call WITHOUT canonicalGrowth still cannot reach IMPROVING (legacy behaviour, unchanged for the orphaned page)', () => {
  const overview = generateClinicalOverview('Test Student', SUBJECTS, [])
  assert.notEqual(overview.trajectory, 'IMPROVING')
})

// ── Zero evidence ────────────────────────────────────────────────────────────

test('ZERO EVIDENCE: no growth projection at all (trend:null) does not fabricate a direction — falls to current-state severity only', () => {
  const overview = generateClinicalOverview('Test Student', SUBJECTS, [], { trend: null, riskLevel: null })
  // avg = 3.0 for SUBJECTS above -> current-state band is STABLE, not a
  // fabricated IMPROVING/declining claim.
  assert.equal(overview.trajectory, 'STABLE')
})

// ── One assessment / insufficient_data ──────────────────────────────────────

test('ONE ASSESSMENT: insufficient_data does not fabricate IMPROVING or DECLINING — current-state severity only', () => {
  const overview = generateClinicalOverview('Test Student', SUBJECTS, [], { trend: 'insufficient_data', riskLevel: 'normal' })
  assert.equal(overview.trajectory, 'STABLE') // avg=3.0 -> STABLE band
  assert.notEqual(overview.trajectory, 'IMPROVING')
})

test('ONE ASSESSMENT: insufficient_data with a weak current average still surfaces real current-state severity (not hidden behind "no trend")', () => {
  const weakSubjects: SubjectProgress[] = [
    { subject: 'mathematics', displayName: 'Mathematics', level: 1, trend: 'stable', velocity: 0, previousScores: [] },
  ]
  const overview = generateClinicalOverview('Test Student', weakSubjects, [], { trend: 'insufficient_data', riskLevel: 'watch' })
  assert.equal(overview.trajectory, 'CRITICAL', 'avg=1.0 < 1.5 must still surface as a real current-state severity read, distinct from a trend claim')
})

// ── Multi-point canonical trend ─────────────────────────────────────────────

test('TWO IMPROVING POINTS (canonical): trend improving -> IMPROVING', () => {
  const overview = generateClinicalOverview('Test Student', SUBJECTS, [], { trend: 'improving', riskLevel: 'normal' })
  assert.equal(overview.trajectory, 'IMPROVING')
})

test('TWO DECLINING POINTS (canonical): trend declining, normal risk -> NEEDS ATTENTION (not an escalated CRITICAL)', () => {
  const overview = generateClinicalOverview('Test Student', SUBJECTS, [], { trend: 'declining', riskLevel: 'watch' })
  assert.equal(overview.trajectory, 'NEEDS ATTENTION')
})

test('DECLINING + CRITICAL RISK: severity escalation is a real, already-canonical axis (risk.overallRiskLevel), not an invented rule', () => {
  const overview = generateClinicalOverview('Test Student', SUBJECTS, [], { trend: 'declining', riskLevel: 'critical' })
  assert.equal(overview.trajectory, 'CRITICAL')
})

test('STABLE (canonical): trend stable -> STABLE', () => {
  const overview = generateClinicalOverview('Test Student', SUBJECTS, [], { trend: 'stable', riskLevel: 'normal' })
  assert.equal(overview.trajectory, 'STABLE')
})

test('MIXED (canonical, e.g. improving Maths + declining Kiswahili): no single clear direction -> STABLE, not a forced pick', () => {
  const overview = generateClinicalOverview('Test Student', SUBJECTS, [], { trend: 'mixed', riskLevel: 'normal' })
  assert.equal(overview.trajectory, 'STABLE')
})

// ── Cross-surface consistency (Step 22) ─────────────────────────────────────

test('CROSS-SURFACE CONSISTENCY: the same canonicalGrowth input produces the identical trajectory label regardless of which report path supplies it', () => {
  const input = { trend: 'improving' as const, riskLevel: 'normal' as const }
  const a = generateClinicalOverview('Learner A', SUBJECTS, [], input)          // shape of assessmentPipeline.ts's call
  const b = generateClinicalOverview('Learner A', SUBJECTS, [{ subject_scores: {} }], input) // shape of clinicPdfHandler.ts's call (real history, now irrelevant to trajectory)
  assert.equal(a.trajectory, b.trajectory,
    'trajectory must not depend on which report path (and its own local assessments array) supplied it once canonicalGrowth is present')
})
