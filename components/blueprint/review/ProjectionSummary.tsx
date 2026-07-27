// components/blueprint/review/ProjectionSummary.tsx
//
// Renders the "Current Projection" section of a Blueprint action review
// snapshot (Phase 2E), from `getBlueprintActionReviewSnapshot()`'s
// `projection` field only — persisted Projection values, never recomputed
// or invented in the UI. Confidence is shown as a category (Low/Moderate/
// High), not a bare percentage presented as certainty — the numeric
// confidence itself is real, already-computed data (`learner_projections
// .confidence`), but bucketing it and pairing it with the caveat below
// keeps this from reading as a precision the number doesn't carry.

import type { ProjectionReviewSnapshot, ProjectionSnapshotEntry } from '@/lib/learnerBlueprint/actionPlan/review'
import { formatDate } from './reviewFormatting'

function confidenceCategory(confidence: number): 'Low' | 'Moderate' | 'High' {
  if (confidence >= 70) return 'High'
  if (confidence >= 40) return 'Moderate'
  return 'Low'
}

const TREND_COPY: Record<ProjectionReviewSnapshot['trend'], string> = {
  increased: 'Confidence has increased since the last review.',
  decreased: 'Confidence has decreased since the last review.',
  unchanged: 'Confidence is unchanged since the last review.',
  no_prior_review: 'No prior review to compare against yet.',
  no_projection: 'No projection is available for this dimension yet.',
}

function ProjectionRow({ entry }: { entry: ProjectionSnapshotEntry }) {
  return (
    <li className="text-sm space-y-0.5 py-1.5 first:pt-0 last:pb-0 border-b border-gray-50 last:border-0">
      <p className="font-bold text-gray-900 capitalize">{entry.projectorType}</p>
      <p className="text-gray-600">Confidence: {confidenceCategory(entry.confidence)}</p>
      <p className="text-gray-500">
        Last computed {formatDate(entry.lastComputed)}
        {entry.freshnessDays !== null && ` · ${entry.freshnessDays} day${entry.freshnessDays === 1 ? '' : 's'} old`}
      </p>
    </li>
  )
}

export default function ProjectionSummary({ projection }: { projection: ProjectionReviewSnapshot }) {
  return (
    <section aria-labelledby="projection-summary-heading" className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
      <h3 id="projection-summary-heading" className="text-xs font-black text-gray-900 uppercase tracking-wide">Current Projection</h3>
      {projection.projections.length === 0 ? (
        <p className="text-sm text-gray-500">No projection is available for this learner yet.</p>
      ) : (
        <>
          <ul>
            {projection.projections.map(entry => <ProjectionRow key={entry.projectorType} entry={entry} />)}
          </ul>
          <p className="text-xs text-gray-500">{TREND_COPY[projection.trend]}</p>
        </>
      )}
      <p className="text-xs text-gray-400 italic">
        Reflects computed confidence based on available evidence — not a determination of success.
      </p>
    </section>
  )
}
