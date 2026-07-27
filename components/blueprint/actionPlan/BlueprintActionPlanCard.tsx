'use client'

// components/blueprint/actionPlan/BlueprintActionPlanCard.tsx
//
// One card in the teacher-only "Blueprint Action Plan" section (Phase 3A).
// Presentation only — every value comes from `ReviewableActionListItem`
// (already fetched server-side) and the pure `deriveActionCardPresentation`
// /`recommendNextAction` helpers. This component never fetches or writes
// anything itself; it opens the delivery panels and hands their results
// back up to the parent section, which is the only place that talks to the
// network for this card's own state.
//
// Visual hierarchy (task brief): (1) the educational need, (2) the
// approved response, (3) delivery, (4) learner activity, (5) educator
// review, (6) next available action — rendered in exactly that order.
// "Approval status" (always "Approved") and "Latest review" are always
// two separately labeled facts, never merged into one relabeled status.

import Link from 'next/link'
import { DECISION_LABEL, DECISION_BADGE_CLASS, formatDate, formatDateTime } from '@/components/blueprint/review/reviewFormatting'
import { deriveActionCardPresentation } from './actionCardPresentation'
import type { ReviewableActionListItem } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'

export default function BlueprintActionPlanCard({
  item,
  learnerId,
  onOpenAssignmentDelivery,
  onOpenCompassDelivery,
}: {
  item: ReviewableActionListItem
  learnerId: string
  onOpenAssignmentDelivery: () => void
  onOpenCompassDelivery: () => void
}) {
  const presentation = deriveActionCardPresentation(item)
  const reviewUrl = `/teacher/learners/${learnerId}/blueprint/review?action=${item.actionId}`

  return (
    <article className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      {/* 1. The educational need */}
      <div>
        <h3 className="text-sm font-black text-gray-900">{item.title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          <span className="font-bold text-gray-600">What the learner needs: </span>
          {item.learnerAction || item.intendedOutcome}
        </p>
      </div>

      {/* 2. The approved response */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center font-bold px-2 py-0.5 rounded-lg bg-teal-100 text-teal-700">
          <span className="sr-only">Approval status: </span>Approved
        </span>
        {item.reviewDate && <span className="text-gray-400">Review date: {formatDate(item.reviewDate)}</span>}
      </div>
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer font-bold text-gray-600">Planned action details</summary>
        <p className="mt-1"><span className="font-bold">Intended outcome: </span>{item.intendedOutcome}</p>
        <p className="mt-1"><span className="font-bold">Success indicator: </span>{item.successIndicator}</p>
      </details>

      {/* 3. Delivery */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          <span className="font-bold text-gray-600">Delivery: </span>{presentation.deliveryLabel}
        </span>
        {item.assignmentDelivered && item.assignmentId && (
          <Link href={`/teacher/assignments/${item.assignmentId}`} className="font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
            View assignment →
          </Link>
        )}
      </div>

      {/* 4. Learner activity */}
      <p className="text-xs text-gray-500">
        <span className="font-bold text-gray-600">Learner activity: </span>
        {presentation.hasActivity ? `Recorded — last activity ${formatDate(item.lastActivityAt)}` : 'No learner activity recorded yet'}
      </p>

      {/* 5. Educator review */}
      <div className="text-xs text-gray-500 space-y-0.5">
        <p>
          <span className="font-bold text-gray-600">Latest teacher review: </span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${DECISION_BADGE_CLASS[item.latestDecision]}`}>
            {DECISION_LABEL[item.latestDecision]}
          </span>
          {item.latestReviewAt && <span className="ml-1 text-gray-400">{formatDateTime(item.latestReviewAt)}</span>}
        </p>
        {item.latestReviewNotes && <p className="italic">"{item.latestReviewNotes}"</p>}
        {presentation.needsAttention && (
          <p className="font-bold text-orange-700">Needs teacher attention</p>
        )}
      </div>

      {/* 6. Next available action */}
      <div className="pt-1 space-y-2">
        <p className="text-xs text-gray-400">Suggested next step: {presentation.recommendedAction.label}</p>
        <div className="flex flex-wrap gap-2">
          {!item.assignmentDelivered && (
            <button
              type="button"
              onClick={onOpenAssignmentDelivery}
              className="bg-teal-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-teal-700"
            >
              Create class assignment
            </button>
          )}
          {!item.compassDelivered && (
            <button
              type="button"
              onClick={onOpenCompassDelivery}
              className="bg-cyan-600 text-white px-3 py-2 rounded-xl font-black text-xs hover:bg-cyan-700"
            >
              Send to Learning Compass
            </button>
          )}
          {(item.assignmentDelivered || item.compassDelivered) && (
            <Link
              href={reviewUrl}
              className="border border-gray-200 text-gray-700 px-3 py-2 rounded-xl font-black text-xs hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Review progress →
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
