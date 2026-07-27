// components/blueprint/actionPlan/actionCardPresentation.ts
//
// Pure presentation model for the Blueprint Action Plan card (Phase 3A,
// docs/architecture/blueprint-execution-experience-phase3a.md). Every value
// here is DERIVED, on every render, from `ReviewableActionListItem`
// (lib/learnerBlueprint/actionPlan/reviewWorkspace.ts) — nothing here is
// persisted, nothing here writes anywhere, and nothing here overrides or
// relabels `blueprint_action_items.status` (which always renders
// separately, as "Approved" — see BlueprintActionPlanCard.tsx). This file
// has no database access at all — proven by static scan
// (actionCardPresentation.test.ts).

import type { ReviewableActionListItem } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'

export type DeliveryPresentation = 'not_delivered' | 'assignment_only' | 'compass_only' | 'both'

/** Delivery state — a straightforward, mutually-exclusive read of the two booleans already on the item. */
export function deriveDeliveryPresentation(item: Pick<ReviewableActionListItem, 'assignmentDelivered' | 'compassDelivered'>): DeliveryPresentation {
  if (item.assignmentDelivered && item.compassDelivered) return 'both'
  if (item.assignmentDelivered) return 'assignment_only'
  if (item.compassDelivered) return 'compass_only'
  return 'not_delivered'
}

export const DELIVERY_PRESENTATION_LABEL: Record<DeliveryPresentation, string> = {
  not_delivered: 'Not yet delivered',
  assignment_only: 'Delivered to Assignment',
  compass_only: 'Delivered to Compass',
  both: 'Delivered to Assignment and Compass',
}

export type RecommendedActionKind = 'deliver' | 'await' | 'review' | 'none'

export type RecommendedAction = {
  label: string
  kind: RecommendedActionKind
}

/**
 * The single most appropriate next teacher action for one action item —
 * navigational only. It NEVER approves, delivers, reviews, writes
 * Evidence, recomputes a Projection, or claims success — it only names
 * where the "Choose delivery" / "Await learner activity" / "Review
 * progress" / "No immediate action" button should point, exactly per the
 * task brief's own worked examples. Priority order (first match wins):
 *
 *  1. Not delivered at all              -> "Choose delivery"
 *  2. Delivered, but no learner activity
 *     recorded at all                   -> "Await learner activity"
 *  3. Latest review is "Needs Revision" -> "Review or prepare revised action"
 *  4. Latest review is "Defer"          -> "Review when ready"
 *  5. Activity/due-date newer than the
 *     latest review (or none yet)       -> "Review progress"
 *  6. Latest review is "Complete" and
 *     nothing newer has happened        -> "No immediate action"
 *  7. Anything else (e.g. "Reopen" or
 *     "No Decision" with nothing newer) -> "Review progress" (safe default —
 *     never silently "no action" for a decision that isn't Complete)
 */
export function recommendNextAction(item: ReviewableActionListItem): RecommendedAction {
  if (!item.assignmentDelivered && !item.compassDelivered) {
    return { label: 'Choose delivery', kind: 'deliver' }
  }
  if (item.lastActivityAt === null) {
    return { label: 'Await learner activity', kind: 'await' }
  }
  if (item.latestDecision === 'needs_revision') {
    return { label: 'Review or prepare revised action', kind: 'review' }
  }
  if (item.latestDecision === 'defer') {
    return { label: 'Review when ready', kind: 'review' }
  }
  if (item.awaitingReview) {
    return { label: 'Review progress', kind: 'review' }
  }
  if (item.latestDecision === 'complete') {
    return { label: 'No immediate action', kind: 'none' }
  }
  return { label: 'Review progress', kind: 'review' }
}

export type ActionCardPresentation = {
  delivery: DeliveryPresentation
  deliveryLabel: string
  hasActivity: boolean
  needsAttention: boolean
  recommendedAction: RecommendedAction
}

/** The full derived presentation bundle a card needs — one call, no duplication of the pieces above. */
export function deriveActionCardPresentation(item: ReviewableActionListItem): ActionCardPresentation {
  const delivery = deriveDeliveryPresentation(item)
  return {
    delivery,
    deliveryLabel: DELIVERY_PRESENTATION_LABEL[delivery],
    hasActivity: item.lastActivityAt !== null,
    needsAttention: item.awaitingReview,
    recommendedAction: recommendNextAction(item),
  }
}
