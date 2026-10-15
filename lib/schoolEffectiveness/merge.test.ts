// lib/schoolEffectiveness/merge.test.ts
//
// The hybrid merge: auto-derived wins for hybrid benchmarks, self-report fills
// the rest, self-report-only benchmarks never take an auto rating, and a cold
// prospect (no auto data) ends up entirely self-reported.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeRatings } from './merge'
import { scoreSchoolEffectiveness } from './scoring'
import type { BenchmarkRating } from './types'

test('hybrid benchmark: auto-derived wins when both auto and self-report exist', () => {
  const merged = mergeRatings(
    [{ benchmarkId: 'each_learners_needs', level: 3 }],
    [{ benchmarkId: 'each_learners_needs', level: 1 }],
  )
  assert.equal(merged.length, 1)
  assert.deepEqual(merged[0], { benchmarkId: 'each_learners_needs', level: 3, source: 'auto' })
})

test('hybrid benchmark: falls back to self-report when no auto rating exists', () => {
  const merged = mergeRatings([], [{ benchmarkId: 'pathway_labour_market_info', level: 2 }])
  assert.deepEqual(merged, [{ benchmarkId: 'pathway_labour_market_info', level: 2, source: 'self_report' }])
})

test('self-report-only benchmark ignores any auto rating', () => {
  // stable_programme (order 1) is self_report-only.
  const withSelf = mergeRatings(
    [{ benchmarkId: 'stable_programme', level: 4 }], // auto — must be ignored
    [{ benchmarkId: 'stable_programme', level: 1 }],
  )
  assert.deepEqual(withSelf, [{ benchmarkId: 'stable_programme', level: 1, source: 'self_report' }])

  // auto only, no self-report → the self_report-only benchmark stays unrated.
  const autoOnly = mergeRatings([{ benchmarkId: 'stable_programme', level: 4 }], [])
  assert.deepEqual(autoOnly, [])
})

test('cold prospect: no auto data → every rating is self-reported, in benchmark order', () => {
  const self: BenchmarkRating[] = [
    { benchmarkId: 'personal_guidance', level: 2 },     // order 8
    { benchmarkId: 'stable_programme', level: 1 },       // order 1
    { benchmarkId: 'each_learners_needs', level: 0 },    // order 3
  ]
  const merged = mergeRatings([], self)
  assert.ok(merged.every((r) => r.source === 'self_report'))
  // Output follows benchmark (order) sequence, not input order.
  assert.deepEqual(merged.map((r) => r.benchmarkId), [
    'stable_programme',
    'each_learners_needs',
    'personal_guidance',
  ])
})

test('unrated benchmarks are omitted', () => {
  const merged = mergeRatings([], [{ benchmarkId: 'personal_guidance', level: 3 }])
  assert.equal(merged.length, 1)
})

test('merged ratings feed the scorer unchanged', () => {
  const merged = mergeRatings(
    [{ benchmarkId: 'each_learners_needs', level: 4 }],
    [{ benchmarkId: 'stable_programme', level: 2 }],
  )
  const profile = scoreSchoolEffectiveness(merged)
  assert.equal(profile.benchmarks_rated, 2)
  // each_learners_needs at 4 is not a gap; stable_programme at 2 is.
  assert.equal(profile.prioritised_gaps.length, 1)
  assert.equal(profile.prioritised_gaps[0].benchmarkId, 'stable_programme')
})

test('deterministic: identical input yields identical output', () => {
  const a = mergeRatings([{ benchmarkId: 'each_learners_needs', level: 3 }], [{ benchmarkId: 'stable_programme', level: 1 }])
  const b = mergeRatings([{ benchmarkId: 'each_learners_needs', level: 3 }], [{ benchmarkId: 'stable_programme', level: 1 }])
  assert.deepEqual(a, b)
})
