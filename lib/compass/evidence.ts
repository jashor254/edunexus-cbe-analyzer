// lib/compass/evidence.ts
// Emits Evidence for a completed/abandoned Compass session, per Phase 4 of
// docs/architecture/migration-ledger.md: Compass is moving from writing
// learner intelligence directly (lib/learnerModel/updater.ts:updateFromCompass)
// to emitting Evidence like every other source, so the Behaviour Projector
// (lib/projection/behaviourProjector.ts — dormant today, no source produces
// 'compass_session' evidence yet) can finally activate.
//
// This is a DUAL-WRITE, not a replacement: updateFromCompass's write into
// learner_profiles is intentionally left in place this phase because
// several deferred consumers (Holiday Planner, Parent Pulse, Remedial
// Planner, Monday Panel, Prerequisite Readiness — see the ledger) still
// depend on it. EXIT CONDITION: once every one of those consumers has
// migrated to the Projection Engine, delete the learner_profiles write in
// updateFromCompass and this becomes Compass's only write path.
//
// Trust tier 1 (AI-inferred, per LI-3) caps confidence at 60, below the 85
// auto-confirm threshold — every claim below always lands pending_review at
// creation, same as any other tier-1 source. That's correct, not a bug: a
// Compass session is not teacher-verified evidence. (Conservative, narrowly
// -scoped auto-confirmation for the "engagement" claim only happens later,
// as a separate reviewed_confirmed transition — see lib/compass/autoConfirm.ts.)
//
// Two distinct claim shapes per session, per Compass v2 Wave 2 Phase 9 — the
// LearnerEvidence type has no dedicated "claim type" field (and adding one
// would mean changing the shared Evidence Domain shape every ingestion source
// uses, which this phase does not do), so `extractionMethod` is the existing,
// semantically-correct field used to distinguish them: it already means
// "which extraction method/version produced this record," and an engagement
// observation and an AI-judged mastery observation genuinely are two
// different derivations from the same session.
//
// - engagement: always emitted for any session with at least one exchange.
//   A behavioural/completion fact (session happened, ran this long, this many
//   exchanges) — never an academic claim, so score/cbcLevel stay null.
// - mastery: emitted only when the AI's own in-session eval reported genuine
//   progress AND named at least one concept. This is the one claim shape
//   Phase 11's auto-confirm policy must never promote automatically.
//
// CLAIM IDENTITY (Phase 1.5). These two claims are independent: both can be
// true simultaneously ("she worked for 12 minutes" AND "she demonstrated
// progress on fractions"), and either can be true without the other (a
// session with no demonstrated learning emits engagement only). Neither
// corrects the other, and a later session does not correct an earlier one —
// Compass session evidence is EVENT evidence.
//
// `claimKey()` in lib/intelligence/evidenceLifecycle.ts therefore exempts
// `compass_session` from claim-key supersession, the same narrow carve-out
// `teacher_remark` already takes and for the same reason. Nothing in THIS
// file had to change for that: the two claims were always distinguishable
// by `extractionMethod`, and remain so. What changed is that the Evidence
// Domain no longer treats them as two versions of one claim.
//
// Consequence worth knowing when reading the rows: Compass evidence never
// carries a `supersedes` pointer and is never marked `superseded`. A
// mistaken claim is corrected by rejection (rejectReview) or retraction
// (retractEvidence), not by a newer session overwriting it.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { applyConservativeAutoConfirm } from '@/lib/compass/autoConfirm'
import { ENGAGEMENT_EXTRACTION_METHOD, MASTERY_EXTRACTION_METHOD } from '@/lib/compass/evidenceClaimTypes'

const SOURCE = 'compass_session' as const

export async function recordCompassSessionEvidence(input: {
  studentId: string
  initiatedBy: string
  sessionId: string
  subject: string
  sessionAbandoned: boolean
  exchangeCount: number
  durationSeconds: number
  genuineProgress: boolean
  masteredConcepts: string[]
  endingLevel: number | null
  academicYear: number
  term: number | null
  /**
   * Phase 2 — the canonical curriculum anchor (`sow_substrands.id`) this
   * session was TARGETED at, from the teacher-approved action that queued
   * it (`compass_bridge.subStrandId`). Null for an open, learner-directed
   * session, which is the normal case and must never be filled in by
   * guessing: Compass has no reliable way to infer which sub-strand a
   * free-form conversation covered, and a wrong anchor is worse than none.
   */
  targetSubStrandId?: string | null
}): Promise<void> {
  const startedAt = new Date()

  const confidence = computeConfidence({
    identityConfidence: 100,   // studentId is already resolved — this isn't identity-inferred
    identityMatchType: 'external_id',
    fieldIssueCount: 0,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: input.initiatedBy,
    teacherId: null,
    institution: null,
  })

  const durationMinutes = Math.round(input.durationSeconds / 60)

  const engagementEvidence: LearnerEvidence = {
    learnerId: input.studentId,
    extractedName: '',
    extractedExternalId: null,
    subject: input.subject,
    rawSubject: input.subject,
    score: null,
    cbcLevel: null,
    // No enum value fits "completed a Compass session" precisely — 'assignment'
    // (a completed learning task) is the closest of the three allowed values.
    assessmentType: 'assignment',
    academicYear: input.academicYear,
    term: input.term,
    evidenceSource: SOURCE,
    trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
    evidenceConfidence: confidence,
    extractionMethod: ENGAGEMENT_EXTRACTION_METHOD,
    reviewStatus,
    rawInputRef: `compass_session:${input.sessionId}:engagement:${input.subject}:` +
      `${input.exchangeCount}x:${durationMinutes}min:${input.sessionAbandoned ? 'abandoned' : 'completed'}`,
    // Engagement stays behavioural even for a targeted session: "she worked
    // on this for 12 minutes" is not a curriculum claim, and anchoring it
    // would let attendance masquerade as sub-strand mastery in
    // academic.bySubStrand. Deliberately unanchored (Phase 2 §20).
    subStrandId: null,
    importedAt: startedAt.toISOString(),
    issues: input.sessionAbandoned ? ['session_abandoned'] : [],
  }

  const evidenceBatch: LearnerEvidence[] = [engagementEvidence]

  // Mastery claim: only when the AI's own eval reported genuine progress on at
  // least one named concept this session — never manufactured from silence.
  if (input.genuineProgress && input.masteredConcepts.length > 0) {
    const cbcLevel = input.endingLevel !== null && input.endingLevel >= 1 && input.endingLevel <= 4
      ? (input.endingLevel as 1 | 2 | 3 | 4)
      : null

    evidenceBatch.push({
      learnerId: input.studentId,
      extractedName: '',
      extractedExternalId: null,
      subject: input.subject,
      rawSubject: input.subject,
      score: null,
      cbcLevel,
      assessmentType: 'assignment',
      academicYear: input.academicYear,
      term: input.term,
      evidenceSource: SOURCE,
      trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
      evidenceConfidence: confidence,
      extractionMethod: MASTERY_EXTRACTION_METHOD,
      reviewStatus,
      rawInputRef: `compass_session:${input.sessionId}:mastery:${input.subject}:` +
        `concepts=${input.masteredConcepts.join('|')}`,
      // Phase 2 — a TARGETED session's mastery claim returns with the same
      // curriculum identity the teacher aimed it at, so "did the
      // proportional-reasoning weakness change?" becomes answerable. An open
      // session leaves this null and stays subject-level, which remains a
      // perfectly valid claim. Still tier 1 and still pending_review: an
      // anchor makes the claim SPECIFIC, never more TRUSTED.
      subStrandId: input.targetSubStrandId ?? null,
      importedAt: startedAt.toISOString(),
      issues: [],
    })
  }

  const result = await persistEvidenceBatch(evidenceBatch, runId)

  await repos.evidence.completeIngestionRun(runId, {
    recordCount: evidenceBatch.length,
    confirmedCount: result.confirmedCount,
    pendingReviewCount: result.pendingReviewCount,
    rejectedCount: 0,
    processingDurationMs: Date.now() - startedAt.getTime(),
  })

  // Phase 11: engagement-only claims may be conservatively auto-confirmed;
  // mastery claims never are (enforced inside applyConservativeAutoConfirm
  // itself, not just by construction here).
  await applyConservativeAutoConfirm(result.inserted)
}
