// lib/repositories/getCohortData.ranking.regression.test.ts
//
// Sprint 3B.2: AssessmentRepository::getCohortData's cohort-ranking logic
// (lines ~843-860 pre-migration) now delegates to lib/ranking's
// computeRankings() instead of its own hand-rolled sort + tie loop. This
// test proves the migration is mechanical — golden values captured from
// the pre-migration algorithm, asserted unchanged, including final array
// ordering (topLearners/lowLearners slice off this exact order).
//
// Run: npx tsx --test lib/repositories/getCohortData.ranking.regression.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRankings } from '@/lib/ranking'

type Row = { studentName: string; total: number }
type RankedRow = Row & { rank: number }

// The exact pre-migration algorithm (git history: assessment.repository.ts,
// removed in the Sprint 3B.2 commit), kept here only as the regression
// oracle — not imported by production code.
function legacyRank(rows: Row[]): RankedRow[] {
  const combined: RankedRow[] = rows
    .map(r => ({ ...r, rank: 0 }))
    .sort((a, b) => b.total - a.total)

  let rank = 1
  combined.forEach((r, i) => {
    if (i > 0 && r.total < combined[i - 1].total) rank = i + 1
    r.rank = rank
  })
  return combined
}

// Current implementation, mirroring the migrated block in getCohortData
function currentRank(rows: Row[]): RankedRow[] {
  const ranked = computeRankings(rows.map((r, i) => ({ id: i, score: r.total })))
  return ranked.map(r => ({ ...rows[r.id], rank: r.position }))
}

function assertSameRanking(rows: Row[]) {
  const legacy = legacyRank(rows)
  const current = currentRank(rows)
  assert.deepEqual(current, legacy)
}

test('no ties: identical ordering and ranks to legacy algorithm', () => {
  assertSameRanking([
    { studentName: 'A', total: 60 },
    { studentName: 'B', total: 90 },
    { studentName: 'C', total: 75 },
  ])
})

test('single tie group: identical ordering and ranks to legacy algorithm', () => {
  assertSameRanking([
    { studentName: 'A', total: 80 },
    { studentName: 'B', total: 80 },
    { studentName: 'C', total: 60 },
  ])
})

test('multiple tie groups: identical ordering and ranks to legacy algorithm', () => {
  assertSameRanking([
    { studentName: 'A', total: 90 },
    { studentName: 'B', total: 90 },
    { studentName: 'C', total: 70 },
    { studentName: 'D', total: 70 },
    { studentName: 'E', total: 50 },
  ])
})

test('all tied: identical ordering and ranks, original input order preserved', () => {
  assertSameRanking([
    { studentName: 'A', total: 50 },
    { studentName: 'B', total: 50 },
    { studentName: 'C', total: 50 },
  ])
})

test('single row: identical to legacy algorithm', () => {
  assertSameRanking([{ studentName: 'A', total: 42 }])
})

test('empty input: identical to legacy algorithm', () => {
  assertSameRanking([])
})

test('multi-stream cohort with clustered ties: identical ordering and ranks to legacy algorithm', () => {
  const rows: Row[] = Array.from({ length: 60 }, (_, i) => ({
    studentName: `learner-${i}`,
    total: [340, 355, 355, 390, 390, 390, 410, 420, 300, 300][i % 10],
  }))
  assertSameRanking(rows)
})

test('topLearners/lowLearners slice points are unaffected by the migration', () => {
  const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({
    studentName: `learner-${i}`,
    total: 500 - i * 3,
  }))
  const legacy = legacyRank(rows)
  const current = currentRank(rows)
  assert.deepEqual(current.slice(0, 20), legacy.slice(0, 20)) // topLearners
  assert.deepEqual(current.slice(-10).reverse(), legacy.slice(-10).reverse()) // lowLearners
})
