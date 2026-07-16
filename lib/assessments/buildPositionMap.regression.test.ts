// lib/assessments/buildPositionMap.regression.test.ts
//
// Sprint 3B: buildPositionMap (lib/assessments/mutations.ts) now delegates
// to lib/ranking's computeRankings() instead of its own hand-rolled sort +
// tie loop. This test proves the migration is mechanical — golden values
// captured from the pre-migration algorithm, asserted unchanged.
//
// Run: npx tsx --test lib/assessments/buildPositionMap.regression.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRankings } from '@/lib/ranking'

// The exact pre-migration algorithm (git history:
// lib/assessments/mutations.ts, removed in the Sprint 3B commit), kept here
// only as the regression oracle — not imported by production code.
function legacyBuildPositionMap(rows: { id: string; total: number }[]): Map<string, number> {
  const sorted = [...rows].sort((a, b) => b.total - a.total)
  const map = new Map<string, number>()
  let pos = 1
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].total < sorted[i - 1].total) pos = i + 1
    map.set(sorted[i].id, pos)
  }
  return map
}

// Current implementation, mirroring lib/assessments/mutations.ts::buildPositionMap
function currentBuildPositionMap(rows: { id: string; total: number }[]): Map<string, number> {
  const ranked = computeRankings(rows.map((r) => ({ id: r.id, score: r.total })))
  return new Map(ranked.map((r) => [r.id, r.position]))
}

function assertSameMap(rows: { id: string; total: number }[]) {
  const legacy = legacyBuildPositionMap(rows)
  const current = currentBuildPositionMap(rows)
  assert.deepEqual(Object.fromEntries(current), Object.fromEntries(legacy))
}

test('no ties: identical output to legacy algorithm', () => {
  assertSameMap([
    { id: 'a', total: 60 },
    { id: 'b', total: 90 },
    { id: 'c', total: 75 },
  ])
})

test('single tie group: identical output to legacy algorithm', () => {
  assertSameMap([
    { id: 'a', total: 80 },
    { id: 'b', total: 80 },
    { id: 'c', total: 60 },
  ])
})

test('multiple tie groups: identical output to legacy algorithm', () => {
  assertSameMap([
    { id: 'a', total: 90 },
    { id: 'b', total: 90 },
    { id: 'c', total: 70 },
    { id: 'd', total: 70 },
    { id: 'e', total: 50 },
  ])
})

test('all tied: identical output to legacy algorithm', () => {
  assertSameMap([
    { id: 'a', total: 50 },
    { id: 'b', total: 50 },
    { id: 'c', total: 50 },
  ])
})

test('single row: identical output to legacy algorithm', () => {
  assertSameMap([{ id: 'a', total: 42 }])
})

test('empty input: identical output to legacy algorithm', () => {
  assertSameMap([])
})

test('realistic class-of-40 marks with several ties: identical output to legacy algorithm', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({
    id: `learner-${i}`,
    // deliberately clustered scores to force many ties, like real exam totals out of 100
    total: [55, 60, 60, 72, 72, 72, 88, 91, 45, 45][i % 10],
  }))
  assertSameMap(rows)
})
