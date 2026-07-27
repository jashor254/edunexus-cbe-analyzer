// components/blueprint/review/BlueprintActionOverview.tsx
//
// Renders the "Approved action" section — the immutable Blueprint action
// item itself (Phase 2E). Only teacher-safe fields: title, learnerAction,
// intendedOutcome, successIndicator, reviewDate. Deliberately never
// renders `teacherNotes` (private), `parentSupport` (parent-facing, not
// established as teacher-visible-by-default here), `evidenceBasis`, or
// any raw internal identifiers — mirroring the exact field-leakage
// guardrail Phase 2B/2C's own content-mapping functions already enforce.
//
// "Approval status" and "Latest review" are deliberately two separate,
// separately labeled pieces of UI (see BlueprintActionReviewCard /
// BlueprintReviewWorkspace) — this component never conflates the two.

import type { BlueprintActionItemRow } from '@/lib/repositories/blueprintActionItem.repository'
import { formatDate } from './reviewFormatting'

export default function BlueprintActionOverview({ action }: { action: BlueprintActionItemRow }) {
  return (
    <section aria-labelledby="action-overview-heading" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 id="action-overview-heading" className="text-base font-black text-gray-900">{action.title}</h2>
        <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-lg bg-teal-100 text-teal-700">
          <span className="sr-only">Approval status: </span>Approved
        </span>
      </div>
      {action.learner_action && (
        <p className="text-sm text-gray-700"><span className="font-bold">Learner action: </span>{action.learner_action}</p>
      )}
      <p className="text-sm text-gray-700"><span className="font-bold">Intended outcome: </span>{action.intended_outcome}</p>
      <p className="text-sm text-gray-700"><span className="font-bold">Success indicator: </span>{action.success_indicator}</p>
      {action.review_date && (
        <p className="text-sm text-gray-500"><span className="font-bold text-gray-600">Review date: </span>{formatDate(action.review_date)}</p>
      )}
    </section>
  )
}
