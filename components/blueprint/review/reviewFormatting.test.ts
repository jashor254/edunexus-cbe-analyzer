// components/blueprint/review/reviewFormatting.test.ts
//
// Pure unit tests for the shared review-workspace formatting/validation
// helpers (Phase 2E) — no DOM, no rendering. `isNoteRequiredForDecision`
// is the exact function `BlueprintReviewForm` uses to decide whether a
// note is required before submission, so these tests cover the task
// brief's "Complete/Needs Revision/Reopen/Defer require a note, No
// Decision does not" rule directly at the logic level.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNoteRequiredForDecision, DECISION_LABEL, formatDate, formatDateTime } from './reviewFormatting'

test('Complete requires a note', () => { assert.equal(isNoteRequiredForDecision('complete'), true) })
test('Needs Revision requires a note', () => { assert.equal(isNoteRequiredForDecision('needs_revision'), true) })
test('Reopen requires a note', () => { assert.equal(isNoteRequiredForDecision('reopen'), true) })
test('Defer requires a note', () => { assert.equal(isNoteRequiredForDecision('defer'), true) })
test('No Decision does not require a note', () => { assert.equal(isNoteRequiredForDecision('no_decision'), false) })

test('every decision has a distinct, exact-five label — no invented synonym', () => {
  const labels = new Set(Object.values(DECISION_LABEL))
  assert.equal(labels.size, Object.keys(DECISION_LABEL).length)
  assert.deepEqual(new Set(Object.keys(DECISION_LABEL)), new Set(['complete', 'needs_revision', 'reopen', 'defer', 'no_decision', 'awaiting_review']))
})

test('formatDate/formatDateTime render a placeholder for null, never throw or show "Invalid Date"', () => {
  assert.equal(formatDate(null), '—')
  assert.equal(formatDateTime(null), '—')
  assert.doesNotMatch(formatDate('2026-07-20'), /Invalid/)
})
