// lib/learnerBlueprint/actionPlan/index.ts
//
// Public API of the Blueprint action-plan domain (Phase 1 of
// docs/architecture/blueprint-living-action-plan-audit.md). Route handlers
// and other modules must import from here, not from lifecycle.ts/
// candidateGeneration.ts/projections.ts directly, and never from
// lib/repositories/blueprintActionItem*.repository.ts directly — those
// repositories are this module's own implementation detail.

export {
  proposeBlueprintAction,
  editBlueprintAction,
  approveBlueprintAction,
  rejectBlueprintAction,
  deferBlueprintAction,
  getBlueprintAction,
  getBlueprintActionHistory,
  listBlueprintActionsForLearner,
} from './lifecycle'

export { generateActionCandidate, DETERMINISTIC_CANDIDATE_GENERATOR_ID } from './candidateGeneration'
export type { ActionCandidate } from './candidateGeneration'

export {
  toParentView,
  toLearnerView,
  toTeacherView,
  listApprovedParentActionsForLearner,
  listApprovedLearnerActionsForLearner,
  listApprovedBlueprintActionsForStakeholder,
} from './projections'
export type { ParentSafeActionView, LearnerSafeActionView, TeacherActionView } from './projections'

export type {
  BlueprintActionItem,
  ProposeBlueprintActionInput,
  EditableBlueprintActionFields,
  BlueprintActionContext,
  BlueprintActionPriority,
  BlueprintActionStatus,
  BlueprintActionVisibility,
  BlueprintActionProposalSource,
  BlueprintActionEvidenceBasis,
} from './types'
