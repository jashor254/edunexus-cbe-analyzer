// lib/repositories/leadership.repository.ts
//
// Owns `learner_leadership`, `leadership_history` exclusively (Sprint 13D,
// ADR-0015). Only the canonical operations the mission named — no
// business logic (no permission checks, no lifecycle validation): that
// all lives in lib/learnerLeadership/leadership.ts. This repository only
// knows how to read and write rows; the DB's own trigger
// (`enforce_leadership_immutability`) is the final backstop against a
// terminal-state or published row ever being edited.
//
// Per ADR-0015 Phase 4/mission Phase 3 discipline: no generic update()/
// delete()/mutate() on leadership entries — every lifecycle transition
// gets its own named method, and there is no delete path at all once an
// entry has left `nomination`. Naming is kept distinct from
// CompetitionRepository/ProjectRepository/AchievementRepository
// throughout (leadership_* tables, Leadership* types).

import { BaseRepository } from './base'

export type LeadershipStatus =
  | 'nomination' | 'selection' | 'active_service' | 'review'
  | 'completion' | 'verification' | 'published' | 'historical'
  | 'not_selected' | 'discontinued' | 'rejected' | 'revoked'

export type LearnerLeadershipRow = {
  id: string
  learner_id: string
  school_id: string
  position_title: string
  scope: string | null
  body: string | null
  responsibilities: string | null
  is_acting: boolean
  start_date: string | null
  end_date: string | null
  mentor_school_user_id: string | null
  status: LeadershipStatus
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  completed_notes: string | null
  reflection: string | null
  supporting_evidence_ids: string[]
  recorded_by: string | null
  verified_by: string | null
  verified_at: string | null
  published_at: string | null
  historical_at: string | null
  not_selected_reason: string | null
  discontinued_reason: string | null
  discontinued_at: string | null
  rejected_reason: string | null
  revoked_by: string | null
  revoked_reason: string | null
  revoked_at: string | null
  version: number
  created_at: string
  updated_at: string
}

export type LeadershipHistoryRow = {
  id: string
  leadership_id: string
  from_status: LeadershipStatus
  to_status: LeadershipStatus
  actor_school_user_id: string | null
  reason: string | null
  version: number
  created_at: string
}

export type CreateLeadershipInput = {
  learner_id: string
  school_id: string
  position_title: string
  scope: string | null
  body: string | null
  responsibilities: string | null
  is_acting: boolean
  supporting_evidence_ids: string[]
  recorded_by: string | null
}

export type UpdateNominationInput = Partial<
  Pick<LearnerLeadershipRow,
    'position_title' | 'scope' | 'body' | 'responsibilities' | 'is_acting' | 'supporting_evidence_ids'>
>

const LEADERSHIP_COLS =
  'id, learner_id, school_id, position_title, scope, body, responsibilities, is_acting, start_date, end_date, ' +
  'mentor_school_user_id, status, review_notes, reviewed_by, reviewed_at, completed_notes, reflection, ' +
  'supporting_evidence_ids, recorded_by, verified_by, verified_at, published_at, historical_at, ' +
  'not_selected_reason, discontinued_reason, discontinued_at, rejected_reason, revoked_by, revoked_reason, ' +
  'revoked_at, version, created_at, updated_at'

export class LeadershipRepository extends BaseRepository {
  // ── learner_leadership ───────────────────────────────────────────────────

  async create(input: CreateLeadershipInput): Promise<LearnerLeadershipRow> {
    const { data, error } = await this.db
      .from('learner_leadership')
      .insert({ ...input, status: 'nomination', version: 1 })
      .select(LEADERSHIP_COLS)
      .single()
    if (error) throw new Error(`create: ${error.message}`)
    return data as unknown as LearnerLeadershipRow
  }

  /** Only succeeds while the row is still `nomination` — the DB trigger rejects any attempt once it has moved on. */
  async updateNomination(id: string, schoolId: string, input: UpdateNominationInput): Promise<LearnerLeadershipRow> {
    const { data, error } = await this.db
      .from('learner_leadership')
      .update(input)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(LEADERSHIP_COLS)
      .single()
    if (error) throw new Error(`updateNomination: ${error.message}`)
    return data as unknown as LearnerLeadershipRow
  }

  async setMentor(id: string, schoolId: string, mentorSchoolUserId: string | null): Promise<LearnerLeadershipRow> {
    const { data, error } = await this.db
      .from('learner_leadership')
      .update({ mentor_school_user_id: mentorSchoolUserId })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(LEADERSHIP_COLS)
      .single()
    if (error) throw new Error(`setMentor: ${error.message}`)
    return data as unknown as LearnerLeadershipRow
  }

  async select(id: string, schoolId: string, nextVersion: number): Promise<LearnerLeadershipRow> {
    return this.setStatus(id, schoolId, 'selection', { version: nextVersion })
  }

  /** Nomination -> Not Selected, terminal (ADR-0015 Phase 4). */
  async markNotSelected(id: string, schoolId: string, reason: string, nextVersion: number): Promise<LearnerLeadershipRow> {
    return this.setStatus(id, schoolId, 'not_selected', { version: nextVersion, not_selected_reason: reason })
  }

  /** Selection -> Active Service. Sets start_date on entry. */
  async beginActiveService(id: string, schoolId: string, nextVersion: number): Promise<LearnerLeadershipRow> {
    return this.setStatus(id, schoolId, 'active_service', { version: nextVersion, start_date: new Date().toISOString().slice(0, 10) })
  }

  /** Active Service -> Review. */
  async review(id: string, schoolId: string, reviewedBy: string, notes: string | null, nextVersion: number): Promise<LearnerLeadershipRow> {
    return this.setStatus(id, schoolId, 'review', { version: nextVersion, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), review_notes: notes })
  }

  /** Active Service or Review -> Discontinued, terminal, neutral factual note only (ADR-0015 Phase 2/11). */
  async discontinue(id: string, schoolId: string, reason: string, nextVersion: number): Promise<LearnerLeadershipRow> {
    const now = new Date().toISOString()
    return this.setStatus(id, schoolId, 'discontinued', { version: nextVersion, discontinued_reason: reason, discontinued_at: now, end_date: now.slice(0, 10) })
  }

  /** Review -> Completion. The factual close-out. */
  async complete(id: string, schoolId: string, notes: string | null, nextVersion: number): Promise<LearnerLeadershipRow> {
    return this.setStatus(id, schoolId, 'completion', { version: nextVersion, completed_notes: notes, end_date: new Date().toISOString().slice(0, 10) })
  }

  /** Completion -> Verification. System-queued automatically (ADR-0015 Phase 4) — no human actor. */
  async queueForVerification(id: string, schoolId: string, nextVersion: number): Promise<LearnerLeadershipRow> {
    return this.setStatus(id, schoolId, 'verification', { version: nextVersion })
  }

  /** Verification -> Published. The authorized school actor's confirmation. */
  async publish(id: string, schoolId: string, verifiedBy: string, nextVersion: number): Promise<LearnerLeadershipRow> {
    const now = new Date().toISOString()
    return this.setStatus(id, schoolId, 'published', { version: nextVersion, verified_by: verifiedBy, verified_at: now, published_at: now })
  }

  /** Verification -> Rejected, terminal, distinct from Not Selected/Discontinued/Revoked. */
  async reject(id: string, schoolId: string, reason: string, nextVersion: number): Promise<LearnerLeadershipRow> {
    return this.setStatus(id, schoolId, 'rejected', { version: nextVersion, rejected_reason: reason })
  }

  /** One of the two legal transitions the DB trigger still allows on a published row. */
  async revoke(id: string, schoolId: string, revokedBy: string, reason: string, nextVersion: number): Promise<LearnerLeadershipRow> {
    return this.setStatus(id, schoolId, 'revoked', { version: nextVersion, revoked_by: revokedBy, revoked_reason: reason, revoked_at: new Date().toISOString() })
  }

  /** The other legal transition the DB trigger still allows on a published row — time-based dormancy, triggered here on demand; no cron wired this sprint (Stop Condition). */
  async moveToHistorical(id: string, schoolId: string, nextVersion: number): Promise<LearnerLeadershipRow> {
    return this.setStatus(id, schoolId, 'historical', { version: nextVersion, historical_at: new Date().toISOString() })
  }

  async setReflection(id: string, schoolId: string, reflection: string): Promise<LearnerLeadershipRow> {
    const { data, error } = await this.db
      .from('learner_leadership')
      .update({ reflection })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(LEADERSHIP_COLS)
      .single()
    if (error) throw new Error(`setReflection: ${error.message}`)
    return data as unknown as LearnerLeadershipRow
  }

  private async setStatus(
    id: string, schoolId: string, status: LeadershipStatus, extra: Record<string, unknown>
  ): Promise<LearnerLeadershipRow> {
    const { data, error } = await this.db
      .from('learner_leadership')
      .update({ status, ...extra })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(LEADERSHIP_COLS)
      .single()
    if (error) throw new Error(`setStatus(${status}): ${error.message}`)
    return data as unknown as LearnerLeadershipRow
  }

  async findById(id: string, schoolId: string): Promise<LearnerLeadershipRow | null> {
    const { data, error } = await this.db
      .from('learner_leadership')
      .select(LEADERSHIP_COLS)
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findById: ${error.message}`)
    return data as unknown as LearnerLeadershipRow | null
  }

  /** Every leadership entry for a learner, regardless of status — teacher/admin full view. */
  async listForLearner(learnerId: string, schoolId: string): Promise<LearnerLeadershipRow[]> {
    const { data, error } = await this.db
      .from('learner_leadership')
      .select(LEADERSHIP_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listForLearner: ${error.message}`)
    return (data ?? []) as unknown as LearnerLeadershipRow[]
  }

  /** Published entries only — the only status external/summary consumers (Blueprint) may read. Revoked entries are never included, even though they were once published. */
  async listPublished(learnerId: string, schoolId: string): Promise<LearnerLeadershipRow[]> {
    const { data, error } = await this.db
      .from('learner_leadership')
      .select(LEADERSHIP_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    if (error) throw new Error(`listPublished: ${error.message}`)
    return (data ?? []) as unknown as LearnerLeadershipRow[]
  }

  /** Selection/Active Service/Review — the "current role" set (ADR-0015 Phase 5: "Selection/Active Service-status"); a role under Review is still ongoing, not yet completed. */
  async listCurrent(learnerId: string, schoolId: string): Promise<LearnerLeadershipRow[]> {
    const { data, error } = await this.db
      .from('learner_leadership')
      .select(LEADERSHIP_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .in('status', ['selection', 'active_service', 'review'])
      .order('updated_at', { ascending: false })
    if (error) throw new Error(`listCurrent: ${error.message}`)
    return (data ?? []) as unknown as LearnerLeadershipRow[]
  }

  // ── leadership_history ───────────────────────────────────────────────────

  async recordTransition(
    leadershipId: string,
    fromStatus: LeadershipStatus,
    toStatus: LeadershipStatus,
    actorSchoolUserId: string | null,
    reason: string | null,
    version: number
  ): Promise<LeadershipHistoryRow> {
    const { data, error } = await this.db
      .from('leadership_history')
      .insert({
        leadership_id: leadershipId, from_status: fromStatus, to_status: toStatus,
        actor_school_user_id: actorSchoolUserId, reason, version,
      })
      .select('id, leadership_id, from_status, to_status, actor_school_user_id, reason, version, created_at')
      .single()
    if (error) throw new Error(`recordTransition: ${error.message}`)
    return data as unknown as LeadershipHistoryRow
  }

  async listHistory(leadershipId: string): Promise<LeadershipHistoryRow[]> {
    const { data, error } = await this.db
      .from('leadership_history')
      .select('id, leadership_id, from_status, to_status, actor_school_user_id, reason, version, created_at')
      .eq('leadership_id', leadershipId)
      .order('version', { ascending: true })
    if (error) throw new Error(`listHistory: ${error.message}`)
    return (data ?? []) as unknown as LeadershipHistoryRow[]
  }
}
