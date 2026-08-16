// lib/attentionFeed/panel.test.ts
// Sprint 8A (ADR-0029): pure unit tests for the three functions migrated off
// legacy learner_profiles.knowledge_state onto Projection's academic.bySubject/
// bySubStrand (ADR-0024 Phase 2). No DB — synthetic LearnerIntelligenceProjection
// and LearnerProfile fixtures only.
//
// Run with: npx tsx --env-file=.env.local --test lib/attentionFeed/panel.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMasteryHeatmap, findPeerHelper, detectAccelerationCandidates } from './panel'
import type { LearnerIntelligenceProjection, AcademicValue, RiskValue } from '@/lib/projection/types'
import type { LearnerProfile } from '@/lib/learnerModel/types'

function projection(bySubStrand: AcademicValue['bySubStrand'], bySubject: AcademicValue['bySubject'] = {}, overallRiskLevel: RiskValue['overallRiskLevel'] = 'normal'): LearnerIntelligenceProjection {
  return {
    learnerId: 'x',
    academic: {
      value: { bySubject, bySubStrand },
      supportingEvidenceIds: [], confidence: 80,
      coverage: { evidenceCount: 2, evidenceDiversity: 1, latestEvidenceAt: null, oldestEvidenceAt: null, freshnessDays: 1 },
      lastComputed: new Date().toISOString(), projectionVersion: 'academic-v1',
    },
    capability: null, knowledge: null, behaviour: null, growth: null,
    risk: { value: { flags: [], overallRiskLevel }, supportingEvidenceIds: [], confidence: 80, coverage: { evidenceCount: 1, evidenceDiversity: 1, latestEvidenceAt: null, oldestEvidenceAt: null, freshnessDays: 1 }, lastComputed: new Date().toISOString(), projectionVersion: 'risk-v1' },
    completeness: null,
  }
}

function profile(overrides: Partial<LearnerProfile> & { student_id: string }): LearnerProfile {
  return {
    id: overrides.student_id, student_id: overrides.student_id,
    knowledge_state: {}, confirmed_gaps: [], persistent_gaps: [],
    capability_dimensions: {}, learning_behaviour: {} as LearnerProfile['learning_behaviour'],
    career_signals: {}, pathway_readiness: {} as LearnerProfile['pathway_readiness'],
    engagement_patterns: {}, formative_signals: [], parent_observations: [],
    risk_flags: [], risk_history: [], overall_risk_level: 'normal',
    growth_milestones: [], term_snapshots: [],
    learning_style: null, strengths: {}, weaknesses: {}, interests: {}, profile_data: {},
    last_assessment_date: null, current_term: null, current_year: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ── buildMasteryHeatmap ────────────────────────────────────────────────────────

test('buildMasteryHeatmap: aggregates academic.bySubStrand across students, not legacy knowledge_state', () => {
  const projections = new Map([
    ['s1', projection({ 'ss-1': { subStrandId: 'ss-1', subStrandTitle: 'Fractions', strandTitle: 'NUMBERS', subject: 'mathematics', latestLevel: 1, trend: 'stable', history: [] } })],
    ['s2', projection({ 'ss-1': { subStrandId: 'ss-1', subStrandTitle: 'Fractions', strandTitle: 'NUMBERS', subject: 'mathematics', latestLevel: 2, trend: 'stable', history: [] } })],
  ])

  const rows = buildMasteryHeatmap(projections)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].substrand, 'Fractions')
  assert.equal(rows[0].subject, 'mathematics')
  assert.equal(rows[0].avg_level, 1.5)
  assert.equal(rows[0].pct_below_me, 100) // both levels < 3
})

test('buildMasteryHeatmap: a sub-strand with only 1 data point is excluded (need 2+)', () => {
  const projections = new Map([
    ['s1', projection({ 'ss-1': { subStrandId: 'ss-1', subStrandTitle: 'Fractions', strandTitle: 'NUMBERS', subject: 'mathematics', latestLevel: 4, trend: 'stable', history: [] } })],
  ])
  assert.deepEqual(buildMasteryHeatmap(projections), [])
})

test('buildMasteryHeatmap: empty projections map returns no rows, never throws', () => {
  assert.deepEqual(buildMasteryHeatmap(new Map()), [])
})

// ── findPeerHelper ─────────────────────────────────────────────────────────────

test('findPeerHelper: finds a peer strong (level >= 3) in the struggling student\'s weak subject via Projection, not legacy knowledge_state', () => {
  const strugglingProfile = profile({ student_id: 's1', confirmed_gaps: ['mathematics:fractions'] })
  const helperProfile     = profile({ student_id: 's2' })
  const projections = new Map([
    ['s2', projection({}, { mathematics: { subject: 'mathematics', latestLevel: 4, trend: 'stable', history: [] } })],
  ])
  const names = new Map([['s2', 'Amina']])

  const helper = findPeerHelper(strugglingProfile, [strugglingProfile, helperProfile], projections, names)
  assert.equal(helper, 'Amina')
})

test('findPeerHelper: a peer at risk is never suggested, even if strong academically', () => {
  const strugglingProfile = profile({ student_id: 's1', confirmed_gaps: ['mathematics:fractions'] })
  const helperProfile     = profile({ student_id: 's2' })
  const projections = new Map([
    ['s2', projection({}, { mathematics: { subject: 'mathematics', latestLevel: 4, trend: 'stable', history: [] } }, 'critical')],
  ])
  const names = new Map([['s2', 'Amina']])

  assert.equal(findPeerHelper(strugglingProfile, [strugglingProfile, helperProfile], projections, names), undefined)
})

test('findPeerHelper: no candidate meets the subject-level threshold → undefined', () => {
  const strugglingProfile = profile({ student_id: 's1', confirmed_gaps: ['mathematics:fractions'] })
  const helperProfile     = profile({ student_id: 's2' })
  const projections = new Map([
    ['s2', projection({}, { mathematics: { subject: 'mathematics', latestLevel: 2, trend: 'stable', history: [] } })],
  ])
  assert.equal(findPeerHelper(strugglingProfile, [strugglingProfile, helperProfile], projections, new Map([['s2', 'Amina']])), undefined)
})

// ── detectAccelerationCandidates ───────────────────────────────────────────────

test('detectAccelerationCandidates: counts sub-strands at level 4 from Projection, not legacy knowledge_state', () => {
  const p = profile({ student_id: 's1', capability_dimensions: {} })
  const projections = new Map([
    ['s1', projection({
      'ss-1': { subStrandId: 'ss-1', subStrandTitle: 'Fractions', strandTitle: 'NUMBERS', subject: 'mathematics', latestLevel: 4, trend: 'stable', history: [] },
      'ss-2': { subStrandId: 'ss-2', subStrandTitle: 'Decimals', strandTitle: 'NUMBERS', subject: 'mathematics', latestLevel: 4, trend: 'stable', history: [] },
      'ss-3': { subStrandId: 'ss-3', subStrandTitle: 'Algebra', strandTitle: 'ALGEBRA', subject: 'mathematics', latestLevel: 4, trend: 'stable', history: [] },
    })],
  ])

  const candidates = detectAccelerationCandidates(projections, [p], new Map([['s1', 'Amina']]))
  assert.equal(candidates.length, 1)
  assert.match(candidates[0].reason, /3 substrands at EE/)
})

test('detectAccelerationCandidates: a student at risk is never a candidate, regardless of substrand levels', () => {
  const p = profile({ student_id: 's1' })
  const projections = new Map([
    ['s1', projection({
      'ss-1': { subStrandId: 'ss-1', subStrandTitle: 'Fractions', strandTitle: 'NUMBERS', subject: 'mathematics', latestLevel: 4, trend: 'stable', history: [] },
    }, {}, 'at_risk')],
  ])
  assert.deepEqual(detectAccelerationCandidates(projections, [p], new Map()), [])
})

test('detectAccelerationCandidates: capability-dimension trend is now derived live from Projection (H2D closure), not the raw legacy capability_dimensions column', () => {
  const p = profile({
    student_id: 's1',
    // Deliberately populated with a DIFFERENT, stale legacy value — proves
    // the function no longer reads this column at all for trend reasoning.
    capability_dimensions: {
      analytical_reasoning: { raw_score: 0.1, level: 'emerging', trend: 'declining', confidence: 0.9, last_computed: new Date().toISOString() },
    },
  })
  // Real, rising evidence history for two subjects (mathematics ->
  // analytical_reasoning, english -> communication) — three snapshots each,
  // sharp enough second-half rise to cross capabilityExtractor's
  // detectTrend() momentum threshold and read as 'accelerating'.
  const bySubject: AcademicValue['bySubject'] = {
    mathematics: {
      subject: 'mathematics', latestLevel: 4, trend: 'improving',
      history: [
        { level: 1, score: 25, at: '2026-01-01T00:00:00Z', evidenceId: 'e1' },
        { level: 2, score: 50, at: '2026-02-01T00:00:00Z', evidenceId: 'e2' },
        { level: 4, score: 95, at: '2026-03-01T00:00:00Z', evidenceId: 'e3' },
      ],
    },
    english: {
      subject: 'english', latestLevel: 4, trend: 'improving',
      history: [
        { level: 1, score: 25, at: '2026-01-01T00:00:00Z', evidenceId: 'e4' },
        { level: 2, score: 50, at: '2026-02-01T00:00:00Z', evidenceId: 'e5' },
        { level: 4, score: 95, at: '2026-03-01T00:00:00Z', evidenceId: 'e6' },
      ],
    },
  }
  const projections = new Map([['s1', projection({}, bySubject)]]) // no substrand-4 data — must qualify on capability trend alone
  const candidates = detectAccelerationCandidates(projections, [p], new Map([['s1', 'Amina']]))
  assert.equal(candidates.length, 1)
  assert.match(candidates[0].reason, /capability dimensions are accelerating/)
})

test('detectAccelerationCandidates: a student with zero admissible evidence is never a candidate on capability grounds, even with a stale accelerating legacy cache', () => {
  const p = profile({
    student_id: 's1',
    capability_dimensions: {
      analytical_reasoning: { raw_score: 0.9, level: 'exceptional', trend: 'accelerating', confidence: 0.9, last_computed: new Date().toISOString() },
      communication:        { raw_score: 0.9, level: 'exceptional', trend: 'accelerating', confidence: 0.9, last_computed: new Date().toISOString() },
    },
  })
  const projections = new Map([['s1', projection({})]]) // no academic evidence at all
  assert.deepEqual(detectAccelerationCandidates(projections, [p], new Map([['s1', 'Amina']])), [])
})
