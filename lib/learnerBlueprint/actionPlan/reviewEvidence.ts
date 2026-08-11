// lib/learnerBlueprint/actionPlan/reviewEvidence.ts
//
// Adaptive Remediation Phase 1, Stage 4 — the teacher's professional
// judgement on a delivered intervention, entering the Evidence Domain.
//
// WHY THIS FILE EXISTS RATHER THAN A WRITE INSIDE review.ts
// `reviewBlueprintAction()` is deliberately forbidden from writing evidence
// (ADR-0031, and a static guardrail scan in review.mapping.test.ts proves
// it). That guardrail is correct and is preserved untouched: this producer
// is called from the API route AFTER a review has already been recorded
// successfully, exactly as every other orchestration-layer Evidence
// producer in the codebase is (see app/api/student/submit-quiz/route.ts and
// app/api/teacher/assignments/[id]/mark/route.ts).
//
// ── WHAT IS AND IS NOT CLAIMED ──────────────────────────────────────────
//
// "Completed" and "worked" are different claims, and this file never
// conflates them.
//
//   score:    null
//   cbcLevel: null
//
// Both are null ON PURPOSE and must stay that way. A teacher marking an
// action `complete` is saying "this piece of work is finished and I am
// satisfied with how it went" — they are NOT saying "this learner is now at
// Level 3". Deriving a CBC level here would invent mastery out of a
// workflow verdict, which is precisely the failure mode this stage was
// written to avoid. Because `cbc_level` is null, `academicProjector` skips
// this row entirely (it filters on `cbc_level !== null`) and no learner's
// academic level can move by a single point because of it. What the row
// DOES reach is `behaviourProjector`, which counts real observations and
// their distinct sources — the honest home for "a teacher reviewed a
// delivered intervention and reached a verdict".
//
// ── WHICH DECISIONS QUALIFY ─────────────────────────────────────────────
//
// Not every workflow click is educational evidence. Of the five decisions:
//
//   complete        → EVIDENCE. An instructional outcome judgement.
//   needs_revision  → EVIDENCE. Also an outcome judgement, negative — that
//                     the approach did not do its job is exactly as
//                     educationally meaningful as that it did, and a
//                     record that only ever captured successes would be a
//                     biased learner record.
//   reopen          → no evidence. Workflow: put it back in play.
//   defer           → no evidence. Scheduling.
//   no_decision     → no evidence. Explicitly no judgement to record.
//
// ── WHICH ACTIONS QUALIFY ───────────────────────────────────────────────
//
// Only actions that were actually DELIVERED to the learner, as an
// assignment or to Compass. An action reviewed without ever having reached
// the learner has no instructional outcome to observe, and the delivery is
// also the only place a real `subject` exists (a Blueprint action carries a
// sub-strand and a free-text capability, never a subject column) — so a
// non-delivered action is skipped rather than given a guessed subject.
//
// Trust tier 2 via `classroom_observation`, mirroring
// lib/remedial/interventionEvidence.ts exactly: a teacher attesting to
// something they reviewed, not something they personally administered and
// scored (that would be tier 3, teacher_upload).

import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import type { BlueprintActionReviewDecision } from '@/lib/repositories/blueprintActionReview.repository'

const SOURCE = 'classroom_observation' as const
export const REVIEW_EXTRACTION_METHOD = 'blueprint_action_review_v1' as const

/** The only two decisions that are instructional outcome judgements rather than workflow. */
const JUDGEMENT_DECISIONS: ReadonlySet<BlueprintActionReviewDecision> = new Set(['complete', 'needs_revision'])

export function isInstructionalJudgement(decision: BlueprintActionReviewDecision): boolean {
  return JUDGEMENT_DECISIONS.has(decision)
}

export type BlueprintActionReviewEvidenceInput = {
  actionItemId: string
  /** Core learner id, as held on the action item — resolved to the legacy id Evidence keys on. */
  coreLearnerId: string
  decision: BlueprintActionReviewDecision
  notes: string | null
  /** The review row's own id — the artifact this observation describes. */
  reviewId: string
  /** Auth user id of the reviewing teacher — the ingestion run's initiator. */
  reviewedByUserId: string
  /** `teachers.id`, when the reviewer maps to one. Null for a non-teacher school role with review rights. */
  teacherId: string | null
  academicYear: number
  term: number | null
}

/**
 * Emits one non-scored `classroom_observation` for a teacher's verdict on a
 * delivered Blueprint action. Returns `false` (without writing) whenever the
 * decision is not an instructional judgement, the learner cannot be
 * resolved, or the action was never delivered — all three are ordinary,
 * expected outcomes, not errors.
 */
export async function recordBlueprintActionReviewEvidence(
  input: BlueprintActionReviewEvidenceInput,
): Promise<boolean> {
  if (!isInstructionalJudgement(input.decision)) return false

  const legacyStudentId = await resolveLegacyStudentId(input.coreLearnerId)
  if (!legacyStudentId) return false

  // Subject + curriculum anchor come from the real delivery, never guessed.
  const [assignment, compassDelivery] = await Promise.all([
    repos.assignments.findByBlueprintActionItemId(input.actionItemId),
    repos.blueprintCompassDeliveries.findByBlueprintActionItemId(input.actionItemId),
  ])

  const subject = assignment?.subject ?? compassDelivery?.subject ?? null
  if (!subject) return false

  const actionItem = await repos.blueprintActionItems.findById(input.actionItemId)
  const subStrandId = assignment?.substrand_id ?? actionItem?.sub_strand_id ?? null

  const confidence = computeConfidence({
    identityConfidence: 100,   // the learner is already resolved from the action item
    identityMatchType: 'external_id',
    fieldIssueCount: 0,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)
  const importedAt = new Date().toISOString()

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: input.reviewedByUserId,
    teacherId: input.teacherId,
    institution: null,
  })

  const evidence: LearnerEvidence = {
    learnerId: legacyStudentId,
    extractedName: '',
    extractedExternalId: null,
    subject,
    rawSubject: subject,
    // Both null, permanently — see this file's header. A verdict on an
    // intervention is not a measurement of the learner.
    score: null,
    cbcLevel: null,
    // No enum member means "intervention review"; 'assignment' (a completed
    // piece of learning work) is the closest of the three allowed values,
    // the same choice lib/compass/evidence.ts makes for the same reason.
    assessmentType: 'assignment',
    academicYear: input.academicYear,
    term: input.term,
    evidenceSource: SOURCE,
    trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
    evidenceConfidence: confidence,
    extractionMethod: REVIEW_EXTRACTION_METHOD,
    reviewStatus,
    rawInputRef: `blueprint_action_review:${input.reviewId}:action=${input.actionItemId}:decision=${input.decision}`,
    importedAt,
    issues: [],
    strand: null,
    subStrand: null,
    // The curriculum identity the action targeted, when it had one — so a
    // verdict on proportional-reasoning work is attached to proportional
    // reasoning and not merely to "Mathematics". Null is left null.
    subStrandId,
  }

  const result = await persistEvidenceBatch([evidence], runId)

  await repos.evidence.completeIngestionRun(runId, {
    recordCount: 1,
    confirmedCount: result.confirmedCount,
    pendingReviewCount: result.pendingReviewCount,
    rejectedCount: 0,
    processingDurationMs: 0,
  })

  return true
}
