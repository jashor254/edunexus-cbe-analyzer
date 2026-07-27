'use client'

// components/blueprint/review/BlueprintReviewWorkspace.tsx
//
// Top-level orchestrator for the Teacher Review Workspace (Phase 2E,
// docs/architecture/blueprint-teacher-review-workspace-phase2e.md). Owns
// only UI state (which action is selected, the fetched detail snapshot) —
// no domain logic, no direct table access. The overview list comes from
// the server page's call to `listReviewableBlueprintActionsForLearner()`;
// the detail snapshot for a selected action is fetched on demand from the
// existing Phase 2D `GET /api/teacher/blueprint/actions/[actionItemId]
// /review` route (never re-implemented here) — so a learner with several
// action items never pays for every action's full snapshot up front, only
// the one the teacher opens.

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ReviewableActionListItem } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'
import type { BlueprintActionReviewSnapshot } from '@/lib/learnerBlueprint/actionPlan/review'
import BlueprintActionReviewList from './BlueprintActionReviewList'
import BlueprintActionOverview from './BlueprintActionOverview'
import AssignmentActivitySummary from './AssignmentActivitySummary'
import CompassActivitySummary from './CompassActivitySummary'
import EvidenceSummary from './EvidenceSummary'
import ProjectionSummary from './ProjectionSummary'
import ReviewHistory from './ReviewHistory'
import BlueprintReviewForm, { type BlueprintReviewFormSubmitResult } from './BlueprintReviewForm'

type DetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; snapshot: BlueprintActionReviewSnapshot }
  | { status: 'undelivered' }
  | { status: 'error'; message: string }

export default function BlueprintReviewWorkspace({
  items,
  initialSelectedActionId,
}: {
  items: ReviewableActionListItem[]
  /** Phase 3A deep-link (?action=<id>) — falls back to the first item exactly as before when absent or not found in `items`. */
  initialSelectedActionId?: string | null
}) {
  const router = useRouter()
  const preferredId = initialSelectedActionId && items.some(i => i.actionId === initialSelectedActionId) ? initialSelectedActionId : null
  const [selectedActionId, setSelectedActionId] = useState<string | null>(preferredId ?? items[0]?.actionId ?? null)
  const [detail, setDetail] = useState<DetailState>({ status: 'idle' })

  const loadSnapshot = useCallback(async (actionId: string) => {
    setDetail({ status: 'loading' })
    try {
      const res = await fetch(`/api/teacher/blueprint/actions/${actionId}/review`)
      if (res.status === 409) {
        setDetail({ status: 'undelivered' })
        return
      }
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setDetail({ status: 'error', message: body?.error ?? 'Could not load this action\'s review information.' })
        return
      }
      setDetail({ status: 'ready', snapshot: body.data.snapshot })
    } catch {
      setDetail({ status: 'error', message: 'A connection problem prevented this from loading. Please try again.' })
    }
  }, [])

  useEffect(() => {
    if (selectedActionId) loadSnapshot(selectedActionId)
    else setDetail({ status: 'idle' })
  }, [selectedActionId, loadSnapshot])

  function handleSelect(actionId: string) {
    setSelectedActionId(actionId)
  }

  function handleReviewSubmitted(result: BlueprintReviewFormSubmitResult) {
    // Instant feedback: the POST response already carries the fresh
    // snapshot (Phase 2D's route returns { review, snapshot }) — reflect it
    // immediately rather than waiting for a round trip.
    setDetail({ status: 'ready', snapshot: result.snapshot as BlueprintActionReviewSnapshot })
    // Revalidate the server-rendered overview list (latest-decision badges,
    // awaiting-review indicator) in the background.
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-4 items-start">
      <div>
        <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-2">Actions</h2>
        <BlueprintActionReviewList items={items} selectedActionId={selectedActionId} onSelect={handleSelect} />
      </div>

      <div className="space-y-3">
        {detail.status === 'idle' && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
            Select an action to review.
          </div>
        )}
        {detail.status === 'loading' && (
          <div role="status" aria-live="polite" className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">
            Loading…
          </div>
        )}
        {detail.status === 'undelivered' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-1">
            <p className="text-sm font-bold text-gray-900">This action has not been delivered yet.</p>
            <p className="text-xs text-gray-400">
              Deliver it to an Assignment or Learning Compass before a review can be recorded.
            </p>
          </div>
        )}
        {detail.status === 'error' && (
          <div role="alert" className="bg-white rounded-2xl border border-red-100 p-6 text-center space-y-2">
            <p className="text-sm font-bold text-red-700">{detail.message}</p>
            {selectedActionId && (
              <button
                type="button"
                onClick={() => loadSnapshot(selectedActionId)}
                className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                Try again
              </button>
            )}
          </div>
        )}
        {detail.status === 'ready' && (
          <>
            <BlueprintActionOverview action={detail.snapshot.actionItem} />
            <AssignmentActivitySummary assignment={detail.snapshot.assignment} />
            <CompassActivitySummary compass={detail.snapshot.compass} />
            <EvidenceSummary evidence={detail.snapshot.evidence} />
            <ProjectionSummary projection={detail.snapshot.projection} />
            <ReviewHistory reviews={detail.snapshot.previousReviews} />
            <BlueprintReviewForm actionId={detail.snapshot.actionItem.id} onSubmitted={handleReviewSubmitted} />
          </>
        )}
      </div>
    </div>
  )
}
