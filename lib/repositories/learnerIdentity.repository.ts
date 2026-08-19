import { BaseRepository } from './base'
import type {
  LearnerIdentity,
  LearnerIdentityLink,
  LearnerIdentityLinkageReason,
  LearnerTransferToken,
} from '@/types/core'

const IDENTITY_COLS = 'id, created_at, updated_at'
const LINK_COLS =
  'id, learner_id, learner_identity_id, linked_by, linked_at, linkage_reason, transfer_id, superseded_at, superseded_by_link_id, created_at, updated_at'
const TOKEN_COLS =
  'id, transfer_id, token_hash, expires_at, consumed_at, consumed_by_learner_id, created_at, updated_at'

export class LearnerIdentityRepository extends BaseRepository {
  // ── learner_identities ───────────────────────────────────────────────────

  async insertIdentity(): Promise<LearnerIdentity> {
    const { data, error } = await this.db
      .from('learner_identities')
      .insert({})
      .select(IDENTITY_COLS)
      .single()
    if (error) throw new Error(`insertLearnerIdentity: ${error.message}`)
    return data
  }

  // ── learner_identity_links ───────────────────────────────────────────────

  async insertLink(params: {
    learner_id: string
    learner_identity_id: string
    linked_by: string | null
    linkage_reason: LearnerIdentityLinkageReason
    transfer_id: string | null
  }): Promise<LearnerIdentityLink> {
    const { data, error } = await this.db
      .from('learner_identity_links')
      .insert(params)
      .select(LINK_COLS)
      .single()
    if (error) throw new Error(`insertLearnerIdentityLink: ${error.message}`)
    return data
  }

  async findCurrentLink(learnerId: string): Promise<LearnerIdentityLink | null> {
    const { data, error } = await this.db
      .from('learner_identity_links')
      .select(LINK_COLS)
      .eq('learner_id', learnerId)
      .is('superseded_at', null)
      .maybeSingle()
    if (error) throw new Error(`findCurrentLearnerIdentityLink: ${error.message}`)
    return data
  }

  async listLinksForLearner(learnerId: string): Promise<LearnerIdentityLink[]> {
    const { data, error } = await this.db
      .from('learner_identity_links')
      .select(LINK_COLS)
      .eq('learner_id', learnerId)
      .order('linked_at', { ascending: false })
    if (error) throw new Error(`listLearnerIdentityLinks: ${error.message}`)
    return data
  }

  /** Marks a link superseded — never deletes/edits it in place (CLAUDE.md's supersede-never-edit pattern). */
  async supersedeLink(linkId: string, supersededByLinkId: string): Promise<void> {
    const { error } = await this.db
      .from('learner_identity_links')
      .update({ superseded_at: new Date().toISOString(), superseded_by_link_id: supersededByLinkId })
      .eq('id', linkId)
      .is('superseded_at', null)
    if (error) throw new Error(`supersedeLearnerIdentityLink: ${error.message}`)
  }

  // ── learners.learner_identity_id ─────────────────────────────────────────

  async setLearnerIdentityId(learnerId: string, learnerIdentityId: string): Promise<void> {
    const { error } = await this.db
      .from('learners')
      .update({ learner_identity_id: learnerIdentityId })
      .eq('id', learnerId)
    if (error) throw new Error(`setLearnerIdentityId: ${error.message}`)
  }

  async findLearnerIdentityId(learnerId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('learners')
      .select('learner_identity_id')
      .eq('id', learnerId)
      .single()
    if (error) throw new Error(`findLearnerIdentityId: ${error.message}`)
    return data.learner_identity_id
  }

  /** Every `learners.id` with no durable identity yet — the backfill's work queue (Phase 2D Step 4). Batched, not queried in a loop. */
  async findLearnersMissingIdentity(limit: number): Promise<string[]> {
    const { data, error } = await this.db
      .from('learners')
      .select('id')
      .is('learner_identity_id', null)
      .limit(limit)
    if (error) throw new Error(`findLearnersMissingIdentity: ${error.message}`)
    return data.map(r => r.id)
  }

  async countLearnersMissingIdentity(): Promise<number> {
    const { count, error } = await this.db
      .from('learners')
      .select('id', { count: 'exact', head: true })
      .is('learner_identity_id', null)
    if (error) throw new Error(`countLearnersMissingIdentity: ${error.message}`)
    return count ?? 0
  }

  // ── learner_transfer_tokens ──────────────────────────────────────────────

  async insertToken(params: {
    transfer_id: string
    token_hash: string
    expires_at: string
  }): Promise<LearnerTransferToken> {
    const { data, error } = await this.db
      .from('learner_transfer_tokens')
      .insert(params)
      .select(TOKEN_COLS)
      .single()
    if (error) throw new Error(`insertLearnerTransferToken: ${error.message}`)
    return data
  }

  async findTokenByHash(tokenHash: string): Promise<LearnerTransferToken | null> {
    const { data, error } = await this.db
      .from('learner_transfer_tokens')
      .select(TOKEN_COLS)
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (error) throw new Error(`findLearnerTransferTokenByHash: ${error.message}`)
    return data
  }

  /**
   * Race-safe single-use RESERVATION (Phase 2D Step 10) — mirrors
   * lib/core/guardianInvites.ts::claimGuardianInvite's proven pattern
   * exactly: the UPDATE is conditional on `consumed_at IS NULL`, and the
   * returned row count is the source of truth for who won the race, not a
   * separate read-then-write check. Under N concurrent callers with the
   * same token, exactly one UPDATE returns a row; every other one races
   * the same conditional WHERE clause and gets zero rows back — this is
   * enforced by Postgres row-level locking on the UPDATE itself, not by
   * anything in this process, so it is safe across concurrent requests/
   * connections, not just concurrent promises in one process.
   *
   * Deliberately split from `attachConsumedLearner` below: at the moment a
   * caller wins this race it does not yet have a `learners.id` to record
   * (that row is created AFTER the reservation succeeds, never before —
   * otherwise every losing concurrent caller would have already created an
   * orphan `learners` row before discovering it lost). Reserve first,
   * create the learner row only if you won, then attach.
   */
  async reserveToken(tokenId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('learner_transfer_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', tokenId)
      .is('consumed_at', null)
      .select('id')
    if (error) throw new Error(`reserveLearnerTransferToken: ${error.message}`)
    return !!data && data.length > 0
  }

  /** Records which new School B `learners` row consumed a reserved token. Called only by the caller that already won `reserveToken`. */
  async attachConsumedLearner(tokenId: string, consumedByLearnerId: string): Promise<void> {
    const { error } = await this.db
      .from('learner_transfer_tokens')
      .update({ consumed_by_learner_id: consumedByLearnerId })
      .eq('id', tokenId)
    if (error) throw new Error(`attachConsumedLearner: ${error.message}`)
  }
}
