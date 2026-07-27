// components/blueprint/review/EvidenceSummary.tsx
//
// Renders the "Recent Evidence" section of a Blueprint action review
// snapshot (Phase 2E), from `getBlueprintActionReviewSnapshot()`'s
// `evidence` field only — never a raw `learner_evidence` query, never a
// second Evidence read. Shows exactly what the snapshot already
// summarized (source/date/one-line content); no raw payload or audit
// metadata is exposed because the snapshot itself never carries any.

import type { EvidenceReviewSnapshot } from '@/lib/learnerBlueprint/actionPlan/review'
import { formatDate } from './reviewFormatting'

export default function EvidenceSummary({ evidence }: { evidence: EvidenceReviewSnapshot }) {
  return (
    <section aria-labelledby="evidence-summary-heading" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
      <h3 id="evidence-summary-heading" className="text-xs font-black text-gray-900 uppercase tracking-wide">Recent Evidence</h3>
      {evidence.count === 0 ? (
        <p className="text-sm text-gray-500">No Evidence recorded for this learner yet.</p>
      ) : (
        <div className="space-y-1.5 text-sm">
          <p className="text-gray-900">{evidence.latestSummary}</p>
          <p className="text-gray-500">
            Observed {formatDate(evidence.latestAt)} · {evidence.count} evidence record{evidence.count === 1 ? '' : 's'} on file
          </p>
        </div>
      )}
    </section>
  )
}
