// lib/core/transfers.ts
//
// Phase 2D — extends the pre-existing transfer-out/transfer-in record
// keeping (Sprint 10) with durable-identity transfer continuity (Phase 2C's
// approved architecture). `transferLearner` itself is unchanged in its
// core behavior (still creates a `learner_transfers` row, still marks the
// source learner 'transferred' + withdraws enrollments on 'out') — the
// addition is: a successful 'out' transfer also issues a single-use
// transfer-continuity token (Step 7), bound to the source learner's durable
// identity via the transfer record. `consumeLearnerTransferToken` is the
// new receiving-school half (Step 9/10/11) — it does NOT create a
// `learners` row itself (that stays admission's job, lib/core/learners.ts,
// to avoid two places creating learner rows); it validates the token and
// hands back the durable `learner_identity_id` to link the newly-admitted
// row to.
import { repos } from '@/lib/repositories'
import { generateTransferToken, hashTransferToken, transferTokenExpiryFromNow } from '@/lib/core/transferTokens'
import { mintFreshIdentityForLearner } from '@/lib/core/learnerIdentity'
import type { LearnerTransfer, TransferLearnerInput, TransferLearnerResult, TransferInConsumptionResult } from '@/types/core'

export async function transferLearner(
  processedBy: string,
  input: TransferLearnerInput
): Promise<TransferLearnerResult> {
  const fromSchoolId = input.direction === 'out'
    ? await repos.learners.findSchoolId(input.learner_id)
    : (input.to_school_id ?? '')

  const transfer = await repos.learners.insertTransfer({
    learner_id: input.learner_id,
    from_school_id: fromSchoolId,
    to_school_id: input.to_school_id ?? null,
    to_school_name: input.to_school_name ?? null,
    direction: input.direction,
    transfer_date: input.transfer_date,
    reason: input.reason ?? null,
    document_urls: input.document_urls ?? [],
    processed_by: processedBy,
  })

  // Mark learner as transferred + withdraw active enrollment
  if (input.direction === 'out') {
    await repos.learners.updateStatusById(input.learner_id, { status: 'transferred' })
    await repos.learners.withdrawActiveEnrollments(input.learner_id, 'transferred')

    // Phase 2D Step 7 — every learner should already carry a durable
    // identity (admission default or an earlier transfer-in), but this is
    // a defensive safety net, not the primary path: a learner admitted
    // before this phase's backfill ran cannot be left without one just
    // because they happen to transfer out first. mintFreshIdentityForLearner
    // is only called when no identity exists yet.
    const existingIdentityId = await repos.learnerIdentity.findLearnerIdentityId(input.learner_id)
    if (!existingIdentityId) {
      await mintFreshIdentityForLearner(input.learner_id, 'admission_default', null)
    }

    const rawToken = generateTransferToken()
    const tokenHash = await hashTransferToken(rawToken)
    const expiresAt = transferTokenExpiryFromNow()
    await repos.learnerIdentity.insertToken({
      transfer_id: transfer.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })

    // Raw token returned exactly once, here — never logged, never stored.
    return { ...transfer, transferToken: rawToken, transferTokenExpiresAt: expiresAt }
  }

  return transfer
}

export async function getLearnerTransfers(learnerId: string): Promise<LearnerTransfer[]> {
  return repos.learners.listTransfers(learnerId)
}

/**
 * Phase 2D Step 9/10/11 — validates and consumes a transfer-continuity
 * token on the RECEIVING side. Race-safe (Step 10): the reservation is a
 * single conditional UPDATE (`reserveToken`), so under N concurrent calls
 * with the same raw token, exactly one reaches `{status: 'consumed'}` and
 * every other one gets `'already_consumed'` before doing anything else —
 * no orphan learner rows are created by losers, because admission (the
 * caller, lib/core/learners.ts::admitTransferredLearner) only creates its
 * `learners` row AFTER this function returns `'consumed'`.
 *
 * School authority (Step 11): `receivingSchoolId` must not be the
 * transfer's own `from_school_id` (a school cannot consume its own
 * transfer-out token as an admission) and, when the transfer specified a
 * `to_school_id`, must match it exactly. Token possession alone is never
 * sufficient — this check runs before the token is ever reserved, so an
 * unauthorized caller cannot even burn the token for someone else.
 *
 * Information disclosure (Step 12): the only thing this function returns
 * on success is the durable `learner_identity_id` plus the minimal source
 * context (`sourceLearnerId`, `fromSchoolId`) admission needs to record
 * provenance — no historical scores, guardian data, notes, or PII.
 */
export async function consumeLearnerTransferToken(
  receivingSchoolId: string,
  rawToken: string
): Promise<TransferInConsumptionResult> {
  const tokenHash = await hashTransferToken(rawToken)
  const token = await repos.learnerIdentity.findTokenByHash(tokenHash)
  if (!token) return { status: 'invalid' }
  if (token.consumed_at) return { status: 'already_consumed' }
  if (new Date(token.expires_at) < new Date()) return { status: 'expired' }

  const transfer = await repos.learners.findTransferById(token.transfer_id)
  if (!transfer) return { status: 'invalid' }

  // School authority — Step 11. Checked BEFORE reservation: an
  // unauthorized caller must never be able to burn a valid token even if
  // their own request is ultimately rejected.
  if (receivingSchoolId === transfer.from_school_id) return { status: 'wrong_school' }
  if (transfer.to_school_id && transfer.to_school_id !== receivingSchoolId) return { status: 'wrong_school' }

  const won = await repos.learnerIdentity.reserveToken(token.id)
  if (!won) return { status: 'already_consumed' } // lost the race

  const learnerIdentityId = await repos.learnerIdentity.findLearnerIdentityId(transfer.learner_id)
  if (!learnerIdentityId) {
    // Should be unreachable post-backfill (every learner has an identity
    // before it can transfer out — see the defensive mint in
    // transferLearner above) — fail loudly rather than silently minting a
    // second identity here, which would defeat the whole point of the token.
    throw new Error(`consumeLearnerTransferToken: source learner ${transfer.learner_id} has no durable identity — transfer continuity cannot proceed.`)
  }

  return {
    status: 'consumed',
    learnerIdentityId,
    sourceLearnerId: transfer.learner_id,
    fromSchoolId: transfer.from_school_id,
    transferId: transfer.id,
  }
}

/** Records which new School B `learners` row consumed an already-reserved token — called by admission AFTER it creates that row. */
export async function attachConsumedTransferLearner(rawToken: string, newLearnerId: string): Promise<void> {
  const tokenHash = await hashTransferToken(rawToken)
  const token = await repos.learnerIdentity.findTokenByHash(tokenHash)
  if (!token) throw new Error('attachConsumedTransferLearner: token not found.')
  await repos.learnerIdentity.attachConsumedLearner(token.id, newLearnerId)
}
