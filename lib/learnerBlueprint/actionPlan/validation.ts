// lib/learnerBlueprint/actionPlan/validation.ts
//
// Field-level validation only — required fields, length limits. Matches
// lib/teacherReflection/reflection.ts's own MAX_FIELD_LENGTH convention
// (same 2000-char limit, same "content-level judgment is a human editorial
// responsibility, not something this validates" stance) — reused, not
// reinvented.

import type { ProposeBlueprintActionInput, EditableBlueprintActionFields, BlueprintActionEvidenceBasis } from './types'

export const MAX_FIELD_LENGTH = 2000

function checkLength(name: string, value: string | null | undefined): void {
  if (value && value.length > MAX_FIELD_LENGTH) {
    throw new Error(`Blueprint action item: "${name}" exceeds ${MAX_FIELD_LENGTH} characters.`)
  }
}

function checkRequired(name: string, value: string | null | undefined): void {
  if (!value || !value.trim()) throw new Error(`Blueprint action item: "${name}" is required.`)
}

/** Validates a fresh proposal — every required content field present, every field within length limits, and proposal-source/evidence-basis internally consistent. */
export function validateProposeInput(input: ProposeBlueprintActionInput): void {
  checkRequired('title', input.title)
  checkRequired('rationale', input.rationale)
  checkRequired('intendedOutcome', input.intendedOutcome)
  checkRequired('successIndicator', input.successIndicator)

  checkLength('title', input.title)
  checkLength('rationale', input.rationale)
  checkLength('intendedOutcome', input.intendedOutcome)
  checkLength('learnerAction', input.learnerAction)
  checkLength('teacherAction', input.teacherAction)
  checkLength('parentSupport', input.parentSupport)
  checkLength('schoolSupport', input.schoolSupport)
  checkLength('successIndicator', input.successIndicator)
  checkLength('targetCapability', input.targetCapability)
  checkLength('teacherNotes', input.teacherNotes)

  if (input.proposalSource === 'system' && !input.sourceGenerator) {
    throw new Error('Blueprint action item: "sourceGenerator" is required when proposalSource is "system".')
  }
  if (input.proposalSource === 'teacher' && input.sourceGenerator) {
    throw new Error('Blueprint action item: "sourceGenerator" must be null when proposalSource is "teacher" — a teacher-authored proposal has no generator.')
  }
  validateEvidenceBasis(input.evidenceBasis)
}

/** Validates the merged (existing + patch) fields before an edit — same rules as a fresh proposal for whichever required fields are present in the merge. */
export function validateEditFields(merged: { title: string; rationale: string; intendedOutcome: string; successIndicator: string } & EditableBlueprintActionFields): void {
  checkRequired('title', merged.title)
  checkRequired('rationale', merged.rationale)
  checkRequired('intendedOutcome', merged.intendedOutcome)
  checkRequired('successIndicator', merged.successIndicator)

  checkLength('title', merged.title)
  checkLength('rationale', merged.rationale)
  checkLength('intendedOutcome', merged.intendedOutcome)
  checkLength('learnerAction', merged.learnerAction)
  checkLength('teacherAction', merged.teacherAction)
  checkLength('parentSupport', merged.parentSupport)
  checkLength('schoolSupport', merged.schoolSupport)
  checkLength('successIndicator', merged.successIndicator)
  checkLength('targetCapability', merged.targetCapability)
  checkLength('teacherNotes', merged.teacherNotes)
}

/** A confidence value, if present, must be a real 0-100 number — mirrors `learner_projections.confidence`'s own CHECK constraint. Never allows a caller to fabricate a value outside what Projection could ever actually produce. */
function validateEvidenceBasis(basis: BlueprintActionEvidenceBasis | undefined): void {
  if (!basis) return
  if (basis.confidence !== null && (basis.confidence < 0 || basis.confidence > 100)) {
    throw new Error('Blueprint action item: "evidenceBasis.confidence" must be between 0 and 100.')
  }
}

export function requireNonEmptyReason(reason: string, action: 'reject' | 'defer'): void {
  if (!reason || !reason.trim()) {
    throw new Error(`Blueprint action item: a reason is required to ${action} an action item.`)
  }
  checkLength('reason', reason)
}
