// components/blueprint/review/reviewFormatting.ts
//
// Small, pure, presentation-only formatting helpers shared by the Teacher
// Review Workspace components (Phase 2E). No data fetching, no domain
// logic — these only turn already-computed values into display strings.
// Kept out of individual components so each stays small and testable in
// isolation, per the task brief's component-design instruction.

import type { BlueprintActionReviewDecision } from '@/lib/repositories/blueprintActionReview.repository'

export type LatestReviewLabel = BlueprintActionReviewDecision | 'awaiting_review'

export const DECISION_LABEL: Record<LatestReviewLabel, string> = {
  complete: 'Complete',
  needs_revision: 'Needs Revision',
  reopen: 'Reopen',
  defer: 'Defer',
  no_decision: 'No Decision',
  awaiting_review: 'Awaiting Review',
}

/** Tailwind pill classes per decision — color is always paired with the text label above (DECISION_LABEL), never used alone to convey meaning. */
export const DECISION_BADGE_CLASS: Record<LatestReviewLabel, string> = {
  complete: 'bg-green-100 text-green-700',
  needs_revision: 'bg-amber-100 text-amber-700',
  reopen: 'bg-blue-100 text-blue-700',
  defer: 'bg-gray-100 text-gray-600',
  no_decision: 'bg-gray-100 text-gray-600',
  awaiting_review: 'bg-orange-100 text-orange-700',
}

const NOTE_REQUIRED: Record<BlueprintActionReviewDecision, boolean> = {
  complete: true,
  needs_revision: true,
  reopen: true,
  defer: true,
  no_decision: false,
}

export function isNoteRequiredForDecision(decision: BlueprintActionReviewDecision): boolean {
  return NOTE_REQUIRED[decision]
}

/** `'en-KE'` medium date style — the convention already used on the Blueprint pages this workspace sits alongside. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-KE', { dateStyle: 'medium' })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
}
