// Senior School Programme Truth — the canonical read/write boundary for
// "what is this learner actually enrolled in," keyed to canonical
// `learners.id` (never legacy `students.id`).
//
// This module is deliberately NOT wired into Blueprint/Career Intelligence
// yet (see docs/architecture/ for the Phase 1 closeout report). It exists so
// a future integration reads programme truth from here instead of deriving
// "current subjects" from `learner_evidence`, which is what the audited
// architecture does today and which this module must never do — evidence
// existence must never be able to create programme membership, and its
// absence must never be read as programme absence.
//
// Ownership boundary (CLAUDE.md + this phase's spec): only this module
// writes learner_programmes/learner_programme_subjects, and only via the
// service-role client calling the create_or_update_senior_programme()
// Postgres function (one implicit transaction — see
// supabase/migrations/20260826093000_senior_programme_write_function.sql).
// No route/page may construct these rows directly.

import { createServiceClient } from '@/utils/supabase/service'
import { type LearnerId } from '@/lib/core/identityTypes'

export type ProgrammeSubjectRole = 'compulsory' | 'elective' | 'exception'

export type ProgrammeSubjectMembership = {
  subjectId: string
  subjectName: string
  subjectCode: string
  role: ProgrammeSubjectRole
  reason: string | null
}

export type SeniorProgramme = {
  id: string
  learnerId: LearnerId
  schoolId: string
  academicYearId: string
  curriculumPolicyVersionId: string | null
  pathway: string | null
  track: string | null
  combinationCode: string | null
  source: string
  effectiveFrom: string
  createdAt: string
}

export type CurrentSeniorProgrammeResult =
  | { status: 'resolved'; programme: SeniorProgramme; subjects: ProgrammeSubjectMembership[] }
  | { status: 'unresolved' }

export type CreateSeniorProgrammeSubjectInput = {
  subjectId: string
  role: ProgrammeSubjectRole
  reason?: string | null
}

export type CreateSeniorProgrammeInput = {
  learnerId: LearnerId
  schoolId: string
  academicYearId: string
  curriculumPolicyVersionId?: string | null
  pathway?: string | null
  track?: string | null
  combinationCode?: string | null
  source: 'admin_entry' | 'parent_selection' | 'legacy_migration' | 'system'
  createdBy?: string | null
  subjects: CreateSeniorProgrammeSubjectInput[]
}

type ProgrammeRow = {
  id: string
  learner_id: string
  school_id: string
  academic_year_id: string
  curriculum_policy_version_id: string | null
  pathway: string | null
  track: string | null
  combination_code: string | null
  source: string
  effective_from: string
  created_at: string
}

function toSeniorProgramme(row: ProgrammeRow): SeniorProgramme {
  return {
    id: row.id,
    learnerId: row.learner_id as LearnerId,
    schoolId: row.school_id,
    academicYearId: row.academic_year_id,
    curriculumPolicyVersionId: row.curriculum_policy_version_id,
    pathway: row.pathway,
    track: row.track,
    combinationCode: row.combination_code,
    source: row.source,
    effectiveFrom: row.effective_from,
    createdAt: row.created_at,
  }
}

/**
 * Reads the learner's CURRENT senior programme and canonical subject
 * memberships. Returns `{ status: 'unresolved' }` — never a fabricated
 * default and never a fallback to Evidence — if no programme has been
 * recorded for this learner yet. This is the one authoritative answer to
 * "which subjects is this learner actually taking right now."
 */
export async function getCurrentSeniorProgramme(
  learnerId: LearnerId
): Promise<CurrentSeniorProgrammeResult> {
  const db = createServiceClient()

  const { data: programmeRow, error: programmeError } = await db
    .from('learner_programmes')
    .select('id, learner_id, school_id, academic_year_id, curriculum_policy_version_id, pathway, track, combination_code, source, effective_from, created_at')
    .eq('learner_id', learnerId)
    .is('superseded_at', null)
    .maybeSingle()

  if (programmeError) {
    throw new Error(`getCurrentSeniorProgramme: failed to load programme for learner ${learnerId}: ${programmeError.message}`)
  }
  if (!programmeRow) {
    return { status: 'unresolved' }
  }

  const { data: subjectRows, error: subjectError } = await db
    .from('learner_programme_subjects')
    .select('subject_id, role, reason, subjects(name, code)')
    .eq('programme_id', programmeRow.id)

  if (subjectError) {
    throw new Error(`getCurrentSeniorProgramme: failed to load subject memberships for programme ${programmeRow.id}: ${subjectError.message}`)
  }

  const subjects: ProgrammeSubjectMembership[] = (subjectRows ?? []).map(row => {
    const subject = row.subjects as unknown as { name: string; code: string } | null
    return {
      subjectId: row.subject_id,
      subjectName: subject?.name ?? '(unknown subject)',
      subjectCode: subject?.code ?? '(unknown code)',
      role: row.role as ProgrammeSubjectRole,
      reason: row.reason,
    }
  })

  return { status: 'resolved', programme: toSeniorProgramme(programmeRow), subjects }
}

/**
 * Batched sibling of {@link getCurrentSeniorProgramme} — Phase 3C's
 * canonical marks-entry roster needs "does this learner's programme
 * include/exclude this subject" for every learner on a class roster at
 * once. Looping the single-learner reader per roster row would be a
 * query-per-iteration (CLAUDE.md: "NEVER query inside a loop"), so this
 * does the same two reads (`learner_programmes`, `learner_programme_subjects`)
 * batched via `.in('learner_id', ...)` and reassembles per-learner results
 * client-side. Same contract as the single-learner version: a learner with
 * no current programme row maps to `{status:'unresolved'}`, never a
 * fabricated default.
 */
export async function getCurrentSeniorProgrammesForLearners(
  learnerIds: readonly LearnerId[]
): Promise<Map<LearnerId, CurrentSeniorProgrammeResult>> {
  const result = new Map<LearnerId, CurrentSeniorProgrammeResult>()
  for (const id of learnerIds) result.set(id, { status: 'unresolved' })
  if (learnerIds.length === 0) return result

  const db = createServiceClient()

  const { data: programmeRows, error: programmeError } = await db
    .from('learner_programmes')
    .select('id, learner_id, school_id, academic_year_id, curriculum_policy_version_id, pathway, track, combination_code, source, effective_from, created_at')
    .in('learner_id', [...learnerIds])
    .is('superseded_at', null)

  if (programmeError) {
    throw new Error(`getCurrentSeniorProgrammesForLearners: failed to load programmes: ${programmeError.message}`)
  }
  if (!programmeRows || programmeRows.length === 0) return result

  const programmeIds = programmeRows.map(p => p.id)
  const { data: subjectRows, error: subjectError } = await db
    .from('learner_programme_subjects')
    .select('programme_id, subject_id, role, reason, subjects(name, code)')
    .in('programme_id', programmeIds)

  if (subjectError) {
    throw new Error(`getCurrentSeniorProgrammesForLearners: failed to load subject memberships: ${subjectError.message}`)
  }

  const subjectsByProgrammeId = new Map<string, ProgrammeSubjectMembership[]>()
  for (const row of subjectRows ?? []) {
    const subject = row.subjects as unknown as { name: string; code: string } | null
    const membership: ProgrammeSubjectMembership = {
      subjectId: row.subject_id,
      subjectName: subject?.name ?? '(unknown subject)',
      subjectCode: subject?.code ?? '(unknown code)',
      role: row.role as ProgrammeSubjectRole,
      reason: row.reason,
    }
    const list = subjectsByProgrammeId.get(row.programme_id) ?? []
    list.push(membership)
    subjectsByProgrammeId.set(row.programme_id, list)
  }

  for (const row of programmeRows) {
    result.set(row.learner_id as LearnerId, {
      status: 'resolved',
      programme: toSeniorProgramme(row),
      subjects: subjectsByProgrammeId.get(row.id) ?? [],
    })
  }

  return result
}

/**
 * The one canonical write path for senior programme truth. Structural
 * validation only (learner/school/academic-year/subject identities must be
 * real and school-scoped, no duplicate subject in one write) — it does NOT
 * enforce any elective-count/compulsory-subject/Mathematics-eligibility rule
 * from `curriculum_policy_versions`, because no policy version is currently
 * `status = 'active'` (see the seeded 'ke-cbc-senior-2026-draft' row, which
 * stays `draft`). Enforcing an unverified rule as though it were
 * authoritative is explicitly prohibited for this phase — see this phase's
 * closeout report §12 for the full list of deliberately-unenforced rules.
 *
 * Superseding is atomic (via the create_or_update_senior_programme Postgres
 * function): the learner's prior current programme, if any, is closed and
 * the new one becomes current in a single transaction — a failure partway
 * through cannot leave the learner with zero current programmes.
 */
export async function createOrUpdateSeniorProgramme(
  input: CreateSeniorProgrammeInput
): Promise<SeniorProgramme> {
  if (input.subjects.length === 0) {
    throw new Error('createOrUpdateSeniorProgramme: subjects must not be empty')
  }
  const subjectIds = input.subjects.map(s => s.subjectId)
  if (new Set(subjectIds).size !== subjectIds.length) {
    throw new Error('createOrUpdateSeniorProgramme: duplicate subjectId in subjects input')
  }

  const db = createServiceClient()

  const { data: newProgrammeId, error } = await db.rpc('create_or_update_senior_programme', {
    p_learner_id: input.learnerId,
    p_school_id: input.schoolId,
    p_academic_year_id: input.academicYearId,
    p_curriculum_policy_version_id: input.curriculumPolicyVersionId ?? null,
    p_pathway: input.pathway ?? null,
    p_track: input.track ?? null,
    p_combination_code: input.combinationCode ?? null,
    p_source: input.source,
    p_created_by: input.createdBy ?? null,
    p_subject_memberships: input.subjects.map(s => ({
      subject_id: s.subjectId,
      role: s.role,
      reason: s.reason ?? null,
    })),
  })

  if (error) {
    throw new Error(`createOrUpdateSeniorProgramme: ${error.message}`)
  }

  const { data: programmeRow, error: fetchError } = await db
    .from('learner_programmes')
    .select('id, learner_id, school_id, academic_year_id, curriculum_policy_version_id, pathway, track, combination_code, source, effective_from, created_at')
    .eq('id', newProgrammeId as string)
    .single()

  if (fetchError || !programmeRow) {
    throw new Error(`createOrUpdateSeniorProgramme: programme ${newProgrammeId} was created but could not be re-read: ${fetchError?.message}`)
  }

  return toSeniorProgramme(programmeRow)
}
