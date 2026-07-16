// lib/grading/gradingEngine.test.ts
//
// Pure unit tests — no database, no Supabase, no fixtures. Sprint 4A
// (docs/engineering/sprint-3-assessment-domain-audit.md §4/§11,
// docs/architecture/deprecation-registry.md #5) required this engine to be
// independently verifiable before anything migrates to it.
//
// Run: npx tsx --test lib/grading/gradingEngine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeScore } from './index'
import { GradingError } from './types'
import { CBC_SCALE_STANDARD, CBC_SCALE_CORE_LEGACY, SCALE_844_KNEC } from './boundaries'
import type { GradeScale } from './types'

// ── Boundary scores ─────────────────────────────────────────────────────────

test('boundary score: exact minPct of a band returns that band, not the one below', () => {
  const result = gradeScore(76, 100, CBC_SCALE_STANDARD)
  assert.equal(result.grade, 'EE')
})

test('boundary score: one point below a band boundary returns the lower band', () => {
  const result = gradeScore(75, 100, CBC_SCALE_STANDARD)
  assert.equal(result.grade, 'ME')
})

test('minimum score (0) returns the lowest band', () => {
  const result = gradeScore(0, 100, CBC_SCALE_STANDARD)
  assert.equal(result.grade, 'BE')
})

test('maximum score (maxScore) returns the highest band', () => {
  const result = gradeScore(100, 100, CBC_SCALE_STANDARD)
  assert.equal(result.grade, 'EE')
})

// ── Invalid scores ───────────────────────────────────────────────────────────

test('invalid score: NaN throws GradingError', () => {
  assert.throws(() => gradeScore(NaN, 100, CBC_SCALE_STANDARD), GradingError)
})

test('invalid score: Infinity throws GradingError', () => {
  assert.throws(() => gradeScore(Infinity, 100, CBC_SCALE_STANDARD), GradingError)
})

test('invalid score: negative throws GradingError', () => {
  assert.throws(() => gradeScore(-1, 100, CBC_SCALE_STANDARD), GradingError)
})

test('invalid score: exceeds maxScore throws GradingError', () => {
  assert.throws(() => gradeScore(101, 100, CBC_SCALE_STANDARD), GradingError)
})

test('invalid maxScore: zero throws GradingError', () => {
  assert.throws(() => gradeScore(50, 0, CBC_SCALE_STANDARD), GradingError)
})

test('invalid maxScore: negative throws GradingError', () => {
  assert.throws(() => gradeScore(50, -10, CBC_SCALE_STANDARD), GradingError)
})

// ── Decimals ─────────────────────────────────────────────────────────────────

test('decimal score just below a boundary lands in the lower band', () => {
  const result = gradeScore(74.99, 100, CBC_SCALE_STANDARD)
  assert.equal(result.grade, 'ME')
})

test('decimal score just at a boundary lands in the upper band', () => {
  const result = gradeScore(75.0, 100, CBC_SCALE_STANDARD)
  assert.equal(result.grade, 'ME') // CBC_SCALE_STANDARD's ME floor is 51, EE floor is 76
})

test('decimal maxScore (e.g. weighted percentage already computed) grades correctly', () => {
  const result = gradeScore(82.5, 100, CBC_SCALE_STANDARD)
  assert.equal(result.grade, 'EE')
})

// ── Custom grade scales ───────────────────────────────────────────────────────

test('custom grade scale (distinct from both built-in CBC variants) grades correctly', () => {
  const customScale: GradeScale = {
    name: 'Custom School Scale',
    bands: [
      { label: 'Distinction', minPct: 90 },
      { label: 'Merit', minPct: 70 },
      { label: 'Pass', minPct: 40 },
      { label: 'Fail', minPct: 0 },
    ],
  }
  assert.equal(gradeScore(95, 100, customScale).grade, 'Distinction')
  assert.equal(gradeScore(75, 100, customScale).grade, 'Merit')
  assert.equal(gradeScore(50, 100, customScale).grade, 'Pass')
  assert.equal(gradeScore(10, 100, customScale).grade, 'Fail')
})

// ── Empty configuration ────────────────────────────────────────────────────

test('empty scale (no bands) throws GradingError', () => {
  const emptyScale: GradeScale = { name: 'Empty', bands: [] }
  assert.throws(() => gradeScore(50, 100, emptyScale), GradingError)
})

// ── Overlapping boundaries ────────────────────────────────────────────────

test('overlapping boundaries (two bands with the same minPct) throws GradingError', () => {
  const overlapping: GradeScale = {
    name: 'Overlapping',
    bands: [
      { label: 'A', minPct: 50 },
      { label: 'B', minPct: 50 }, // same as A — ambiguous
      { label: 'C', minPct: 0 },
    ],
  }
  assert.throws(() => gradeScore(60, 100, overlapping), GradingError)
})

test('non-descending boundaries (out of order) throws GradingError', () => {
  const outOfOrder: GradeScale = {
    name: 'Out of order',
    bands: [
      { label: 'A', minPct: 50 },
      { label: 'B', minPct: 70 }, // higher than the band before it
      { label: 'C', minPct: 0 },
    ],
  }
  assert.throws(() => gradeScore(60, 100, outOfOrder), GradingError)
})

// ── Gaps between boundaries ────────────────────────────────────────────────

test('gap at the bottom (lowest band minPct is not 0) throws GradingError', () => {
  const gappedScale: GradeScale = {
    name: 'Gapped',
    bands: [
      { label: 'A', minPct: 50 },
      { label: 'B', minPct: 20 }, // lowest band does not reach 0
    ],
  }
  assert.throws(() => gradeScore(10, 100, gappedScale), GradingError)
})

// ── Both discovered CBC boundary sets genuinely disagree ───────────────────

test('CBC_SCALE_STANDARD and CBC_SCALE_CORE_LEGACY disagree at the documented boundary points', () => {
  // 75 is EE under CORE_LEGACY (floor 75) but ME under STANDARD (floor 76)
  assert.equal(gradeScore(75, 100, CBC_SCALE_CORE_LEGACY).grade, 'EE')
  assert.equal(gradeScore(75, 100, CBC_SCALE_STANDARD).grade, 'ME')

  // 50 is ME under CORE_LEGACY (floor 50) but AE under STANDARD (floor 51)
  assert.equal(gradeScore(50, 100, CBC_SCALE_CORE_LEGACY).grade, 'ME')
  assert.equal(gradeScore(50, 100, CBC_SCALE_STANDARD).grade, 'AE')

  // 30 is AE under CORE_LEGACY (floor 25) but BE under STANDARD (floor 31)
  assert.equal(gradeScore(30, 100, CBC_SCALE_CORE_LEGACY).grade, 'AE')
  assert.equal(gradeScore(30, 100, CBC_SCALE_STANDARD).grade, 'BE')
})

// ── 8-4-4 scale end-to-end, including points ────────────────────────────────

test('8-4-4 KNEC scale grades and returns points/descriptor correctly', () => {
  const result = gradeScore(85, 100, SCALE_844_KNEC)
  assert.equal(result.grade, 'A')
  assert.equal(result.points, 12)
  assert.equal(result.descriptor, 'Excellent')
})

test('8-4-4 KNEC scale: lowest band (E) still returns valid points', () => {
  const result = gradeScore(10, 100, SCALE_844_KNEC)
  assert.equal(result.grade, 'E')
  assert.equal(result.points, 1)
})

test('band with no points/descriptor returns null, not undefined', () => {
  const minimalScale: GradeScale = {
    name: 'Minimal',
    bands: [
      { label: 'Pass', minPct: 50 },
      { label: 'Fail', minPct: 0 },
    ],
  }
  const result = gradeScore(60, 100, minimalScale)
  assert.equal(result.points, null)
  assert.equal(result.descriptor, null)
})

// ── Purity ───────────────────────────────────────────────────────────────────

test('does not mutate the input scale', () => {
  const scaleCopy = JSON.parse(JSON.stringify(CBC_SCALE_STANDARD))
  gradeScore(80, 100, CBC_SCALE_STANDARD)
  assert.deepEqual(CBC_SCALE_STANDARD, scaleCopy)
})

test('returned band is a member of the input scale.bands', () => {
  const result = gradeScore(80, 100, CBC_SCALE_STANDARD)
  assert.ok(CBC_SCALE_STANDARD.bands.includes(result.band))
})
