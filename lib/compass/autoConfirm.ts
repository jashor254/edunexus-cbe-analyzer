// lib/compass/autoConfirm.ts
// Compass v2 Wave 2, Phase 11 — the narrow, conservative auto-confirm policy
// approved in Compass v2 Design §7: only engagement-shaped Compass evidence
// (a session happened, ran this long, this many exchanges) may be promoted
// without a teacher's click. Mastery-shaped evidence (an AI's judgment that a
// learner now understands something) always requires a real teacher review
// via app/api/teacher/classes/[classId]/compass/evidence/[evidenceId] — no
// exception, ever, regardless of confidence.
//
// This does not bypass the Evidence Domain lifecycle: it calls the exact same
// confirmReview() a teacher's PATCH request calls (pending_review ->
// reviewed_confirmed is the only legal transition for this evidence, enforced
// by the enforce_evidence_lifecycle_transition trigger). The only difference
// from a teacher's confirmation is *who* the reviewer is — a real, auditable
// system account (see scripts/create-compass-auto-confirm-account.ts), never
// a synthetic id and never a bypass of the reviewed_by foreign key.

import { confirmReview } from '@/lib/intelligence/evidenceLifecycle'
import { COMPASS_AUTO_CONFIRM_CONFIG } from '@/lib/config/api'
import { ENGAGEMENT_EXTRACTION_METHOD, MASTERY_EXTRACTION_METHOD } from '@/lib/compass/evidenceClaimTypes'
import type { EvidenceRow } from '@/lib/repositories/evidence.repository'

const AUTO_CONFIRM_REASON =
  'Auto-confirmed by policy: engagement-only observation (Compass v2 Design §7). ' +
  'Session completion/duration facts are conservatively eligible; mastery and all other ' +
  'claim types always require teacher review.'

/**
 * Applies the conservative auto-confirm policy to a batch of just-inserted
 * Compass evidence rows. Safe to call unconditionally after every
 * persistEvidenceBatch — rows that aren't eligible are left untouched at
 * pending_review, which is always the correct fallback.
 */
export async function applyConservativeAutoConfirm(insertedRows: EvidenceRow[]): Promise<void> {
  if (!COMPASS_AUTO_CONFIRM_CONFIG.isConfigured()) {
    // Not yet set up in this environment (scripts/create-compass-auto-confirm-account.ts
    // hasn't been run) — the safe default is simply "nothing auto-confirms yet",
    // not an error. Every engagement claim still reaches Projection eventually,
    // just via teacher review instead.
    console.warn('[compass/autoConfirm] COMPASS_AUTO_CONFIRM_USER_ID not configured — skipping auto-confirm; evidence stays pending_review')
    return
  }

  const systemUserId = COMPASS_AUTO_CONFIRM_CONFIG.getUserIdOrThrow()

  const eligible = insertedRows.filter(row =>
    row.lifecycle_state === 'pending_review' &&
    row.evidence_source === 'compass_session' &&
    row.extraction_method === ENGAGEMENT_EXTRACTION_METHOD
  )

  // Hard invariant, not just a filter condition: this function must never be
  // the thing that confirms a mastery claim, under any circumstance.
  for (const row of eligible) {
    if (row.extraction_method === MASTERY_EXTRACTION_METHOD) {
      throw new Error('applyConservativeAutoConfirm: refusing to auto-confirm a mastery claim — this must never happen')
    }
  }

  for (const row of eligible) {
    try {
      await confirmReview(row.id, systemUserId, AUTO_CONFIRM_REASON)
    } catch (err) {
      // A single row failing (e.g. it was concurrently rejected by a teacher
      // between insert and this call) must not block the rest of the batch.
      console.error(`[compass/autoConfirm] failed to auto-confirm evidence ${row.id}:`, err)
    }
  }
}
