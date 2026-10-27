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
import type { ApprovedPlanStep } from '../types'

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

/**
 * One report-safe plan step, built ONLY from the two stakeholder projections
 * above — so the visibility rule is decided in exactly one place (here, via
 * `toParentView`/`toLearnerView`) and `teacherNotes`/`evidenceBasis` can never
 * be carried. Null when neither audience may see the item (`teacher_only`, or
 * not approved).
 */
export function toApprovedPlanStep(item: BlueprintActionItem): ApprovedPlanStep | null {
  const learner = toLearnerView(item)
  const parent = toParentView(item)
  if (!learner && !parent) return null
  return {
    id: item.id,
    title: item.title,
    context: item.context,
    reviewDate: item.reviewDate,
    successIndicator: item.successIndicator,
    learnerView: learner ? { nextGoal: learner.nextGoal, assignedActivity: learner.assignedActivity, whyItMatters: learner.whyItMatters } : null,
    parentView: parent ? { observation: parent.observation, whatTheSchoolWillDo: parent.whatTheSchoolWillDo, homeSupport: parent.homeSupport } : null,
  }
}

/**
 * Approved, stakeholder-visible plan steps that are still active — i.e. not
 * already reviewed by a teacher as `complete`. A review never moves an item
 * out of `approved` (actionPlan/review.ts), so without this filter a finished
 * action would keep presenting itself as the learner's next step. Two reads,
 * neither in a loop: the approved items, then their latest review decisions
 * in one batched query. Same authorization note as the functions above — the
 * caller has already authorized composing this learner's report.
 */
export async function listActiveApprovedPlanForLearner(coreLearnerId: string, schoolId: string): Promise<ApprovedPlanStep[]> {
  const rows = await repos.blueprintActionItems.listApprovedForLearner(coreLearnerId, schoolId)
  const steps = rows.map(toBlueprintActionItem).map(toApprovedPlanStep).filter((s): s is ApprovedPlanStep => s !== null)
  if (steps.length === 0) return []
  const latest = await repos.blueprintActionReviews.findLatestDecisionsForActionItems(steps.map(s => s.id))
  return steps.filter(s => latest[s.id] !== 'complete')
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
