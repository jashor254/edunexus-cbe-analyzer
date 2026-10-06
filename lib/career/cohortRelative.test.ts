// lib/career/cohortRelative.test.ts
//
// FIX 5 — cohort-relative capability (pure math + isolation from matching).
//   * fewer than 15 learners with evidence → no percentile, a reason instead;
//   * exactly 15 and more → mid-rank percentiles, deterministic;
//   * a dimension the learner (or too few peers) has no evidence for → null;
//   * the view never changes a career match score;
//   * the match engine source never reads it, and the pure extractor leaves it null.
//
// Run: npm test -- lib/career/cohortRelative.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computeCohortRelative } from './cohortRelative'
import { computeCapabilityMatches } from './capabilityMatchEngine'
import { extractCapabilityProfile } from './capabilityExtractor'
import type { CapabilityProfile, CapabilityDimension, CapabilityScore, Career, CareerCapabilityRequirements } from './types'

const DIMS: CapabilityDimension[] = [
  'analytical_reasoning', 'communication', 'creative_thinking',
  'technical_aptitude', 'social_intelligence', 'resilience',
]
const COHORT = { schoolId: 'school-1', grade: 9 }

function score(raw: number, confidence = 0.6): CapabilityScore {
  return { level: 'capable', raw_score: raw, trend: 'stable', evidence: [], confidence }
}

function profile(raw: number, overrides: Partial<Record<CapabilityDimension, CapabilityScore>> = {}): CapabilityProfile {
  const dims = Object.fromEntries(DIMS.map(d => [d, overrides[d] ?? score(raw)])) as Record<CapabilityDimension, CapabilityScore>
  return {
    ...dims, dominant_cluster: [], emerging_cluster: [], computed_at: '2026-01-01T00:00:00.000Z',
    assessment_count: 3, disclaimer: 'test', cohort_relative: null,
  }
}

/** n peers with evenly spread scores in (0, 1). */
function peers(n: number): CapabilityProfile[] {
  return Array.from({ length: n }, (_, i) => profile((i + 1) / (n + 2)))
}

test('cohort of 14 (learner + 13 peers) → insufficient, no percentile, reason given', () => {
  const r = computeCohortRelative(profile(0.5), peers(13), COHORT)
  assert.equal(r.status, 'insufficient_cohort')
  if (r.status !== 'insufficient_cohort') return
  assert.equal(r.cohort.size, 14)
  assert.match(r.reason, /Only 14 learners .* at least 15/)
  assert.ok(!('percentiles' in r))
})

test('cohort of exactly 15 → available', () => {
  const r = computeCohortRelative(profile(0.5), peers(14), COHORT)
  assert.equal(r.status, 'available')
  if (r.status === 'available') assert.equal(r.cohort.size, 15)
})

test('cohort above 15 → deterministic mid-rank percentiles (unique top, unique bottom, ties)', () => {
  const top = computeCohortRelative(profile(0.99), peers(19), COHORT)
  const bottom = computeCohortRelative(profile(0.001), peers(19), COHORT)
  assert.equal(top.status, 'available')
  assert.equal(bottom.status, 'available')
  if (top.status !== 'available' || bottom.status !== 'available') return
  assert.equal(top.percentiles.analytical_reasoning, 98)    // (19 + 0.5) / 20
  assert.equal(bottom.percentiles.analytical_reasoning, 3)  // (0 + 0.5) / 20

  const allTied = computeCohortRelative(profile(0.5), Array.from({ length: 19 }, () => profile(0.5)), COHORT)
  if (allTied.status === 'available') assert.equal(allTied.percentiles.communication, 50)
})

test('missing evidence: learner confidence 0 → that dimension null; too few peers with evidence → null', () => {
  const learner = profile(0.6, { creative_thinking: score(0.35, 0) })
  const cohort = peers(19).map((p, i) => i < 10 ? { ...p, technical_aptitude: score(0.35, 0) } : p)
  const r = computeCohortRelative(learner, cohort, COHORT)
  assert.equal(r.status, 'available')
  if (r.status !== 'available') return
  assert.equal(r.percentiles.creative_thinking, null, 'no evidence for the learner is not a rank')
  assert.equal(r.percentiles.technical_aptitude, null, 'only 10 of 20 have evidence — below the floor')
  assert.equal(typeof r.percentiles.analytical_reasoning, 'number')
})

test('the cohort view never alters a career match score', () => {
  const caps: Partial<CareerCapabilityRequirements> = {
    analytical_reasoning: { minimum: 0.4, ideal: 0.7, weight: 0.6, note: 'n' },
    communication:        { minimum: 0.3, ideal: 0.6, weight: 0.4, note: 'n' },
  }
  const careers = [{ slug: 'c', title: 'c', category: 'technology', pathway: 'STEM', required_capabilities: caps } as Career]
  const without = profile(0.62)
  const withView: CapabilityProfile = { ...without, cohort_relative: computeCohortRelative(without, peers(19), COHORT) }
  const strip = (r: ReturnType<typeof computeCapabilityMatches>) => ({ ...r, generated_at: '' })
  assert.deepEqual(strip(computeCapabilityMatches('s', withView, careers)), strip(computeCapabilityMatches('s', without, careers)))
})

test('the match engine source never reads cohort_relative', () => {
  const src = readFileSync(new URL('./capabilityMatchEngine.ts', import.meta.url), 'utf8')
  assert.ok(!src.includes('cohort_relative'), 'capabilityMatchEngine.ts must not reference cohort_relative')
})

test('the pure extractor leaves cohort_relative null', () => {
  assert.equal(extractCapabilityProfile([{ mathematics: 3 }, { mathematics: 3.2 }]).cohort_relative, null)
})
