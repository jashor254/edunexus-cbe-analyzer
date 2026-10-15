// lib/schoolEffectiveness/scoring.test.ts
//
// The School Effectiveness Check scorer — pure, deterministic. These lock the
// maturity maths, the gap prioritisation, the programme mapping, and the
// honesty invariant (horizon gaps are surfaced but never mapped to a product).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreSchoolEffectiveness } from './scoring'
import { CBC_GATSBY_BENCHMARKS } from './benchmarks'
import type { BenchmarkRating } from './types'

const ALL_IDS = CBC_GATSBY_BENCHMARKS.map((b) => b.id)

function rate(ids: string[], level: 0 | 1 | 2 | 3 | 4): BenchmarkRating[] {
  return ids.map((benchmarkId) => ({ benchmarkId, level }))
}

test('no ratings: returns an empty, honest "nothing to diagnose" profile', () => {
  const p = scoreSchoolEffectiveness([])
  assert.equal(p.benchmarks_rated, 0)
  assert.equal(p.benchmarks_total, 11)
  assert.equal(p.overall_maturity, 0)
  assert.equal(p.overall_stage, 'absent')
  assert.deepEqual(p.prioritised_gaps, [])
  assert.deepEqual(p.recommended_programmes, [])
  assert.match(p.summary, /nothing to diagnose/)
})

test('all benchmarks fully embedded: no gaps, no recommendations, embedded stage', () => {
  const p = scoreSchoolEffectiveness(rate(ALL_IDS, 4))
  assert.equal(p.benchmarks_rated, 11)
  assert.equal(p.overall_maturity, 4)
  assert.equal(p.overall_percent, 100)
  assert.equal(p.overall_stage, 'embedded')
  assert.deepEqual(p.prioritised_gaps, [])
  assert.deepEqual(p.recommended_programmes, [])
  assert.deepEqual(p.unaddressed_gaps, [])
  assert.match(p.summary, /No benchmark falls below full maturity/)
})

test('all benchmarks absent: 11 critical gaps, absent stage, 9 available programmes, 2 unaddressed', () => {
  const p = scoreSchoolEffectiveness(rate(ALL_IDS, 0))
  assert.equal(p.overall_maturity, 0)
  assert.equal(p.overall_stage, 'absent')
  assert.equal(p.prioritised_gaps.length, 11)
  assert.ok(p.prioritised_gaps.every((g) => g.priority === 'critical' && g.shortfall === 4))

  // At equal shortfall, addressable gaps come before horizon gaps.
  const lastTwo = p.prioritised_gaps.slice(-2).map((g) => g.order).sort((a, b) => a - b)
  assert.deepEqual(lastTwo, [5, 6], 'the two horizon gaps sort last')

  // Honesty: exactly benchmarks 5 and 6 are unaddressed.
  assert.deepEqual(p.unaddressed_gaps.map((g) => g.order).sort((a, b) => a - b), [5, 6])
  for (const g of p.unaddressed_gaps) assert.deepEqual(g.recommended, [])

  // All nine real programmes are recommended; no horizon programme leaks in.
  const keys = p.recommended_programmes.map((r) => r.key)
  assert.equal(p.recommended_programmes.length, 9)
  assert.ok(keys.includes('career_intelligence'))
  assert.ok(keys.includes('learner_portfolio'))
  assert.ok(p.recommended_programmes.every((r) => r.status === 'available'))
})

test('partial, mixed ratings: maturity maths and prioritisation are correct', () => {
  const p = scoreSchoolEffectiveness([
    { benchmarkId: 'stable_programme', level: 4 },     // no gap
    { benchmarkId: 'each_learners_needs', level: 1 },  // shortfall 3, addressable
    { benchmarkId: 'employer_encounters', level: 0 },  // shortfall 4, horizon
  ])
  assert.equal(p.benchmarks_rated, 3)
  assert.equal(p.overall_maturity, 1.7) // (4+1+0)/3 = 1.667 → 1.7
  assert.equal(p.overall_percent, 42)
  assert.equal(p.overall_stage, 'developing')

  // Biggest shortfall first — the horizon employer gap (4) outranks the
  // addressable each-learner gap (3); the embedded benchmark is not a gap.
  assert.equal(p.prioritised_gaps.length, 2)
  assert.equal(p.prioritised_gaps[0].benchmarkId, 'employer_encounters')
  assert.equal(p.prioritised_gaps[1].benchmarkId, 'each_learners_needs')

  // Only the addressable gap yields programmes; the horizon gap yields none.
  const keys = p.recommended_programmes.map((r) => r.key).sort()
  assert.deepEqual(keys, ['adaptive', 'blueprint', 'gradebook'])
  assert.ok(!keys.includes('career_intelligence'))
  assert.equal(p.unaddressed_gaps.length, 1)
})

test('unknown benchmark ids are ignored; a duplicate id keeps the last rating', () => {
  const p = scoreSchoolEffectiveness([
    { benchmarkId: 'not_a_real_benchmark', level: 0 },
    { benchmarkId: 'personal_guidance', level: 1 },
    { benchmarkId: 'personal_guidance', level: 3 }, // last wins → level 3
  ])
  assert.equal(p.benchmarks_rated, 1)
  assert.equal(p.prioritised_gaps.length, 1)
  assert.equal(p.prioritised_gaps[0].level, 3)
  assert.equal(p.prioritised_gaps[0].shortfall, 1)
  assert.equal(p.prioritised_gaps[0].priority, 'moderate')
})

test('deterministic: identical input yields identical output', () => {
  const ratings = rate(['each_learners_needs', 'personal_guidance', 'employer_encounters'], 2)
  assert.deepEqual(scoreSchoolEffectiveness(ratings), scoreSchoolEffectiveness(ratings))
})
