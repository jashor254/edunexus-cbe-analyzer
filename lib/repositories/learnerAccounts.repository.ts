// lib/repositories/learnerAccounts.repository.ts
//
// Phase 2B-RESUME — data access for learner_accounts / learner_account_invites.
// Mirrors lib/repositories/learnerIdentity.repository.ts's shape exactly
// (explicit column lists, conditional-update race safety patterns) since
// this domain is the direct continuation of that phase's work.
import { BaseRepository } from './base'
import type { LearnerAccount, LearnerAccountInvite, LearnerAccountInvitePurpose } from '@/types/core'

const ACCOUNT_COLS = 'id, learner_identity_id, user_id, status, activated_at, suspended_at, created_at, updated_at'
const INVITE_COLS =
  'id, learner_identity_id, school_id, token_hash, purpose, expires_at, used_at, issued_by, created_at, updated_at'

export class LearnerAccountsRepository extends BaseRepository {
  // ── learner_accounts ─────────────────────────────────────────────────────

  async insertAccount(params: { learner_identity_id: string; user_id: string }): Promise<LearnerAccount> {
    const { data, error } = await this.db
      .from('learner_accounts')
      .insert(params)
      .select(ACCOUNT_COLS)
      .single()
    if (error) throw new Error(`insertLearnerAccount: ${error.message}`)
    return data
  }

  async findByLearnerIdentityId(learnerIdentityId: string): Promise<LearnerAccount | null> {
    const { data, error } = await this.db
      .from('learner_accounts')
      .select(ACCOUNT_COLS)
      .eq('learner_identity_id', learnerIdentityId)
      .maybeSingle()
    if (error) throw new Error(`findLearnerAccountByLearnerIdentityId: ${error.message}`)
    return data
  }

  async findByUserId(userId: string): Promise<LearnerAccount | null> {
    const { data, error } = await this.db
      .from('learner_accounts')
      .select(ACCOUNT_COLS)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(`findLearnerAccountByUserId: ${error.message}`)
    return data
  }

  /** `school_users.id` for an active membership — used to populate `learner_account_invites.issued_by` from the request's already-authenticated (auth.users.id, schoolId) pair. */
  async findActiveSchoolUserId(userId: string, schoolId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('school_users')
      .select('id')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .maybeSingle()
    if (error) throw new Error(`findActiveSchoolUserId: ${error.message}`)
    return data?.id ?? null
  }

  // ── learner_account_invites ──────────────────────────────────────────────

  async insertInvite(params: {
    learner_identity_id: string
    school_id: string
    token_hash: string
    purpose: LearnerAccountInvitePurpose
    expires_at: string
    issued_by: string | null
  }): Promise<LearnerAccountInvite> {
    const { data, error } = await this.db
      .from('learner_account_invites')
      .insert(params)
      .select(INVITE_COLS)
      .single()
    if (error) throw new Error(`insertLearnerAccountInvite: ${error.message}`)
    return data
  }

  async findInviteByHash(tokenHash: string): Promise<LearnerAccountInvite | null> {
    const { data, error } = await this.db
      .from('learner_account_invites')
      .select(INVITE_COLS)
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (error) throw new Error(`findLearnerAccountInviteByHash: ${error.message}`)
    return data
  }

  /** The most recent unused, unexpired invite for a durable identity — used for issuance idempotency (re-issuing returns the same pending invite rather than creating a second live one). */
  async findActivePendingInvite(learnerIdentityId: string, purpose: LearnerAccountInvitePurpose): Promise<LearnerAccountInvite | null> {
    const { data, error } = await this.db
      .from('learner_account_invites')
      .select(INVITE_COLS)
      .eq('learner_identity_id', learnerIdentityId)
      .eq('purpose', purpose)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`findActiveLearnerAccountInvite: ${error.message}`)
    return data
  }

  /**
   * Race-safe single-use RESERVATION — conditional UPDATE on `used_at IS
   * NULL`, returned row count is the source of truth for who won the race
   * (mirrors learnerIdentity.repository.ts::reserveToken /
   * guardianInvites.ts::claimGuardianInvite exactly).
   */
  async reserveInvite(inviteId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('learner_account_invites')
      .update({ used_at: new Date().toISOString() })
      .eq('id', inviteId)
      .is('used_at', null)
      .select('id')
    if (error) throw new Error(`reserveLearnerAccountInvite: ${error.message}`)
    return !!data && data.length > 0
  }

  /** Resolves the school-local `learners.id` currently authorized for a durable identity, scoped to `schoolId` — Step 6's issuance-authority chain. Returns null if this school does not currently hold a `learners` row for this identity. */
  async findAuthorizedLearnerIdForSchool(learnerIdentityId: string, schoolId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('learners')
      .select('id')
      .eq('learner_identity_id', learnerIdentityId)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findAuthorizedLearnerIdForSchool: ${error.message}`)
    return data?.id ?? null
  }

  /** The durable identity behind a specific school-owned `learners.id`, scoped to `schoolId` so a caller cannot supply an arbitrary learner id from another school (Step 6). */
  async findLearnerIdentityIdForSchoolLearner(learnerId: string, schoolId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('learners')
      .select('learner_identity_id')
      .eq('id', learnerId)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findLearnerIdentityIdForSchoolLearner: ${error.message}`)
    return data?.learner_identity_id ?? null
  }

  /**
   * Every school-local `learners` row currently pointing at this durable
   * identity, across every school — Step 14's multi-school resolver
   * primitive. Deliberately returns the full set rather than picking one:
   * Phase 2C found dual-active enrollment is real, so the caller (not this
   * repository) decides how to disambiguate when more than one row comes
   * back.
   */
  async findSchoolLocalLearnersForIdentity(learnerIdentityId: string): Promise<Array<{ id: string; school_id: string; status: string }>> {
    const { data, error } = await this.db
      .from('learners')
      .select('id, school_id, status')
      .eq('learner_identity_id', learnerIdentityId)
    if (error) throw new Error(`findSchoolLocalLearnersForIdentity: ${error.message}`)
    return data
  }
}
