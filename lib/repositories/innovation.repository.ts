// lib/repositories/innovation.repository.ts
//
// Owns `learner_innovations`, `innovation_iterations`, `innovation_artifacts`,
// `innovation_review_history` exclusively (Sprint 13I, ADR-0018). Only the
// canonical operations the mission named — no business logic (no
// permission checks, no lifecycle validation): that all lives in
// lib/learnerInnovation/innovation.ts. This repository only knows how to
// read and write rows; the DB's own trigger
// (`enforce_innovation_immutability`) is the final backstop against a
// terminal-state or implemented row ever being edited.
//
// Per ADR-0018 Phase 5/mission Phase 4 discipline: no generic update()/
// delete()/mutate()/save() on innovations — every lifecycle transition
// gets its own named method. No repository method wraps a delete action
// at all (mirrors every sibling domain's identical choice) — the DB's own
// trigger is the sole backstop against a raw `.delete()` call, exactly as
// intended by "delete legal only while `idea`."

import { BaseRepository } from './base'

export type InnovationStatus =
  | 'idea' | 'exploration' | 'prototype' | 'testing' | 'refinement'
  | 'validation' | 'implementation' | 'archived'
  | 'discontinued' | 'not_validated' | 'revoked'

export type LearnerInnovationRow = {
  id: string
  learner_id: string
  school_id: string
  problem_addressed: string
  idea_summary: string
  status: InnovationStatus
  mentor_school_user_id: string | null
  project_id: string | null
  competition_id: string | null
  validated_by: string | null
  validated_at: string | null
  impact_evidence: string | null
  adoption_note: string | null
  public_demonstration: string | null
  discontinued_reason: string | null
  lessons_learned: string | null
  discontinued_at: string | null
  not_validated_reason: string | null
  not_validated_at: string | null
  revoked_by: string | null
  revoked_reason: string | null
  revoked_at: string | null
  archived_at: string | null
  published_at: string | null
  supporting_evidence_ids: string[]
  recorded_by: string | null
  version: number
  schema_version: number
  created_at: string
  updated_at: string
}

export type InnovationIterationRow = {
  id: string
  innovation_id: string
  problem: string
  hypothesis: string
  change_introduced: string
  evidence: string
  outcome: string
  teacher_note: string | null
  actor_school_user_id: string | null
  created_at: string
}

export type InnovationArtifactRow = { id: string; innovation_id: string; url: string; label: string | null; created_at: string }

export type InnovationReviewHistoryRow = {
  id: string
  innovation_id: string
  from_status: InnovationStatus
  to_status: InnovationStatus
  actor_school_user_id: string | null
  reason: string | null
  version: number
  created_at: string
}

export type CreateInnovationInput = {
  learner_id: string
  school_id: string
  problem_addressed: string
  idea_summary: string
  supporting_evidence_ids: string[]
  recorded_by: string | null
}

export type UpdateIdeaInput = Partial<Pick<LearnerInnovationRow, 'problem_addressed' | 'idea_summary' | 'supporting_evidence_ids'>>

const INNOVATION_COLS =
  'id, learner_id, school_id, problem_addressed, idea_summary, status, mentor_school_user_id, project_id, ' +
  'competition_id, validated_by, validated_at, impact_evidence, adoption_note, public_demonstration, ' +
  'discontinued_reason, lessons_learned, discontinued_at, not_validated_reason, not_validated_at, revoked_by, ' +
  'revoked_reason, revoked_at, archived_at, published_at, supporting_evidence_ids, recorded_by, version, ' +
  'schema_version, created_at, updated_at'

export class InnovationRepository extends BaseRepository {
  // ── learner_innovations ──────────────────────────────────────────────────

  async createIdea(input: CreateInnovationInput): Promise<LearnerInnovationRow> {
    const { data, error } = await this.db
      .from('learner_innovations')
      .insert({ ...input, status: 'idea', version: 1 })
      .select(INNOVATION_COLS)
      .single()
    if (error) throw new Error(`createIdea: ${error.message}`)
    return data as unknown as LearnerInnovationRow
  }

  /** Only succeeds while the row is still `idea` — the DB trigger rejects any attempt once it has moved on. */
  async updateIdea(id: string, schoolId: string, input: UpdateIdeaInput): Promise<LearnerInnovationRow> {
    const { data, error } = await this.db
      .from('learner_innovations')
      .update(input)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(INNOVATION_COLS)
      .single()
    if (error) throw new Error(`updateIdea: ${error.message}`)
    return data as unknown as LearnerInnovationRow
  }

  async setMentor(id: string, schoolId: string, mentorSchoolUserId: string | null): Promise<LearnerInnovationRow> {
    const { data, error } = await this.db
      .from('learner_innovations')
      .update({ mentor_school_user_id: mentorSchoolUserId })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(INNOVATION_COLS)
      .single()
    if (error) throw new Error(`setMentor: ${error.message}`)
    return data as unknown as LearnerInnovationRow
  }

  async setProjectReference(id: string, schoolId: string, projectId: string | null): Promise<LearnerInnovationRow> {
    const { data, error } = await this.db
      .from('learner_innovations')
      .update({ project_id: projectId })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(INNOVATION_COLS)
      .single()
    if (error) throw new Error(`setProjectReference: ${error.message}`)
    return data as unknown as LearnerInnovationRow
  }

  async setCompetitionReference(id: string, schoolId: string, competitionId: string | null): Promise<LearnerInnovationRow> {
    const { data, error } = await this.db
      .from('learner_innovations')
      .update({ competition_id: competitionId })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(INNOVATION_COLS)
      .single()
    if (error) throw new Error(`setCompetitionReference: ${error.message}`)
    return data as unknown as LearnerInnovationRow
  }

  async beginExploration(id: string, schoolId: string, nextVersion: number): Promise<LearnerInnovationRow> {
    return this.setStatus(id, schoolId, 'exploration', { version: nextVersion })
  }

  async createPrototype(id: string, schoolId: string, nextVersion: number): Promise<LearnerInnovationRow> {
    return this.setStatus(id, schoolId, 'prototype', { version: nextVersion })
  }

  async moveToTesting(id: string, schoolId: string, nextVersion: number): Promise<LearnerInnovationRow> {
    return this.setStatus(id, schoolId, 'testing', { version: nextVersion })
  }

  async moveToRefinement(id: string, schoolId: string, nextVersion: number): Promise<LearnerInnovationRow> {
    return this.setStatus(id, schoolId, 'refinement', { version: nextVersion })
  }

  /** Refinement -> Validation. Teacher-gated (mission Phase 8) — validatedBy/validatedAt set in the same call. */
  async validateInnovation(id: string, schoolId: string, validatedBy: string, nextVersion: number): Promise<LearnerInnovationRow> {
    return this.setStatus(id, schoolId, 'validation', { version: nextVersion, validated_by: validatedBy, validated_at: new Date().toISOString() })
  }

  /** Refinement -> Not Validated, terminal — the sibling rejection outcome of the same gate `validateInnovation()` passes. */
  async markNotValidated(id: string, schoolId: string, reason: string, nextVersion: number): Promise<LearnerInnovationRow> {
    return this.setStatus(id, schoolId, 'not_validated', { version: nextVersion, not_validated_reason: reason, not_validated_at: new Date().toISOString() })
  }

  /** Validation -> Implementation. Sets `published_at` (this domain's credential-worthy moment — ADR-0018 Phase 5). */
  async implementInnovation(
    id: string, schoolId: string, adoptionNote: string | null, impactEvidence: string | null, nextVersion: number
  ): Promise<LearnerInnovationRow> {
    return this.setStatus(id, schoolId, 'implementation', {
      version: nextVersion, adoption_note: adoptionNote, impact_evidence: impactEvidence, published_at: new Date().toISOString(),
    })
  }

  /** Implementation -> Archived — the one legal transition on an implemented row that doesn't revoke it. */
  async archiveInnovation(id: string, schoolId: string, nextVersion: number): Promise<LearnerInnovationRow> {
    return this.setStatus(id, schoolId, 'archived', { version: nextVersion, archived_at: new Date().toISOString() })
  }

  /** Implementation -> Revoked — the other legal transition the DB trigger still allows on an implemented row. */
  async revokeInnovation(id: string, schoolId: string, revokedBy: string, reason: string, nextVersion: number): Promise<LearnerInnovationRow> {
    return this.setStatus(id, schoolId, 'revoked', { version: nextVersion, revoked_by: revokedBy, revoked_reason: reason, revoked_at: new Date().toISOString() })
  }

  /** Reachable from Idea/Exploration/Prototype/Testing/Refinement only (service-enforced) — requires both a reason and lessons learned (ADR-0018 Phase 5/8 Principle 2). */
  async discontinueInnovation(id: string, schoolId: string, reason: string, lessonsLearned: string, nextVersion: number): Promise<LearnerInnovationRow> {
    return this.setStatus(id, schoolId, 'discontinued', {
      version: nextVersion, discontinued_reason: reason, lessons_learned: lessonsLearned, discontinued_at: new Date().toISOString(),
    })
  }

  private async setStatus(
    id: string, schoolId: string, status: InnovationStatus, extra: Record<string, unknown>
  ): Promise<LearnerInnovationRow> {
    const { data, error } = await this.db
      .from('learner_innovations')
      .update({ status, ...extra })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(INNOVATION_COLS)
      .single()
    if (error) throw new Error(`setStatus(${status}): ${error.message}`)
    return data as unknown as LearnerInnovationRow
  }

  async findById(id: string, schoolId: string): Promise<LearnerInnovationRow | null> {
    const { data, error } = await this.db
      .from('learner_innovations')
      .select(INNOVATION_COLS)
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findById: ${error.message}`)
    return data as unknown as LearnerInnovationRow | null
  }

  /** Every innovation for a learner, regardless of status — teacher/admin full view. */
  async listForLearner(learnerId: string, schoolId: string): Promise<LearnerInnovationRow[]> {
    const { data, error } = await this.db
      .from('learner_innovations')
      .select(INNOVATION_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listForLearner: ${error.message}`)
    return (data ?? []) as unknown as LearnerInnovationRow[]
  }

  /** Implemented innovations only — the only status external/summary consumers (Blueprint) may read. Revoked innovations are never included, even though they were once implemented. */
  async listImplemented(learnerId: string, schoolId: string): Promise<LearnerInnovationRow[]> {
    const { data, error } = await this.db
      .from('learner_innovations')
      .select(INNOVATION_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .eq('status', 'implementation')
      .order('published_at', { ascending: false })
    if (error) throw new Error(`listImplemented: ${error.message}`)
    return (data ?? []) as unknown as LearnerInnovationRow[]
  }

  /** Every in-flight (pre-Implementation, pre-terminal) innovation — Blueprint's "current stage" reads only {problem_addressed, status} from whichever this returns first (service picks "current"). */
  async listInFlight(learnerId: string, schoolId: string): Promise<LearnerInnovationRow[]> {
    const { data, error } = await this.db
      .from('learner_innovations')
      .select(INNOVATION_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .in('status', ['idea', 'exploration', 'prototype', 'testing', 'refinement', 'validation'])
      .order('updated_at', { ascending: false })
    if (error) throw new Error(`listInFlight: ${error.message}`)
    return (data ?? []) as unknown as LearnerInnovationRow[]
  }

  // ── innovation_iterations (append-only) ──────────────────────────────────

  async addIteration(
    innovationId: string, problem: string, hypothesis: string, changeIntroduced: string,
    evidence: string, outcome: string, teacherNote: string | null, actorSchoolUserId: string | null
  ): Promise<InnovationIterationRow> {
    const { data, error } = await this.db
      .from('innovation_iterations')
      .insert({
        innovation_id: innovationId, problem, hypothesis, change_introduced: changeIntroduced,
        evidence, outcome, teacher_note: teacherNote, actor_school_user_id: actorSchoolUserId,
      })
      .select('id, innovation_id, problem, hypothesis, change_introduced, evidence, outcome, teacher_note, actor_school_user_id, created_at')
      .single()
    if (error) throw new Error(`addIteration: ${error.message}`)
    return data as unknown as InnovationIterationRow
  }

  async listIterations(innovationId: string): Promise<InnovationIterationRow[]> {
    const { data, error } = await this.db
      .from('innovation_iterations')
      .select('id, innovation_id, problem, hypothesis, change_introduced, evidence, outcome, teacher_note, actor_school_user_id, created_at')
      .eq('innovation_id', innovationId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`listIterations: ${error.message}`)
    return (data ?? []) as unknown as InnovationIterationRow[]
  }

  // ── innovation_artifacts ─────────────────────────────────────────────────

  async addArtifact(innovationId: string, url: string, label: string | null): Promise<InnovationArtifactRow> {
    const { data, error } = await this.db
      .from('innovation_artifacts')
      .insert({ innovation_id: innovationId, url, label })
      .select('id, innovation_id, url, label, created_at')
      .single()
    if (error) throw new Error(`addArtifact: ${error.message}`)
    return data as unknown as InnovationArtifactRow
  }

  async listArtifacts(innovationId: string): Promise<InnovationArtifactRow[]> {
    const { data, error } = await this.db
      .from('innovation_artifacts')
      .select('id, innovation_id, url, label, created_at')
      .eq('innovation_id', innovationId)
    if (error) throw new Error(`listArtifacts: ${error.message}`)
    return (data ?? []) as unknown as InnovationArtifactRow[]
  }

  // ── innovation_review_history (append-only) ──────────────────────────────

  async recordTransition(
    innovationId: string, fromStatus: InnovationStatus, toStatus: InnovationStatus,
    actorSchoolUserId: string | null, reason: string | null, version: number
  ): Promise<InnovationReviewHistoryRow> {
    const { data, error } = await this.db
      .from('innovation_review_history')
      .insert({ innovation_id: innovationId, from_status: fromStatus, to_status: toStatus, actor_school_user_id: actorSchoolUserId, reason, version })
      .select('id, innovation_id, from_status, to_status, actor_school_user_id, reason, version, created_at')
      .single()
    if (error) throw new Error(`recordTransition: ${error.message}`)
    return data as unknown as InnovationReviewHistoryRow
  }

  async listHistory(innovationId: string): Promise<InnovationReviewHistoryRow[]> {
    const { data, error } = await this.db
      .from('innovation_review_history')
      .select('id, innovation_id, from_status, to_status, actor_school_user_id, reason, version, created_at')
      .eq('innovation_id', innovationId)
      .order('version', { ascending: true })
    if (error) throw new Error(`listHistory: ${error.message}`)
    return (data ?? []) as unknown as InnovationReviewHistoryRow[]
  }
}
