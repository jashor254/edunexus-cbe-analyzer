// lib/learnerProjects/project.ts
//
// The canonical Learner Projects service (Sprint 12Z, ADR-0013). Owns:
// permission checks, lifecycle transitions (ADR-0013 Phase 5's frozen ten
// states — Draft/Planning/In Progress/Submitted/Reviewed/Verified/
// Published/Archived/Rejected/Cancelled), versioning, and field
// validation. No Supabase client is ever used directly here — every read/
// write goes through `repos.projects` (lib/repositories/project.repository.ts),
// which owns the tables exclusively.
//
// Teacher verification required (mission Phase 4/9) — every write action
// requires `requireSchoolStaff`, reusing the existing shared permission
// service rather than inventing another permission model. No learner- or
// parent-facing write path exists this sprint (no UI/route exists to
// exercise one — see the sprint doc's "Known Gaps" for the honest
// accounting of what a future learner-authoring sprint still needs).
//
// Unlike Achievement (ADR-0012 Phase 5's non-negotiable Evidence
// requirement), Projects' own Evidence relationship is explicitly
// optional (ADR-0013 Phase 7: "Projects MAY reference Evidence") — a
// purely creative/undertaking-in-progress project may have no Evidence at
// all and still verify legitimately (e.g. a teacher's own first-hand
// confirmation, self_only, etc.). This is a deliberate, ADR-grounded
// difference from Achievement's stricter rule, not an oversight.
//
// No AI, no automatic scoring, no rubric anywhere in this module
// (Forbidden list).

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSchoolStaff } from '@/lib/core/permissions'
import { repos } from '@/lib/repositories'
import type { LearnerProjectRow, ProjectVerificationType } from '@/lib/repositories/project.repository'
import { validateProjectFields } from './validation'
import { toProject, type Project, type ProjectFields, type ProjectsSummary } from './types'

async function withRelated(row: LearnerProjectRow): Promise<Project> {
  const [members, mentors, updates, artifacts] = await Promise.all([
    repos.projects.listMembers(row.id),
    repos.projects.listMentors(row.id),
    repos.projects.listUpdates(row.id),
    repos.projects.listArtifacts(row.id),
  ])
  return toProject(row, members, mentors, updates, artifacts)
}

/** Records a new Draft project. */
export async function createDraft(
  client: SupabaseClient,
  schoolId: string,
  learnerId: string,
  actorUserId: string,
  fields: ProjectFields
): Promise<Project> {
  await requireSchoolStaff(client, schoolId)
  validateProjectFields(fields)

  const creator = await repos.teachers.findSchoolUser(actorUserId, schoolId).catch(() => null)

  const row = await repos.projects.createDraft({
    learner_id: learnerId,
    school_id: schoolId,
    title: fields.title,
    description: fields.description,
    goal: fields.goal,
    category: fields.category,
    start_date: fields.startDate,
    completion_date: fields.completionDate,
    reflection: fields.reflection,
    supporting_evidence_ids: fields.supportingEvidenceIds,
    created_by: creator?.id ?? null,
  })
  return withRelated(row)
}

/** Edits an existing Draft. Throws a clean error if the project has left draft — the DB trigger is the final backstop. */
export async function updateDraft(
  client: SupabaseClient,
  schoolId: string,
  projectId: string,
  fields: Partial<ProjectFields>
): Promise<Project> {
  await requireSchoolStaff(client, schoolId)

  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  if (existing.status !== 'draft') throw new Error('This project is no longer a draft and cannot be edited directly.')

  const merged: ProjectFields = {
    title: fields.title ?? existing.title,
    description: fields.description !== undefined ? fields.description : existing.description,
    goal: fields.goal !== undefined ? fields.goal : existing.goal,
    category: fields.category ?? existing.category,
    startDate: fields.startDate !== undefined ? fields.startDate : existing.start_date,
    completionDate: fields.completionDate !== undefined ? fields.completionDate : existing.completion_date,
    reflection: fields.reflection !== undefined ? fields.reflection : existing.reflection,
    supportingEvidenceIds: fields.supportingEvidenceIds ?? existing.supporting_evidence_ids,
  }
  validateProjectFields(merged)

  const row = await repos.projects.updateDraft(projectId, schoolId, {
    title: merged.title,
    description: merged.description,
    goal: merged.goal,
    category: merged.category,
    start_date: merged.startDate,
    completion_date: merged.completionDate,
    reflection: merged.reflection,
    supporting_evidence_ids: merged.supportingEvidenceIds,
  })
  return withRelated(row)
}

export async function moveToPlanning(client: SupabaseClient, schoolId: string, projectId: string): Promise<Project> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  if (existing.status !== 'draft') throw new Error('Only a draft project can move to planning.')
  const row = await repos.projects.moveToPlanning(projectId, schoolId, existing.version + 1)
  return withRelated(row)
}

/** Planning -> In Progress. Sets the project's start_date on entry (frozen: never backdated later, ADR-0013 Phase 5). */
export async function startInProgress(client: SupabaseClient, schoolId: string, projectId: string): Promise<Project> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  if (existing.status !== 'planning') throw new Error('Only a project in planning can start.')
  const row = await repos.projects.startInProgress(projectId, schoolId, existing.version + 1)
  return withRelated(row)
}

/** In Progress -> Submitted — the learner (via a teacher/staff actor this sprint) considers the work complete. */
export async function submitProject(client: SupabaseClient, schoolId: string, projectId: string): Promise<Project> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  if (existing.status !== 'in_progress') throw new Error('Only a project in progress can be submitted.')
  const row = await repos.projects.submit(projectId, schoolId, existing.version + 1)
  return withRelated(row)
}

/** Submitted -> Reviewed — formative feedback, distinct from Verified (ADR-0013 Phase 5: different acts, different authority). */
export async function reviewProject(client: SupabaseClient, schoolId: string, projectId: string, notes: string | null): Promise<Project> {
  const membership = await requireSchoolStaff(client, schoolId)
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  if (existing.status !== 'submitted') throw new Error('Only a submitted project can be reviewed.')

  const reviewer = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!reviewer) throw new Error('Reviewing staff member has no school_users record — cannot attribute this review.')

  const row = await repos.projects.review(projectId, schoolId, reviewer.id, notes, existing.version + 1)
  return withRelated(row)
}

/**
 * Reviewed -> Verified. Evidence is optional here (ADR-0013 Phase 7), unlike
 * Achievement's non-negotiable rule — the verifying teacher/staff member's
 * own confirmation is sufficient; `verificationType` records how.
 */
export async function verifyProject(
  client: SupabaseClient, schoolId: string, projectId: string,
  verificationType: ProjectVerificationType, verifyingDocumentReference: string | null
): Promise<Project> {
  const membership = await requireSchoolStaff(client, schoolId)
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  if (existing.status !== 'reviewed') throw new Error('Only a reviewed project can be verified.')

  const verifier = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!verifier) throw new Error('Verifying staff member has no school_users record — cannot attribute this verification.')

  const row = await repos.projects.verify(projectId, schoolId, verifier.id, verificationType, verifyingDocumentReference, existing.version + 1)
  return withRelated(row)
}

/** Reachable from Submitted or Reviewed — a distinct terminal state from Cancelled (ADR-0013 Phase 5). */
export async function rejectProject(client: SupabaseClient, schoolId: string, projectId: string, reason: string): Promise<Project> {
  await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A rejection reason is required.')

  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  if (existing.status !== 'submitted' && existing.status !== 'reviewed') {
    throw new Error('Only a submitted or reviewed project can be rejected.')
  }
  const row = await repos.projects.reject(projectId, schoolId, reason, existing.version + 1)
  return withRelated(row)
}

/** Verified -> Published. Cannot publish an unverified project. */
export async function publishProject(client: SupabaseClient, schoolId: string, projectId: string): Promise<Project> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  if (existing.status !== 'verified') throw new Error('Cannot publish: this project has not been verified yet.')
  const row = await repos.projects.publish(projectId, schoolId, existing.version + 1)
  return withRelated(row)
}

/** Published -> Archived — the one legal transition on a published project, matching the identical rule every other domain in this series already enforces. */
export async function archiveProject(client: SupabaseClient, schoolId: string, projectId: string): Promise<Project> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  if (existing.status !== 'published') throw new Error('Only a published project can be archived.')
  const row = await repos.projects.archive(projectId, schoolId, existing.version + 1)
  return withRelated(row)
}

/** Reachable only from Draft/Planning/In Progress — never after Submitted (ADR-0013 Phase 5: a submitted claim gets a real disposition, never a silent withdrawal). */
export async function cancelProject(client: SupabaseClient, schoolId: string, projectId: string): Promise<Project> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  if (!['draft', 'planning', 'in_progress'].includes(existing.status)) {
    throw new Error('Only a Draft, Planning, or In Progress project can be cancelled.')
  }
  const row = await repos.projects.cancel(projectId, schoolId, existing.version + 1)
  return withRelated(row)
}

export async function addTeamMember(client: SupabaseClient, schoolId: string, projectId: string, teammateLearnerId: string, role: string | null): Promise<Project> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  await repos.projects.addMember(projectId, teammateLearnerId, role)
  return withRelated(existing)
}

export async function addMentor(client: SupabaseClient, schoolId: string, projectId: string, mentorName: string, mentorSchoolUserId: string | null, role: string | null): Promise<Project> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  await repos.projects.addMentor(projectId, mentorName, mentorSchoolUserId, role)
  return withRelated(existing)
}

export async function addProgressUpdate(client: SupabaseClient, schoolId: string, projectId: string, note: string): Promise<Project> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!note || !note.trim()) throw new Error('A progress update note is required.')
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  await repos.projects.addUpdate(projectId, note, actor?.id ?? null)
  return withRelated(existing)
}

export async function addArtifactLink(client: SupabaseClient, schoolId: string, projectId: string, url: string, label: string | null): Promise<Project> {
  await requireSchoolStaff(client, schoolId)
  if (!url || !url.trim()) throw new Error('An artifact URL is required.')
  const existing = await repos.projects.findById(projectId, schoolId)
  if (!existing) throw new Error('Project not found.')
  await repos.projects.addArtifact(projectId, url, label)
  return withRelated(existing)
}

export async function findProjectById(client: SupabaseClient, schoolId: string, projectId: string): Promise<Project | null> {
  await requireSchoolStaff(client, schoolId)
  const row = await repos.projects.findById(projectId, schoolId)
  return row ? withRelated(row) : null
}

/** Every project for a learner, any status — the teacher/admin full view. */
export async function listForLearner(client: SupabaseClient, schoolId: string, learnerId: string): Promise<Project[]> {
  await requireSchoolStaff(client, schoolId)
  const rows = await repos.projects.listForLearner(learnerId, schoolId)
  return Promise.all(rows.map(withRelated))
}

/** Published projects only — the surface every non-staff/summary consumer may read. */
export async function listPublished(learnerId: string, schoolId: string): Promise<Project[]> {
  const rows = await repos.projects.listPublished(learnerId, schoolId)
  return Promise.all(rows.map(withRelated))
}

/**
 * Blueprint's field budget for Projects (ADR-0013 Phase 2/6) — count,
 * latest published, current active, featured, URL. Never internal
 * lifecycle state, never a full record.
 */
export async function getProjectsSummary(learnerId: string, schoolId: string): Promise<ProjectsSummary> {
  const [published, inProgress] = await Promise.all([
    repos.projects.listPublished(learnerId, schoolId),
    repos.projects.listInProgress(learnerId, schoolId),
  ])

  const currentActive = inProgress[0] ?? null

  if (published.length === 0 && !currentActive) {
    return { available: false, projectCount: 0, latestPublishedProject: null, currentActiveProject: null, featuredProject: null, projectsUrl: null }
  }

  const sorted = [...published].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  const latest = sorted[0] ?? null

  return {
    available: true,
    projectCount: published.length,
    latestPublishedProject: latest ? { title: latest.title, category: latest.category, publishedAt: latest.published_at } : null,
    currentActiveProject: currentActive ? { title: currentActive.title, category: currentActive.category } : null,
    // No curation/pinning mechanism exists yet (out of this sprint's scope,
    // matching Portfolio's identical honest gap) — the most recently
    // published project stands in as "featured" until one is built, never
    // a fabricated distinct selection.
    featuredProject: latest ? { title: latest.title, category: latest.category, publishedAt: latest.published_at } : null,
    projectsUrl: null,
  }
}
