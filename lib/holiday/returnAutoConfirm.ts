// lib/holiday/returnAutoConfirm.ts
// Adaptive Learning v2 Architecture §7 (FROZEN) — applies the exact same
// conservative auto-confirm policy Compass v2 established
// (lib/compass/autoConfirm.ts) to Holiday Return's engagement claim:
// "learner returned N of M weeks" may be promoted without a teacher's
// click; "the teacher assessed this subject at this CBC level"
// (holiday_mastery) never is, regardless of confidence — a false
// "confirmed mastery" is a materially worse failure than a false
// "confirmed engagement."
//
// Deliberately reuses COMPASS_AUTO_CONFIRM_CONFIG's system account rather
// than minting a second one: this is the same actor and the same policy
// (conservative, engagement-only, auditable, real reviewer id) applied to
// a second evidence source — not a new auto-confirm mechanism.
//
// Load-bearing note (see lib/holiday/return.ts): unlike Compass's tier-1
// evidence, which is structurally capped below the auto-confirm threshold
// by its trust tier alone, holiday_return's tier-2 evidence is NOT capped
// below threshold by tier alone — return.ts must set every record's
// reviewStatus to pending_review at creation, unconditionally, so this
// module is the only path either claim type can leave pending_review
// without a human. If that invariant in return.ts is ever weakened, this
// module's filter alone does not protect mastery claims from an
// accidental direct auto_confirmed insert.

import { confirmReview } from '@/lib/intelligence/evidenceLifecycle'
import { COMPASS_AUTO_CONFIRM_CONFIG } from '@/lib/config/api'
import { HOLIDAY_ENGAGEMENT_EXTRACTION_METHOD, HOLIDAY_MASTERY_EXTRACTION_METHOD } from '@/lib/holiday/evidenceClaimTypes'
import type { EvidenceRow } from '@/lib/repositories/evidence.repository'

const AUTO_CONFIRM_REASON =
  'Auto-confirmed by policy: engagement-only observation (Adaptive Learning v2 Architecture §7). ' +
  'Holiday pack return/completion facts are conservatively eligible; mastery and all other ' +
  'claim types always require teacher review.'

/**
 * Applies the conservative auto-confirm policy to a batch of just-inserted
 * Holiday Return evidence rows. Safe to call unconditionally after every
 * persistEvidenceBatch — rows that aren't eligible are left untouched at
 * pending_review, which is always the correct fallback.
 */
export async function applyHolidayEngagementAutoConfirm(insertedRows: EvidenceRow[]): Promise<void> {
  if (!COMPASS_AUTO_CONFIRM_CONFIG.isConfigured()) {
    console.warn('[holiday/returnAutoConfirm] COMPASS_AUTO_CONFIRM_USER_ID not configured — skipping auto-confirm; evidence stays pending_review')
    return
  }

  const systemUserId = COMPASS_AUTO_CONFIRM_CONFIG.getUserIdOrThrow()

  const eligible = insertedRows.filter(row =>
    row.lifecycle_state === 'pending_review' &&
    row.evidence_source === 'holiday_return' &&
    row.extraction_method === HOLIDAY_ENGAGEMENT_EXTRACTION_METHOD
  )

  // Hard invariant, not just a filter condition: this function must never be
  // the thing that confirms a mastery claim, under any circumstance.
  for (const row of eligible) {
    if (row.extraction_method === HOLIDAY_MASTERY_EXTRACTION_METHOD) {
      throw new Error('applyHolidayEngagementAutoConfirm: refusing to auto-confirm a mastery claim — this must never happen')
    }
  }

  for (const row of eligible) {
    try {
      await confirmReview(row.id, systemUserId, AUTO_CONFIRM_REASON)
    } catch (err) {
      console.error(`[holiday/returnAutoConfirm] failed to auto-confirm evidence ${row.id}:`, err)
    }
  }
}
