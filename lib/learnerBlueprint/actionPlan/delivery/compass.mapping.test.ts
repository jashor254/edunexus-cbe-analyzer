// lib/learnerBlueprint/actionPlan/delivery/compass.mapping.test.ts
//
// Pure unit tests for `mapActionToCompassObjective` (Phase 2C) — no
// database, no auth. Proves the deterministic content mapping never
// surfaces teacher-private, parent-only, or projection-provenance fields,
// independent of the full authorization/lifecycle integration suite
// (compass.integration.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapActionToCompassObjective } from './compass'
import { EVIDENCE_BASIS_EMPTY } from '../types'
import type { BlueprintActionItemRow } from '@/lib/repositories/blueprintActionItem.repository'
import { asLearnerId } from '@/lib/core/identityTypes'

function makeAction(overrides: Partial<BlueprintActionItemRow> = {}): BlueprintActionItemRow {
  return {
    id: 'action-1',
    learner_id: asLearnerId('learner-1'),
    school_id: 'school-1',
    academic_year_id: null,
    term_id: null,
    blueprint_snapshot_id: null,
    context: 'current_term',
    priority: 'medium',
    status: 'approved',
    visibility: 'teacher_only',
    title: 'Build fluency in fractions',
    rationale: 'Recent evidence shows steady development.',
    intended_outcome: 'Reach confident fluency adding and subtracting fractions.',
    learner_action: 'Practice fraction addition with Compass for 15 minutes.',
    teacher_action: null,
    parent_support: 'Ask your child to show you one fractions problem they solved.',
    school_support: null,
    success_indicator: 'Solves 4/5 fraction addition problems correctly in a Compass check.',
    target_capability: 'Grade 7 Mathematics — Fractions',
    sub_strand_id: null,
    review_date: '2026-08-15',
    teacher_notes: 'CONFIDENTIAL internal note.',
    proposal_source: 'teacher',
    source_generator: null,
    evidence_basis: { ...EVIDENCE_BASIS_EMPTY, confidence: 91, lastComputed: '2026-07-20T00:00:00.000Z' },
    proposed_by: null,
    reviewed_by: null,
    reviewed_at: null,
    decision_reason: null,
    created_at: '2026-07-25T00:00:00.000Z',
    updated_at: '2026-07-25T00:00:00.000Z',
    ...overrides,
  }
}

test('objective maps from learnerAction', () => {
  const draft = mapActionToCompassObjective(makeAction())
  assert.equal(draft.objective, 'Practice fraction addition with Compass for 15 minutes.')
})

test('falls back to intendedOutcome when learnerAction is null', () => {
  const draft = mapActionToCompassObjective(makeAction({ learner_action: null }))
  assert.equal(draft.objective, 'Reach confident fluency adding and subtracting fractions.')
})

test('learnerInstructions include the objective and the success indicator', () => {
  const draft = mapActionToCompassObjective(makeAction())
  assert.ok(draft.learnerInstructions.includes('Practice fraction addition with Compass for 15 minutes.'))
  assert.ok(draft.learnerInstructions.includes('Solves 4/5 fraction addition problems correctly in a Compass check.'))
})

test('successIndicator passes through verbatim', () => {
  const draft = mapActionToCompassObjective(makeAction())
  assert.equal(draft.successIndicator, 'Solves 4/5 fraction addition problems correctly in a Compass check.')
})

test('reviewDate mirrors the action reviewDate', () => {
  const draft = mapActionToCompassObjective(makeAction({ review_date: '2026-09-01' }))
  assert.equal(draft.reviewDate, '2026-09-01')
})

test('curriculumReference passes through targetCapability verbatim, never fabricated', () => {
  const draft = mapActionToCompassObjective(makeAction())
  assert.equal(draft.curriculumReference, 'Grade 7 Mathematics — Fractions')
})

test('curriculumReference is null when the action has none', () => {
  const draft = mapActionToCompassObjective(makeAction({ target_capability: null }))
  assert.equal(draft.curriculumReference, null)
})

test('never includes teacherNotes, evidenceBasis (confidence/freshness), parentSupport, teacherAction, or schoolSupport', () => {
  const action = makeAction({
    teacher_notes: 'PRIVATE_MARKER_TEACHER_NOTES',
    parent_support: 'PRIVATE_MARKER_PARENT_SUPPORT',
    teacher_action: 'PRIVATE_MARKER_TEACHER_ACTION',
    school_support: 'PRIVATE_MARKER_SCHOOL_SUPPORT',
  })
  const draft = mapActionToCompassObjective(action)
  const serialized = JSON.stringify(draft)
  assert.ok(!serialized.includes('PRIVATE_MARKER_TEACHER_NOTES'))
  assert.ok(!serialized.includes('PRIVATE_MARKER_PARENT_SUPPORT'))
  assert.ok(!serialized.includes('PRIVATE_MARKER_TEACHER_ACTION'))
  assert.ok(!serialized.includes('PRIVATE_MARKER_SCHOOL_SUPPORT'))
  assert.ok(!serialized.includes('confidence'))
  assert.ok(!serialized.includes('lastComputed'))
  assert.ok(!Object.keys(draft).includes('evidenceBasis'))
})
