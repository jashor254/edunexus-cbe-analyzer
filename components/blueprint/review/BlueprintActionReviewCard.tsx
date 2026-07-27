'use client'

// components/blueprint/review/BlueprintActionReviewCard.tsx
//
// One row in the Blueprint action review overview list (Phase 2E).
// Presentation only — every field comes from the learner-scoped list DTO
// (`ReviewableActionListItem`, lib/learnerBlueprint/actionPlan/
// reviewWorkspace.ts). "Approval status" and "Latest review" are always
// two separately labeled pieces of text, never merged into one label —
// approval status is always "Approved" (only approved items are ever
// listed here) and never relabeled by the latest review decision.

import type { ReviewableActionListItem } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'
import { DECISION_LABEL, DECISION_BADGE_CLASS, formatDate } from './reviewFormatting'

export default function BlueprintActionReviewCard({
  item,
  selected,
  onSelect,
}: {
  item: ReviewableActionListItem
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-current={selected ? 'true' : undefined}
        className={`w-full text-left rounded-2xl border p-4 space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
          selected ? 'border-teal-600 bg-teal-50' : 'border-gray-100 bg-white hover:border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-black text-gray-900">{item.title}</h3>
          {item.awaitingReview && (
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg bg-orange-100 text-orange-700">
              Needs attention
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 line-clamp-2">{item.intendedOutcome}</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pt-1">
          <span><span className="font-bold text-gray-600">Approval status:</span> Approved</span>
          <span>
            <span className="font-bold text-gray-600">Latest review:</span>{' '}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${DECISION_BADGE_CLASS[item.latestDecision]}`}>
              {DECISION_LABEL[item.latestDecision]}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>
            <span className="font-bold text-gray-600">Delivery:</span>{' '}
            {item.assignmentDelivered || item.compassDelivered
              ? [item.assignmentDelivered && 'Assignment', item.compassDelivered && 'Compass'].filter(Boolean).join(' · ')
              : 'Not yet delivered'}
          </span>
          {item.reviewDate && <span><span className="font-bold text-gray-600">Review date:</span> {formatDate(item.reviewDate)}</span>}
          {item.lastActivityAt && <span><span className="font-bold text-gray-600">Last activity:</span> {formatDate(item.lastActivityAt)}</span>}
        </div>
      </button>
    </li>
  )
}
