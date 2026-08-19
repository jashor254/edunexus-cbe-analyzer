// lib/core/learnerIdentity.ts
//
// Phase 2D — the durable learner identity domain. Implements Phase 2C's
// approved architecture: `learner_identities.id` is the durable EduNexus
// identity that survives inter-school transfer; `learners.id` remains the
// school-owned institutional record. This module is the ONLY place that
// creates a `learner_identities` row, writes `learner_identity_links`, or
// mutates `learners.learner_identity_id` — every caller (admission,
// transfer-in, backfill, future correction) goes through here so the
// supersede-never-edit and cardinality invariants can never be bypassed by
// a second implementation growing elsewhere.
//
// Cardinality (Step 2, documented choice): every learner gets exactly one
// CURRENT (non-superseded) `learner_identity_links` row, enforced by a
// partial unique index on `learner_identity_links (learner_id) WHERE
// superseded_at IS NULL` (migration 20260818180000). `learners.
// learner_identity_id` is a plain nullable FK with NO uniqueness
// constraint — Phase 2C found legitimate dual-school enrollment exists, so
// two different `learners` rows are allowed to point at the same durable
// identity (that is in fact the whole point of transfer continuity: School
// A's historical row and School B's new row share one identity). What must
// never happen — two CURRENT links for the SAME learner row — is a DB
// invariant; "two learners sharing one identity" is expected and is a
// code-level, not a DB-level, concern.
import { repos } from '@/lib/repositories'
import type { LearnerIdentity, LearnerIdentityLink, LearnerIdentityLinkageReason } from '@/types/core'

export type IdentityCreationResult = {
  identity: LearnerIdentity
  link: LearnerIdentityLink
}

/**
 * Mints a brand-new durable identity and binds it to `learnerId` as that
 * learner's CURRENT link. Used by: new admission with no transfer token
 * (`admission_default`), the deterministic backfill (`admission_default`),
 * and transfer-in when no token is supplied (`admission_default` — a fresh,
 * unmatched identity, per Phase 2C's "no global search for possible prior
 * identity" finding, Step 15).
 *
 * Never called for a learner that already has a current link — callers
 * (admitLearner, backfillLearnerIdentities) check first, matching the
 * check-then-create idiom already established across this codebase
 * (schoolActivation.ts, guardianInvites.ts).
 */
export async function mintFreshIdentityForLearner(
  learnerId: string,
  reason: Extract<LearnerIdentityLinkageReason, 'admission_default'>,
  linkedBy: string | null
): Promise<IdentityCreationResult> {
  const identity = await repos.learnerIdentity.insertIdentity()
  const link = await repos.learnerIdentity.insertLink({
    learner_id: learnerId,
    learner_identity_id: identity.id,
    linked_by: linkedBy,
    linkage_reason: reason,
    transfer_id: null,
  })
  await repos.learnerIdentity.setLearnerIdentityId(learnerId, identity.id)
  return { identity, link }
}

/**
 * Binds an EXISTING durable identity (from a consumed transfer token) to a
 * newly-created School B `learners` row. This is the transfer continuity
 * mechanism (Step 9): the new learner row gets its own fresh `learners.id`
 * — never the old row's id — but shares the durable identity of the School
 * A record it continues from.
 */
export async function linkLearnerToExistingIdentity(
  learnerId: string,
  learnerIdentityId: string,
  reason: Extract<LearnerIdentityLinkageReason, 'transfer_token'>,
  linkedBy: string | null,
  transferId: string
): Promise<LearnerIdentityLink> {
  const link = await repos.learnerIdentity.insertLink({
    learner_id: learnerId,
    learner_identity_id: learnerIdentityId,
    linked_by: linkedBy,
    linkage_reason: reason,
    transfer_id: transferId,
  })
  await repos.learnerIdentity.setLearnerIdentityId(learnerId, learnerIdentityId)
  return link
}

export type BackfillResult = {
  learnersProcessed: number
  identitiesCreated: number
  linksCreated: number
}

/**
 * Deterministic, idempotent backfill (Phase 2D Step 4/5): every existing
 * `learners` row with no `learner_identity_id` gets a FRESH, unmatched
 * durable identity — no name/phone/admission-number/UPI matching, no
 * transfer pairing, even for `status='transferred'` rows (Phase 2C
 * confirmed zero provably-linkable transfer pairs exist). Batched via
 * `findLearnersMissingIdentity`, never queried in a loop for the
 * candidate set — but processed one at a time because each candidate
 * requires its own multi-statement create-identity+create-link+set-FK
 * sequence, and re-checking `learner_identity_id IS NULL` per batch keeps
 * a re-run safe even if a previous run partially completed.
 *
 * Idempotent: a second call finds zero rows with `learner_identity_id IS
 * NULL` and creates nothing.
 */
export async function backfillLearnerIdentities(batchSize = 500): Promise<BackfillResult> {
  let learnersProcessed = 0
  let identitiesCreated = 0
  let linksCreated = 0

  for (;;) {
    const learnerIds = await repos.learnerIdentity.findLearnersMissingIdentity(batchSize)
    if (learnerIds.length === 0) break

    for (const learnerId of learnerIds) {
      const { link } = await mintFreshIdentityForLearner(learnerId, 'admission_default', null)
      learnersProcessed += 1
      identitiesCreated += 1
      linksCreated += link ? 1 : 0
    }

    if (learnerIds.length < batchSize) break
  }

  return { learnersProcessed, identitiesCreated, linksCreated }
}

/**
 * Phase 2D Step 16 — the SCHEMA/DOMAIN PRIMITIVE for audited identity
 * correction: supersede the learner's current link, create a new current
 * link with reason `admin_correction`, and repoint `learners.
 * learner_identity_id`. Old link history is never deleted (supersede, not
 * edit) — `listLinksForLearner` still returns it.
 *
 * NAMED LIMITATION (deliberate, per spec Step 16): this function exists
 * but is NOT wired to any API route or UI in Phase 2D. Correction
 * authorization policy — who may invoke this, under what evidence, with
 * what audit requirement beyond `linkedBy` — was not decided as part of
 * this phase and deserves its own review before it is reachable from
 * outside a trusted script/future admin-tool phase. Callers today are
 * therefore limited to server-side scripts run by an engineer, not any
 * request handler.
 */
export async function correctLearnerIdentityLink(
  learnerId: string,
  newLearnerIdentityId: string,
  linkedBy: string
): Promise<LearnerIdentityLink> {
  const current = await repos.learnerIdentity.findCurrentLink(learnerId)
  if (!current) {
    throw new Error(`correctLearnerIdentityLink: learner ${learnerId} has no current identity link to correct.`)
  }

  const newLink = await repos.learnerIdentity.insertLink({
    learner_id: learnerId,
    learner_identity_id: newLearnerIdentityId,
    linked_by: linkedBy,
    linkage_reason: 'admin_correction',
    transfer_id: null,
  })
  await repos.learnerIdentity.supersedeLink(current.id, newLink.id)
  await repos.learnerIdentity.setLearnerIdentityId(learnerId, newLearnerIdentityId)
  return newLink
}

export async function getLearnerIdentityId(learnerId: string): Promise<string | null> {
  return repos.learnerIdentity.findLearnerIdentityId(learnerId)
}

export async function getIdentityLinkHistory(learnerId: string): Promise<LearnerIdentityLink[]> {
  return repos.learnerIdentity.listLinksForLearner(learnerId)
}
