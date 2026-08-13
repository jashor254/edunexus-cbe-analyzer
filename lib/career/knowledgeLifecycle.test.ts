// lib/career/knowledgeLifecycle.test.ts
//
// Run: npx tsx --test lib/career/knowledgeLifecycle.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assessCareerKnowledge,
  needsReverification,
  byStalestFirst,
} from './knowledgeLifecycle'
import { CAREER_KNOWLEDGE_THRESHOLDS } from '@/lib/config/careerKnowledge'

const NOW = new Date('2026-08-13T12:00:00.000Z')

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

test('recent knowledge is fresh and may be stated plainly', () => {
  const state = assessCareerKnowledge(daysAgo(10), NOW)
  assert.equal(state.freshness, 'fresh')
  assert.equal(state.ageDays, 10)
  assert.equal(state.requiresHistoricalFraming, false)
})

test('the fresh/aging boundary is inclusive of the threshold', () => {
  const { freshMaxDays } = CAREER_KNOWLEDGE_THRESHOLDS
  assert.equal(assessCareerKnowledge(daysAgo(freshMaxDays), NOW).freshness, 'fresh')
  assert.equal(assessCareerKnowledge(daysAgo(freshMaxDays + 1), NOW).freshness, 'aging')
})

test('the aging/stale boundary is inclusive of the threshold', () => {
  const { agingMaxDays } = CAREER_KNOWLEDGE_THRESHOLDS
  assert.equal(assessCareerKnowledge(daysAgo(agingMaxDays), NOW).freshness, 'aging')
  assert.equal(assessCareerKnowledge(daysAgo(agingMaxDays + 1), NOW).freshness, 'stale')
})

test('stale knowledge must be framed historically, never as present tense', () => {
  const state = assessCareerKnowledge(daysAgo(400), NOW)
  assert.equal(state.freshness, 'stale')
  assert.equal(state.requiresHistoricalFraming, true)
  assert.match(state.asOfLabel, /out of date/)
})

test('aging knowledge is usable but dated for the reader', () => {
  const state = assessCareerKnowledge(daysAgo(200), NOW)
  assert.equal(state.freshness, 'aging')
  assert.equal(state.requiresHistoricalFraming, false)
  assert.match(state.asOfLabel, /confirmed/)
})

// The whole point of the module: absence of a date is not a licence to assume
// currency. This is the assertion that would have caught the original bug.
test('never-verified knowledge is unknown, not fresh, and is framed historically', () => {
  for (const missing of [null, undefined, '']) {
    const state = assessCareerKnowledge(missing, NOW)
    assert.equal(state.freshness, 'unknown', `expected unknown for ${JSON.stringify(missing)}`)
    assert.equal(state.ageDays, null)
    assert.equal(state.verifiedAt, null)
    assert.equal(state.requiresHistoricalFraming, true)
  }
})

test('an unparseable date is unknown, not a NaN age', () => {
  const state = assessCareerKnowledge('not-a-date', NOW)
  assert.equal(state.freshness, 'unknown')
  assert.equal(state.ageDays, null)
})

test('a future verification date clamps to zero rather than reading as stale', () => {
  const future = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
  const state = assessCareerKnowledge(future, NOW)
  assert.equal(state.ageDays, 0)
  assert.equal(state.freshness, 'fresh')
})

test('the as-of label always names the confirmation date when one exists', () => {
  for (const age of [1, 150, 500]) {
    const state = assessCareerKnowledge(daysAgo(age), NOW)
    assert.match(state.asOfLabel, /\d{4}/, `expected a year in the label at age ${age}`)
  }
})

test('anything not fresh is due for re-verification, including unknown', () => {
  assert.equal(needsReverification(daysAgo(10), NOW), false)
  assert.equal(needsReverification(daysAgo(200), NOW), true)
  assert.equal(needsReverification(daysAgo(400), NOW), true)
  assert.equal(needsReverification(null, NOW), true)
})

test('a refresh sweep takes never-verified careers before merely old ones', () => {
  const corpus = [
    { slug: 'old', knowledge_verified_at: daysAgo(400) },
    { slug: 'never', knowledge_verified_at: null },
    { slug: 'recent', knowledge_verified_at: daysAgo(5) },
    { slug: 'older', knowledge_verified_at: daysAgo(900) },
  ]
  const order = [...corpus].sort(byStalestFirst).map(c => c.slug)
  assert.deepEqual(order, ['never', 'older', 'old', 'recent'])
})

// The real corpus condition when this module was written: 43 careers, all
// seeded, none confirmed since 2026-06-16 — 58 days old, which is genuinely
// still fresh. The original defect was never that 58 days is too old; it was
// that NOTHING measured the age and nothing could ever refresh it. This test
// pins both halves: fresh today, and correctly self-reporting as stale once the
// same untouched corpus crosses the threshold.
test('the June 2026 seed corpus is fresh in August but reports itself stale a year on', () => {
  const seeded = '2026-06-16T00:00:00.000Z'

  const today = assessCareerKnowledge(seeded, NOW)
  assert.equal(today.freshness, 'fresh')
  assert.equal(today.ageDays, 58)
  assert.equal(today.requiresHistoricalFraming, false)

  const aYearOn = assessCareerKnowledge(seeded, new Date('2027-08-13T12:00:00.000Z'))
  assert.equal(aYearOn.freshness, 'stale')
  assert.equal(aYearOn.requiresHistoricalFraming, true)
})
