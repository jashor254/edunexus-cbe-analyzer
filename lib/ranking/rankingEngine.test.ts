// lib/ranking/rankingEngine.test.ts
//
// Pure unit tests — no database, no Supabase, no fixtures. Sprint 3A
// (docs/engineering/sprint-3-assessment-domain-audit.md §11) required this
// engine to be independently verifiable before anything migrates to it.
//
// Run: npx tsx --test lib/ranking/rankingEngine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRankings } from './index'
import { RankingError } from './types'

test('single learner gets position 1', () => {
  const result = computeRankings([{ id: 'a', score: 50 }])
  assert.deepEqual(result, [{ id: 'a', score: 50, position: 1 }])
})

test('multiple learners, descending order by default', () => {
  const result = computeRankings([
    { id: 'a', score: 60 },
    { id: 'b', score: 90 },
    { id: 'c', score: 75 },
  ])
  assert.deepEqual(
    result.map((r) => r.id),
    ['b', 'c', 'a']
  )
  assert.deepEqual(
    result.map((r) => r.position),
    [1, 2, 3]
  )
})

test('ascending direction option', () => {
  const result = computeRankings(
    [
      { id: 'a', score: 60 },
      { id: 'b', score: 90 },
      { id: 'c', score: 75 },
    ],
    { direction: 'asc' }
  )
  assert.deepEqual(
    result.map((r) => r.id),
    ['a', 'c', 'b']
  )
  assert.deepEqual(
    result.map((r) => r.position),
    [1, 2, 3]
  )
})

test('equal scores share a position (single tie)', () => {
  const result = computeRankings([
    { id: 'a', score: 80 },
    { id: 'b', score: 80 },
    { id: 'c', score: 60 },
  ])
  const byId = Object.fromEntries(result.map((r) => [r.id, r.position]))
  assert.equal(byId.a, 1)
  assert.equal(byId.b, 1)
  assert.equal(byId.c, 3) // standard competition ranking: 1,1,3 not 1,1,2
})

test('multiple separate tie groups', () => {
  const result = computeRankings([
    { id: 'a', score: 90 },
    { id: 'b', score: 90 },
    { id: 'c', score: 70 },
    { id: 'd', score: 70 },
    { id: 'e', score: 50 },
  ])
  const byId = Object.fromEntries(result.map((r) => [r.id, r.position]))
  assert.deepEqual(byId, { a: 1, b: 1, c: 3, d: 3, e: 5 })
})

test('empty list returns empty list, not an error', () => {
  assert.deepEqual(computeRankings([]), [])
})

test('negative values rank correctly', () => {
  const result = computeRankings([
    { id: 'a', score: -5 },
    { id: 'b', score: -1 },
    { id: 'c', score: -10 },
  ])
  assert.deepEqual(
    result.map((r) => r.id),
    ['b', 'a', 'c']
  )
})

test('decimal values rank correctly', () => {
  const result = computeRankings([
    { id: 'a', score: 75.5 },
    { id: 'b', score: 75.4 },
    { id: 'c', score: 75.6 },
  ])
  assert.deepEqual(
    result.map((r) => r.id),
    ['c', 'a', 'b']
  )
})

test('already-sorted input', () => {
  const result = computeRankings([
    { id: 'a', score: 90 },
    { id: 'b', score: 80 },
    { id: 'c', score: 70 },
  ])
  assert.deepEqual(
    result.map((r) => r.position),
    [1, 2, 3]
  )
})

test('reverse-sorted input', () => {
  const result = computeRankings([
    { id: 'a', score: 70 },
    { id: 'b', score: 80 },
    { id: 'c', score: 90 },
  ])
  assert.deepEqual(
    result.map((r) => r.id),
    ['c', 'b', 'a']
  )
})

test('stable ordering: equal scores preserve original input order', () => {
  const result = computeRankings([
    { id: 'first', score: 50 },
    { id: 'second', score: 50 },
    { id: 'third', score: 50 },
  ])
  assert.deepEqual(
    result.map((r) => r.id),
    ['first', 'second', 'third']
  )
  assert.deepEqual(
    result.map((r) => r.position),
    [1, 1, 1]
  )
})

test('large dataset ranks correctly and completes quickly', () => {
  const size = 10_000
  const entries = Array.from({ length: size }, (_, i) => ({
    id: `learner-${i}`,
    score: Math.floor(Math.random() * 100),
  }))

  const start = Date.now()
  const result = computeRankings(entries)
  const elapsedMs = Date.now() - start

  assert.equal(result.length, size)
  assert.ok(elapsedMs < 1000, `expected < 1000ms, took ${elapsedMs}ms`)

  // invariants: bijection on ids, positions non-decreasing, all >= 1
  const inputIds = new Set(entries.map((e) => e.id))
  const outputIds = new Set(result.map((r) => r.id))
  assert.equal(outputIds.size, inputIds.size)
  for (const id of inputIds) assert.ok(outputIds.has(id))

  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i].position >= result[i - 1].position)
    assert.ok(result[i].score <= result[i - 1].score)
  }
  assert.ok(result.every((r) => r.position >= 1))
})

test('invalid score (NaN) throws RankingError', () => {
  assert.throws(
    () => computeRankings([{ id: 'a', score: NaN }]),
    RankingError
  )
})

test('invalid score (Infinity) throws RankingError', () => {
  assert.throws(
    () => computeRankings([{ id: 'a', score: Infinity }]),
    RankingError
  )
})

test('duplicate ids are allowed and ranked independently', () => {
  const result = computeRankings([
    { id: 'a', score: 90 },
    { id: 'a', score: 50 },
  ])
  assert.equal(result.length, 2)
  assert.deepEqual(
    result.map((r) => r.position),
    [1, 2]
  )
})

test('does not mutate the input array', () => {
  const input = [
    { id: 'a', score: 60 },
    { id: 'b', score: 90 },
  ]
  const inputCopy = input.map((e) => ({ ...e }))
  computeRankings(input)
  assert.deepEqual(input, inputCopy)
})
