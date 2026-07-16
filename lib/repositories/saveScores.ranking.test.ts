// lib/repositories/saveScores.ranking.test.ts
//
// Sprint 3E: AssessmentRepository::saveScores now delegates to the
// canonical Ranking Engine (lib/ranking) instead of `position: i+1` on raw
// request-array order — the audit's most severe finding: not a ranking
// algorithm with a missing tie policy, but no ranking at all. These tests
// show the defective old output alongside the corrected new output for
// every scenario in the sprint's correctness table.
//
// Run: npx tsx --test lib/repositories/saveScores.ranking.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRankings } from '@/lib/ranking'

type Score = { learner_id: string; total_marks: number }

// The exact pre-migration algorithm (git history: assessment.repository.ts,
// removed in the Sprint 3E commit), kept here only as the "old (defective)
// behaviour" oracle for comparison — not imported by production code.
function legacyPositions(scores: Score[]): Array<{ learner_id: string; position: number }> {
  return scores.map((s, i) => ({ learner_id: s.learner_id, position: i + 1 }))
}

// Current implementation, mirroring the migrated block in saveScores
function currentPositions(scores: Score[]): Array<{ learner_id: string; position: number }> {
  const ranked = computeRankings(scores.map((s, i) => ({ id: i, score: s.total_marks })))
  const positionByIndex = new Map(ranked.map((r) => [r.id, r.position]))
  return scores.map((s, i) => ({ learner_id: s.learner_id, position: positionByIndex.get(i)! }))
}

test('ordered request (already descending by score): old happens to match new', () => {
  const scores: Score[] = [
    { learner_id: 'a', total_marks: 90 },
    { learner_id: 'b', total_marks: 75 },
    { learner_id: 'c', total_marks: 60 },
  ]
  assert.deepEqual(currentPositions(scores), legacyPositions(scores))
})

test('FIXED: unordered request produces mathematically correct positions', () => {
  // Client sent scores in alphabetical/roster order, not score order
  const scores: Score[] = [
    { learner_id: 'a', total_marks: 60 }, // lowest score, arrives first
    { learner_id: 'b', total_marks: 90 }, // highest score, arrives second
    { learner_id: 'c', total_marks: 75 }, // middle score, arrives third
  ]

  const old = legacyPositions(scores)
  const current = currentPositions(scores)

  // Old (defective): position = array order, completely wrong
  assert.deepEqual(old, [
    { learner_id: 'a', position: 1 }, // WRONG: lowest scorer ranked first
    { learner_id: 'b', position: 2 },
    { learner_id: 'c', position: 3 },
  ])

  // New (correct): position = actual rank by score
  assert.deepEqual(current, [
    { learner_id: 'a', position: 3 }, // correct: lowest scorer ranked last
    { learner_id: 'b', position: 1 }, // correct: highest scorer ranked first
    { learner_id: 'c', position: 2 },
  ])

  assert.notDeepEqual(current, old, 'this scenario is expected to change — this is the core defect being repaired')
})

test('FIXED: worst case — ascending request order inverts old positions entirely', () => {
  const scores: Score[] = [
    { learner_id: 'lowest', total_marks: 40 },
    { learner_id: 'middle', total_marks: 70 },
    { learner_id: 'highest', total_marks: 95 },
  ]

  const old = legacyPositions(scores)
  const current = currentPositions(scores)

  // Old: best-scoring learner gets the worst position
  assert.deepEqual(old.find((r) => r.learner_id === 'highest')?.position, 3)
  // New: best-scoring learner correctly gets position 1
  assert.deepEqual(current.find((r) => r.learner_id === 'highest')?.position, 1)
  assert.deepEqual(current.find((r) => r.learner_id === 'lowest')?.position, 3)
})

test('FIXED: equal scores (ties) now share a position instead of arbitrary distinct ones', () => {
  const scores: Score[] = [
    { learner_id: 'a', total_marks: 82 },
    { learner_id: 'b', total_marks: 82 }, // tied with 'a'
    { learner_id: 'c', total_marks: 60 },
  ]
  const current = currentPositions(scores)
  assert.deepEqual(current, [
    { learner_id: 'a', position: 1 },
    { learner_id: 'b', position: 1 },
    { learner_id: 'c', position: 3 },
  ])
})

test('FIXED: duplicate marks across a larger group all resolve to the shared position', () => {
  const scores: Score[] = [
    { learner_id: 'a', total_marks: 88 },
    { learner_id: 'b', total_marks: 88 },
    { learner_id: 'c', total_marks: 88 },
    { learner_id: 'd', total_marks: 70 },
  ]
  const current = currentPositions(scores)
  assert.deepEqual(current, [
    { learner_id: 'a', position: 1 },
    { learner_id: 'b', position: 1 },
    { learner_id: 'c', position: 1 },
    { learner_id: 'd', position: 4 },
  ])
})

test('FIXED: missing marks (total_marks=0) rank correctly at the bottom, not by array position', () => {
  const scores: Score[] = [
    { learner_id: 'ungraded', total_marks: 0 }, // arrives first in the request
    { learner_id: 'grader', total_marks: 65 },
  ]
  const old = legacyPositions(scores)
  const current = currentPositions(scores)

  assert.deepEqual(old.find((r) => r.learner_id === 'ungraded')?.position, 1) // WRONG under old behaviour
  assert.deepEqual(current.find((r) => r.learner_id === 'ungraded')?.position, 2) // correct
  assert.deepEqual(current.find((r) => r.learner_id === 'grader')?.position, 1)
})

test('FIXED: large class (60 learners), random request order — every position matches score rank', () => {
  const scores: Score[] = Array.from({ length: 60 }, (_, i) => ({
    learner_id: `learner-${i}`,
    total_marks: Math.floor(Math.random() * 100),
  }))
  const current = currentPositions(scores)

  const byId = Object.fromEntries(scores.map((s) => [s.learner_id, s.total_marks]))
  // Invariant: for every pair, a strictly higher score must never have a
  // worse (numerically larger) position than a strictly lower score.
  for (const a of current) {
    for (const b of current) {
      if (byId[a.learner_id] > byId[b.learner_id]) {
        assert.ok(
          a.position <= b.position,
          `${a.learner_id} (score ${byId[a.learner_id]}) should rank >= ${b.learner_id} (score ${byId[b.learner_id]})`
        )
      }
    }
  }
})

test('reverse-sorted request order: positions still correctly reflect score, not array order', () => {
  const scores: Score[] = [
    { learner_id: 'a', total_marks: 50 },
    { learner_id: 'b', total_marks: 70 },
    { learner_id: 'c', total_marks: 90 },
  ]
  const current = currentPositions(scores)
  assert.deepEqual(current, [
    { learner_id: 'a', position: 3 },
    { learner_id: 'b', position: 2 },
    { learner_id: 'c', position: 1 },
  ])
})
