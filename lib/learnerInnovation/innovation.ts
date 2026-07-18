// lib/learnerInnovation/innovation.ts
//
// The canonical Learner Innovation service (Sprint 13I, ADR-0018). Owns:
// lifecycle enforcement, authorization, iteration creation, validation,
// and publication rules. No Supabase client is ever used directly here —
// every read/write goes through `repos.innovations`
// (lib/repositories/innovation.repository.ts), which owns the tables
// exclusively.
//
// Lifecycle is ADR-0018 Phase 5's frozen eight-state main line — Idea,
// Exploration, Prototype, Testing, Refinement, Validation, Implementation,
// Archived — strictly forward-only. Repeated Prototype/Testing/Refinement
// cycles are never modeled by moving `status` backward; they are captured
// entirely as repeated `addIteration()` calls while status remains at
// Testing or Refinement (ADR-0018 Phase 5).
//
// `validateInnovation()`/`markNotValidated()` are modeled as two sibling
// outcomes of the same gate, both reachable from `refinement` — not a
// linear "submit for validation, then get approved" pipeline. This is a
// deliberate reading of ADR-0018 Phase 5's "Not Validated: reachable from
// Validation": since `validateInnovation()` itself is the teacher-gated
// approval action (mission Phase 8: "Validation requires teacher
// approval"), there is no intermediate "pending validation" status to
// fail out of — the decision point is the transition out of Refinement,
// exactly like Achievement's verify/reject pair both reachable from
// `draft`, or Leadership's publish/reject pair both reachable from
// `verification`.
//
// Teacher/staff action only (matching every sibling domain except
// Wellbeing) — every write action requires `requireSchoolStaff`. No
// learner- or parent-facing write path exists this sprint (Stop
// Condition: no UI).
//
// No AI, no novelty scoring, no ranking engine anywhere in this module
// (ADR-0018 Phase 7/8, Stop Condition). This module imports nothing from
// lib/learnerBlueprint/, lib/learnerPortfolio/, lib/learnerAchievement/,
// lib/learnerProjects/, lib/career/, lib/parentExperience/, or
// lib/compass/ — verified by innovationBoundary.architecture.test.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSchoolStaff } from '@/lib/core/permissions'
import { repos } from '@/lib/repositories'
import type { LearnerInnovationRow, InnovationStatus } from '@/lib/repositories/innovation.repository'
import { validateInnovationFields, validateIterationFields } from './validation'
import {
  toInnovation, toIteration, toHistoryEntry,
  type Innovation, type InnovationFields, type InnovationIteration, type InnovationHistoryEntry, type InnovationsSummary,
} from './types'

const DISCONTINUABLE_STATUSES: InnovationStatus[] = ['idea', 'exploration', 'prototype', 'testing', 'refinement']
const IN_FLIGHT_STATUSES: InnovationStatus[] = ['idea', 'exploration', 'prototype', 'testing', 'refinement', 'validation']

function toDomain(row: LearnerInnovationRow): Innovation {
  return toInnovation(row)
}

async function recordTransition(
  innovationId: string, from: InnovationStatus, to: InnovationStatus,
  actorSchoolUserId: string | null, reason: string | null, version: number
): Promise<void> {
  await repos.innovations.recordTransition(innovationId, from, to, actorSchoolUserId, reason, version)
}

/** Records a new Idea — the earliest, editable state (ADR-0018 Phase 5). */
export async function createIdea(
  client: SupabaseClient,
  schoolId: string,
  learnerId: string,
  actorUserId: string,
  fields: InnovationFields
): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)
  validateInnovationFields(fields)

  const recorder = await repos.teachers.findSchoolUser(actorUserId, schoolId).catch(() => null)

  const row = await repos.innovations.createIdea({
    learner_id: learnerId,
    school_id: schoolId,
    problem_addressed: fields.problemAddressed,
    idea_summary: fields.ideaSummary,
    supporting_evidence_ids: fields.supportingEvidenceIds,
    recorded_by: recorder?.id ?? null,
  })
  return toDomain(row)
}

/** Edits an existing Idea. Throws a clean error once it has moved on — the DB trigger is the final backstop. */
export async function updateIdea(
  client: SupabaseClient, schoolId: string, innovationId: string, fields: Partial<InnovationFields>
): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)

  const existing = await repos.innovations.findById(innovationId, schoolId)
  if (!existing) throw new Error('Innovation not found.')
  if (existing.status !== 'idea') throw new Error('This innovation has moved past idea and can no longer be edited directly.')

  const merged: InnovationFields = {
    problemAddressed: fields.problemAddressed ?? existing.problem_addressed,
    ideaSummary: fields.ideaSummary ?? existing.idea_summary,
    supportingEvidenceIds: fields.supportingEvidenceIds ?? existing.supporting_evidence_ids,
  }
  validateInnovationFields(merged)

  const row = await repos.innovations.updateIdea(innovationId, schoolId, {
    problem_addressed: merged.problemAddressed,
    idea_summary: merged.ideaSummary,
    supporting_evidence_ids: merged.supportingEvidenceIds,
  })
  return toDomain(row)
}

async function requireStatus(schoolId: string, innovationId: string, expected: InnovationStatus, actionLabel: string): Promise<LearnerInnovationRow> {
  const existing = await repos.innovations.findById(innovationId, schoolId)
  if (!existing) throw new Error('Innovation not found.')
  if (existing.status !== expected) throw new Error(`Only an innovation in ${expected} can ${actionLabel}.`)
  return existing
}

/** Idea -> Exploration. */
export async function beginExploration(client: SupabaseClient, schoolId: string, innovationId: string): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)
  const existing = await requireStatus(schoolId, innovationId, 'idea', 'move to exploration')
  const row = await repos.innovations.beginExploration(innovationId, schoolId, existing.version + 1)
  await recordTransition(innovationId, 'idea', 'exploration', null, null, row.version)
  return toDomain(row)
}

/** Exploration -> Prototype. */
export async function createPrototype(client: SupabaseClient, schoolId: string, innovationId: string): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)
  const existing = await requireStatus(schoolId, innovationId, 'exploration', 'create a prototype')
  const row = await repos.innovations.createPrototype(innovationId, schoolId, existing.version + 1)
  await recordTransition(innovationId, 'exploration', 'prototype', null, null, row.version)
  return toDomain(row)
}

/** Prototype -> Testing. */
export async function moveToTesting(client: SupabaseClient, schoolId: string, innovationId: string): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)
  const existing = await requireStatus(schoolId, innovationId, 'prototype', 'move to testing')
  const row = await repos.innovations.moveToTesting(innovationId, schoolId, existing.version + 1)
  await recordTransition(innovationId, 'prototype', 'testing', null, null, row.version)
  return toDomain(row)
}

/** Testing -> Refinement. */
export async function moveToRefinement(client: SupabaseClient, schoolId: string, innovationId: string): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)
  const existing = await requireStatus(schoolId, innovationId, 'testing', 'move to refinement')
  const row = await repos.innovations.moveToRefinement(innovationId, schoolId, existing.version + 1)
  await recordTransition(innovationId, 'testing', 'refinement', null, null, row.version)
  return toDomain(row)
}

/** Refinement -> Validation. Requires teacher approval (mission Phase 8) — the acting staff member IS the validator. */
export async function validateInnovation(client: SupabaseClient, schoolId: string, innovationId: string): Promise<Innovation> {
  const membership = await requireSchoolStaff(client, schoolId)
  const existing = await requireStatus(schoolId, innovationId, 'refinement', 'be validated')

  const validator = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!validator) throw new Error('Validating staff member has no school_users record — cannot attribute this validation.')

  const row = await repos.innovations.validateInnovation(innovationId, schoolId, validator.id, existing.version + 1)
  await recordTransition(innovationId, 'refinement', 'validation', validator.id, null, row.version)
  return toDomain(row)
}

/** Refinement -> Not Validated, terminal — the sibling rejection outcome of the same gate `validateInnovation()` passes. */
export async function markNotValidated(client: SupabaseClient, schoolId: string, innovationId: string, reason: string): Promise<Innovation> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A reason is required.')
  const existing = await requireStatus(schoolId, innovationId, 'refinement', 'be marked not validated')

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  const row = await repos.innovations.markNotValidated(innovationId, schoolId, reason, existing.version + 1)
  await recordTransition(innovationId, 'refinement', 'not_validated', actor?.id ?? null, reason, row.version)
  return toDomain(row)
}

/** Validation -> Implementation. Cannot implement anything that hasn't been validated (mission Phase 8). */
export async function implementInnovation(
  client: SupabaseClient, schoolId: string, innovationId: string, adoptionNote: string | null, impactEvidence: string | null
): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.innovations.findById(innovationId, schoolId)
  if (!existing) throw new Error('Innovation not found.')
  if (existing.status !== 'validation') throw new Error('Cannot implement: this innovation has not been validated yet.')

  const row = await repos.innovations.implementInnovation(innovationId, schoolId, adoptionNote, impactEvidence, existing.version + 1)
  await recordTransition(innovationId, 'validation', 'implementation', null, null, row.version)
  return toDomain(row)
}

/** Implementation -> Archived — time-based dormancy; callable on demand, no cron wired this sprint (Stop Condition). */
export async function archiveInnovation(client: SupabaseClient, schoolId: string, innovationId: string): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)
  const existing = await requireStatus(schoolId, innovationId, 'implementation', 'be archived')
  const row = await repos.innovations.archiveInnovation(innovationId, schoolId, existing.version + 1)
  await recordTransition(innovationId, 'implementation', 'archived', null, null, row.version)
  return toDomain(row)
}

/** Implementation -> Revoked, for a validated-then-disproven claim. Never a delete. */
export async function revokeInnovation(client: SupabaseClient, schoolId: string, innovationId: string, reason: string): Promise<Innovation> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A revocation reason is required.')
  const existing = await requireStatus(schoolId, innovationId, 'implementation', 'be revoked')

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!actor) throw new Error('Revoking staff member has no school_users record — cannot attribute this revocation.')

  const row = await repos.innovations.revokeInnovation(innovationId, schoolId, actor.id, reason, existing.version + 1)
  await recordTransition(innovationId, 'implementation', 'revoked', actor.id, reason, row.version)
  return toDomain(row)
}

/** Reachable only from Idea/Exploration/Prototype/Testing/Refinement — requires both a reason and a lessons-learned field (ADR-0018 Phase 5/8 Principle 2: "failure is educational evidence"). */
export async function discontinueInnovation(
  client: SupabaseClient, schoolId: string, innovationId: string, reason: string, lessonsLearned: string
): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A discontinuation reason is required.')
  if (!lessonsLearned || !lessonsLearned.trim()) throw new Error('A lessons-learned note is required — failure is educational evidence, never a silent drop.')

  const existing = await repos.innovations.findById(innovationId, schoolId)
  if (!existing) throw new Error('Innovation not found.')
  if (!DISCONTINUABLE_STATUSES.includes(existing.status)) {
    throw new Error('Only an innovation in Idea, Exploration, Prototype, Testing, or Refinement can be discontinued.')
  }

  const row = await repos.innovations.discontinueInnovation(innovationId, schoolId, reason, lessonsLearned, existing.version + 1)
  await recordTransition(innovationId, existing.status, 'discontinued', null, reason, row.version)
  return toDomain(row)
}

export async function setMentor(client: SupabaseClient, schoolId: string, innovationId: string, mentorSchoolUserId: string | null): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.innovations.findById(innovationId, schoolId)
  if (!existing) throw new Error('Innovation not found.')
  const row = await repos.innovations.setMentor(innovationId, schoolId, mentorSchoolUserId)
  return toDomain(row)
}

/** Innovation may reference a Project it produced, one direction only — never touches Projects' own table or code (ADR-0018 Phase 4/6). */
export async function setProjectReference(client: SupabaseClient, schoolId: string, innovationId: string, projectId: string | null): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.innovations.findById(innovationId, schoolId)
  if (!existing) throw new Error('Innovation not found.')
  const row = await repos.innovations.setProjectReference(innovationId, schoolId, projectId)
  return toDomain(row)
}

/** Innovation may reference a Competition it was entered into, one direction only — never touches Competitions' own table or code (ADR-0018 Phase 4/6). */
export async function setCompetitionReference(client: SupabaseClient, schoolId: string, innovationId: string, competitionId: string | null): Promise<Innovation> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.innovations.findById(innovationId, schoolId)
  if (!existing) throw new Error('Innovation not found.')
  const row = await repos.innovations.setCompetitionReference(innovationId, schoolId, competitionId)
  return toDomain(row)
}

/**
 * The domain's unique architectural feature (mission Phase 7). Every
 * iteration stores Problem/Hypothesis/Change introduced/Evidence/Outcome/
 * an optional Teacher note/Timestamp — append-only from the moment of
 * creation (enforced at the DB layer, never editable or deletable by any
 * caller, ever). Blocked once the innovation is implemented or terminal
 * (mission Phase 8: "Iteration entries immutable after publication" — no
 * new entries are logged once the record itself is no longer actively
 * evolving).
 */
export async function addIteration(
  client: SupabaseClient, schoolId: string, innovationId: string,
  problem: string, hypothesis: string, changeIntroduced: string, evidence: string, outcome: string, teacherNote: string | null
): Promise<InnovationIteration> {
  const membership = await requireSchoolStaff(client, schoolId)
  validateIterationFields(problem, hypothesis, changeIntroduced, evidence, outcome)

  const existing = await repos.innovations.findById(innovationId, schoolId)
  if (!existing) throw new Error('Innovation not found.')
  if (!IN_FLIGHT_STATUSES.includes(existing.status)) {
    throw new Error('Cannot log an iteration once an innovation has reached Implementation or a terminal state.')
  }

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  const row = await repos.innovations.addIteration(innovationId, problem, hypothesis, changeIntroduced, evidence, outcome, teacherNote, actor?.id ?? null)
  return toIteration(row)
}

export async function addArtifact(client: SupabaseClient, schoolId: string, innovationId: string, url: string, label: string | null): Promise<void> {
  await requireSchoolStaff(client, schoolId)
  if (!url || !url.trim()) throw new Error('An artifact URL is required.')
  const existing = await repos.innovations.findById(innovationId, schoolId)
  if (!existing) throw new Error('Innovation not found.')
  await repos.innovations.addArtifact(innovationId, url, label)
}

export async function findInnovationById(client: SupabaseClient, schoolId: string, innovationId: string): Promise<Innovation | null> {
  await requireSchoolStaff(client, schoolId)
  const row = await repos.innovations.findById(innovationId, schoolId)
  return row ? toDomain(row) : null
}

/** Every innovation for a learner, any status — the teacher/admin full view. */
export async function listForLearner(client: SupabaseClient, schoolId: string, learnerId: string): Promise<Innovation[]> {
  await requireSchoolStaff(client, schoolId)
  const rows = await repos.innovations.listForLearner(learnerId, schoolId)
  return rows.map(toDomain)
}

/** Implemented innovations only — the surface every non-staff/summary consumer may read. */
export async function listImplemented(learnerId: string, schoolId: string): Promise<Innovation[]> {
  const rows = await repos.innovations.listImplemented(learnerId, schoolId)
  return rows.map(toDomain)
}

export async function listIterations(client: SupabaseClient, schoolId: string, innovationId: string): Promise<InnovationIteration[]> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.innovations.findById(innovationId, schoolId)
  if (!existing) throw new Error('Innovation not found.')
  const rows = await repos.innovations.listIterations(innovationId)
  return rows.map(toIteration)
}

export async function getVerificationHistory(client: SupabaseClient, schoolId: string, innovationId: string): Promise<InnovationHistoryEntry[]> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.innovations.findById(innovationId, schoolId)
  if (!existing) throw new Error('Innovation not found.')
  const rows = await repos.innovations.listHistory(innovationId)
  return rows.map(toHistoryEntry)
}

/**
 * Blueprint's field budget for Innovation (mission Phase 6) — availability,
 * current stage, iteration count, latest milestone, latest implementation
 * date, URL. Never iteration history, teacher notes, internal review,
 * artifacts, or testing data (currentStage reads only
 * {problemAddressed, status} from an in-flight entry, the same discipline
 * every sibling domain's "current X" field already applies).
 */
export async function getInnovationsSummary(learnerId: string, schoolId: string): Promise<InnovationsSummary> {
  const [implemented, inFlight] = await Promise.all([
    repos.innovations.listImplemented(learnerId, schoolId),
    repos.innovations.listInFlight(learnerId, schoolId),
  ])

  const current = inFlight[0] ?? null

  if (implemented.length === 0 && !current) {
    return { available: false, currentStage: null, iterationCount: 0, latestMilestone: null, latestImplementationDate: null, innovationsUrl: null }
  }

  const sorted = [...implemented].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  const latest = sorted[0] ?? null

  // Iteration count is scoped to whichever entry is currently "active" for
  // the learner — the in-flight one if any, else the most recently
  // implemented one — never a cross-innovation total (mission Phase 6:
  // never expose iteration history, only a bare count for the entry the
  // summary is actually describing).
  const iterationSourceId = current?.id ?? latest?.id ?? null
  const iterationCount = iterationSourceId ? (await repos.innovations.listIterations(iterationSourceId)).length : 0

  return {
    available: true,
    currentStage: current ? { problemAddressed: current.problem_addressed, status: current.status } : null,
    iterationCount,
    latestMilestone: latest ? `Implementation reached: ${latest.problem_addressed}` : (current ? `${current.status} in progress` : null),
    latestImplementationDate: latest?.published_at ?? null,
    innovationsUrl: null,
  }
}
