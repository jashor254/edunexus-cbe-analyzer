// lib/academicClinic/canonicalSeniorGuidance.test.ts
//
// Phase 2.1 (canonical ownership cutover, Decision 2 + Decision 4).
//
// buildSeniorGuidanceFromCanonical() is a pure, DB-free presentation adapter
// over the already-scored, already-ranked output of
// resolveCanonicalCareerMatches() — these tests prove it stays that way: it
// must never re-score, re-rank, or invent an "unavailable" state for a
// learner who has real (if sparse) canonical matches, while still honestly
// distinguishing zero evidence from sparse evidence (Decision 5).
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/canonicalSeniorGuidance.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSeniorGuidanceFromCanonical } from './canonicalSeniorGuidance'
import type { CanonicalCareerMatches } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import type { CareerMatchWithDetail } from '@/lib/career/types'
import type { SubjectProgress } from './types'

function makeMatch(overrides: Partial<CareerMatchWithDetail> = {}): CareerMatchWithDetail {
  return {
    id: 'test-career', student_id: 'test-student', career_id: 'test-career-id',
    match_score: 60, match_reasoning: 'Strong analytical alignment based on confirmed evidence.',
    subject_gaps: null, skill_gaps: null, generated_at: '2026-01-01T00:00:00.000Z',
    career: {
      id: 'test-career-id', slug: 'test-career', title: 'Test Engineer', category: 'technology',
      kenya_market_outlook: 'Growing.', salary_range_kes: null,
      required_subjects: ['mathematics', 'integrated_science'], pathway: 'STEM',
      description: 'Test description.', ai_impact: { level: 'medium' },
    },
    ...overrides,
  } as CareerMatchWithDetail
}

const SUBJECTS: SubjectProgress[] = [
  { subject: 'mathematics', displayName: 'Mathematics', level: 4, trend: 'stable', velocity: 0, previousScores: [] },
  { subject: 'integrated_science', displayName: 'Integrated Science', level: 2, trend: 'stable', velocity: 0, previousScores: [] },
]

// ── Zero-evidence boundary (Decision 5) ─────────────────────────────────────

test('ZERO EVIDENCE: insufficientEvidence:true produces an honest empty state, not a fabricated career', () => {
  const canonical: CanonicalCareerMatches = { matches: [], mode: 'planning', insufficientEvidence: true, generatedAt: null }
  const guidance = buildSeniorGuidanceFromCanonical(canonical, SUBJECTS, 'Test Student', 11)
  assert.deepEqual(guidance.topCareers, [])
  assert.match(guidance.honestAssessment ?? '', /insufficient/i)
})

test('ZERO EVIDENCE: an empty matches array even without the insufficientEvidence flag is treated the same way (defensive)', () => {
  const canonical: CanonicalCareerMatches = { matches: [], mode: 'planning', insufficientEvidence: false, generatedAt: '2026-01-01T00:00:00.000Z' }
  const guidance = buildSeniorGuidanceFromCanonical(canonical, SUBJECTS, 'Test Student', 11)
  assert.deepEqual(guidance.topCareers, [])
})

// ── One-assessment / sparse-evidence matrix (Decision 4) ────────────────────

test('SPARSE EVIDENCE: a real (if low-confidence) canonical match still produces a real career, not "unavailable"', () => {
  // capabilityMatchEngine.ts caps assessment_count<2 at a raw score of 0.65
  // -> match_score 65 here simulates that real, already-applied cap.
  const canonical: CanonicalCareerMatches = {
    matches: [makeMatch({ match_score: 65 })], mode: 'planning', insufficientEvidence: false, generatedAt: '2026-01-01T00:00:00.000Z',
  }
  const guidance = buildSeniorGuidanceFromCanonical(canonical, SUBJECTS, 'Test Student', 11)
  assert.equal(guidance.topCareers.length, 1, 'one valid canonical match must produce ONE real career, not zero')
  assert.equal(guidance.topCareers[0].name, 'Test Engineer')
})

test('SPARSE EVIDENCE: the 1-assessment score cap (65) naturally caps matchStrength below STRONG — degraded specificity, not a definitive verdict', () => {
  const canonical: CanonicalCareerMatches = {
    matches: [makeMatch({ match_score: 65 })], mode: 'planning', insufficientEvidence: false, generatedAt: '2026-01-01T00:00:00.000Z',
  }
  const guidance = buildSeniorGuidanceFromCanonical(canonical, SUBJECTS, 'Test Student', 11)
  assert.equal(guidance.topCareers[0].matchStrength, 'GOOD',
    'score 65 must land below the STRONG threshold (70) — this is how sparse evidence degrades specificity without hiding the signal entirely')
})

test('SUFFICIENT EVIDENCE: a high, multi-assessment-backed score reaches STRONG', () => {
  const canonical: CanonicalCareerMatches = {
    matches: [makeMatch({ match_score: 85 })], mode: 'planning', insufficientEvidence: false, generatedAt: '2026-01-01T00:00:00.000Z',
  }
  const guidance = buildSeniorGuidanceFromCanonical(canonical, SUBJECTS, 'Test Student', 11)
  assert.equal(guidance.topCareers[0].matchStrength, 'STRONG')
})

// ── Contradiction tests (Step 19) — presentation-only, no re-scoring ────────

test('CONTRADICTION TEST: the adapter never re-orders canonical matches — it presents exactly the order/scores it was given', () => {
  const canonical: CanonicalCareerMatches = {
    matches: [
      makeMatch({ id: 'a', match_score: 55, career: { ...makeMatch().career, slug: 'career-a', title: 'Career A' } }),
      makeMatch({ id: 'b', match_score: 90, career: { ...makeMatch().career, slug: 'career-b', title: 'Career B' } }),
      makeMatch({ id: 'c', match_score: 72, career: { ...makeMatch().career, slug: 'career-c', title: 'Career C' } }),
    ],
    mode: 'planning', insufficientEvidence: false, generatedAt: '2026-01-01T00:00:00.000Z',
  }
  const guidance = buildSeniorGuidanceFromCanonical(canonical, SUBJECTS, 'Test Student', 11)
  // Deliberately NOT sorted by score (A=55, B=90, C=72) — if the adapter
  // re-ranked, "Career B" would move to the front. It must not.
  assert.deepEqual(guidance.topCareers.map(c => c.name), ['Career A', 'Career B', 'Career C'],
    'the adapter must preserve the canonical engine\'s own order — re-ordering would be a second ranking algorithm')
  assert.deepEqual(guidance.topCareers.map(c => c.matchPercentage), [55, 90, 72],
    'match_score must pass through verbatim — recomputing it would be a second scoring algorithm')
})

test('CONTRADICTION TEST: exactly 3 careers are shown even when more are supplied — a selection, not a re-scoring', () => {
  const canonical: CanonicalCareerMatches = {
    matches: [makeMatch({ id: 'a' }), makeMatch({ id: 'b' }), makeMatch({ id: 'c' }), makeMatch({ id: 'd' }), makeMatch({ id: 'e' })],
    mode: 'planning', insufficientEvidence: false, generatedAt: '2026-01-01T00:00:00.000Z',
  }
  const guidance = buildSeniorGuidanceFromCanonical(canonical, SUBJECTS, 'Test Student', 11)
  assert.equal(guidance.topCareers.length, 3)
})

// ── Missing-subject safety (Step 23) ─────────────────────────────────────────

test('MISSING SUBJECT SAFETY: a required subject the learner was never assessed on is a real gap, not silently ignored or treated as zero', () => {
  const canonical: CanonicalCareerMatches = {
    matches: [makeMatch({ career: { ...makeMatch().career, required_subjects: ['mathematics', 'chemistry'] } })],
    mode: 'planning', insufficientEvidence: false, generatedAt: '2026-01-01T00:00:00.000Z',
  }
  // SUBJECTS has no 'chemistry' entry at all.
  const guidance = buildSeniorGuidanceFromCanonical(canonical, SUBJECTS, 'Test Student', 11)
  assert.match(guidance.topCareers[0].keyGap ?? '', /chemistry/i,
    'an unassessed required subject must surface as the gap, not be silently dropped')
})

test('MISSING SUBJECT SAFETY: a required subject the learner IS strong in (level >= 3) is not flagged as a gap', () => {
  const canonical: CanonicalCareerMatches = {
    matches: [makeMatch({ career: { ...makeMatch().career, required_subjects: ['mathematics'] } })],
    mode: 'planning', insufficientEvidence: false, generatedAt: '2026-01-01T00:00:00.000Z',
  }
  // SUBJECTS has mathematics at level 4.
  const guidance = buildSeniorGuidanceFromCanonical(canonical, SUBJECTS, 'Test Student', 11)
  assert.doesNotMatch(guidance.topCareers[0].keyGap ?? '', /mathematics/i)
})

// ── AI-impact passthrough (consistency with the Phase 2 fix) ────────────────

test('the real canonical ai_impact.level flows through to CareerMatch.aiImpact, not a keyword guess', () => {
  const canonical: CanonicalCareerMatches = {
    matches: [makeMatch({ career: { ...makeMatch().career, ai_impact: { level: 'transforming' } } })],
    mode: 'planning', insufficientEvidence: false, generatedAt: '2026-01-01T00:00:00.000Z',
  }
  const guidance = buildSeniorGuidanceFromCanonical(canonical, SUBJECTS, 'Test Student', 11)
  assert.deepEqual(guidance.topCareers[0].aiImpact, { disruptionRisk: 'very_high', growthOutlook: 'booming' })
})
