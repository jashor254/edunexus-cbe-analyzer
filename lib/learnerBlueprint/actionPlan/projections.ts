// lib/learnerBlueprint/actionPlan/projections.ts
//
// Stakeholder visibility — pure, explicit, testable projection functions
// (Phase 1's own instruction: "Prefer explicit, testable visibility fields
// or projections rather than parsing prose labels"). `teacherNotes` and
// `evidenceBasis` are structurally absent from both stakeholder view
// types below — not filtered out at runtime, but never part of the
// return shape at all, so there is no field a future edit could
// accidentally start leaking through these two functions.
//
// Both stakeholder views additionally refuse to return anything unless
// the item has a final 'approved' decision AND its own declared
// `visibility` permits that audience — a draft/proposed/edited/rejected/
// deferred item is never visible here, regardless of caller.
//
// Part C's full stakeholder-language design (bespoke "strengths"/"what not
// to overreact to" framing, PDF page adaptation) is explicitly Phase 4
// scope. These two functions map today's generic content fields onto that
// shape as directly as the current schema allows — documented per field
// below — not a claim that this is the final stakeholder copy.

import { repos } from '@/lib/repositories'
import { toBlueprintActionItem, type BlueprintActionItem } from './types'

export type ParentSafeActionView = {
  id: string
  title: string
  /** = rationale, written in plain language by convention (Sprint 12O's `teacher_reflections` precedent: content-level tone is a human editorial responsibility, not something this function validates). */
  observation: string
  /** = teacherAction, when the teacher chose to share it — Part C's "what the school will do." */
  whatTheSchoolWillDo: string | null
  /** = parentSupport — Part C's "realistic home support." */
  homeSupport: string | null
  reviewDate: string | null
  successIndicator: string
}

export type LearnerSafeActionView = {
  id: string
  title: string
  /** = intendedOutcome — Part C's "next goal." */
  nextGoal: string
  /** = learnerAction — Part C's "assigned activity." */
  assignedActivity: string | null
  /** = rationale — Part C's "why it matters." */
  whyItMatters: string
  successIndicator: string
}

/** The full, unrestricted teacher view — every field, including `teacherNotes` and `evidenceBasis`. Teachers are the one audience with no visibility restriction (they authored/reviewed the item). */
export type TeacherActionView = BlueprintActionItem

function isApprovedFor(item: BlueprintActionItem, allowedVisibility: BlueprintActionItem['visibility'][]): boolean {
  return item.status === 'approved' && allowedVisibility.includes(item.visibility)
}

export function toParentView(item: BlueprintActionItem): ParentSafeActionView | null {
  if (!isApprovedFor(item, ['parent_visible', 'shared'])) return null
  return {
    id: item.id,
    title: item.title,
    observation: item.rationale,
    whatTheSchoolWillDo: item.teacherAction,
    homeSupport: item.parentSupport,
    reviewDate: item.reviewDate,
    successIndicator: item.successIndicator,
  }
}

export function toLearnerView(item: BlueprintActionItem): LearnerSafeActionView | null {
  if (!isApprovedFor(item, ['learner_visible', 'shared'])) return null
  return {
    id: item.id,
    title: item.title,
    nextGoal: item.intendedOutcome,
    assignedActivity: item.learnerAction,
    whyItMatters: item.rationale,
    successIndicator: item.successIndicator,
  }
}

export function toTeacherView(item: BlueprintActionItem): TeacherActionView {
  return item
}

/**
 * Approved, stakeholder-visible action items for one learner, projected
 * for the given audience — the read path Blueprint composition uses (see
 * `composeRecommendedNextSteps.ts`'s cutover). No `SupabaseClient`/auth
 * check here, deliberately: this mirrors every other composer-support
 * function Blueprint calls internally (e.g. `getLatestBlueprintSnapshot`)
 * — the caller (`composeBlueprint()`, gated by `requireLearnerAccess` at
 * the route) has already authorized access to compose this learner's
 * Blueprint at all; this function's own job is only the stakeholder
 * projection, never a second authorization decision.
 */
export async function listApprovedParentActionsForLearner(coreLearnerId: string, schoolId: string): Promise<ParentSafeActionView[]> {
  const rows = await repos.blueprintActionItems.listApprovedForLearner(coreLearnerId, schoolId)
  return rows.map(toBlueprintActionItem).map(toParentView).filter((v): v is ParentSafeActionView => v !== null)
}

export async function listApprovedLearnerActionsForLearner(coreLearnerId: string, schoolId: string): Promise<LearnerSafeActionView[]> {
  const rows = await repos.blueprintActionItems.listApprovedForLearner(coreLearnerId, schoolId)
  return rows.map(toBlueprintActionItem).map(toLearnerView).filter((v): v is LearnerSafeActionView => v !== null)
}

/** Convenience wrapper over the two functions above, for callers that receive `stakeholder` as a runtime value (e.g. a route param) rather than knowing it at the call site. */
export async function listApprovedBlueprintActionsForStakeholder(
  coreLearnerId: string,
  schoolId: string,
  stakeholder: 'parent' | 'learner'
): Promise<Array<ParentSafeActionView | LearnerSafeActionView>> {
  return stakeholder === 'parent'
    ? listApprovedParentActionsForLearner(coreLearnerId, schoolId)
    : listApprovedLearnerActionsForLearner(coreLearnerId, schoolId)
}
