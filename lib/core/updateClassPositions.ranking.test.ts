// lib/core/updateClassPositions.ranking.test.ts
//
// Sprint 3C: lib/core/assessments.ts::updateClassPositions now delegates to
// the canonical Ranking Engine (lib/ranking) instead of `i+1` sequential
// assignment. Unlike Sprint 3B/3B.2, this is an INTENTIONAL behaviour
// change — the old algorithm never handled ties. These tests demonstrate
// both what stays the same (no-tie cases) and what intentionally changes
// (tie cases), per the sprint's "do not hide differences" requirement.
//
// Run: npx tsx --test lib/core/updateClassPositions.ranking.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRankings } from '@/lib/ranking'

type Row = { id: string; weighted_score: number | null }

// The exact pre-migration algorithm (git history: lib/core/assessments.ts,
// removed in the Sprint 3C commit), kept here only as the "old behaviour"
// oracle for comparison — not imported by production code. Mirrors
// `updateClassPositions`'s inner loop over a single subject's
// already-DB-sorted (descending, NULLS FIRST) rows.
function legacyPositions(dbSortedRows: Row[]): Array<{ id: string; position: number }> {
  return dbSortedRows.map((r, i) => ({ id: r.id, position: i + 1 }))
}

// Current implementation, mirroring the migrated block in updateClassPositions
function currentPositions(dbSortedRows: Row[]): Array<{ id: string; position: number }> {
  const rankable = dbSortedRows.filter(
    (r): r is Row & { weighted_score: number } =>
      typeof r.weighted_score === 'number' && Number.isFinite(r.weighted_score)
  )
  return computeRankings(rankable.map((r) => ({ id: r.id, score: r.weighted_score }))).map((r) => ({
    id: r.id,
    position: r.position,
  }))
}

test('UNCHANGED: no ties, descending scores — identical positions to old behaviour', () => {
  // Simulates the DB's ORDER BY weighted_score DESC output
  const dbSortedRows: Row[] = [
    { id: 'a', weighted_score: 90 },
    { id: 'b', weighted_score: 75 },
    { id: 'c', weighted_score: 60 },
  ]
  assert.deepEqual(currentPositions(dbSortedRows), legacyPositions(dbSortedRows))
})

test('UNCHANGED: single row — identical to old behaviour', () => {
  const dbSortedRows: Row[] = [{ id: 'a', weighted_score: 42 }]
  assert.deepEqual(currentPositions(dbSortedRows), legacyPositions(dbSortedRows))
})

test('CHANGED (intentional): single tie group now shares a position', () => {
  const dbSortedRows: Row[] = [
    { id: 'a', weighted_score: 82.5 },
    { id: 'b', weighted_score: 82.5 }, // tied with 'a'
    { id: 'c', weighted_score: 60 },
  ]
  const old = legacyPositions(dbSortedRows)
  const current = currentPositions(dbSortedRows)

  // Old (buggy) behaviour: arbitrary distinct positions 1, 2, 3
  assert.deepEqual(old, [
    { id: 'a', position: 1 },
    { id: 'b', position: 2 },
    { id: 'c', position: 3 },
  ])

  // New (correct) behaviour: tied students share position 1, next resumes at 3
  assert.deepEqual(current, [
    { id: 'a', position: 1 },
    { id: 'b', position: 1 },
    { id: 'c', position: 3 },
  ])

  assert.notDeepEqual(current, old, 'this scenario is expected to change — that is the point of the migration')
})

test('CHANGED (intentional): multiple tie groups all resolve to shared positions', () => {
  const dbSortedRows: Row[] = [
    { id: 'a', weighted_score: 88 },
    { id: 'b', weighted_score: 88 },
    { id: 'c', weighted_score: 70 },
    { id: 'd', weighted_score: 70 },
    { id: 'e', weighted_score: 55 },
  ]
  const current = currentPositions(dbSortedRows)
  assert.deepEqual(current, [
    { id: 'a', position: 1 },
    { id: 'b', position: 1 },
    { id: 'c', position: 3 },
    { id: 'd', position: 3 },
    { id: 'e', position: 5 },
  ])
})

test('DEFENSIVE (intentional): non-finite weighted_score is skipped, not fabricated', () => {
  const dbSortedRows: Row[] = [
    { id: 'a', weighted_score: null }, // theoretical only — sole writer never produces this
    { id: 'b', weighted_score: 90 },
    { id: 'c', weighted_score: 70 },
  ]
  const current = currentPositions(dbSortedRows)
  // 'a' is excluded entirely — no position written for it
  assert.deepEqual(current, [
    { id: 'b', position: 1 },
    { id: 'c', position: 2 },
  ])
  assert.ok(!current.some((r) => r.id === 'a'))
})

test('UNCHANGED: empty group produces no writes', () => {
  assert.deepEqual(currentPositions([]), [])
  assert.deepEqual(currentPositions([]), legacyPositions([]))
})
