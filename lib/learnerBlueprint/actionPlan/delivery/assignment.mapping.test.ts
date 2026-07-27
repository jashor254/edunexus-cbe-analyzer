// lib/learnerBlueprint/actionPlan/delivery/assignment.mapping.test.ts
//
// Pure unit tests for `mapActionToAssignmentDraft` (Phase 2B) — no database,
// no auth. Proves the deterministic content mapping never surfaces
// teacher-private or parent-only fields, independent of the full
// authorization/lifecycle integration suite (assignment.integration.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapActionToAssignmentDraft } from './assignment'
import { EVIDENCE_BASIS_EMPTY } from '../types'
import type { BlueprintActionItemRow } from '@/lib/repositories/blueprintActionItem.repository'

function makeAction(overrides: Partial<BlueprintActionItemRow> = {}): BlueprintActionItemRow {
  return {
    id: 'action-1',
    learner_id: 'learner-1',
    school_id: 'school-1',
    academic_year_id: null,
    term_id: null,
    blueprint_snapshot_id: null,
    context: 'current_term',
    priority: 'medium',
    status: 'approved',
    visibility: 'teacher_only',
    title: 'Strengthen fractions',
    rationale: 'Recent evidence shows steady development.',
    intended_outcome: 'Move to Level 3 in fractions by end of term.',
    learner_action: 'Complete 10 fractions practice problems this week.',
    teacher_action: null,
    parent_support: 'Ask your child to explain one fractions problem each evening.',
    school_support: null,
    success_indicator: 'Next confirmed assessment shows Level 3 or above.',
    target_capability: null,
    review_date: '2026-08-15',
    teacher_notes: 'CONFIDENTIAL internal note.',
    proposal_source: 'teacher',
    source_generator: null,
    evidence_basis: EVIDENCE_BASIS_EMPTY,
    proposed_by: null,
    reviewed_by: null,
    reviewed_at: null,
    decision_reason: null,
    created_at: '2026-07-25T00:00:00.000Z',
    updated_at: '2026-07-25T00:00:00.000Z',
    ...overrides,
  }
}

test('title maps verbatim from the action title', () => {
  const draft = mapActionToAssignmentDraft(makeAction())
  assert.equal(draft.title, 'Strengthen fractions')
})

test('instructions include learnerAction and successIndicator', () => {
  const draft = mapActionToAssignmentDraft(makeAction())
  assert.ok(draft.instructions.includes('Complete 10 fractions practice problems this week.'))
  assert.ok(draft.instructions.includes('Next confirmed assessment shows Level 3 or above.'))
})

test('falls back to intendedOutcome when learnerAction is null', () => {
  const draft = mapActionToAssignmentDraft(makeAction({ learner_action: null }))
  assert.ok(draft.instructions.includes('Move to Level 3 in fractions by end of term.'))
})

test('dueDate mirrors reviewDate', () => {
  const draft = mapActionToAssignmentDraft(makeAction({ review_date: '2026-09-01' }))
  assert.equal(draft.dueDate, '2026-09-01')
})

test('dueDate is null when the action has no reviewDate', () => {
  const draft = mapActionToAssignmentDraft(makeAction({ review_date: null }))
  assert.equal(draft.dueDate, null)
})

test('never includes teacherNotes, evidenceBasis, parentSupport, teacherAction, or schoolSupport', () => {
  const action = makeAction({
    teacher_notes: 'PRIVATE_MARKER_TEACHER_NOTES',
    parent_support: 'PRIVATE_MARKER_PARENT_SUPPORT',
    teacher_action: 'PRIVATE_MARKER_TEACHER_ACTION',
    school_support: 'PRIVATE_MARKER_SCHOOL_SUPPORT',
  })
  const draft = mapActionToAssignmentDraft(action)
  const serialized = JSON.stringify(draft)
  assert.ok(!serialized.includes('PRIVATE_MARKER_TEACHER_NOTES'))
  assert.ok(!serialized.includes('PRIVATE_MARKER_PARENT_SUPPORT'))
  assert.ok(!serialized.includes('PRIVATE_MARKER_TEACHER_ACTION'))
  assert.ok(!serialized.includes('PRIVATE_MARKER_SCHOOL_SUPPORT'))
  assert.ok(!serialized.includes('evidence_basis'))
})
