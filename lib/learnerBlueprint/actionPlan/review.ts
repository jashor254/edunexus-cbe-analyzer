// lib/learnerBlueprint/actionPlan/review.ts
//
// Teacher Review — Phase 2D of
// docs/architecture/blueprint-living-action-plan-audit.md (see
// docs/architecture/blueprint-review-loop-phase2d.md and
// docs/architecture/adr-0031-educational-actions-require-human-review.md).
// The final stage of the Blueprint execution cycle:
//
//   Evidence -> Projection -> Blueprint -> Teacher Approval -> Blueprint
//   Action -> Delivery -> Learner Interaction -> New Evidence -> Teacher
//   Review.
//
// `reviewBlueprintAction()` is the only place allowed to finalize a
// Blueprint action's review state. It never decides whether learning
// occurred — it gathers (never recomputes) the latest picture from
// Assignment, Compass, Evidence, and Projection, and records the teacher's
// own professional judgement as a new, immutable row. The system
// summarizes; the teacher concludes.
//
// Guardrails, enforced by construction (never a `.from('learner_evidence')`,
// `.from('learner_projections')`, `.from('assignments')`,
// `.from('assignment_submissions')`, `.from('compass_sessions')`, or
// `.from('student_learning_context')` write anywhere in this file — proven
// by the static guardrail scan in review.mapping.test.ts):
//   - Evidence: read-only, via lib/learnerRecord/timeline.ts's
//     getLearnerTimeline() — never persistEvidenceBatch or any evidence
//     writer.
//   - Projection: read-only, via lib/projection/recompute.ts's
//     getPersistedProjections() — never recomputeLearnerProjection(), which
//     has a write side effect this module must never trigger.
//   - Assignment: read-only, via repos.assignments.findByBlueprintActionItemId
//     + the new read-only repos.assignments.getSubmissionSummary() — never
//     an insert/update.
//   - Compass: read-only, via repos.blueprintCompassDeliveries + the new
//     read-only repos.compass.summarizeSessionsForSubject() — never a
//     session write, never setTeacherSuggestedTopic.
//
// Automatic completion is forbidden: nothing in this file (or anywhere
// else) may set a review decision except an explicit call to
// reviewBlueprintAction() with a teacher-supplied decision. Assignment
// submission, assignment grading, Compass completion, Compass inactivity,
// new evidence, and new projections are read here, never used to conclude
// a verdict on their own.

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuthentication, canManageLearnerRecordCore } from '@/lib/core/permissions'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { ResourceOwnershipError, NotFoundError, ConflictError } from '@/lib/core/errors'
import { getSchoolUser } from '@/lib/core/school-users'
import { repos } from '@/lib/repositories'
import type { BlueprintActionItemRow } from '@/lib/repositories/blueprintActionItem.repository'
import type { BlueprintActionHistoryEventType } from '@/lib/repositories/blueprintActionItemHistory.repository'
import type { BlueprintActionReviewDecision, BlueprintActionReviewRow } from '@/lib/repositories/blueprintActionReview.repository'
import { getLearnerTimeline } from '@/lib/learnerRecord/timeline'
import { getPersistedProjections } from '@/lib/projection/recompute'
import type { ProjectionRow } from '@/lib/repositories/projection.repository'

export type ReviewBlueprintActionCommand = {
  decision: BlueprintActionReviewDecision
  notes?: string
}

export type AssignmentReviewSnapshot =
  | { delivered: false }
  | {
      delivered: true
      assignmentId: string
      status: string
      completionLabel: 'no_roster' | 'not_started' | 'in_progress' | 'completed'
      total: number
      pending: number
      submitted: number
      marked: number
      averageScore: number | null
    }

export type CompassReviewSnapshot =
  | { delivered: false }
  | {
      delivered: true
      deliveryId: string
      subject: string
      /**
       * Phase 2.6 / G-08 — the EXACT answer to "did they do the intervention
       * I sent?".
       *
       * `deliveryStatus` is the intervention's own lifecycle
       * (available -> started -> completed) and `boundSessionId` is the one
       * Compass session that consumed it. Before these existed the closest
       * available answer was the subject-wide session count below, which
       * answers a different and much weaker question ("did they do any Maths
       * Compass?").
       *
       * `completed` here means the learner finished that session. It does
       * NOT mean the objective was mastered — the session's mastery claim is
       * still `pending_review` until this teacher confirms it, which is
       * exactly the judgement this review screen exists to support.
       */
      deliveryStatus: 'available' | 'started' | 'completed' | 'expired'
      boundSessionId: string | null
      /**
       * Subject-wide session activity, retained deliberately: it is still
       * useful context ("she has done four Maths sessions this term") and
       * removing it would change what existing consumers render. It is no
       * longer the only thing available, which was the actual problem.
       */
      sessionCount: number
      activeCount: number
      completedCount: number
      abandonedCount: number
      lastActivityAt: string | null
    }

export type EvidenceReviewSnapshot = {
  count: number
  latestAt: string | null
  latestSummary: string | null
}

export type ProjectionSnapshotEntry = {
  projectorType: string
  confidence: number
  freshnessDays: number | null
  lastComputed: string
}

export type ProjectionTrend = 'increased' | 'decreased' | 'unchanged' | 'no_prior_review' | 'no_projection'

export type ProjectionReviewSnapshot = {
  projections: ProjectionSnapshotEntry[]
  trend: ProjectionTrend
}

export type BlueprintActionReviewSnapshot = {
  actionItem: BlueprintActionItemRow
  assignment: AssignmentReviewSnapshot
  compass: CompassReviewSnapshot
  evidence: EvidenceReviewSnapshot
  projection: ProjectionReviewSnapshot
  previousReviews: BlueprintActionReviewRow[]
  latestDecision: BlueprintActionReviewDecision | 'awaiting_review'
}

export type ReviewBlueprintActionResult = {
  review: BlueprintActionReviewRow
  snapshot: BlueprintActionReviewSnapshot
}

const DECISION_TO_EVENT_TYPE: Record<BlueprintActionReviewDecision, BlueprintActionHistoryEventType> = {
  complete: 'review_completed',
  needs_revision: 'review_revision_requested',
  reopen: 'review_reopened',
  defer: 'review_deferred',
  no_decision: 'review_no_decision',
}

async function requireManageAccess(client: SupabaseClient, schoolId: string, learnerId: string): Promise<void> {
  const canManage = await canManageLearnerRecordCore(client, schoolId, learnerId)
  if (!canManage) throw new ResourceOwnershipError('You do not have permission to review this learner\'s Blueprint action plan.')
}

async function resolveActorSchoolUserId(userId: string, schoolId: string): Promise<string | null> {
  const schoolUser = await getSchoolUser(userId, schoolId).catch(() => null)
  return schoolUser?.id ?? null
}

/** Exported for pure unit testing (review.mapping.test.ts) — a deterministic label derivation, never a database call. */
export function summarizeAssignment(
  assignmentId: string,
  status: string,
  summary: { total: number; pending: number; submitted: number; marked: number; averageScore: number | null },
): AssignmentReviewSnapshot {
  const label = summary.total === 0
    ? 'no_roster'
    : summary.marked === summary.total
      ? 'completed'
      : summary.submitted + summary.marked > 0
        ? 'in_progress'
        : 'not_started'
  return { delivered: true, assignmentId, status, completionLabel: label, ...summary }
}

/** Most recent evidence entry's one-line summary — never a fabricated or recomputed claim, just a rendering of what getLearnerTimeline already returned. Exported for pure unit testing. */
export function summarizeLatestEvidence(entries: Awaited<ReturnType<typeof getLearnerTimeline>>): EvidenceReviewSnapshot {
  const evidenceEntries = entries.filter(e => e.kind === 'evidence')
  if (evidenceEntries.length === 0) return { count: 0, latestAt: null, latestSummary: null }
  const latest = evidenceEntries[evidenceEntries.length - 1]
  const parts = [latest.subject]
  if (latest.cbcLevel !== null) parts.push(`Level ${latest.cbcLevel}`)
  if (latest.score !== null) parts.push(`score ${latest.score}`)
  if (latest.body) parts.push(latest.body)
  return {
    count: evidenceEntries.length,
    latestAt: latest.date,
    latestSummary: parts.join(' — '),
  }
}

function toProjectionSnapshotEntries(rows: ProjectionRow[]): ProjectionSnapshotEntry[] {
  return rows.map(r => ({
    projectorType: r.projector_type,
    confidence: r.confidence,
    freshnessDays: r.freshness_days,
    lastComputed: r.last_computed,
  }))
}

/**
 * Compares the current projection confidence to the confidence recorded in
 * the most recent PRIOR review's own snapshot — a diff of two already-
 * computed numbers, never a recomputation. The "primary" projector is
 * whichever current projection has the highest evidence_count (the
 * dimension review has the most support for); if the prior review's
 * snapshot has no entry for that same projector type, no comparison is
 * possible. Exported for pure unit testing.
 */
export function deriveProjectionTrend(
  current: ProjectionSnapshotEntry[],
  currentRows: ProjectionRow[],
  previousReviews: BlueprintActionReviewRow[],
): ProjectionTrend {
  if (current.length === 0) return 'no_projection'
  if (previousReviews.length === 0) return 'no_prior_review'

  const primary = currentRows.reduce((best, r) => (r.evidence_count > best.evidence_count ? r : best), currentRows[0])
  const previousSnapshot = previousReviews[0].projection_snapshot as { projections?: ProjectionSnapshotEntry[] } | null
  const previousEntry = previousSnapshot?.projections?.find(p => p.projectorType === primary.projector_type)
  if (!previousEntry) return 'no_prior_review'

  const currentEntry = current.find(p => p.projectorType === primary.projector_type)
  if (!currentEntry) return 'no_projection'

  if (currentEntry.confidence > previousEntry.confidence) return 'increased'
  if (currentEntry.confidence < previousEntry.confidence) return 'decreased'
  return 'unchanged'
}

/**
 * Gathers the latest review picture for an approved, delivered Blueprint
 * action item — read-only, safe to call as often as needed (e.g. to render
 * the review screen before a teacher decides). `reviewBlueprintAction()`
 * calls this internally, then inserts a review row on top of it; this
 * function itself writes nothing.
 *
 * Throws {@link NotFoundError} / {@link ResourceOwnershipError} /
 * {@link ConflictError} identically to `reviewBlueprintAction()` — see its
 * doc comment for the full precondition list.
 */
export async function getBlueprintActionReviewSnapshot(
  client: SupabaseClient,
  actionItemId: string,
): Promise<BlueprintActionReviewSnapshot> {
  const action = await repos.blueprintActionItems.findById(actionItemId)
  if (!action) throw new NotFoundError('Blueprint action item not found.')

  await requireManageAccess(client, action.school_id, action.learner_id)

  if (action.status !== 'approved') {
    throw new ConflictError(`Blueprint action item ${actionItemId} has status "${action.status}" — only an approved, delivered action item may be reviewed.`)
  }

  const [assignment, compassDelivery, previousReviews] = await Promise.all([
    repos.assignments.findByBlueprintActionItemId(actionItemId),
    repos.blueprintCompassDeliveries.findByBlueprintActionItemId(actionItemId),
    repos.blueprintActionReviews.listForActionItem(actionItemId),
  ])

  if (!assignment && !compassDelivery) {
    throw new ConflictError(`Blueprint action item ${actionItemId} has not been delivered yet — nothing to review.`)
  }

  const assignmentSnapshot: AssignmentReviewSnapshot = assignment
    ? summarizeAssignment(assignment.id, assignment.status, await repos.assignments.getSubmissionSummary(assignment.id))
    : { delivered: false }

  let compassSnapshot: CompassReviewSnapshot = { delivered: false }
  if (compassDelivery) {
    const legacyStudentId = await resolveLegacyStudentId(action.learner_id)
    const sessionSummary = legacyStudentId
      ? await repos.compass.summarizeSessionsForSubject(legacyStudentId, compassDelivery.subject)
      : { sessionCount: 0, activeCount: 0, completedCount: 0, abandonedCount: 0, lastActivityAt: null }
    compassSnapshot = {
      delivered: true,
      deliveryId: compassDelivery.id,
      subject: compassDelivery.subject,
      deliveryStatus: compassDelivery.status,
      boundSessionId: compassDelivery.compass_session_id,
      ...sessionSummary,
    }
  }

  const legacyStudentIdForEvidence = await resolveLegacyStudentId(action.learner_id)
  const timeline = legacyStudentIdForEvidence ? await getLearnerTimeline(legacyStudentIdForEvidence) : []
  const evidenceSnapshot = summarizeLatestEvidence(timeline)

  const projectionRows = legacyStudentIdForEvidence ? await getPersistedProjections(legacyStudentIdForEvidence) : []
  const projectionEntries = toProjectionSnapshotEntries(projectionRows)
  const projectionSnapshot: ProjectionReviewSnapshot = {
    projections: projectionEntries,
    trend: deriveProjectionTrend(projectionEntries, projectionRows, previousReviews),
  }

  return {
    actionItem: action,
    assignment: assignmentSnapshot,
    compass: compassSnapshot,
    evidence: evidenceSnapshot,
    projection: projectionSnapshot,
    previousReviews,
    latestDecision: previousReviews[0]?.decision ?? 'awaiting_review',
  }
}

/**
 * Records a teacher's professional judgement on a delivered Blueprint
 * action item — the only function in this codebase allowed to write a
 * review verdict. Never decides whether learning occurred; only presents
 * (via {@link getBlueprintActionReviewSnapshot}) and records.
 *
 * Preconditions (throws on the first one violated):
 *  - `UnauthorizedError` — no authenticated session.
 *  - `NotFoundError` — no action item with this id.
 *  - `ResourceOwnershipError` — the actor may not manage this learner's
 *    Blueprint record.
 *  - `ConflictError` — the action's status is not `approved`, or it has
 *    never been delivered to Assignment or Compass.
 *
 * Exactly five decisions are accepted (enforced by
 * {@link BlueprintActionReviewDecision} and the DB CHECK constraint):
 * `complete`, `needs_revision`, `reopen`, `defer`, `no_decision`. There is
 * no automatic-success path — every row this function inserts was an
 * explicit teacher choice.
 *
 * A review is repeatable: calling this again for the same action item
 * inserts a NEW row (never updates/overwrites a prior one — the DB trigger
 * would reject an update anyway) — "Reopen" is precisely this: a review
 * that sends the learner back to work, followed later by another review.
 */
export async function reviewBlueprintAction(
  client: SupabaseClient,
  actionItemId: string,
  command: ReviewBlueprintActionCommand,
): Promise<ReviewBlueprintActionResult> {
  const user = await requireAuthentication(client)

  const snapshot = await getBlueprintActionReviewSnapshot(client, actionItemId)
  const action = snapshot.actionItem

  const actorId = await resolveActorSchoolUserId(user.id, action.school_id)

  const review = await repos.blueprintActionReviews.insert({
    learner_id: action.learner_id,
    school_id: action.school_id,
    blueprint_action_item_id: actionItemId,
    decision: command.decision,
    notes: command.notes?.trim() || null,
    assignment_snapshot: snapshot.assignment,
    compass_snapshot: snapshot.compass,
    evidence_snapshot: snapshot.evidence,
    projection_snapshot: snapshot.projection,
    reviewed_by: actorId,
  })

  await recordReviewHistory(action, review, actorId)

  return {
    review,
    snapshot: { ...snapshot, previousReviews: [review, ...snapshot.previousReviews], latestDecision: review.decision },
  }
}

/**
 * A review is recorded as an event, not overloaded into the action item's
 * own `status` — the item remains `approved` (the trigger would reject
 * anything else anyway). Failure here is logged, not thrown: the review row
 * (the durable verdict) is already committed by this point, so a
 * history-write failure loses only a convenience audit-log entry,
 * recoverable by re-deriving from `blueprint_action_reviews` directly — the
 * same documented, deliberate choice Phase 2B/2C made for delivery history.
 */
async function recordReviewHistory(
  action: BlueprintActionItemRow,
  review: BlueprintActionReviewRow,
  actorId: string | null,
): Promise<void> {
  try {
    await repos.blueprintActionItemHistory.record({
      action_item_id: action.id,
      event_type: DECISION_TO_EVENT_TYPE[review.decision],
      previous_status: action.status,
      resulting_status: action.status, // Unchanged — a review verdict is never "action completed" at the lifecycle-status level.
      snapshot: action,
      actor_id: actorId,
      reason: review.notes,
    })
  } catch (err) {
    console.error('[blueprint/review] failed to record review history:', err instanceof Error ? err.message : String(err))
  }
}
