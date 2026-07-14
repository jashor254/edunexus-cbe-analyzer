// lib/career/careerEngine.mergeChronologicalScoreHistories.test.ts
//
// Pure unit test — no DB. Covers the Phase H blend logic (Decision 8,
// amended per docs/architecture/learner-record-layer-decisions.md): two
// independently-sorted score-history sources (Projection-derived, legacy
// `assessments`-table-derived) must merge into one true time-ordered
// sequence, not a naive concatenation, or extractCapabilityProfile()'s
// trend detection (earliest-vs-latest) would silently read the wrong
// direction whenever the two sources interleave in real time.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeChronologicalScoreHistories } from './careerEngine'
import type { TimestampedScoreSnapshot } from '@/lib/learnerIntelligence/projectionAdapters'

function snap(at: string, scores: Record<string, number>): TimestampedScoreSnapshot {
  return { at, scores }
}

test('merges two separately-sorted sources into one true chronological sequence, not a concatenation', () => {
  // Deliberately interleaved in real time: legacy source has the oldest AND
  // the newest snapshot; Projection source sits in the middle. A naive
  // concatenation (projection first, then legacy) would put the newest
  // snapshot (legacy) before the middle one (projection) — wrong order.
  const projectionSource = [snap('2026-02-01T00:00:00Z', { mathematics: 2 })]
  const legacySource = [
    snap('2026-01-01T00:00:00Z', { mathematics: 1 }),
    snap('2026-03-01T00:00:00Z', { mathematics: 3 }),
  ]

  const merged = mergeChronologicalScoreHistories(projectionSource, legacySource)

  assert.deepEqual(merged, [
    { mathematics: 1 }, // 2026-01-01, legacy
    { mathematics: 2 }, // 2026-02-01, projection
    { mathematics: 3 }, // 2026-03-01, legacy
  ])
})

test('an empty source contributes nothing, and both-empty produces an empty result', () => {
  const merged = mergeChronologicalScoreHistories([], [])
  assert.deepEqual(merged, [])

  const onlyLegacy = mergeChronologicalScoreHistories(
    [],
    [snap('2026-01-01T00:00:00Z', { english: 3 })],
  )
  assert.deepEqual(onlyLegacy, [{ english: 3 }])
})

test('accepts any number of sources, not just two', () => {
  const merged = mergeChronologicalScoreHistories(
    [snap('2026-01-03T00:00:00Z', { c: 3 })],
    [snap('2026-01-01T00:00:00Z', { a: 1 })],
    [snap('2026-01-02T00:00:00Z', { b: 2 })],
  )
  assert.deepEqual(merged, [{ a: 1 }, { b: 2 }, { c: 3 }])
})
