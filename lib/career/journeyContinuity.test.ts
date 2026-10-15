// lib/career/journeyContinuity.test.ts
//
// buildJourneyContinuity() is the Junior → Senior continuity section of a
// Senior Career Intelligence report. These tests fix its behaviour as a pure,
// deterministic, DB-free function — plain data in, plain data out.
//
// Coverage:
//   - Senior learner WITH a junior history: continuity is detected across the
//     Grade 9 → 10 crossing, evidence is counted, carried capabilities named.
//   - Senior learner with NO junior history (added straight at Grade 10):
//     graceful "starting point" note, no fabricated junior span.
//   - Retracted/erased Evidence does not count as "work the journey is built on".
//   - No career title or prediction ever appears in the note (Career Principle).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildJourneyContinuity } from './journeyContinuity'
import type { TimelineEntry } from '@/lib/learnerRecord/timeline'
import type {
  CapabilityProfile,
  CapabilityScore,
  CapabilityLevel,
  CapabilityTrendDirection,
} from './types'

// ── fixtures ─────────────────────────────────────────────────────────────────

function score(
  raw: number,
  level: CapabilityLevel = 'capable',
  trend: CapabilityTrendDirection = 'stable',
): CapabilityScore {
  return { level, raw_score: raw, trend, evidence: [], confidence: 1 }
}

function profileWith(dominant: string[]): CapabilityProfile {
  return {
    analytical_reasoning: score(0.7),
    communication:        score(0.65),
    creative_thinking:    score(0.4),
    technical_aptitude:   score(0.5),
    social_intelligence:  score(0.45),
    resilience:           score(0.55),
    dominant_cluster:     dominant,
    emerging_cluster:     [],
    computed_at:          '2026-01-01T00:00:00.000Z',
    assessment_count:     12,
    disclaimer:           'test',
  }
}

function evidence(
  date: string,
  subject: string,
  lifecycleState = 'confirmed',
): TimelineEntry {
  return {
    kind: 'evidence',
    date,
    evidenceId: `${subject}-${date}`,
    evidenceSource: 'mark',
    subject,
    score: 72,
    cbcLevel: 3,
    body: null,
    lifecycleState,
  }
}

function promotion(date: string, fromGrade: number | null, toGrade: number): TimelineEntry {
  return {
    kind: 'promotion',
    date,
    promotionId: `promo-${toGrade}`,
    fromGrade,
    toGrade,
    academicYear: `${new Date(date).getFullYear()}`,
    notes: null,
  }
}

// ── a Senior learner whose record reaches back into Junior ─────────────────────

test('senior learner with junior history: continuity detected across the G9→G10 crossing', () => {
  const timeline: TimelineEntry[] = [
    evidence('2024-02-01T00:00:00Z', 'mathematics'),
    promotion('2024-12-01T00:00:00Z', 8, 9),
    evidence('2025-03-01T00:00:00Z', 'integrated_science'),
    promotion('2025-12-01T00:00:00Z', 9, 10), // the junior → senior crossing
    evidence('2026-03-01T00:00:00Z', 'biology'),
  ]
  const result = buildJourneyContinuity(
    'Jane',
    10,
    timeline,
    profileWith(['analytical_reasoning', 'communication']),
  )

  assert.equal(result.spans_junior, true)
  assert.deepEqual(result.junior_grades_covered, [8, 9])
  assert.equal(result.total_evidence_count, 3)
  assert.equal(result.promotion_path.length, 2)
  assert.deepEqual(result.promotion_path[1], {
    from_grade: 9,
    to_grade: 10,
    academic_year: '2025',
  })
  assert.deepEqual(result.carried_capabilities, ['Analytical Reasoning', 'Communication'])

  // The note names the journey and the carried capabilities, and says senior
  // builds on the record — it must NOT name a career or make a prediction.
  assert.match(result.continuity_note, /Grade 8 through to Grade 10/)
  assert.match(result.continuity_note, /3 recorded pieces of work/)
  assert.match(result.continuity_note, /Analytical Reasoning and Communication/)
  assert.match(result.continuity_note, /builds on that record/)
})

// ── a Senior learner with no junior record ─────────────────────────────────────

test('senior learner added straight at Grade 10: graceful starting-point note', () => {
  const timeline: TimelineEntry[] = [
    evidence('2026-03-01T00:00:00Z', 'biology'),
    evidence('2026-04-01T00:00:00Z', 'chemistry'),
  ]
  const result = buildJourneyContinuity('Ken', 10, timeline, profileWith(['technical_aptitude']))

  assert.equal(result.spans_junior, false)
  assert.deepEqual(result.junior_grades_covered, [])
  assert.equal(result.total_evidence_count, 2)
  assert.equal(result.promotion_path.length, 0)
  assert.match(result.continuity_note, /begins in Senior School/)
  // No fabricated junior span.
  assert.doesNotMatch(result.continuity_note, /Grade 7|Grade 8|Grade 9/)
})

// ── retracted / erased evidence does not count as work ─────────────────────────

test('retracted and erased evidence are excluded from the journey count', () => {
  const timeline: TimelineEntry[] = [
    promotion('2025-12-01T00:00:00Z', 9, 10),
    evidence('2026-01-01T00:00:00Z', 'mathematics', 'confirmed'),
    evidence('2026-01-02T00:00:00Z', 'mathematics', 'superseded'), // still real work
    evidence('2026-01-03T00:00:00Z', 'mathematics', 'retracted'),  // excluded
    evidence('2026-01-04T00:00:00Z', 'mathematics', 'erased'),     // excluded
  ]
  const result = buildJourneyContinuity('Mary', 10, timeline, null)

  assert.equal(result.total_evidence_count, 2)
})

// ── no capability profile: still produces a valid, hedged note ─────────────────

test('null profile: carried_capabilities empty, note still coherent', () => {
  const timeline: TimelineEntry[] = [
    promotion('2025-12-01T00:00:00Z', 9, 10),
    evidence('2026-01-01T00:00:00Z', 'mathematics'),
  ]
  const result = buildJourneyContinuity('Omar', 10, timeline, null)

  assert.deepEqual(result.carried_capabilities, [])
  assert.match(result.continuity_note, /Grade 9 through to Grade 10/)
  assert.match(result.continuity_note, /builds on that record/)
})

// ── determinism ────────────────────────────────────────────────────────────────

test('deterministic: identical input yields identical output', () => {
  const timeline: TimelineEntry[] = [
    promotion('2025-12-01T00:00:00Z', 9, 10),
    evidence('2026-01-01T00:00:00Z', 'mathematics'),
  ]
  const a = buildJourneyContinuity('Jane', 10, timeline, profileWith(['communication']))
  const b = buildJourneyContinuity('Jane', 10, timeline, profileWith(['communication']))
  assert.deepEqual(a, b)
})
