// lib/learnerBlueprint/actionPlan/types.ts
//
// Domain-facing types for the Blueprint action-plan capability (Phase 1 of
// docs/architecture/blueprint-living-action-plan-audit.md). These are the
// shapes callers of lib/learnerBlueprint/actionPlan/ work with — distinct
// from the raw DB row types in lib/repositories/blueprintActionItem
// .repository.ts, which this module maps to/from internally.

import type {
  BlueprintActionContext,
  BlueprintActionPriority,
  BlueprintActionStatus,
  BlueprintActionVisibility,
  BlueprintActionProposalSource,
  BlueprintActionEvidenceBasis,
  BlueprintActionItemRow,
} from '@/lib/repositories/blueprintActionItem.repository'

export type {
  BlueprintActionContext,
  BlueprintActionPriority,
  BlueprintActionStatus,
  BlueprintActionVisibility,
  BlueprintActionProposalSource,
  BlueprintActionEvidenceBasis,
}

/** The full domain view of one action item — a straightforward field-name mapping of the DB row (snake_case -> camelCase), not a reshaping. */
export type BlueprintActionItem = {
  id: string
  learnerId: string
  schoolId: string
  academicYearId: string | null
  termId: string | null
  blueprintSnapshotId: string | null
  context: BlueprintActionContext
  priority: BlueprintActionPriority
  status: BlueprintActionStatus
  visibility: BlueprintActionVisibility
  title: string
  rationale: string
  intendedOutcome: string
  learnerAction: string | null
  teacherAction: string | null
  parentSupport: string | null
  schoolSupport: string | null
  successIndicator: string
  targetCapability: string | null
  /** Canonical curriculum anchor (`sow_substrands.id`), or null for a subject-level action. */
  subStrandId: string | null
  reviewDate: string | null
  teacherNotes: string | null
  proposalSource: BlueprintActionProposalSource
  sourceGenerator: string | null
  evidenceBasis: BlueprintActionEvidenceBasis
  proposedBy: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  decisionReason: string | null
  createdAt: string
  updatedAt: string
}

export function toBlueprintActionItem(row: BlueprintActionItemRow): BlueprintActionItem {
  return {
    id: row.id,
    learnerId: row.learner_id,
    schoolId: row.school_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    blueprintSnapshotId: row.blueprint_snapshot_id,
    context: row.context,
    priority: row.priority,
    status: row.status,
    visibility: row.visibility,
    title: row.title,
    rationale: row.rationale,
    intendedOutcome: row.intended_outcome,
    learnerAction: row.learner_action,
    teacherAction: row.teacher_action,
    parentSupport: row.parent_support,
    schoolSupport: row.school_support,
    successIndicator: row.success_indicator,
    targetCapability: row.target_capability,
    subStrandId: row.sub_strand_id,
    reviewDate: row.review_date,
    teacherNotes: row.teacher_notes,
    proposalSource: row.proposal_source,
    sourceGenerator: row.source_generator,
    evidenceBasis: row.evidence_basis,
    proposedBy: row.proposed_by,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    decisionReason: row.decision_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Input for `proposeBlueprintAction` — every field a fresh proposal needs. `proposedBy`/`schoolId`/`status`/timestamps are never caller-supplied (derived internally from the authenticated session and the learner's real school). */
export type ProposeBlueprintActionInput = {
  coreLearnerId: string
  context: BlueprintActionContext
  priority?: BlueprintActionPriority
  visibility?: BlueprintActionVisibility
  title: string
  rationale: string
  intendedOutcome: string
  learnerAction?: string | null
  teacherAction?: string | null
  parentSupport?: string | null
  schoolSupport?: string | null
  successIndicator: string
  targetCapability?: string | null
  /** Canonical curriculum anchor (`sow_substrands.id`). Never inferred from text. */
  subStrandId?: string | null
  reviewDate?: string | null
  teacherNotes?: string | null
  proposalSource: BlueprintActionProposalSource
  /** Required when proposalSource is 'system' — which deterministic rule/generator produced this. Must be null for 'teacher'. */
  sourceGenerator?: string | null
  /** Real Projection provenance for a 'system' proposal — omit or leave empty for a 'teacher' proposal with no formal Projection backing. Never fabricated. */
  evidenceBasis?: BlueprintActionEvidenceBasis
}

/** Only the teacher-controlled content fields — the exact set `editBlueprintAction` may change. Identity/provenance fields (id, learnerId, schoolId, proposalSource, sourceGenerator, evidenceBasis, proposedBy, createdAt) are structurally absent from this type, not merely discouraged. */
export type EditableBlueprintActionFields = Partial<{
  context: BlueprintActionContext
  priority: BlueprintActionPriority
  visibility: BlueprintActionVisibility
  title: string
  rationale: string
  intendedOutcome: string
  learnerAction: string | null
  teacherAction: string | null
  parentSupport: string | null
  schoolSupport: string | null
  successIndicator: string
  targetCapability: string | null
  reviewDate: string | null
  teacherNotes: string | null
}>

export const EVIDENCE_BASIS_EMPTY: BlueprintActionEvidenceBasis = {
  projectorType: null,
  supportingEvidenceIds: [],
  confidence: null,
  lastComputed: null,
  projectionVersion: null,
}
