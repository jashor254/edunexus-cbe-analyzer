// lib/paperIntelligence/markingClaim.ts
//
// One whole-script marking pass per submission at a time.
//
// Paper Intelligence has no per-paper charge and no daily quota — teachers
// mark as many scripts as they teach (the scanner-first product decision,
// 2026-10-28). That makes the per-script vision call EduNexus' own operating
// cost, so the safeguards are operational rather than commercial: access is
// "currently teaches this class", pages are size/count/sharpness-limited,
// each provider attempt is time-bounded, and — this module — a submission can
// not be marked twice concurrently.
//
// Without it, a double-tap, a reopened learner, or a re-run bulk scan paid
// for a second multimodal call on the same pages, and the second pass's
// replaceScriptMarks() orphaned the first pass's pending_review evidence
// (it only supersedes the evidence it read before its own AI call).
//
// Mechanism (no migration): a `processing` row in `jobs`, then
// insert-then-check — every concurrent request inserts its claim and then
// reads all live claims for the submission; exactly one (earliest created_at,
// id as tie-break) proceeds. Same rule as the free-trial SOW guard
// (lib/sow/generationJob.ts isWinningFreeTrial).

import { repos } from '@/lib/repositories'
import { logger } from '@/lib/observability/logger'

export const PAPER_SCRIPT_MARK_JOB_TYPE = 'ai.paper_script.mark'

/**
 * A claim older than this is dead (its request ended without releasing it).
 * Longer than the mark-script route's maxDuration (120s), so a live pass is
 * never treated as dead.
 */
export const MARKING_CLAIM_TTL_MS = 3 * 60 * 1000

export type MarkingClaimRow = { id: string; created_at: string }

/** Whether `claimId` is the one live claim allowed to mark. Pure. */
export function isWinningClaim(claimId: string, claims: MarkingClaimRow[], now: number): boolean {
  const live = claims.filter(c => {
    const created = Date.parse(c.created_at)
    return Number.isFinite(created) && now - created < MARKING_CLAIM_TTL_MS
  })
  const [winner] = [...live].sort((a, b) =>
    a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at),
  )
  return winner?.id === claimId
}

export type MarkingClaim =
  | { claimed: true; release: (outcome: 'completed' | 'failed') => Promise<void> }
  | { claimed: false }

const NO_OP_CLAIM: MarkingClaim = { claimed: true, release: async () => {} }

/**
 * Claims the right to mark `submissionId`. `claimed: false` means another
 * pass for this submission is already running — the caller must not call
 * the model. Always `release()` a held claim when the pass ends.
 *
 * Fails OPEN, loudly: if the claim store errors, marking proceeds (a teacher's
 * marking must not stop because a guard's bookkeeping failed) and the error is
 * logged.
 */
export async function claimScriptMarking(submissionId: string, userId: string): Promise<MarkingClaim> {
  let claimId: string
  try {
    const claim = await repos.jobs.insertProcessingClaim({
      type: PAPER_SCRIPT_MARK_JOB_TYPE,
      userId,
      payload: { submission_id: submissionId },
    })
    claimId = claim.id
    const since = new Date(Date.now() - MARKING_CLAIM_TTL_MS).toISOString()
    const live = await repos.jobs.listProcessingJobsForResource(PAPER_SCRIPT_MARK_JOB_TYPE, 'submission_id', submissionId, since)
    if (!isWinningClaim(claimId, live, Date.now())) {
      await repos.jobs.updateProgress(claimId, { status: 'failed', result: { reason: 'superseded: marking already in progress' } })
      return { claimed: false }
    }
  } catch (err) {
    logger.error('Script marking claim unavailable — proceeding without the concurrency guard', { operation: 'paperIntelligence.claimScriptMarking' }, err)
    return NO_OP_CLAIM
  }

  let released = false
  return {
    claimed: true,
    release: async (outcome) => {
      if (released) return
      released = true
      try {
        await repos.jobs.updateProgress(claimId, { status: outcome, result: { outcome } })
      } catch (err) {
        // A claim left `processing` expires on its own after MARKING_CLAIM_TTL_MS.
        logger.warn('Script marking claim release failed — it will expire', { operation: 'paperIntelligence.releaseScriptMarking' }, err)
      }
    },
  }
}
