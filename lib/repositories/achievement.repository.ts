// lib/repositories/achievement.repository.ts
//
// Owns `learner_achievements`, `achievement_media`, `achievement_tags`,
// `achievement_verification_history` exclusively (Sprint 12W, ADR-0012).
// Only the canonical operations the mission named — no business logic (no
// permission checks, no lifecycle validation, no evidence-requirement
// rules): that all lives in lib/learnerAchievement/achievement.ts. This
// repository only knows how to read and write rows; the DB's own trigger
// (`enforce_achievement_immutability`) is the final backstop against a
// terminal-state or published row ever being edited, even if a future bug
// in the service layer tried to call `updateDraft` on one.
//
// Per ADR-0012 Phase 11/CLAUDE.md discipline: no generic update()/delete()
// on achievements — every lifecycle transition gets its own named method,
// and there is no deletePublished/updatePublished path at all.

import { BaseRepository } from './base'

export type AchievementType =
  | 'certificate' | 'competition' | 'leadership' | 'community_service'
  | 'innovation' | 'creative_work' | 'participation'

export type AchievementCategory =
  | 'academic' | 'leadership' | 'innovation' | 'community_service'
  | 'creative_arts' | 'sports' | 'entrepreneurship' | 'research'
  | 'technology' | 'other'

export type AchievementStatus = 'draft' | 'verified' | 'published' | 'rejected' | 'revoked' | 'archived'

export type LearnerAchievementRow = {
  id: string
  learner_id: string
  school_id: string
  achievement_type: AchievementType
  category: AchievementCategory
  title: string
  description: string | null
  supporting_evidence_ids: string[]
  verifying_document_reference: string | null
  awarding_organization: string | null
  award_date: string
  expires_at: string | null
  status: AchievementStatus
  version: number
  recorded_by: string | null
  verified_by: string | null
  verified_at: string | null
  rejected_reason: string | null
  published_at: string | null
  revoked_by: string | null
  revoked_reason: string | null
  revoked_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type AchievementMediaRow = { id: string; achievement_id: string; url: string; label: string | null; created_at: string }
export type AchievementTagRow = { id: string; achievement_id: string; tag: string; created_at: string }
export type AchievementHistoryRow = {
  id: string
  achievement_id: string
  from_status: AchievementStatus
  to_status: AchievementStatus
  actor_school_user_id: string | null
  reason: string | null
  version: number
  created_at: string
}

export type CreateAchievementInput = {
  learner_id: string
  school_id: string
  achievement_type: AchievementType
  category: AchievementCategory
  title: string
  description: string | null
  supporting_evidence_ids: string[]
  verifying_document_reference: string | null
  awarding_organization: string | null
  award_date: string
  expires_at: string | null
  recorded_by: string | null
}

export type UpdateDraftAchievementInput = Partial<
  Pick<LearnerAchievementRow,
    'achievement_type' | 'category' | 'title' | 'description' | 'supporting_evidence_ids' |
    'verifying_document_reference' | 'awarding_organization' | 'award_date' | 'expires_at'>
>

const ACHIEVEMENT_COLS =
  'id, learner_id, school_id, achievement_type, category, title, description, supporting_evidence_ids, ' +
  'verifying_document_reference, awarding_organization, award_date, expires_at, status, version, ' +
  'recorded_by, verified_by, verified_at, rejected_reason, published_at, revoked_by, revoked_reason, ' +
  'revoked_at, archived_at, created_at, updated_at'

export class AchievementRepository extends BaseRepository {
  // ── learner_achievements ─────────────────────────────────────────────────

  async create(input: CreateAchievementInput): Promise<LearnerAchievementRow> {
    const { data, error } = await this.db
      .from('learner_achievements')
      .insert({ ...input, status: 'draft', version: 1 })
      .select(ACHIEVEMENT_COLS)
      .single()
    if (error) throw new Error(`create: ${error.message}`)
    return data as unknown as LearnerAchievementRow
  }

  /** Only succeeds while the row is still `draft` — the DB trigger rejects any attempt once it has left draft. */
  async updateDraft(id: string, schoolId: string, input: UpdateDraftAchievementInput): Promise<LearnerAchievementRow> {
    const { data, error } = await this.db
      .from('learner_achievements')
      .update(input)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ACHIEVEMENT_COLS)
      .single()
    if (error) throw new Error(`updateDraft: ${error.message}`)
    return data as unknown as LearnerAchievementRow
  }

  async verify(id: string, schoolId: string, verifiedBy: string, nextVersion: number): Promise<LearnerAchievementRow> {
    const { data, error } = await this.db
      .from('learner_achievements')
      .update({ status: 'verified', verified_by: verifiedBy, verified_at: new Date().toISOString(), version: nextVersion })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ACHIEVEMENT_COLS)
      .single()
    if (error) throw new Error(`verify: ${error.message}`)
    return data as unknown as LearnerAchievementRow
  }

  async reject(id: string, schoolId: string, reason: string, nextVersion: number): Promise<LearnerAchievementRow> {
    const { data, error } = await this.db
      .from('learner_achievements')
      .update({ status: 'rejected', rejected_reason: reason, version: nextVersion })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ACHIEVEMENT_COLS)
      .single()
    if (error) throw new Error(`reject: ${error.message}`)
    return data as unknown as LearnerAchievementRow
  }

  async publish(id: string, schoolId: string, nextVersion: number): Promise<LearnerAchievementRow> {
    const { data, error } = await this.db
      .from('learner_achievements')
      .update({ status: 'published', published_at: new Date().toISOString(), version: nextVersion })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ACHIEVEMENT_COLS)
      .single()
    if (error) throw new Error(`publish: ${error.message}`)
    return data as unknown as LearnerAchievementRow
  }

  /** One of the two legal transitions the DB trigger still allows on a published row. */
  async revoke(id: string, schoolId: string, revokedBy: string, reason: string, nextVersion: number): Promise<LearnerAchievementRow> {
    const { data, error } = await this.db
      .from('learner_achievements')
      .update({ status: 'revoked', revoked_by: revokedBy, revoked_reason: reason, revoked_at: new Date().toISOString(), version: nextVersion })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ACHIEVEMENT_COLS)
      .single()
    if (error) throw new Error(`revoke: ${error.message}`)
    return data as unknown as LearnerAchievementRow
  }

  /** The other legal transition the DB trigger still allows on a published row. */
  async archive(id: string, schoolId: string, nextVersion: number): Promise<LearnerAchievementRow> {
    const { data, error } = await this.db
      .from('learner_achievements')
      .update({ status: 'archived', archived_at: new Date().toISOString(), version: nextVersion })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ACHIEVEMENT_COLS)
      .single()
    if (error) throw new Error(`archive: ${error.message}`)
    return data as unknown as LearnerAchievementRow
  }

  async findById(id: string, schoolId: string): Promise<LearnerAchievementRow | null> {
    const { data, error } = await this.db
      .from('learner_achievements')
      .select(ACHIEVEMENT_COLS)
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findById: ${error.message}`)
    return data as unknown as LearnerAchievementRow | null
  }

  /** Every achievement for a learner, regardless of status — teacher/admin/owning-learner view. */
  async listForLearner(learnerId: string, schoolId: string): Promise<LearnerAchievementRow[]> {
    const { data, error } = await this.db
      .from('learner_achievements')
      .select(ACHIEVEMENT_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listForLearner: ${error.message}`)
    return (data ?? []) as unknown as LearnerAchievementRow[]
  }

  /** Published achievements only — the only status external/summary consumers (Blueprint) may read. Revoked achievements are never included, even though they were once published (Phase 10). */
  async listPublished(learnerId: string, schoolId: string): Promise<LearnerAchievementRow[]> {
    const { data, error } = await this.db
      .from('learner_achievements')
      .select(ACHIEVEMENT_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    if (error) throw new Error(`listPublished: ${error.message}`)
    return (data ?? []) as unknown as LearnerAchievementRow[]
  }

  // ── achievement_media / achievement_tags ────────────────────────────────

  async addMedia(achievementId: string, url: string, label: string | null): Promise<AchievementMediaRow> {
    const { data, error } = await this.db
      .from('achievement_media')
      .insert({ achievement_id: achievementId, url, label })
      .select('id, achievement_id, url, label, created_at')
      .single()
    if (error) throw new Error(`addMedia: ${error.message}`)
    return data as unknown as AchievementMediaRow
  }

  async listMedia(achievementId: string): Promise<AchievementMediaRow[]> {
    const { data, error } = await this.db
      .from('achievement_media')
      .select('id, achievement_id, url, label, created_at')
      .eq('achievement_id', achievementId)
    if (error) throw new Error(`listMedia: ${error.message}`)
    return (data ?? []) as unknown as AchievementMediaRow[]
  }

  async addTag(achievementId: string, tag: string): Promise<AchievementTagRow> {
    const { data, error } = await this.db
      .from('achievement_tags')
      .insert({ achievement_id: achievementId, tag })
      .select('id, achievement_id, tag, created_at')
      .single()
    if (error) throw new Error(`addTag: ${error.message}`)
    return data as unknown as AchievementTagRow
  }

  async listTags(achievementId: string): Promise<AchievementTagRow[]> {
    const { data, error } = await this.db
      .from('achievement_tags')
      .select('id, achievement_id, tag, created_at')
      .eq('achievement_id', achievementId)
    if (error) throw new Error(`listTags: ${error.message}`)
    return (data ?? []) as unknown as AchievementTagRow[]
  }

  // ── achievement_verification_history ────────────────────────────────────

  async recordTransition(
    achievementId: string,
    fromStatus: AchievementStatus,
    toStatus: AchievementStatus,
    actorSchoolUserId: string | null,
    reason: string | null,
    version: number
  ): Promise<AchievementHistoryRow> {
    const { data, error } = await this.db
      .from('achievement_verification_history')
      .insert({
        achievement_id: achievementId, from_status: fromStatus, to_status: toStatus,
        actor_school_user_id: actorSchoolUserId, reason, version,
      })
      .select('id, achievement_id, from_status, to_status, actor_school_user_id, reason, version, created_at')
      .single()
    if (error) throw new Error(`recordTransition: ${error.message}`)
    return data as unknown as AchievementHistoryRow
  }

  async listHistory(achievementId: string): Promise<AchievementHistoryRow[]> {
    const { data, error } = await this.db
      .from('achievement_verification_history')
      .select('id, achievement_id, from_status, to_status, actor_school_user_id, reason, version, created_at')
      .eq('achievement_id', achievementId)
      .order('version', { ascending: true })
    if (error) throw new Error(`listHistory: ${error.message}`)
    return (data ?? []) as unknown as AchievementHistoryRow[]
  }
}
