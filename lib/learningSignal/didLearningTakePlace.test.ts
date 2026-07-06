// lib/learningSignal/didLearningTakePlace.test.ts
// Run with: npx tsx --test lib/learningSignal/didLearningTakePlace.test.ts
// (node:test + node:assert — no new dependency, nothing else is installed in this repo)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeLearningDeltas, aggregateClassLearningDeltas } from './didLearningTakePlace'
import type { StrandAssessmentSample } from '@/lib/repositories/learning-signal.repository'

function sample(topic: string, rating: number, createdAt: string, strand = 'Numbers'): StrandAssessmentSample {
  return { strand, topic, rating, created_at: createdAt }
}

test('movedUp: rating increases between T1 and T2', () => {
  const rows = [sample('Fractions', 1, '2026-01-01'), sample('Fractions', 3, '2026-03-01')]
  const [delta] = computeLearningDeltas(rows)
  assert.equal(delta.movement, 'movedUp')
  assert.equal(delta.ratingT1, 1)
  assert.equal(delta.ratingT2, 3)
  assert.equal(delta.delta, 2)
})

test('flat: rating unchanged between T1 and T2', () => {
  const rows = [sample('Decimals', 2, '2026-01-01'), sample('Decimals', 2, '2026-03-01')]
  const [delta] = computeLearningDeltas(rows)
  assert.equal(delta.movement, 'flat')
  assert.equal(delta.delta, 0)
})

test('regressed: rating decreases between T1 and T2', () => {
  const rows = [sample('Angles', 3, '2026-01-01'), sample('Angles', 2, '2026-03-01')]
  const [delta] = computeLearningDeltas(rows)
  assert.equal(delta.movement, 'regressed')
  assert.equal(delta.delta, -1)
})

test('insufficient_data: only one sample in range', () => {
  const rows = [sample('Money', 2, '2026-01-01')]
  const [delta] = computeLearningDeltas(rows)
  assert.equal(delta.movement, 'insufficient_data')
  assert.equal(delta.ratingT1, 2)
  assert.equal(delta.ratingT2, null)
  assert.equal(delta.delta, null)
  assert.equal(delta.crossedThreshold, false)
})

test('crossedThreshold: true only when T1 below 3 and T2 at/above 3', () => {
  const crossed = computeLearningDeltas([sample('Fractions', 2, '2026-01-01'), sample('Fractions', 3, '2026-03-01')])[0]
  assert.equal(crossed.crossedThreshold, true)

  const notCrossedStillLow = computeLearningDeltas([sample('Fractions', 1, '2026-01-01'), sample('Fractions', 2, '2026-03-01')])[0]
  assert.equal(notCrossedStillLow.crossedThreshold, false)

  const alreadyAboveNoCrossing = computeLearningDeltas([sample('Fractions', 3, '2026-01-01'), sample('Fractions', 4, '2026-03-01')])[0]
  assert.equal(alreadyAboveNoCrossing.crossedThreshold, false)
})

test('uses earliest and latest sample when more than two exist in range', () => {
  const rows = [
    sample('Fractions', 1, '2026-01-01'),
    sample('Fractions', 2, '2026-02-01'),
    sample('Fractions', 4, '2026-03-01'),
  ]
  const [delta] = computeLearningDeltas(rows)
  assert.equal(delta.ratingT1, 1)
  assert.equal(delta.ratingT2, 4)
  assert.equal(delta.delta, 3)
})

test('rows are grouped independently per (strand, topic)', () => {
  const rows = [
    sample('Fractions', 1, '2026-01-01', 'Numbers'),
    sample('Fractions', 3, '2026-03-01', 'Numbers'),
    sample('Angles', 3, '2026-01-01', 'Geometry'),
    sample('Angles', 2, '2026-03-01', 'Geometry'),
  ]
  const deltas = computeLearningDeltas(rows)
  assert.equal(deltas.length, 2)
  const fractions = deltas.find(d => d.topic === 'Fractions')!
  const angles     = deltas.find(d => d.topic === 'Angles')!
  assert.equal(fractions.movement, 'movedUp')
  assert.equal(angles.movement, 'regressed')
})

test('class aggregate: pctMovedUp excludes insufficient_data from the denominator', () => {
  const learnerA = computeLearningDeltas([sample('Fractions', 1, '2026-01-01'), sample('Fractions', 3, '2026-03-01')]) // movedUp
  const learnerB = computeLearningDeltas([sample('Fractions', 2, '2026-01-01'), sample('Fractions', 2, '2026-03-01')]) // flat
  const learnerC = computeLearningDeltas([sample('Fractions', 2, '2026-01-01')]) // insufficient_data

  const [agg] = aggregateClassLearningDeltas([learnerA, learnerB, learnerC])
  assert.equal(agg.learnerCount, 2)       // C excluded
  assert.equal(agg.movedUpCount, 1)
  assert.equal(agg.flatCount, 1)
  assert.equal(agg.pctMovedUp, 50)
})

test('class aggregate: 0 usable learners yields 0% not NaN', () => {
  const learnerA = computeLearningDeltas([sample('Fractions', 2, '2026-01-01')]) // insufficient_data only
  const [agg] = aggregateClassLearningDeltas([learnerA])
  assert.equal(agg.learnerCount, 0)
  assert.equal(agg.pctMovedUp, 0)
})
