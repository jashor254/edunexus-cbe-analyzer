// components/blueprint/actionPlan/actionCardPresentation.test.ts
//
// Pure unit tests for the Blueprint Action Plan's presentation model
// (Phase 3A) — no database, no rendering. Proves the exact derivation
// rules documented in docs/architecture/blueprint-execution-experience-
// phase3a.md, and that this module is genuinely presentation-only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deriveDeliveryPresentation, recommendNextAction, deriveActionCardPresentation } from './actionCardPresentation'
import type { ReviewableActionListItem } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'

function makeItem(overrides: Partial<ReviewableActionListItem> = {}): ReviewableActionListItem {
  return {
    actionId: 'a1', title: 'Reading Fluency', intendedOutcome: 'Reach fluent oral reading by end of term.',
    learnerAction: 'Read aloud for 10 minutes daily.', successIndicator: 'Improved reading accuracy.',
    approvalStatus: 'approved', reviewDate: null, assignmentDelivered: false, assignmentId: null, compassDelivered: false,
    latestDecision: 'awaiting_review', latestReviewAt: null, latestReviewNotes: null, reviewCount: 0,
    lastActivityAt: null, awaitingReview: true,
    ...overrides,
  }
}

// ── deriveDeliveryPresentation ──────────────────────────────────────────────

test('not delivered to either channel -> not_delivered', () => {
  assert.equal(deriveDeliveryPresentation(makeItem()), 'not_delivered')
})
test('assignment only -> assignment_only', () => {
  assert.equal(deriveDeliveryPresentation(makeItem({ assignmentDelivered: true })), 'assignment_only')
})
test('compass only -> compass_only', () => {
  assert.equal(deriveDeliveryPresentation(makeItem({ compassDelivered: true })), 'compass_only')
})
test('both channels -> both', () => {
  assert.equal(deriveDeliveryPresentation(makeItem({ assignmentDelivered: true, compassDelivered: true })), 'both')
})

// ── recommendNextAction ─────────────────────────────────────────────────────

test('approved and undelivered -> "Choose delivery"', () => {
  const { label, kind } = recommendNextAction(makeItem())
  assert.equal(label, 'Choose delivery')
  assert.equal(kind, 'deliver')
})

test('delivered but no learner activity -> "Await learner activity"', () => {
  const { label, kind } = recommendNextAction(makeItem({ assignmentDelivered: true, lastActivityAt: null }))
  assert.equal(label, 'Await learner activity')
  assert.equal(kind, 'await')
})

test('activity exists, never reviewed -> "Review progress"', () => {
  const { label, kind } = recommendNextAction(makeItem({
    assignmentDelivered: true, lastActivityAt: '2026-07-20T00:00:00Z', latestDecision: 'awaiting_review', awaitingReview: true,
  }))
  assert.equal(label, 'Review progress')
  assert.equal(kind, 'review')
})

test('latest review is Needs Revision -> "Review or prepare revised action", even if not currently flagged awaiting', () => {
  const { label, kind } = recommendNextAction(makeItem({
    assignmentDelivered: true, lastActivityAt: '2026-07-20T00:00:00Z', latestDecision: 'needs_revision', awaitingReview: false,
  }))
  assert.equal(label, 'Review or prepare revised action')
  assert.equal(kind, 'review')
})

test('latest review is Defer -> "Review when ready"', () => {
  const { label, kind } = recommendNextAction(makeItem({
    assignmentDelivered: true, lastActivityAt: '2026-07-20T00:00:00Z', latestDecision: 'defer', awaitingReview: false,
  }))
  assert.equal(label, 'Review when ready')
  assert.equal(kind, 'review')
})

test('latest review is Complete and nothing newer has happened -> "No immediate action"', () => {
  const { label, kind } = recommendNextAction(makeItem({
    assignmentDelivered: true, lastActivityAt: '2026-07-01T00:00:00Z', latestDecision: 'complete', awaitingReview: false,
  }))
  assert.equal(label, 'No immediate action')
  assert.equal(kind, 'none')
})

test('activity newer than the latest review re-surfaces "Review progress" even after a completed review', () => {
  const { label, kind } = recommendNextAction(makeItem({
    assignmentDelivered: true, lastActivityAt: '2026-07-25T00:00:00Z', latestDecision: 'complete', awaitingReview: true,
  }))
  assert.equal(label, 'Review progress')
  assert.equal(kind, 'review')
})

test('Reopen with nothing newer still recommends review, never "no immediate action"', () => {
  const { label, kind } = recommendNextAction(makeItem({
    assignmentDelivered: true, lastActivityAt: '2026-07-01T00:00:00Z', latestDecision: 'reopen', awaitingReview: false,
  }))
  assert.equal(label, 'Review progress')
  assert.equal(kind, 'review')
})

test('recommendNextAction never returns a kind other than deliver/await/review/none — it is navigational only', () => {
  const kinds: string[] = []
  for (const item of [
    makeItem(),
    makeItem({ assignmentDelivered: true }),
    makeItem({ assignmentDelivered: true, lastActivityAt: '2026-07-01T00:00:00Z', latestDecision: 'complete', awaitingReview: false }),
  ]) kinds.push(recommendNextAction(item).kind)
  for (const k of kinds) assert.ok(['deliver', 'await', 'review', 'none'].includes(k))
})

// ── deriveActionCardPresentation ────────────────────────────────────────────

test('deriveActionCardPresentation bundles delivery/activity/attention/recommendation from one item, deterministically', () => {
  const item = makeItem({ compassDelivered: true, lastActivityAt: '2026-07-20T00:00:00Z', awaitingReview: true })
  const p1 = deriveActionCardPresentation(item)
  const p2 = deriveActionCardPresentation(item)
  assert.deepEqual(p1, p2)
  assert.equal(p1.delivery, 'compass_only')
  assert.equal(p1.hasActivity, true)
  assert.equal(p1.needsAttention, true)
})

// ── Static guardrail scan ───────────────────────────────────────────────────

const SOURCE = readFileSync(join(__dirname, 'actionCardPresentation.ts'), 'utf8')

test('static: actionCardPresentation.ts has no database/network access at all — no imports besides the type it reads', () => {
  const importLines = SOURCE.split('\n').filter(line => line.trim().startsWith('import '))
  assert.equal(importLines.length, 1)
  assert.match(importLines[0], /import type \{ ReviewableActionListItem \}/)
})

test('static: never mutates blueprint_action_items.status — the word "status" never appears as an assignment target', () => {
  assert.doesNotMatch(SOURCE, /\.status\s*=/)
  assert.doesNotMatch(SOURCE, /approveBlueprintAction|editBlueprintAction|recordDecision/)
})
