// lib/learnerBlueprint/actionPlan/reviewWorkspace.mapping.test.ts
//
// Pure unit tests for the awaiting-review presentation rule (Phase 2E) —
// no database, no auth. Proves the exact rule documented in
// docs/architecture/blueprint-teacher-review-workspace-phase2e.md §8: a
// deterministic timestamp comparison, never a persisted status, never a
// success/failure judgement.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeAwaitingReview } from './reviewWorkspace'

const BASE = {
  today: '2026-08-01T00:00:00Z',
  reviewDate: null as string | null,
  latestReviewAt: null as string | null,
  assignmentUpdatedAt: null as string | null,
  compassLastActivityAt: null as string | null,
  latestEvidenceAt: null as string | null,
  latestProjectionComputedAt: null as string | null,
}

test('never reviewed -> awaiting', () => {
  assert.equal(computeAwaitingReview(BASE), true)
})

test('reviewed, nothing changed since, no due review date -> not awaiting', () => {
  assert.equal(computeAwaitingReview({ ...BASE, latestReviewAt: '2026-07-20T00:00:00Z' }), false)
})

test('review date has passed and no review has happened since -> awaiting', () => {
  assert.equal(computeAwaitingReview({ ...BASE, latestReviewAt: '2026-07-01T00:00:00Z', reviewDate: '2026-07-15' }), true)
})

test('review date has passed but a later review already covered it -> not awaiting', () => {
  assert.equal(computeAwaitingReview({ ...BASE, latestReviewAt: '2026-07-20T00:00:00Z', reviewDate: '2026-07-15' }), false)
})

test('review date is in the future -> not awaiting on that basis alone', () => {
  assert.equal(computeAwaitingReview({ ...BASE, latestReviewAt: '2026-07-20T00:00:00Z', reviewDate: '2026-09-01' }), false)
})

test('new assignment activity after the latest review -> awaiting', () => {
  assert.equal(computeAwaitingReview({ ...BASE, latestReviewAt: '2026-07-20T00:00:00Z', assignmentUpdatedAt: '2026-07-25T00:00:00Z' }), true)
})

test('assignment activity BEFORE the latest review -> not awaiting on that basis', () => {
  assert.equal(computeAwaitingReview({ ...BASE, latestReviewAt: '2026-07-20T00:00:00Z', assignmentUpdatedAt: '2026-07-10T00:00:00Z' }), false)
})

test('new Compass activity after the latest review -> awaiting', () => {
  assert.equal(computeAwaitingReview({ ...BASE, latestReviewAt: '2026-07-20T00:00:00Z', compassLastActivityAt: '2026-07-22T00:00:00Z' }), true)
})

test('new Evidence after the latest review -> awaiting', () => {
  assert.equal(computeAwaitingReview({ ...BASE, latestReviewAt: '2026-07-20T00:00:00Z', latestEvidenceAt: '2026-07-21T00:00:00Z' }), true)
})

test('Projection recomputed after the latest review -> awaiting', () => {
  assert.equal(computeAwaitingReview({ ...BASE, latestReviewAt: '2026-07-20T00:00:00Z', latestProjectionComputedAt: '2026-07-21T00:00:00Z' }), true)
})

test('nothing at all newer than the latest review, and no due date -> not awaiting', () => {
  assert.equal(computeAwaitingReview({
    ...BASE,
    latestReviewAt: '2026-07-20T00:00:00Z',
    assignmentUpdatedAt: '2026-07-01T00:00:00Z',
    compassLastActivityAt: '2026-07-02T00:00:00Z',
    latestEvidenceAt: '2026-07-03T00:00:00Z',
    latestProjectionComputedAt: '2026-07-04T00:00:00Z',
  }), false)
})

// ── Static guardrail scan ───────────────────────────────────────────────────

const SOURCE = readFileSync(join(__dirname, 'reviewWorkspace.ts'), 'utf8')

test('static: reviewWorkspace.ts never calls a Supabase table writer directly', () => {
  const forbidden = /\.from\(['"][a-z_]+['"]\)[\s\S]{0,80}?\.(insert|update|upsert|delete)\(/g
  assert.equal(SOURCE.match(forbidden), null)
})

test('static: reviewWorkspace.ts never imports an Evidence, Projection, Assignment, or Compass writer', () => {
  const importLines = SOURCE.split('\n').filter(line => line.trim().startsWith('import ')).join('\n')
  assert.doesNotMatch(importLines, /persistEvidenceBatch|confirmReview|rejectReview|retractEvidence|eraseEvidence/)
  assert.doesNotMatch(importLines, /recomputeLearnerProjection|upsertProjection/)
  assert.doesNotMatch(importLines, /setTeacherSuggestedTopic|getOrCreateSession|createSession/)
  assert.doesNotMatch(importLines, /deliverBlueprintActionAsAssignment|deliverBlueprintActionToCompass|createAssignment\b/)
})

test('static: reviewWorkspace.ts does not import reviewBlueprintAction — this file only reads, never writes a review', () => {
  const importLines = SOURCE.split('\n').filter(line => line.trim().startsWith('import ')).join('\n')
  assert.doesNotMatch(importLines, /reviewBlueprintAction/)
})
