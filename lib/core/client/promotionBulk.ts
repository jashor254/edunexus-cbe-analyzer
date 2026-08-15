// lib/core/client/promotionBulk.ts
//
// Phase 7 ("Promotion Review UX: bulk the ordinary, handle the exceptions") —
// pure, framework-free logic behind the promotion page's cohort bulk
// controls. Extracted (not written inline in the page component) so it can
// be unit-tested directly, matching this codebase's established pattern
// (app/(auth)/signup/page.tsx's buildAuthCallbackUrl).
//
// NON-NEGOTIABLE this module exists to enforce: bulk actions only ever
// write into the SAME two flat per-learner maps
// (decisions[learnerId], destinationClassByLearner[learnerId]) the existing
// promotion page already builds its POST /api/core/promotions payload from.
// There is no cohort-level or bulk-level state that reaches the network —
// bulk disappears before the request boundary, exactly as Phase 7 requires.

export type PromotionDecision = 'promote' | 'graduate' | 'repeat' | 'skip'

export type PromotionPreviewRow = {
  learner_id: string
  current_class: string
}

export type Cohort = {
  /** The exact `current_class` display-name string every learner in this cohort shares — the only source-class signal previewPromotion() already returns, so grouping needs no new backend field. */
  className: string
  learnerIds: string[]
}

/** Groups the existing preview rows by their current (source) class, in first-seen order. Pure read of data the page already has — no new API call. */
export function groupByCurrentClass(preview: PromotionPreviewRow[]): Cohort[] {
  const order: string[] = []
  const byClass = new Map<string, string[]>()
  for (const row of preview) {
    if (!byClass.has(row.current_class)) {
      byClass.set(row.current_class, [])
      order.push(row.current_class)
    }
    byClass.get(row.current_class)!.push(row.learner_id)
  }
  return order.map(className => ({ className, learnerIds: byClass.get(className)! }))
}

export type ApplyCohortDecisionInput = {
  learnerIds: string[]
  decision: PromotionDecision
  /** null for decisions that don't carry a destination (graduate, skip). */
  destinationClassId: string | null
  currentDecisions: Record<string, PromotionDecision>
  currentDestinations: Record<string, string>
  /** Learner ids the admin has individually edited since the last preview load — Task 9's "apply to unmodified learners only" safety rule reads this. */
  overridden: Record<string, boolean>
}

export type ApplyCohortDecisionResult = {
  decisions: Record<string, PromotionDecision>
  destinations: Record<string, string>
  appliedCount: number
  skippedCount: number
}

/**
 * Task B/C/D/9 — applies one decision (+ optional destination) to every
 * learner in `learnerIds`, EXCEPT those already individually overridden.
 * This is the deliberate, smallest-complexity choice Task 9 asks for
 * ("apply to unmodified learners only") over a destructive-overwrite
 * confirmation dialog: an exception, once made, is never silently
 * destroyed by a later bulk apply — the admin must edit it individually
 * to change it again.
 *
 * Returns new map objects (never mutates the inputs) so a React setState
 * call can use the result directly.
 */
export function applyCohortDecision(input: ApplyCohortDecisionInput): ApplyCohortDecisionResult {
  const decisions = { ...input.currentDecisions }
  const destinations = { ...input.currentDestinations }
  let appliedCount = 0
  let skippedCount = 0

  for (const learnerId of input.learnerIds) {
    if (input.overridden[learnerId]) {
      skippedCount++
      continue
    }
    decisions[learnerId] = input.decision
    if (input.destinationClassId) {
      destinations[learnerId] = input.destinationClassId
    } else {
      delete destinations[learnerId]
    }
    appliedCount++
  }

  return { decisions, destinations, appliedCount, skippedCount }
}

export type DecisionSummary = {
  byDecision: Record<PromotionDecision, number>
  byDestinationClass: Array<{ classId: string; className: string; count: number }>
  overriddenCount: number
  total: number
}

/**
 * Task E/F — the cohort-level and school-wide review summaries are the
 * SAME computation at different scopes: pass a cohort's learnerIds for
 * Task E, the whole preview's learnerIds for Task F. Pure local
 * arithmetic over state the page already holds — no backend call.
 */
export function summarizeDecisions(
  learnerIds: string[],
  decisions: Record<string, PromotionDecision>,
  destinations: Record<string, string>,
  overridden: Record<string, boolean>,
  classNameById: Record<string, string>
): DecisionSummary {
  const byDecision: Record<PromotionDecision, number> = { promote: 0, graduate: 0, repeat: 0, skip: 0 }
  const destinationCounts = new Map<string, number>()
  let overriddenCount = 0

  for (const learnerId of learnerIds) {
    const decision = decisions[learnerId] ?? 'promote'
    byDecision[decision]++
    if (overridden[learnerId]) overriddenCount++

    if (decision === 'promote' || decision === 'repeat') {
      const classId = destinations[learnerId]
      if (classId) destinationCounts.set(classId, (destinationCounts.get(classId) ?? 0) + 1)
    }
  }

  const byDestinationClass = Array.from(destinationCounts.entries()).map(([classId, count]) => ({
    classId,
    className: classNameById[classId] ?? classId,
    count,
  }))

  return { byDecision, byDestinationClass, overriddenCount, total: learnerIds.length }
}

/**
 * Task 12 — a decision is complete/submittable only if it either needs no
 * destination (graduate, skip) or has one. Shared by the cohort "Apply"
 * button's disabled state and the page's own existing canRun check, so the
 * two never disagree about what counts as valid.
 */
export function decisionNeedsDestination(decision: PromotionDecision): boolean {
  return decision === 'promote' || decision === 'repeat'
}
