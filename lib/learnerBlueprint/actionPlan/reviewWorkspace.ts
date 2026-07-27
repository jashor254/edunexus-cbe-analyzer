// lib/learnerBlueprint/actionPlan/reviewWorkspace.ts
//
// Teacher Review Workspace — Phase 2E of
// docs/architecture/blueprint-living-action-plan-audit.md (see
// docs/architecture/blueprint-teacher-review-workspace-phase2e.md). A
// thin, learner-scoped, read-only list model over the Phase 2D review
// service — never a second review engine.
//
// This file answers exactly one question the Phase 2D snapshot cannot:
// "which of this learner's approved action items deserve a teacher's
// attention right now," across possibly many action items at once,
// without throwing on an action that has never been delivered (the
// snapshot's `getBlueprintActionReviewSnapshot` intentionally throws
// ConflictError for that case — correct for a single-action detail view,
// wrong for a list that must show "not yet delivered" as a normal,
// non-error state). The full per-action detail (Assignment/Compass/
// Evidence/Projection/history) is still read exclusively through
// `getBlueprintActionReviewSnapshot()` — this file never reimplements
// that gathering, only a cheaper, list-shaped existence/freshness check
// reused once per learner (never once per action item) for Evidence and
// Projection, since both are learner-scoped, not action-item-scoped.
//
// Guardrails identical to review.ts: read-only, never writes evidence,
// projections, assignments, or Compass sessions; never writes a review.

import type { SupabaseClient } from '@supabase/supabase-js'
import { canManageLearnerRecordCore } from '@/lib/core/permissions'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { repos } from '@/lib/repositories'
import { getLearnerTimeline } from '@/lib/learnerRecord/timeline'
import { getPersistedProjections } from '@/lib/projection/recompute'
import type { BlueprintActionReviewDecision } from '@/lib/repositories/blueprintActionReview.repository'

export type ReviewableActionListItem = {
  actionId: string
  title: string
  intendedOutcome: string
  // Added in Phase 3A (docs/architecture/blueprint-execution-experience-
  // phase3a.md) — both already read off the same `blueprint_action_items`
  // row this function already fetches, zero new query. Needed by the
  // Blueprint Action Plan card, which shows the learner-facing action text
  // and success indicator directly (the Review Workspace's own detail
  // panel already shows these via the full snapshot; the Action Plan
  // card needs them at list-render time too, without paying for a full
  // per-action snapshot fetch just to show two more strings).
  learnerAction: string | null
  successIndicator: string
  approvalStatus: 'approved' // reviewable actions are always approved — see repos.blueprintActionItems.listApprovedForLearner
  reviewDate: string | null
  assignmentDelivered: boolean
  // Added in Phase 3A — lets the Blueprint Action Plan card link straight
  // to the existing assignment page (`/teacher/assignments/[assignmentId]`)
  // on a page reload, not only immediately after a delivery response.
  assignmentId: string | null
  compassDelivered: boolean
  latestDecision: BlueprintActionReviewDecision | 'awaiting_review'
  latestReviewAt: string | null
  // Added in Phase 3A — the Action Plan card shows a concise excerpt of the
  // latest review's own note (never re-fetched via a second call; it's
  // already the same row `latestReview` below is read from).
  latestReviewNotes: string | null
  reviewCount: number
  lastActivityAt: string | null
  awaitingReview: boolean
}

async function requireManageAccess(client: SupabaseClient, schoolId: string, learnerId: string): Promise<void> {
  const canManage = await canManageLearnerRecordCore(client, schoolId, learnerId)
  if (!canManage) throw new ResourceOwnershipError('You do not have permission to review this learner\'s Blueprint action plan.')
}

/**
 * The exact awaiting-review rule (documented in
 * docs/architecture/blueprint-teacher-review-workspace-phase2e.md §8):
 * an action is awaiting review if
 *   (a) it has never been reviewed, OR
 *   (b) its review date has arrived/passed and no review has happened
 *       since that date, OR
 *   (c) Assignment/Compass/Evidence/Projection activity is newer than the
 *       most recent review.
 * This is a pure presentation rule — it never reads or writes any
 * persisted "awaiting" state, and it never concludes success or failure.
 */
export function computeAwaitingReview(input: {
  today: string
  reviewDate: string | null
  latestReviewAt: string | null
  assignmentUpdatedAt: string | null
  compassLastActivityAt: string | null
  latestEvidenceAt: string | null
  latestProjectionComputedAt: string | null
}): boolean {
  if (!input.latestReviewAt) return true
  const latestReviewMs = new Date(input.latestReviewAt).getTime()

  if (input.reviewDate) {
    const reviewDateMs = new Date(input.reviewDate).getTime()
    if (reviewDateMs <= new Date(input.today).getTime() && reviewDateMs > latestReviewMs) return true
  }

  const isNewerThanLatestReview = (ts: string | null): boolean => ts !== null && new Date(ts).getTime() > latestReviewMs
  return (
    isNewerThanLatestReview(input.assignmentUpdatedAt) ||
    isNewerThanLatestReview(input.compassLastActivityAt) ||
    isNewerThanLatestReview(input.latestEvidenceAt) ||
    isNewerThanLatestReview(input.latestProjectionComputedAt)
  )
}

function latestOf(...timestamps: Array<string | null>): string | null {
  return timestamps.reduce<string | null>((latest, ts) => {
    if (!ts) return latest
    if (!latest || ts > latest) return ts
    return latest
  }, null)
}

/**
 * Every approved Blueprint action item for one learner, shaped for the
 * review-workspace overview list — never the full Phase 2D snapshot (that
 * stays scoped to one action at a time, fetched on selection). Evidence and
 * Projection freshness are read ONCE for the whole learner and reused
 * across every action item's awaiting-review computation, since both are
 * learner-scoped, not action-item-scoped — avoiding an N-times-redundant
 * read for a learner with several action items.
 *
 * Throws identically to `getBlueprintActionReviewSnapshot` for
 * authorization; never throws for "not yet delivered" — that is a normal
 * list row state (`assignmentDelivered: false, compassDelivered: false`).
 */
export async function listReviewableBlueprintActionsForLearner(
  client: SupabaseClient,
  learnerId: string,
): Promise<ReviewableActionListItem[]> {
  const schoolId = await repos.learners.findSchoolId(learnerId)
  await requireManageAccess(client, schoolId, learnerId)

  const actions = await repos.blueprintActionItems.listApprovedForLearner(learnerId, schoolId)
  if (actions.length === 0) return []

  const legacyStudentId = await resolveLegacyStudentId(learnerId)
  const [timeline, projections] = await Promise.all([
    legacyStudentId ? getLearnerTimeline(legacyStudentId) : Promise.resolve([]),
    legacyStudentId ? getPersistedProjections(legacyStudentId) : Promise.resolve([]),
  ])
  const latestEvidenceAt = latestOf(...timeline.filter(e => e.kind === 'evidence').map(e => e.date))
  const latestProjectionComputedAt = latestOf(...projections.map(p => p.last_computed))

  const today = new Date().toISOString()

  return Promise.all(actions.map(async (action): Promise<ReviewableActionListItem> => {
    const [assignment, compassDelivery, reviews] = await Promise.all([
      repos.assignments.findByBlueprintActionItemId(action.id),
      repos.blueprintCompassDeliveries.findByBlueprintActionItemId(action.id),
      repos.blueprintActionReviews.listForActionItem(action.id),
    ])

    const assignmentActivityAt = assignment ? await repos.assignments.getLatestSubmissionActivityAt(assignment.id) : null

    let compassLastActivityAt: string | null = null
    if (compassDelivery && legacyStudentId) {
      const sessionSummary = await repos.compass.summarizeSessionsForSubject(legacyStudentId, compassDelivery.subject)
      compassLastActivityAt = sessionSummary.lastActivityAt
    }

    const latestReview = reviews[0] ?? null

    return {
      actionId: action.id,
      title: action.title,
      intendedOutcome: action.intended_outcome,
      learnerAction: action.learner_action,
      successIndicator: action.success_indicator,
      approvalStatus: 'approved',
      reviewDate: action.review_date,
      assignmentDelivered: assignment !== null,
      assignmentId: assignment?.id ?? null,
      compassDelivered: compassDelivery !== null,
      latestDecision: latestReview?.decision ?? 'awaiting_review',
      latestReviewAt: latestReview?.created_at ?? null,
      latestReviewNotes: latestReview?.notes ?? null,
      reviewCount: reviews.length,
      lastActivityAt: latestOf(assignmentActivityAt, compassLastActivityAt, latestEvidenceAt, latestProjectionComputedAt),
      awaitingReview: computeAwaitingReview({
        today,
        reviewDate: action.review_date,
        latestReviewAt: latestReview?.created_at ?? null,
        assignmentUpdatedAt: assignmentActivityAt,
        compassLastActivityAt,
        latestEvidenceAt,
        latestProjectionComputedAt,
      }),
    }
  }))
}
