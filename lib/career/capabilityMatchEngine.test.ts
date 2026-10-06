// lib/career/capabilityMatchEngine.test.ts
//
// Deterministic, env-free regression suite for the capability→career match
// engine. Before this file the engine was only covered indirectly by
// integration tests; it now has a dedicated contract suite locking the two
// Phase A corrections:
//   FIX 2 — the match score is bounded to [0, 1] / alignment to [0, 100],
//           even for an accelerating learner at or above ideal everywhere.
//   FIX 3 — a dimension with confidence 0 (no observed evidence) is treated as
//           unknown, never weakness: excluded from numerator, denominator,
//           gaps and narrative; >50% of a career's required weight excluded
//           floors the match to Low confidence with a caveat.
//
// All numbers here are on the normalized 0–1 capability scale the extractor
// produces — never raw CBC 1–4.
//
// Run: npm test -- lib/career/capabilityMatchEngine.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCapabilityMatches, alignmentToPercent } from './capabilityMatchEngine'
import type {
  Career, CapabilityProfile, CapabilityScore, CapabilityDimension,
  CareerCapabilityRequirements, CapabilityTrendDirection,
} from './types'

// ── Fixture builders ─────────────────────────────────────────────────────────

const ALL_DIMS: CapabilityDimension[] = [
  'analytical_reasoning', 'communication', 'creative_thinking',
  'technical_aptitude', 'social_intelligence', 'resilience',
]

function levelFor(raw: number): CapabilityScore['level'] {
  if (raw >= 0.85) return 'exceptional'
  if (raw >= 0.70) return 'strong'
  if (raw >= 0.50) return 'capable'
  if (raw >= 0.30) return 'developing'
  return 'emerging'
}

function dim(raw: number, confidence: number, trend: CapabilityTrendDirection = 'stable'): CapabilityScore {
  return { level: levelFor(raw), raw_score: raw, trend, evidence: [], confidence }
}

/**
 * Build a full 6-dimension profile. `overrides` sets specific dimensions; any
 * dimension not overridden defaults to a mid, observed score so it never
 * accidentally triggers the FIX 3 exclusion path in an unrelated test.
 */
function profile(
  overrides: Partial<Record<CapabilityDimension, CapabilityScore>>,
  assessmentCount = 3,
): CapabilityProfile {
  const base = Object.fromEntries(
    ALL_DIMS.map(d => [d, overrides[d] ?? dim(0.55, 0.6)]),
  ) as Record<CapabilityDimension, CapabilityScore>

  const dominant = ALL_DIMS.filter(d => base[d].raw_score >= 0.60)
  const emerging = ALL_DIMS.filter(d => base[d].raw_score >= 0.40 && base[d].raw_score < 0.60)

  return {
    ...base,
    dominant_cluster: dominant,
    emerging_cluster: emerging,
    computed_at: '2026-01-01T00:00:00.000Z',
    assessment_count: assessmentCount,
    disclaimer: 'test',
  }
}

function req(minimum: number, ideal: number, weight: number): CareerCapabilityRequirements[CapabilityDimension] {
  return { minimum, ideal, weight, note: 'test requirement' }
}

/** Minimal Career carrying only the fields the match engine reads. */
function career(
  slug: string,
  required: Partial<CareerCapabilityRequirements>,
  extra: Partial<Career> = {},
): Career {
  return {
    slug,
    title: slug.replace(/-/g, ' '),
    category: 'engineering_technology',
    pathway: 'STEM',
    required_capabilities: required as CareerCapabilityRequirements,
    ...extra,
  } as Career
}

// ── FIX 2 — score bounds ──────────────────────────────────────────────────────

test('FIX 2: perfect match + accelerating trend is bounded at exactly 1.0, never above', () => {
  const p = profile({
    analytical_reasoning: dim(0.95, 0.8, 'accelerating'),
    technical_aptitude:   dim(0.95, 0.8, 'accelerating'),
  }, 4)
  const c = career('perfect-accel', {
    analytical_reasoning: req(0.4, 0.7, 0.6),
    technical_aptitude:   req(0.4, 0.7, 0.4),
  })

  const report = computeCapabilityMatches('s1', p, [c])
  const match = [...report.primary, ...report.stretch, ...report.alternative][0]
  assert.ok(match, 'expected a match')
  // Exactly bounded, not merely formatted to look like 100%.
  assert.equal(match.alignment_score, 1)
  assert.equal(alignmentToPercent(match.alignment_score), 100)
  assert.ok(match.alignment_score <= 1)
})

test('FIX 2: accelerating trend still lifts a below-ideal learner (momentum preserved)', () => {
  const below = profile({ analytical_reasoning: dim(0.55, 0.8, 'stable') }, 4)
  const belowAccel = profile({ analytical_reasoning: dim(0.55, 0.8, 'accelerating') }, 4)
  const c = career('one-dim', { analytical_reasoning: req(0.4, 0.7, 1.0) })

  const stable = computeCapabilityMatches('s', below, [c])
  const accel  = computeCapabilityMatches('s', belowAccel, [c])
  const sScore = [...stable.primary, ...stable.stretch, ...stable.alternative][0].alignment_score
  const aScore = [...accel.primary, ...accel.stretch, ...accel.alternative][0].alignment_score

  assert.ok(aScore > sScore, 'accelerating should score higher than stable below ideal')
  assert.ok(aScore <= 1)
})

test('FIX 2: every produced match has alignment in [0, 1] / [0, 100] across a varied spread', () => {
  const careers = [
    career('a', { analytical_reasoning: req(0.4, 0.7, 0.5), communication: req(0.3, 0.6, 0.5) }),
    career('b', { technical_aptitude: req(0.5, 0.8, 1.0) }),
    career('c', { social_intelligence: req(0.2, 0.5, 0.4), creative_thinking: req(0.3, 0.6, 0.6) }),
  ]
  const p = profile({
    analytical_reasoning: dim(0.9, 0.9, 'accelerating'),
    technical_aptitude:   dim(0.1, 0.5, 'declining'),
  }, 5)
  const report = computeCapabilityMatches('s', p, careers)
  for (const m of [...report.primary, ...report.stretch, ...report.alternative, ...report.entrepreneurial]) {
    assert.ok(m.alignment_score >= 0 && m.alignment_score <= 1, `score out of range: ${m.alignment_score}`)
    const pct = alignmentToPercent(m.alignment_score)
    assert.ok(pct >= 0 && pct <= 100, `pct out of range: ${pct}`)
  }
})

// ── FIX 3 — confidence-aware exclusion ────────────────────────────────────────

test('FIX 3 Case A: a confidence-0 dimension is excluded — no gap, scored on observed only', () => {
  // creative_thinking has zero evidence (the extractor's 0.35 placeholder).
  const p = profile({
    analytical_reasoning: dim(0.8, 0.8),
    creative_thinking:    dim(0.35, 0),   // unobserved
  }, 4)
  const c = career('needs-creative', {
    analytical_reasoning: req(0.4, 0.7, 0.5),
    creative_thinking:    req(0.6, 0.8, 0.5),
  })
  const report = computeCapabilityMatches('s', p, [c])
  const match = [...report.primary, ...report.stretch, ...report.alternative][0]
  assert.ok(match, 'expected a match')

  // No gap or dimension score fabricated for the unobserved dimension.
  assert.ok(!match.gaps.some(g => g.dimension === 'creative_thinking'), 'must not fabricate a creative gap')
  assert.equal(match.dimension_scores.creative_thinking, undefined)
  // Observed dimension (analytical, at ideal) carried the score — high, not dragged down.
  assert.ok(match.alignment_score >= 0.9, `expected observed-only high score, got ${match.alignment_score}`)
})

test('FIX 3 Case B: >50% required weight unobserved → Low confidence + caveat', () => {
  const p = profile({
    analytical_reasoning: dim(0.8, 0.8),
    creative_thinking:    dim(0.35, 0),
    social_intelligence:  dim(0.35, 0),
  }, 5)   // plenty of assessments — the floor is about COVERAGE, not volume
  const c = career('creative-heavy', {
    analytical_reasoning: req(0.4, 0.7, 0.3),
    creative_thinking:    req(0.6, 0.8, 0.4),
    social_intelligence:  req(0.5, 0.7, 0.3),
  })
  const report = computeCapabilityMatches('s', p, [c])
  const match = [...report.primary, ...report.stretch, ...report.alternative][0]
  assert.ok(match, 'expected a match')
  assert.equal(match.confidence, 'Low')
  assert.match(match.narrative, /incomplete capability evidence/i)
})

test('FIX 3 Case C: every required dimension unobserved → career skipped, no fabricated match', () => {
  const p = profile({
    creative_thinking: dim(0.35, 0),
    technical_aptitude: dim(0.35, 0),
  }, 4)
  const c = career('all-unobserved', {
    creative_thinking:  req(0.6, 0.8, 0.5),
    technical_aptitude: req(0.6, 0.8, 0.5),
  })
  const report = computeCapabilityMatches('s', p, [c])
  const all = [...report.primary, ...report.stretch, ...report.alternative, ...report.entrepreneurial]
  assert.ok(!all.some(m => m.career_slug === 'all-unobserved'), 'career with no observed evidence must be skipped')
  assert.equal(report.total_careers_scored, 0)
})

test('FIX 3 Case D: confidence transition 0 → observed makes the dimension count again', () => {
  const c = career('needs-creative', {
    analytical_reasoning: req(0.4, 0.7, 0.5),
    creative_thinking:    req(0.6, 0.8, 0.5),
  })
  // Before: creative unobserved → excluded, no creative gap.
  const before = computeCapabilityMatches('s', profile({
    analytical_reasoning: dim(0.8, 0.8),
    creative_thinking:    dim(0.35, 0),
  }, 4), [c])
  const mBefore = [...before.primary, ...before.stretch, ...before.alternative][0]
  assert.ok(!mBefore.gaps.some(g => g.dimension === 'creative_thinking'))

  // After: creative now observed and low → a real gap may appear.
  const after = computeCapabilityMatches('s', profile({
    analytical_reasoning: dim(0.8, 0.8),
    creative_thinking:    dim(0.30, 0.6),
  }, 4), [c])
  const mAfter = [...after.primary, ...after.stretch, ...after.alternative][0]
  assert.ok(mAfter.gaps.some(g => g.dimension === 'creative_thinking'), 'observed low creative should surface a gap')
  assert.equal(mAfter.dimension_scores.creative_thinking !== undefined, true)
})

test('FIX 3: a confidence-0 dimension never appears as a weakness in any produced match', () => {
  const p = profile({
    analytical_reasoning: dim(0.7, 0.7),
    creative_thinking:    dim(0.35, 0),
  }, 4)
  const careers = [
    career('x', { analytical_reasoning: req(0.4, 0.7, 0.7), creative_thinking: req(0.5, 0.8, 0.3) }),
    career('y', { creative_thinking: req(0.5, 0.8, 0.4), analytical_reasoning: req(0.4, 0.7, 0.6) }),
  ]
  const report = computeCapabilityMatches('s', p, careers)
  for (const m of [...report.primary, ...report.stretch, ...report.alternative, ...report.entrepreneurial]) {
    assert.ok(!m.gaps.some(g => g.dimension === 'creative_thinking'),
      `creative_thinking fabricated as a gap in ${m.career_slug}`)
  }
})

// ── Confidence caps still apply (unchanged behavior, guarded) ─────────────────

test('single-assessment learner is capped at 0.65, labelled Low, never primary', () => {
  const p = profile({
    analytical_reasoning: dim(0.95, 0.8),
    technical_aptitude:   dim(0.95, 0.8),
  }, 1)
  const c = career('top', {
    analytical_reasoning: req(0.4, 0.7, 0.5),
    technical_aptitude:   req(0.4, 0.7, 0.5),
  })
  const report = computeCapabilityMatches('s', p, [c])
  const match = [...report.primary, ...report.stretch, ...report.alternative][0]
  assert.ok(match.alignment_score <= 0.65, `expected cap at 0.65, got ${match.alignment_score}`)
  assert.equal(match.confidence, 'Low')
  assert.notEqual(match.tier, 'primary')
})
