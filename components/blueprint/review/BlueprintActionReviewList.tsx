'use client'

// components/blueprint/review/BlueprintActionReviewList.tsx
//
// The overview list of reviewable Blueprint actions for one learner
// (Phase 2E). Presentation + selection only — no data fetching, no
// awaiting-review computation (that's `computeAwaitingReview`, already
// applied server-side into each item before this component ever sees it).

import type { ReviewableActionListItem } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'
import BlueprintActionReviewCard from './BlueprintActionReviewCard'

export default function BlueprintActionReviewList({
  items,
  selectedActionId,
  onSelect,
}: {
  items: ReviewableActionListItem[]
  selectedActionId: string | null
  onSelect: (actionId: string) => void
}) {
  if (items.length === 0) {
    return (
      <div role="status" className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
        <p className="text-sm font-bold text-gray-700">No approved Blueprint actions are available for review yet.</p>
        <p className="text-xs text-gray-400 mt-1">Once an action is approved, it will appear here.</p>
      </div>
    )
  }

  return (
    <nav aria-label="Blueprint actions awaiting review">
      <ul className="space-y-2">
        {items.map(item => (
          <BlueprintActionReviewCard
            key={item.actionId}
            item={item}
            selected={item.actionId === selectedActionId}
            onSelect={() => onSelect(item.actionId)}
          />
        ))}
      </ul>
    </nav>
  )
}
