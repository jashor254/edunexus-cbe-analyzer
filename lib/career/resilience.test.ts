// lib/career/resilience.test.ts
//
// Deterministic, env-free behavioural contract for computeResilience (via the
// public extractCapabilityProfile), locking FIX 1 of the Career Intelligence
// corrective pass: stability, improvement and recovery are separate signals.
//
//   * Stability alone (incl. a learner holding CBC 3.8 every term) reaches
//     "capable" but never "strong".
//   * Improvement, or a genuine mid-history recovery, is what earns "strong".
//   * One low FIRST point followed by the learner's usual level counts less
//     than a genuine recovery (regression to the mean is not resilience).
//   * Flat-low and noisy oscillation are never rewarded as resilience.
//   * The <2-assessment branch is unchanged, value for value.
//
// Histories are raw CBC 1–4, one value per assessment, applied to three
// subjects so the per-subject rates are realistic. Assertions are on the
// behavioural contract (levels, ordering), not on tuned constants, except the
// <2-assessment branch whose exact values are themselves contractual.
//
// Run: npm test -- lib/career/resilience.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractCapabilityProfile } from './capabilityExtractor'
import type { CapabilityScore } from './types'

const SUBJECTS = ['mathematics', 'english', 'physics']

function history(series: number[]): Array<Record<string, number>> {
  return series.map(v => Object.fromEntries(SUBJECTS.map(s => [s, v])))
}

function resilienceOf(series: number[]): CapabilityScore {
  return extractCapabilityProfile(history(series)).resilience
}

const STRONG_OR_ABOVE: CapabilityScore['level'][] = ['strong', 'exceptional']

const flatLow     = resilienceOf([1.5, 1.5, 1.5, 1.5])
const flatMiddle  = resilienceOf([3.0, 3.0, 3.0, 3.0])
const flatHigh    = resilienceOf([3.8, 3.8, 3.8, 3.8])
const improving   = resilienceOf([3.0, 3.3, 3.6, 3.9])
const accelerating = resilienceOf([2.0, 2.2, 3.0, 3.8])
const declining   = resilienceOf([3.5, 3.0, 2.5, 2.0])
const recovery    = resilienceOf([3.5, 2.5, 3.6, 3.6])
const badFirst    = resilienceOf([2.0, 3.5, 3.6, 3.5])
const volatileLow  = resilienceOf([3.5, 2.0, 3.5, 2.0])
const volatileHigh = resilienceOf([2.0, 3.5, 2.0, 3.5])

test('flat high (CBC 3.8, 4 assessments) reaches capable — not strong from stability alone', () => {
  assert.equal(flatHigh.level, 'capable')
})

test('flat high with only 3 assessments is still at least capable', () => {
  assert.equal(resilienceOf([3.8, 3.8, 3.8]).level, 'capable')
})

test('stability-only ceiling: flat at the CBC maximum across 6 assessments never reaches strong', () => {
  const flatMax = resilienceOf([4, 4, 4, 4, 4, 4])
  assert.ok(!STRONG_OR_ABOVE.includes(flatMax.level), `stability alone reached ${flatMax.level}`)
})

test('flat ordering: flat low < flat middle < flat high, and flat middle is not strong', () => {
  assert.ok(flatLow.raw_score < flatMiddle.raw_score)
  assert.ok(flatMiddle.raw_score < flatHigh.raw_score)
  assert.ok(!STRONG_OR_ABOVE.includes(flatMiddle.level))
})

test('flat low is never credited as capable-or-better resilience', () => {
  assert.ok(['emerging', 'developing'].includes(flatLow.level), `flat low read as ${flatLow.level}`)
})

test('improving high learner reaches strong or above', () => {
  assert.ok(STRONG_OR_ABOVE.includes(improving.level), `improving read as ${improving.level}`)
})

test('accelerating learner reaches strong or above', () => {
  assert.ok(STRONG_OR_ABOVE.includes(accelerating.level), `accelerating read as ${accelerating.level}`)
})

test('sustained strength plus some improvement is eligible for strong', () => {
  const mixed = extractCapabilityProfile([
    { mathematics: 3.8, english: 3.0, physics: 3.8 },
    { mathematics: 3.8, english: 3.3, physics: 3.8 },
    { mathematics: 3.8, english: 3.6, physics: 3.8 },
    { mathematics: 3.8, english: 3.9, physics: 3.8 },
  ]).resilience
  assert.ok(STRONG_OR_ABOVE.includes(mixed.level), `sustained + improvement read as ${mixed.level}`)
})

test('declining learner scores below a flat-middle learner', () => {
  assert.ok(declining.raw_score < flatMiddle.raw_score)
  assert.ok(!STRONG_OR_ABOVE.includes(declining.level))
})

test('genuine dip-and-recovery earns explicit recovery credit (strong with 4 assessments)', () => {
  assert.ok(STRONG_OR_ABOVE.includes(recovery.level), `recovery read as ${recovery.level}`)
  assert.ok(recovery.evidence.some(e => /^Recovered in Mathematics after a dip/.test(e)))
})

test('one bad first point counts less than a genuine mid-history recovery', () => {
  assert.ok(badFirst.raw_score < recovery.raw_score,
    `bad-first (${badFirst.raw_score}) must score below recovery (${recovery.raw_score})`)
  assert.ok(badFirst.evidence.some(e => /returned to its usual level after one low early assessment/.test(e)))
})

test('volatile oscillation ending high is not rewarded as strong resilience', () => {
  assert.ok(!STRONG_OR_ABOVE.includes(volatileHigh.level), `volatile read as ${volatileHigh.level}`)
  assert.ok(volatileHigh.raw_score < improving.raw_score)
})

test('volatile oscillation ending low carries the decline penalty', () => {
  assert.ok(volatileLow.raw_score < flatMiddle.raw_score)
})

test('evidence lines are human-readable reasons', () => {
  assert.ok(flatHigh.evidence.includes('Held strong performance in Mathematics across 4 assessments'))
})

test('<2 assessments: unchanged documented branch, value for value', () => {
  const single = resilienceOf([3.0])
  assert.deepEqual(single, {
    level:      'developing',
    raw_score:  0.40,
    trend:      'stable',
    evidence:   ['Need at least 2 assessments to measure resilience accurately'],
    confidence: 0.15,
  })
})
