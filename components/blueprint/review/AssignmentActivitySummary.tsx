// components/blueprint/review/AssignmentActivitySummary.tsx
//
// Renders the Assignment-delivery section of a Blueprint action review
// snapshot (Phase 2E). Presentation only — every value comes straight from
// `getBlueprintActionReviewSnapshot()`'s `assignment` field; this component
// never fetches, computes, or infers anything. It never claims the learner
// "succeeded" — completion/marking counts are shown as activity, not a
// verdict (that distinction is the teacher's, made in the review form).

import type { AssignmentReviewSnapshot } from '@/lib/learnerBlueprint/actionPlan/review'

const COMPLETION_LABEL: Record<string, string> = {
  no_roster: 'No students on the roster yet',
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'All submissions marked',
}

export default function AssignmentActivitySummary({ assignment }: { assignment: AssignmentReviewSnapshot }) {
  return (
    <section aria-labelledby="assignment-summary-heading" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
      <h3 id="assignment-summary-heading" className="text-xs font-black text-gray-900 uppercase tracking-wide">Assignment</h3>
      {!assignment.delivered ? (
        <p className="text-sm text-gray-500">Not yet delivered as an assignment.</p>
      ) : (
        <div className="space-y-1.5 text-sm">
          <p className="font-bold text-gray-900">
            <span className="sr-only">Delivery status: </span>Delivered
          </p>
          <p className="text-gray-600">
            {COMPLETION_LABEL[assignment.completionLabel] ?? assignment.completionLabel}
            {' — '}{assignment.submitted + assignment.marked} of {assignment.total || 0} submitted, {assignment.marked} marked
          </p>
          {assignment.averageScore !== null && (
            <p className="text-gray-500">Average marked score: {Math.round(assignment.averageScore)}</p>
          )}
          <a
            href={`/teacher/assignments/${assignment.assignmentId}`}
            className="inline-block text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            View assignment →
          </a>
        </div>
      )}
    </section>
  )
}
