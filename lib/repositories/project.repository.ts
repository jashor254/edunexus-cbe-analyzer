// lib/repositories/project.repository.ts
//
// Owns `learner_projects`, `project_members`, `project_mentors`,
// `project_updates`, `project_artifacts` exclusively (Sprint 12Z,
// ADR-0013). Only the canonical operations the mission named — no
// business logic (no permission checks, no lifecycle validation): that
// all lives in lib/learnerProjects/project.ts. This repository only
// knows how to read and write rows; the DB's own trigger
// (`enforce_learner_project_immutability`) is the final backstop against
// a terminal-state or published row ever being edited.
//
// Per ADR-0013 Phase 3/CLAUDE.md discipline: no generic update()/delete()
// on projects — every lifecycle transition gets its own named method, and
// there is no delete path at all once a project has left draft.

import { BaseRepository } from './base'

export type ProjectCategory =
  | 'academic' | 'cbc' | 'research' | 'innovation' | 'technology'
  | 'creative_arts' | 'music' | 'drama' | 'business' | 'agriculture'
  | 'engineering' | 'community' | 'environmental' | 'leadership'
  | 'entrepreneurship' | 'digital'

export type ProjectStatus =
  | 'draft' | 'planning' | 'in_progress' | 'submitted' | 'reviewed'
  | 'verified' | 'published' | 'archived' | 'rejected' | 'cancelled'

export type ProjectVerificationType =
  | 'teacher_verified' | 'school_verified' | 'competition_verified'
  | 'external_verified' | 'self_only' | 'pending'

export type LearnerProjectRow = {
  id: string
  learner_id: string
  school_id: string
  title: string
  description: string | null
  goal: string | null
  category: ProjectCategory
  status: ProjectStatus
  start_date: string | null
  completion_date: string | null
  reflection: string | null
  supporting_evidence_ids: string[]
  verification_type: ProjectVerificationType | null
  verifying_document_reference: string | null
  verified_by: string | null
  verified_at: string | null
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejected_reason: string | null
  published_at: string | null
  archived_at: string | null
  cancelled_at: string | null
  created_by: string | null
  version: number
  created_at: string
  updated_at: string
}

export type ProjectMemberRow = { id: string; project_id: string; learner_id: string; role: string | null; created_at: string }
export type ProjectMentorRow = { id: string; project_id: string; mentor_name: string; mentor_school_user_id: string | null; role: string | null; created_at: string }
export type ProjectUpdateRow = { id: string; project_id: string; note: string; created_by: string | null; created_at: string }
export type ProjectArtifactRow = { id: string; project_id: string; url: string; label: string | null; created_at: string }

export type CreateProjectInput = {
  learner_id: string
  school_id: string
  title: string
  description: string | null
  goal: string | null
  category: ProjectCategory
  start_date: string | null
  completion_date: string | null
  reflection: string | null
  supporting_evidence_ids: string[]
  created_by: string | null
}

export type UpdateDraftProjectInput = Partial<
  Pick<LearnerProjectRow,
    'title' | 'description' | 'goal' | 'category' | 'start_date' | 'completion_date' |
    'reflection' | 'supporting_evidence_ids'>
>

const PROJECT_COLS =
  'id, learner_id, school_id, title, description, goal, category, status, start_date, completion_date, ' +
  'reflection, supporting_evidence_ids, verification_type, verifying_document_reference, verified_by, ' +
  'verified_at, review_notes, reviewed_by, reviewed_at, rejected_reason, published_at, archived_at, ' +
  'cancelled_at, created_by, version, created_at, updated_at'

export class ProjectRepository extends BaseRepository {
  // ── learner_projects ─────────────────────────────────────────────────────

  async createDraft(input: CreateProjectInput): Promise<LearnerProjectRow> {
    const { data, error } = await this.db
      .from('learner_projects')
      .insert({ ...input, status: 'draft', version: 1 })
      .select(PROJECT_COLS)
      .single()
    if (error) throw new Error(`createDraft: ${error.message}`)
    return data as unknown as LearnerProjectRow
  }

  /** Only succeeds while the project is still `draft` — the DB trigger rejects any attempt once it has left draft. */
  async updateDraft(id: string, schoolId: string, input: UpdateDraftProjectInput): Promise<LearnerProjectRow> {
    const { data, error } = await this.db
      .from('learner_projects')
      .update(input)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(PROJECT_COLS)
      .single()
    if (error) throw new Error(`updateDraft: ${error.message}`)
    return data as unknown as LearnerProjectRow
  }

  async moveToPlanning(id: string, schoolId: string, nextVersion: number): Promise<LearnerProjectRow> {
    return this.setStatus(id, schoolId, 'planning', { version: nextVersion })
  }

  async startInProgress(id: string, schoolId: string, nextVersion: number): Promise<LearnerProjectRow> {
    return this.setStatus(id, schoolId, 'in_progress', { version: nextVersion, start_date: new Date().toISOString().slice(0, 10) })
  }

  async submit(id: string, schoolId: string, nextVersion: number): Promise<LearnerProjectRow> {
    return this.setStatus(id, schoolId, 'submitted', { version: nextVersion })
  }

  async review(id: string, schoolId: string, reviewedBy: string, notes: string | null, nextVersion: number): Promise<LearnerProjectRow> {
    return this.setStatus(id, schoolId, 'reviewed', { version: nextVersion, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), review_notes: notes })
  }

  async verify(
    id: string, schoolId: string, verifiedBy: string,
    verificationType: ProjectVerificationType, verifyingDocumentReference: string | null, nextVersion: number
  ): Promise<LearnerProjectRow> {
    return this.setStatus(id, schoolId, 'verified', {
      version: nextVersion, verified_by: verifiedBy, verified_at: new Date().toISOString(),
      verification_type: verificationType, verifying_document_reference: verifyingDocumentReference,
    })
  }

  async reject(id: string, schoolId: string, reason: string, nextVersion: number): Promise<LearnerProjectRow> {
    return this.setStatus(id, schoolId, 'rejected', { version: nextVersion, rejected_reason: reason })
  }

  async publish(id: string, schoolId: string, nextVersion: number): Promise<LearnerProjectRow> {
    return this.setStatus(id, schoolId, 'published', { version: nextVersion, published_at: new Date().toISOString() })
  }

  /** The one legal transition the DB trigger still allows on a published row. */
  async archive(id: string, schoolId: string, nextVersion: number): Promise<LearnerProjectRow> {
    return this.setStatus(id, schoolId, 'archived', { version: nextVersion, archived_at: new Date().toISOString() })
  }

  async cancel(id: string, schoolId: string, nextVersion: number): Promise<LearnerProjectRow> {
    return this.setStatus(id, schoolId, 'cancelled', { version: nextVersion, cancelled_at: new Date().toISOString() })
  }

  private async setStatus(
    id: string, schoolId: string, status: ProjectStatus, extra: Record<string, unknown>
  ): Promise<LearnerProjectRow> {
    const { data, error } = await this.db
      .from('learner_projects')
      .update({ status, ...extra })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(PROJECT_COLS)
      .single()
    if (error) throw new Error(`setStatus(${status}): ${error.message}`)
    return data as unknown as LearnerProjectRow
  }

  async findById(id: string, schoolId: string): Promise<LearnerProjectRow | null> {
    const { data, error } = await this.db
      .from('learner_projects')
      .select(PROJECT_COLS)
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findById: ${error.message}`)
    return data as unknown as LearnerProjectRow | null
  }

  /** Every project for a learner, regardless of status — teacher/admin full view. */
  async listForLearner(learnerId: string, schoolId: string): Promise<LearnerProjectRow[]> {
    const { data, error } = await this.db
      .from('learner_projects')
      .select(PROJECT_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listForLearner: ${error.message}`)
    return (data ?? []) as unknown as LearnerProjectRow[]
  }

  /** Published projects only — the only status external/summary consumers (Blueprint) may read. */
  async listPublished(learnerId: string, schoolId: string): Promise<LearnerProjectRow[]> {
    const { data, error } = await this.db
      .from('learner_projects')
      .select(PROJECT_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    if (error) throw new Error(`listPublished: ${error.message}`)
    return (data ?? []) as unknown as LearnerProjectRow[]
  }

  /** Exactly one active (in_progress) project is the intended usage (service-enforced) — this returns all in_progress rows, the service picks "current." */
  async listInProgress(learnerId: string, schoolId: string): Promise<LearnerProjectRow[]> {
    const { data, error } = await this.db
      .from('learner_projects')
      .select(PROJECT_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
    if (error) throw new Error(`listInProgress: ${error.message}`)
    return (data ?? []) as unknown as LearnerProjectRow[]
  }

  // ── project_members / project_mentors / project_updates / project_artifacts ──

  async addMember(projectId: string, learnerId: string, role: string | null): Promise<ProjectMemberRow> {
    const { data, error } = await this.db
      .from('project_members')
      .insert({ project_id: projectId, learner_id: learnerId, role })
      .select('id, project_id, learner_id, role, created_at')
      .single()
    if (error) throw new Error(`addMember: ${error.message}`)
    return data as unknown as ProjectMemberRow
  }

  async listMembers(projectId: string): Promise<ProjectMemberRow[]> {
    const { data, error } = await this.db
      .from('project_members')
      .select('id, project_id, learner_id, role, created_at')
      .eq('project_id', projectId)
    if (error) throw new Error(`listMembers: ${error.message}`)
    return (data ?? []) as unknown as ProjectMemberRow[]
  }

  async addMentor(projectId: string, mentorName: string, mentorSchoolUserId: string | null, role: string | null): Promise<ProjectMentorRow> {
    const { data, error } = await this.db
      .from('project_mentors')
      .insert({ project_id: projectId, mentor_name: mentorName, mentor_school_user_id: mentorSchoolUserId, role })
      .select('id, project_id, mentor_name, mentor_school_user_id, role, created_at')
      .single()
    if (error) throw new Error(`addMentor: ${error.message}`)
    return data as unknown as ProjectMentorRow
  }

  async listMentors(projectId: string): Promise<ProjectMentorRow[]> {
    const { data, error } = await this.db
      .from('project_mentors')
      .select('id, project_id, mentor_name, mentor_school_user_id, role, created_at')
      .eq('project_id', projectId)
    if (error) throw new Error(`listMentors: ${error.message}`)
    return (data ?? []) as unknown as ProjectMentorRow[]
  }

  async addUpdate(projectId: string, note: string, createdBy: string | null): Promise<ProjectUpdateRow> {
    const { data, error } = await this.db
      .from('project_updates')
      .insert({ project_id: projectId, note, created_by: createdBy })
      .select('id, project_id, note, created_by, created_at')
      .single()
    if (error) throw new Error(`addUpdate: ${error.message}`)
    return data as unknown as ProjectUpdateRow
  }

  async listUpdates(projectId: string): Promise<ProjectUpdateRow[]> {
    const { data, error } = await this.db
      .from('project_updates')
      .select('id, project_id, note, created_by, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`listUpdates: ${error.message}`)
    return (data ?? []) as unknown as ProjectUpdateRow[]
  }

  async addArtifact(projectId: string, url: string, label: string | null): Promise<ProjectArtifactRow> {
    const { data, error } = await this.db
      .from('project_artifacts')
      .insert({ project_id: projectId, url, label })
      .select('id, project_id, url, label, created_at')
      .single()
    if (error) throw new Error(`addArtifact: ${error.message}`)
    return data as unknown as ProjectArtifactRow
  }

  async listArtifacts(projectId: string): Promise<ProjectArtifactRow[]> {
    const { data, error } = await this.db
      .from('project_artifacts')
      .select('id, project_id, url, label, created_at')
      .eq('project_id', projectId)
    if (error) throw new Error(`listArtifacts: ${error.message}`)
    return (data ?? []) as unknown as ProjectArtifactRow[]
  }
}
