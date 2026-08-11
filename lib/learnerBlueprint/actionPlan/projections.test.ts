// lib/learnerBlueprint/actionPlan/projections.test.ts
//
// Pure-domain tests for the stakeholder visibility projections (Phase 1,
// tests #16-18 of the phase's required test list). No DB, no auth — just
// the projection functions against hand-built BlueprintActionItem
// literals, verifying the exact boundary the phase asked for: a
// parent/learner-safe view must never carry `teacherNotes`/`evidenceBasis`,
// and must return null for anything not `status: 'approved'` with a
// permitting `visibility`.
// Run with: npx tsx --test lib/learnerBlueprint/actionPlan/projections.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toParentView, toLearnerView, toTeacherView } from './projections'
import type { BlueprintActionItem } from './types'

function baseItem(overrides: Partial<BlueprintActionItem> = {}): BlueprintActionItem {
  return {
    id: 'item-1',
    learnerId: 'learner-1',
    schoolId: 'school-1',
    academicYearId: null,
    termId: null,
    blueprintSnapshotId: null,
    context: 'current_term',
    priority: 'medium',
    status: 'approved',
    visibility: 'shared',
    title: 'Strengthen fractions',
    rationale: 'Recent evidence shows Amani is developing steadily in Mathematics.',
    intendedOutcome: 'Move to Level 3 in fractions by end of term.',
    learnerAction: 'Complete two practice sets a week.',
    teacherAction: 'Run a small-group fractions session on Tuesdays.',
    parentSupport: 'Ask Amani to explain one fraction problem at home each week.',
    schoolSupport: null,
    successIndicator: 'Next confirmed assessment shows Level 3 or above.',
    targetCapability: 'Mathematics — Fractions',
    subStrandId: null,
    reviewDate: '2026-08-15',
    teacherNotes: 'Hypothesis: struggles with mixed numbers specifically, not fractions generally — watch for this in the next assessment. Possible confusion with an earlier misconception from Term 1.',
    proposalSource: 'teacher',
    sourceGenerator: null,
    evidenceBasis: { projectorType: 'academic', supportingEvidenceIds: ['ev-1', 'ev-2'], confidence: 72, lastComputed: '2026-07-20T00:00:00.000Z', projectionVersion: 'academic-v1' },
    proposedBy: 'school-user-1',
    reviewedBy: 'school-user-1',
    reviewedAt: '2026-07-21T00:00:00.000Z',
    decisionReason: null,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
    ...overrides,
  }
}

test('toParentView: an approved, shared item is returned, with no teacherNotes/evidenceBasis field on the object at all', () => {
  const view = toParentView(baseItem())
  assert.ok(view)
  assert.equal(view.title, 'Strengthen fractions')
  assert.equal(view.observation, 'Recent evidence shows Amani is developing steadily in Mathematics.')
  assert.equal(view.whatTheSchoolWillDo, 'Run a small-group fractions session on Tuesdays.')
  assert.equal(view.homeSupport, 'Ask Amani to explain one fraction problem at home each week.')
  assert.equal('teacherNotes' in view, false, 'teacherNotes must not appear on the parent view object')
  assert.equal('evidenceBasis' in view, false, 'evidenceBasis must not appear on the parent view object')
})

test('toLearnerView: an approved, shared item is returned, with no teacherNotes/evidenceBasis field on the object at all', () => {
  const view = toLearnerView(baseItem())
  assert.ok(view)
  assert.equal(view.nextGoal, 'Move to Level 3 in fractions by end of term.')
  assert.equal(view.assignedActivity, 'Complete two practice sets a week.')
  assert.equal(view.whyItMatters, 'Recent evidence shows Amani is developing steadily in Mathematics.')
  assert.equal('teacherNotes' in view, false, 'teacherNotes must not appear on the learner view object')
  assert.equal('evidenceBasis' in view, false, 'evidenceBasis must not appear on the learner view object')
})

test('toTeacherView: the full item is returned unrestricted, including teacherNotes and evidenceBasis', () => {
  const item = baseItem()
  const view = toTeacherView(item)
  assert.equal(view.teacherNotes, item.teacherNotes)
  assert.deepEqual(view.evidenceBasis, item.evidenceBasis)
})

test('toParentView returns null for a "proposed" (draft) item, even if visibility is "shared"', () => {
  assert.equal(toParentView(baseItem({ status: 'proposed' })), null)
})

test('toParentView returns null for an "edited" item', () => {
  assert.equal(toParentView(baseItem({ status: 'edited' })), null)
})

test('toParentView returns null for a "deferred" item', () => {
  assert.equal(toParentView(baseItem({ status: 'deferred' })), null)
})

test('toParentView returns null for a "rejected" item', () => {
  assert.equal(toParentView(baseItem({ status: 'rejected' })), null)
})

test('toLearnerView returns null for a "proposed" (draft) item, even if visibility is "shared"', () => {
  assert.equal(toLearnerView(baseItem({ status: 'proposed' })), null)
})

test('toParentView returns null for an approved item whose visibility is "teacher_only"', () => {
  assert.equal(toParentView(baseItem({ status: 'approved', visibility: 'teacher_only' })), null)
})

test('toParentView returns null for an approved item whose visibility is "learner_visible" only (not parent-facing)', () => {
  assert.equal(toParentView(baseItem({ status: 'approved', visibility: 'learner_visible' })), null)
})

test('toLearnerView returns null for an approved item whose visibility is "parent_visible" only (not learner-facing)', () => {
  assert.equal(toLearnerView(baseItem({ status: 'approved', visibility: 'parent_visible' })), null)
})

test('toParentView is returned for an approved "parent_visible" item (not just "shared")', () => {
  assert.ok(toParentView(baseItem({ status: 'approved', visibility: 'parent_visible' })))
})

test('toLearnerView is returned for an approved "learner_visible" item (not just "shared")', () => {
  assert.ok(toLearnerView(baseItem({ status: 'approved', visibility: 'learner_visible' })))
})
