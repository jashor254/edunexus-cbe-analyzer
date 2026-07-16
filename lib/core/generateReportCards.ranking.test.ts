// lib/core/generateReportCards.ranking.test.ts
//
// Sprint 3D: lib/core/report-cards.ts::generateReportCards now delegates to
// the canonical Ranking Engine (lib/ranking) instead of `i+1` sequential
// assignment. Same defect class as Sprint 3C's updateClassPositions, now on
// the parent-facing, published-report-card surface. These tests demonstrate
// what stays the same (no-tie cases) vs. what intentionally changes (tie
// cases, including the all-zero-score scenario).
//
// Run: npx tsx --test lib/core/generateReportCards.ranking.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRankings } from '@/lib/ranking'

type LearnerAvg = { learner_id: string; avg: number }

// The exact pre-migration algorithm (git history: lib/core/report-cards.ts,
// removed in the Sprint 3D commit), kept here only as the "old behaviour"
// oracle for comparison — not imported by production code.
function legacyPositions(learnerIds: string[], avgs: Record<string, number>): Array<{ learner_id: string; position: number }> {
  const ranked = learnerIds
    .map((id) => ({ learner_id: id, avg: avgs[id] ?? 0 }))
    .sort((a, b) => b.avg - a.avg)
  return ranked.map((r, i) => ({ learner_id: r.learner_id, position: i + 1 }))
}

// Current implementation, mirroring the migrated block in generateReportCards
function currentPositions(learnerIds: string[], avgs: Record<string, number>): Array<{ learner_id: string; position: number }> {
  const learnerAvgs: LearnerAvg[] = learnerIds.map((id) => ({ learner_id: id, avg: avgs[id] ?? 0 }))
  const ranked = computeRankings(learnerAvgs.map((r) => ({ id: r.learner_id, score: r.avg })))
  return ranked.map((r) => ({ learner_id: r.id, position: r.position }))
}

test('UNCHANGED: no ties, descending averages — identical positions to old behaviour', () => {
  const ids = ['a', 'b', 'c']
  const avgs = { a: 90, b: 75, c: 60 }
  assert.deepEqual(currentPositions(ids, avgs), legacyPositions(ids, avgs))
})

test('UNCHANGED: single learner — identical to old behaviour', () => {
  const ids = ['a']
  const avgs = { a: 55 }
  assert.deepEqual(currentPositions(ids, avgs), legacyPositions(ids, avgs))
})

test('UNCHANGED: empty class produces no ranked rows', () => {
  assert.deepEqual(currentPositions([], {}), [])
  assert.deepEqual(currentPositions([], {}), legacyPositions([], {}))
})

test('CHANGED (intentional): tied averages now share a position', () => {
  const ids = ['a', 'b', 'c']
  const avgs = { a: 82.5, b: 82.5, c: 60 } // a and b tied

  const old = legacyPositions(ids, avgs)
  const current = currentPositions(ids, avgs)

  assert.deepEqual(old, [
    { learner_id: 'a', position: 1 },
    { learner_id: 'b', position: 2 },
    { learner_id: 'c', position: 3 },
  ])
  assert.deepEqual(current, [
    { learner_id: 'a', position: 1 },
    { learner_id: 'b', position: 1 },
    { learner_id: 'c', position: 3 },
  ])
  assert.notDeepEqual(current, old, 'this scenario is expected to change — that is the point of the migration')
})

test('CHANGED (intentional): learners with no scores at all (avg=0) tie together', () => {
  // Simulates learners enrolled in the class but with zero term_subject_summaries rows
  const ids = ['grader', 'ungraded1', 'ungraded2']
  const avgs = { grader: 70 } // ungraded1/ungraded2 fall back to avg=0 via the caller

  const old = legacyPositions(ids, avgs)
  const current = currentPositions(ids, avgs)

  assert.deepEqual(old, [
    { learner_id: 'grader', position: 1 },
    { learner_id: 'ungraded1', position: 2 },
    { learner_id: 'ungraded2', position: 3 },
  ])
  assert.deepEqual(current, [
    { learner_id: 'grader', position: 1 },
    { learner_id: 'ungraded1', position: 2 },
    { learner_id: 'ungraded2', position: 2 },
  ])
})

test('UNCHANGED: rounding-display collisions without an underlying tie do not merge positions', () => {
  // avg values that round to the same displayed overall_score but are not
  // actually equal — ranking must use the unrounded value, same as before.
  const ids = ['a', 'b']
  const avgs = { a: 75.004, b: 74.996 } // both round to 75.00 for display, not equal underneath
  const current = currentPositions(ids, avgs)
  assert.deepEqual(current, [
    { learner_id: 'a', position: 1 },
    { learner_id: 'b', position: 2 },
  ])
})
