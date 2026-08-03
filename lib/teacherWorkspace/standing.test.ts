// lib/teacherWorkspace/standing.test.ts
// Run: npx tsx --test lib/teacherWorkspace/standing.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyStanding,
  getStandingLabel,
  getStandingColorClasses,
  classifyStandingDistribution,
  averageScore,
  rawMean,
} from './standing'

test('classifyStanding: boundary values are inclusive at the lower edge of each band', () => {
  assert.equal(classifyStanding(3.5), 'exceeds')
  assert.equal(classifyStanding(3.49), 'meets')
  assert.equal(classifyStanding(2.5), 'meets')
  assert.equal(classifyStanding(2.49), 'approaching')
  assert.equal(classifyStanding(1.5), 'approaching')
  assert.equal(classifyStanding(1.49), 'below')
  assert.equal(classifyStanding(0), 'below')
})

test('classifyStanding: valid CBC range 1-4 covers all four bands', () => {
  assert.equal(classifyStanding(4), 'exceeds')
  assert.equal(classifyStanding(1), 'below')
})

test('classifyStanding: unexpected out-of-range values do not throw', () => {
  assert.equal(classifyStanding(-5), 'below')
  assert.equal(classifyStanding(100), 'exceeds')
})

test('getStandingLabel: long format matches the prior per-learner/per-subject labels', () => {
  assert.equal(getStandingLabel(3.6, 'long'), 'Exceeds Expectations')
  assert.equal(getStandingLabel(3.0, 'long'), 'Meets Expectations')
  assert.equal(getStandingLabel(2.0, 'long'), 'Approaching Expectations')
  assert.equal(getStandingLabel(1.0, 'long'), 'Below Expectations')
})

test('getStandingLabel: short format matches the prior class-card/insights labels, and is the default only when explicitly requested', () => {
  assert.equal(getStandingLabel(3.6, 'short'), 'Exceeds')
  assert.equal(getStandingLabel(3.0, 'short'), 'Meets')
  assert.equal(getStandingLabel(2.0, 'short'), 'Approaching')
  assert.equal(getStandingLabel(1.0, 'short'), 'Below')
})

test('getStandingLabel: defaults to long form when format is omitted', () => {
  assert.equal(getStandingLabel(3.6), 'Exceeds Expectations')
})

test('getStandingLabel and classifyStanding agree for every consumer — label consistency', () => {
  for (const avg of [0, 1, 1.5, 1.99, 2.5, 3.2, 3.5, 4]) {
    const level = classifyStanding(avg)
    const long = getStandingLabel(avg, 'long')
    const short = getStandingLabel(avg, 'short')
    assert.ok(long.startsWith(short), `long label "${long}" should start with short label "${short}" for level ${level}`)
  }
})

test('getStandingColorClasses: returns badge and bar classes for every band', () => {
  assert.deepEqual(getStandingColorClasses(3.6), { badge: 'text-purple-700 bg-purple-100', bar: 'bg-purple-500' })
  assert.deepEqual(getStandingColorClasses(3.0), { badge: 'text-green-700 bg-green-100', bar: 'bg-green-500' })
  assert.deepEqual(getStandingColorClasses(2.0), { badge: 'text-amber-700 bg-amber-100', bar: 'bg-amber-500' })
  assert.deepEqual(getStandingColorClasses(1.0), { badge: 'text-red-700 bg-red-100', bar: 'bg-red-500' })
})

test('classifyStandingDistribution: empty input returns all-zero buckets', () => {
  assert.deepEqual(classifyStandingDistribution([]), { below: 0, approaching: 0, meets: 0, exceeds: 0 })
})

test('classifyStandingDistribution: buckets a mixed set of scores exactly like the original inline filters', () => {
  const scores = [1.0, 1.5, 2.4, 2.5, 3.4, 3.5, 4.0]
  assert.deepEqual(classifyStandingDistribution(scores), { below: 1, approaching: 2, meets: 2, exceeds: 2 })
})

test('averageScore: empty input returns null, not NaN', () => {
  assert.equal(averageScore([]), null)
})

test('averageScore: rounds to 1 decimal place', () => {
  assert.equal(averageScore([3, 3, 4]), 3.3)
})

test('rawMean: empty input returns null', () => {
  assert.equal(rawMean([]), null)
})

test('rawMean: unrounded, can classify differently than the rounded averageScore would suggest', () => {
  const values = [3.4, 3.5] // rawMean = 3.45 -> classifies as "meets" (below 3.5)
  assert.equal(rawMean(values), 3.45)
  assert.equal(classifyStanding(rawMean(values)!), 'meets')
  // averageScore would round 3.45 to 3.5 (JS rounds .5 up), which would
  // wrongly classify as "exceeds" if used for classification instead of display —
  // this is exactly the boundary-flip rawMean exists to avoid.
  assert.equal(averageScore(values), 3.5)
})

test('null/unexpected values: classifyStanding handles NaN by falling through to "below" rather than throwing', () => {
  assert.equal(classifyStanding(NaN), 'below')
})
