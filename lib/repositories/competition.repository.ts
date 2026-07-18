// lib/repositories/competition.repository.ts
//
// Owns `learner_competitions`, `competition_members`, `competition_media`,
// `competition_history` exclusively (Sprint 13B, ADR-0014). Only the
// canonical operations the mission named — no business logic (no
// permission checks, no lifecycle validation): that all lives in
// lib/learnerCompetitions/competition.ts. This repository only knows how
// to read and write rows; the DB's own trigger
// (`enforce_competition_immutability`) is the final backstop against a
// terminal-state or published row ever being edited.
//
// Per ADR-0014 Phase 6/mission Phase 3 discipline: no generic update()/
// delete()/mutate() on competitions — every lifecycle transition gets its
// own named method, and there is no delete path at all once a competition
// has left `opportunity`. Naming is kept distinct from ProjectRepository
// and AchievementRepository throughout (competition_* tables, Competition*
// types, no shared method names beyond the identical CRUD shape every
// sibling repository in this series already uses).

import { BaseRepository } from './base'

export type CompetitionLevel = 'school' | 'regional' | 'national' | 'international'

export type CompetitionCategory =
  | 'academic' | 'robotics' | 'coding' | 'debate' | 'sports'
  | 'music' | 'drama' | 'science' | 'innovation' | 'quiz' | 'other'

export type CompetitionStatus =
  | 'opportunity' | 'registration' | 'preparation' | 'participation'
  | 'judging' | 'results' | 'verification' | 'published' | 'historical'
  | 'rejected' | 'withdrawn' | 'revoked'

export type LearnerCompetitionRow = {
  id: string
  learner_id: string
  school_id: string
  name: string
  organizing_body: string | null
  level: CompetitionLevel
  category: CompetitionCategory
  event_date: string | null
  venue: string | null
  project_id: string | null
  mentor_school_user_id: string | null
  status: CompetitionStatus
  position: string | null
  results_summary: string | null
  judges: string | null
  feedback: string | null
  supporting_evidence_ids: string[]
  recorded_by: string | null
  verified_by: string | null
  verified_at: string | null
  rejected_reason: string | null
  published_at: string | null
  historical_at: string | null
  revoked_by: string | null
  revoked_reason: string | null
  revoked_at: string | null
  withdrawn_reason: string | null
  withdrawn_at: string | null
  version: number
  created_at: string
  updated_at: string
}

export type CompetitionMemberRow = { id: string; competition_id: string; learner_id: string; role: string | null; created_at: string }
export type CompetitionMediaRow = { id: string; competition_id: string; url: string; label: string | null; created_at: string }
export type CompetitionHistoryRow = {
  id: string
  competition_id: string
  from_status: CompetitionStatus
  to_status: CompetitionStatus
  actor_school_user_id: string | null
  reason: string | null
  version: number
  created_at: string
}

export type CreateCompetitionInput = {
  learner_id: string
  school_id: string
  name: string
  organizing_body: string | null
  level: CompetitionLevel
  category: CompetitionCategory
  event_date: string | null
  venue: string | null
  project_id: string | null
  supporting_evidence_ids: string[]
  recorded_by: string | null
}

export type UpdateOpportunityInput = Partial<
  Pick<LearnerCompetitionRow,
    'name' | 'organizing_body' | 'level' | 'category' | 'event_date' | 'venue' |
    'project_id' | 'supporting_evidence_ids'>
>

const COMPETITION_COLS =
  'id, learner_id, school_id, name, organizing_body, level, category, event_date, venue, project_id, ' +
  'mentor_school_user_id, status, position, results_summary, judges, feedback, supporting_evidence_ids, ' +
  'recorded_by, verified_by, verified_at, rejected_reason, published_at, historical_at, revoked_by, ' +
  'revoked_reason, revoked_at, withdrawn_reason, withdrawn_at, version, created_at, updated_at'

export class CompetitionRepository extends BaseRepository {
  // ── learner_competitions ─────────────────────────────────────────────────

  async create(input: CreateCompetitionInput): Promise<LearnerCompetitionRow> {
    const { data, error } = await this.db
      .from('learner_competitions')
      .insert({ ...input, status: 'opportunity', version: 1 })
      .select(COMPETITION_COLS)
      .single()
    if (error) throw new Error(`create: ${error.message}`)
    return data as unknown as LearnerCompetitionRow
  }

  /** Only succeeds while the row is still `opportunity` — the DB trigger rejects any attempt once it has moved on. */
  async updateOpportunity(id: string, schoolId: string, input: UpdateOpportunityInput): Promise<LearnerCompetitionRow> {
    const { data, error } = await this.db
      .from('learner_competitions')
      .update(input)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(COMPETITION_COLS)
      .single()
    if (error) throw new Error(`updateOpportunity: ${error.message}`)
    return data as unknown as LearnerCompetitionRow
  }

  async setMentor(id: string, schoolId: string, mentorSchoolUserId: string | null): Promise<LearnerCompetitionRow> {
    const { data, error } = await this.db
      .from('learner_competitions')
      .update({ mentor_school_user_id: mentorSchoolUserId })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(COMPETITION_COLS)
      .single()
    if (error) throw new Error(`setMentor: ${error.message}`)
    return data as unknown as LearnerCompetitionRow
  }

  async register(id: string, schoolId: string, nextVersion: number): Promise<LearnerCompetitionRow> {
    return this.setStatus(id, schoolId, 'registration', { version: nextVersion })
  }

  async beginPreparation(id: string, schoolId: string, nextVersion: number): Promise<LearnerCompetitionRow> {
    return this.setStatus(id, schoolId, 'preparation', { version: nextVersion })
  }

  async beginParticipation(id: string, schoolId: string, nextVersion: number): Promise<LearnerCompetitionRow> {
    return this.setStatus(id, schoolId, 'participation', { version: nextVersion })
  }

  async beginJudging(id: string, schoolId: string, nextVersion: number): Promise<LearnerCompetitionRow> {
    return this.setStatus(id, schoolId, 'judging', { version: nextVersion })
  }

  /** Judging -> Results. Records the organizer-announced outcome. */
  async recordResults(
    id: string, schoolId: string,
    position: string | null, resultsSummary: string | null, judges: string | null, feedback: string | null,
    nextVersion: number
  ): Promise<LearnerCompetitionRow> {
    return this.setStatus(id, schoolId, 'results', {
      version: nextVersion, position, results_summary: resultsSummary, judges, feedback,
    })
  }

  /** Results -> Verification. System-queued automatically on Results entry (ADR-0014 Phase 4) — no human actor. */
  async queueForVerification(id: string, schoolId: string, nextVersion: number): Promise<LearnerCompetitionRow> {
    return this.setStatus(id, schoolId, 'verification', { version: nextVersion })
  }

  /** Verification -> Published. The authorized school actor's confirmation (ADR-0014 Phase 4). */
  async publish(id: string, schoolId: string, verifiedBy: string, nextVersion: number): Promise<LearnerCompetitionRow> {
    const now = new Date().toISOString()
    return this.setStatus(id, schoolId, 'published', {
      version: nextVersion, verified_by: verifiedBy, verified_at: now, published_at: now,
    })
  }

  /** Verification -> Rejected, a distinct terminal state from Withdrawn/Revoked (ADR-0014 Phase 4). */
  async reject(id: string, schoolId: string, reason: string, nextVersion: number): Promise<LearnerCompetitionRow> {
    return this.setStatus(id, schoolId, 'rejected', { version: nextVersion, rejected_reason: reason })
  }

  /** Reachable from Registration/Preparation/Participation only (service-enforced) — a real exit, never a silent drop. */
  async withdraw(id: string, schoolId: string, reason: string, nextVersion: number): Promise<LearnerCompetitionRow> {
    return this.setStatus(id, schoolId, 'withdrawn', { version: nextVersion, withdrawn_reason: reason, withdrawn_at: new Date().toISOString() })
  }

  /** One of the two legal transitions the DB trigger still allows on a published row. */
  async revoke(id: string, schoolId: string, revokedBy: string, reason: string, nextVersion: number): Promise<LearnerCompetitionRow> {
    return this.setStatus(id, schoolId, 'revoked', { version: nextVersion, revoked_by: revokedBy, revoked_reason: reason, revoked_at: new Date().toISOString() })
  }

  /** The other legal transition the DB trigger still allows on a published row — time-based dormancy (ADR-0014 Phase 4), triggered here on demand; no cron wired this sprint (Stop Condition). */
  async moveToHistorical(id: string, schoolId: string, nextVersion: number): Promise<LearnerCompetitionRow> {
    return this.setStatus(id, schoolId, 'historical', { version: nextVersion, historical_at: new Date().toISOString() })
  }

  private async setStatus(
    id: string, schoolId: string, status: CompetitionStatus, extra: Record<string, unknown>
  ): Promise<LearnerCompetitionRow> {
    const { data, error } = await this.db
      .from('learner_competitions')
      .update({ status, ...extra })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(COMPETITION_COLS)
      .single()
    if (error) throw new Error(`setStatus(${status}): ${error.message}`)
    return data as unknown as LearnerCompetitionRow
  }

  async findById(id: string, schoolId: string): Promise<LearnerCompetitionRow | null> {
    const { data, error } = await this.db
      .from('learner_competitions')
      .select(COMPETITION_COLS)
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findById: ${error.message}`)
    return data as unknown as LearnerCompetitionRow | null
  }

  /** Every competition for a learner, regardless of status — teacher/admin full view. */
  async listForLearner(learnerId: string, schoolId: string): Promise<LearnerCompetitionRow[]> {
    const { data, error } = await this.db
      .from('learner_competitions')
      .select(COMPETITION_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listForLearner: ${error.message}`)
    return (data ?? []) as unknown as LearnerCompetitionRow[]
  }

  /** Published competitions only — the only status external/summary consumers (Blueprint) may read. Revoked competitions are never included, even though they were once published. */
  async listPublished(learnerId: string, schoolId: string): Promise<LearnerCompetitionRow[]> {
    const { data, error } = await this.db
      .from('learner_competitions')
      .select(COMPETITION_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    if (error) throw new Error(`listPublished: ${error.message}`)
    return (data ?? []) as unknown as LearnerCompetitionRow[]
  }

  /** Every in-flight (post-opportunity, pre-terminal) competition — Blueprint's "current participation" reads only {name, level, category} from whichever this returns first (service picks "current"). */
  async listInFlight(learnerId: string, schoolId: string): Promise<LearnerCompetitionRow[]> {
    const { data, error } = await this.db
      .from('learner_competitions')
      .select(COMPETITION_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .in('status', ['registration', 'preparation', 'participation', 'judging', 'results', 'verification'])
      .order('updated_at', { ascending: false })
    if (error) throw new Error(`listInFlight: ${error.message}`)
    return (data ?? []) as unknown as LearnerCompetitionRow[]
  }

  // ── competition_members / competition_media ─────────────────────────────

  async addMember(competitionId: string, learnerId: string, role: string | null): Promise<CompetitionMemberRow> {
    const { data, error } = await this.db
      .from('competition_members')
      .insert({ competition_id: competitionId, learner_id: learnerId, role })
      .select('id, competition_id, learner_id, role, created_at')
      .single()
    if (error) throw new Error(`addMember: ${error.message}`)
    return data as unknown as CompetitionMemberRow
  }

  async listMembers(competitionId: string): Promise<CompetitionMemberRow[]> {
    const { data, error } = await this.db
      .from('competition_members')
      .select('id, competition_id, learner_id, role, created_at')
      .eq('competition_id', competitionId)
    if (error) throw new Error(`listMembers: ${error.message}`)
    return (data ?? []) as unknown as CompetitionMemberRow[]
  }

  async addMedia(competitionId: string, url: string, label: string | null): Promise<CompetitionMediaRow> {
    const { data, error } = await this.db
      .from('competition_media')
      .insert({ competition_id: competitionId, url, label })
      .select('id, competition_id, url, label, created_at')
      .single()
    if (error) throw new Error(`addMedia: ${error.message}`)
    return data as unknown as CompetitionMediaRow
  }

  async listMedia(competitionId: string): Promise<CompetitionMediaRow[]> {
    const { data, error } = await this.db
      .from('competition_media')
      .select('id, competition_id, url, label, created_at')
      .eq('competition_id', competitionId)
    if (error) throw new Error(`listMedia: ${error.message}`)
    return (data ?? []) as unknown as CompetitionMediaRow[]
  }

  // ── competition_history ──────────────────────────────────────────────────

  async recordTransition(
    competitionId: string,
    fromStatus: CompetitionStatus,
    toStatus: CompetitionStatus,
    actorSchoolUserId: string | null,
    reason: string | null,
    version: number
  ): Promise<CompetitionHistoryRow> {
    const { data, error } = await this.db
      .from('competition_history')
      .insert({
        competition_id: competitionId, from_status: fromStatus, to_status: toStatus,
        actor_school_user_id: actorSchoolUserId, reason, version,
      })
      .select('id, competition_id, from_status, to_status, actor_school_user_id, reason, version, created_at')
      .single()
    if (error) throw new Error(`recordTransition: ${error.message}`)
    return data as unknown as CompetitionHistoryRow
  }

  async listHistory(competitionId: string): Promise<CompetitionHistoryRow[]> {
    const { data, error } = await this.db
      .from('competition_history')
      .select('id, competition_id, from_status, to_status, actor_school_user_id, reason, version, created_at')
      .eq('competition_id', competitionId)
      .order('version', { ascending: true })
    if (error) throw new Error(`listHistory: ${error.message}`)
    return (data ?? []) as unknown as CompetitionHistoryRow[]
  }
}
