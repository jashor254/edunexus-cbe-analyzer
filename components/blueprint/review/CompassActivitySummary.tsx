// components/blueprint/review/CompassActivitySummary.tsx
//
// Renders the Compass-delivery section of a Blueprint action review
// snapshot (Phase 2E). Presentation only, from
// `getBlueprintActionReviewSnapshot()`'s `compass` field. Deliberately
// shows only session counts and dates — never raw model prompts, session
// transcripts, or unrelated conversation content, none of which the
// snapshot exposes in the first place (see review.ts's own guardrails).

import type { CompassReviewSnapshot } from '@/lib/learnerBlueprint/actionPlan/review'
import { formatDateTime } from './reviewFormatting'

export default function CompassActivitySummary({ compass }: { compass: CompassReviewSnapshot }) {
  return (
    <section aria-labelledby="compass-summary-heading" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
      <h3 id="compass-summary-heading" className="text-xs font-black text-gray-900 uppercase tracking-wide">Learning Compass</h3>
      {!compass.delivered ? (
        <p className="text-sm text-gray-500">Not yet delivered to Learning Compass.</p>
      ) : (
        <div className="space-y-1.5 text-sm">
          <p className="font-bold text-gray-900">Queued objective — {compass.subject}</p>
          <p className="text-gray-600">
            {compass.sessionCount === 0
              ? 'No learner activity recorded yet.'
              : `${compass.sessionCount} session${compass.sessionCount === 1 ? '' : 's'} — ${compass.completedCount} completed, ${compass.activeCount} active, ${compass.abandonedCount} abandoned`}
          </p>
          {compass.lastActivityAt && (
            <p className="text-gray-500">Last activity: {formatDateTime(compass.lastActivityAt)}</p>
          )}
        </div>
      )}
    </section>
  )
}
