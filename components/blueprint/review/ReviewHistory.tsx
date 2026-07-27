// components/blueprint/review/ReviewHistory.tsx
//
// Renders previous educator reviews for one Blueprint action item, in
// chronological order (Phase 2E). Read-only, presentation-only — the
// underlying `blueprint_action_reviews` rows are append-only at the
// database level (Phase 2D); this component has no edit/delete affordance
// because none exists to offer.
//
// Reviewer identity: the Phase 2D snapshot only carries `reviewed_by` as a
// `school_users.id` — resolving it to a display name would require a new
// cross-table read (school_users -> teachers) whose only consumer would be
// this decorative label. Deliberately deferred rather than added here (see
// docs/architecture/blueprint-teacher-review-workspace-phase2e.md) — shown
// as a generic, honest "Recorded by school staff" instead of fabricating
// or omitting the field entirely.

import type { BlueprintActionReviewRow } from '@/lib/repositories/blueprintActionReview.repository'
import { DECISION_LABEL, DECISION_BADGE_CLASS, formatDateTime } from './reviewFormatting'

export default function ReviewHistory({ reviews }: { reviews: BlueprintActionReviewRow[] }) {
  // previousReviews from the snapshot is newest-first — display oldest-first
  // so the history reads top-to-bottom as it happened.
  const chronological = [...reviews].reverse()

  return (
    <section aria-labelledby="review-history-heading" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
      <h3 id="review-history-heading" className="text-xs font-black text-gray-900 uppercase tracking-wide">Previous Reviews</h3>
      {chronological.length === 0 ? (
        <p className="text-sm text-gray-500">No reviews recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {chronological.map(review => (
            <li key={review.id} className="text-sm border-l-2 border-gray-100 pl-3 py-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-lg ${DECISION_BADGE_CLASS[review.decision]}`}>
                  {DECISION_LABEL[review.decision]}
                </span>
                <span className="text-xs text-gray-400">{formatDateTime(review.created_at)}</span>
              </div>
              {review.notes && <p className="text-gray-700 mt-1">{review.notes}</p>}
              <p className="text-xs text-gray-400 mt-0.5">Recorded by school staff</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
