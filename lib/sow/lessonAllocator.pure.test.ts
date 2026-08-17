// lib/sow/lessonAllocator.pure.test.ts
//
// H5A-2 CUR-SOW-001/CUR-ID-003 — proves allocateLessons() carries the
// teacher's canonical sow_substrands.id through unchanged, and that two
// selections sharing an identical title never get their ids confused. Pure,
// deterministic, no AI, no DB — this is the exact point H5A-1 traced as the
// first identity-loss boundary in the SOW pipeline
// (lib/sow/lessonAllocator.ts), so it is tested here in isolation from the
// AI call and persistence layer that follow it.
//
// Run: npm test -- lib/sow/lessonAllocator.pure.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allocateLessons } from './lessonAllocator'
import type { SelectedSubstrand, TimelineSlot } from './types'

function slots(n: number): TimelineSlot[] {
  return Array.from({ length: n }, (_, i) => ({
    slotIndex: i, week: Math.floor(i / 4) + 1, lesson: (i % 4) + 1, isBreak: false,
  }))
}

test('allocateLessons carries the real substrandId through unchanged, never re-derives it from the title', () => {
  const selected: SelectedSubstrand[] = [
    { strandId: 'strand-A', strandTitle: 'Numbers', substrandId: 'substrand-X', substrandTitle: 'Fractions', lessonsRequired: 2, orderIndex: 0 },
  ]
  const allocated = allocateLessons({ timeline: slots(2), selectedSubstrands: selected })

  assert.equal(allocated.length, 2)
  for (const lesson of allocated) {
    assert.equal(lesson.substrandId, 'substrand-X')
    assert.equal(lesson.strand, 'Numbers')
    assert.equal(lesson.substrand, 'Fractions')
  }
})

test('allocateLessons: two selections sharing an identical title do not collide — identity follows id, not text', () => {
  const selected: SelectedSubstrand[] = [
    { strandId: 'strand-A', strandTitle: 'Numbers',    substrandId: 'substrand-X', substrandTitle: 'Fractions (synthetic)', lessonsRequired: 1, orderIndex: 0 },
    { strandId: 'strand-B', strandTitle: 'Algebra',     substrandId: 'substrand-Y', substrandTitle: 'Fractions (synthetic)', lessonsRequired: 1, orderIndex: 1 },
  ]
  const allocated = allocateLessons({ timeline: slots(2), selectedSubstrands: selected })

  assert.equal(allocated.length, 2)
  assert.equal(allocated[0].substrand, allocated[1].substrand, 'both share the same title — the interesting case')
  assert.notEqual(allocated[0].substrandId, allocated[1].substrandId)
  assert.equal(allocated[0].substrandId, 'substrand-X')
  assert.equal(allocated[0].strand, 'Numbers')
  assert.equal(allocated[1].substrandId, 'substrand-Y')
  assert.equal(allocated[1].strand, 'Algebra')
})

test('allocateLessons: a selection with no canonical id (defensive path — not reachable via the real teacher picker today) persists as null, never fabricated', () => {
  const selected = [
    { strandId: 'strand-A', strandTitle: 'Numbers', substrandId: undefined as unknown as string, substrandTitle: 'Custom topic', lessonsRequired: 1, orderIndex: 0 },
  ] as SelectedSubstrand[]
  const allocated = allocateLessons({ timeline: slots(1), selectedSubstrands: selected })

  assert.equal(allocated.length, 1)
  assert.equal(allocated[0].substrandId, null)
  assert.equal(allocated[0].substrand, 'Custom topic')
})
