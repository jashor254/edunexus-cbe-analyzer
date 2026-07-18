// lib/learnerCompetitions/competition.ts
//
// The canonical Learner Competitions service (Sprint 13B, ADR-0014). Owns:
// permission checks, lifecycle transitions (ADR-0014 Phase 4's frozen
// nine-state main line — Opportunity/Registration/Preparation/
// Participation/Judging/Results/Verification/Published/Historical — plus
// three named terminal branches: Rejected from Verification, Withdrawn
// from Registration/Preparation/Participation, Revoked from Published),
// versioning, and field validation. No Supabase client is ever used
// directly here — every read/write goes through `repos.competitions`
// (lib/repositories/competition.repository.ts), which owns the tables
// exclusively.
//
// This service owns lifecycle only — never educational meaning. It never
// imports Blueprint, Portfolio, Achievement, Parent Experience, or Career
// (mission Phase 4). The one exception is `getCompetitionsSummary()`,
// which Blueprint's own composeCompetitions() calls — that direction
// (Blueprint reads Competitions) is exactly the discipline every sibling
// domain in this series already follows; nothing here ever reads back.
//
// Teacher/staff action only (mission Phase 10, matching Achievement/
// Projects/Portfolio exactly) — every write action requires
// `requireSchoolStaff`, reusing the existing shared permission service,
// no stronger and no weaker than its siblings. No learner- or
// parent-facing write path exists this sprint (Stop Condition: no UI).
//
// No AI, no automatic scoring, no ranking engine anywhere in this module
// (Stop Condition).

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSchoolStaff } from '@/lib/core/permissions'
import { repos } from '@/lib/repositories'
import type { LearnerCompetitionRow, CompetitionStatus } from '@/lib/repositories/competition.repository'
import { validateCompetitionFields } from './validation'
import { toCompetition, toHistoryEntry, type Competition, type CompetitionFields, type CompetitionHistoryEntry, type CompetitionsSummary } from './types'

const IN_FLIGHT_STATUSES: CompetitionStatus[] = ['registration', 'preparation', 'participation', 'judging', 'results', 'verification']
const WITHDRAWABLE_STATUSES: CompetitionStatus[] = ['registration', 'preparation', 'participation']

async function withRelated(row: LearnerCompetitionRow): Promise<Competition> {
  const [members, media] = await Promise.all([repos.competitions.listMembers(row.id), repos.competitions.listMedia(row.id)])
  return toCompetition(row, members, media)
}

async function recordTransition(
  competitionId: string, from: CompetitionStatus, to: CompetitionStatus,
  actorSchoolUserId: string | null, reason: string | null, version: number
): Promise<void> {
  await repos.competitions.recordTransition(competitionId, from, to, actorSchoolUserId, reason, version)
}

/** Records a new Opportunity — the earliest, editable state (ADR-0014 Phase 4). */
export async function createOpportunity(
  client: SupabaseClient,
  schoolId: string,
  learnerId: string,
  actorUserId: string,
  fields: CompetitionFields
): Promise<Competition> {
  await requireSchoolStaff(client, schoolId)
  validateCompetitionFields(fields)

  const recorder = await repos.teachers.findSchoolUser(actorUserId, schoolId).catch(() => null)

  const row = await repos.competitions.create({
    learner_id: learnerId,
    school_id: schoolId,
    name: fields.name,
    organizing_body: fields.organizingBody,
    level: fields.level,
    category: fields.category,
    event_date: fields.eventDate,
    venue: fields.venue,
    project_id: fields.projectId,
    supporting_evidence_ids: fields.supportingEvidenceIds,
    recorded_by: recorder?.id ?? null,
  })
  return withRelated(row)
}

/** Edits an existing Opportunity. Throws a clean error once it has moved on — the DB trigger is the final backstop. */
export async function updateOpportunity(
  client: SupabaseClient,
  schoolId: string,
  competitionId: string,
  fields: Partial<CompetitionFields>
): Promise<Competition> {
  await requireSchoolStaff(client, schoolId)

  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  if (existing.status !== 'opportunity') throw new Error('This competition has already been registered and can no longer be edited directly.')

  const merged: CompetitionFields = {
    name: fields.name ?? existing.name,
    organizingBody: fields.organizingBody !== undefined ? fields.organizingBody : existing.organizing_body,
    level: fields.level ?? existing.level,
    category: fields.category ?? existing.category,
    eventDate: fields.eventDate !== undefined ? fields.eventDate : existing.event_date,
    venue: fields.venue !== undefined ? fields.venue : existing.venue,
    projectId: fields.projectId !== undefined ? fields.projectId : existing.project_id,
    supportingEvidenceIds: fields.supportingEvidenceIds ?? existing.supporting_evidence_ids,
  }
  validateCompetitionFields(merged)

  const row = await repos.competitions.updateOpportunity(competitionId, schoolId, {
    name: merged.name,
    organizing_body: merged.organizingBody,
    level: merged.level,
    category: merged.category,
    event_date: merged.eventDate,
    venue: merged.venue,
    project_id: merged.projectId,
    supporting_evidence_ids: merged.supportingEvidenceIds,
  })
  return withRelated(row)
}

/** Opportunity -> Registration. Learner/teacher formally enters (ADR-0014 Phase 4). */
export async function registerCompetition(client: SupabaseClient, schoolId: string, competitionId: string): Promise<Competition> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  if (existing.status !== 'opportunity') throw new Error('Only an opportunity can be registered.')
  const row = await repos.competitions.register(competitionId, schoolId, existing.version + 1)
  await recordTransition(competitionId, 'opportunity', 'registration', null, null, row.version)
  return withRelated(row)
}

/** Registration -> Preparation. Registration confirmed (ADR-0014 Phase 4). */
export async function beginPreparation(client: SupabaseClient, schoolId: string, competitionId: string): Promise<Competition> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  if (existing.status !== 'registration') throw new Error('Only a registered competition can move to preparation.')
  const row = await repos.competitions.beginPreparation(competitionId, schoolId, existing.version + 1)
  await recordTransition(competitionId, 'registration', 'preparation', null, null, row.version)
  return withRelated(row)
}

/** Preparation -> Participation. The competition date has arrived (ADR-0014 Phase 4). */
export async function beginParticipation(client: SupabaseClient, schoolId: string, competitionId: string): Promise<Competition> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  if (existing.status !== 'preparation') throw new Error('Only a competition in preparation can move to participation.')
  const row = await repos.competitions.beginParticipation(competitionId, schoolId, existing.version + 1)
  await recordTransition(competitionId, 'preparation', 'participation', null, null, row.version)
  return withRelated(row)
}

/** Participation -> Judging. Participation concludes; results are not yet announced (ADR-0014 Phase 4). */
export async function beginJudging(client: SupabaseClient, schoolId: string, competitionId: string): Promise<Competition> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  if (existing.status !== 'participation') throw new Error('Only a competition in participation can move to judging.')
  const row = await repos.competitions.beginJudging(competitionId, schoolId, existing.version + 1)
  await recordTransition(competitionId, 'participation', 'judging', null, null, row.version)
  return withRelated(row)
}

/**
 * Judging -> Results -> Verification. The organizer's published outcome is
 * recorded (Judging -> Results), then automatically queued for a school
 * actor's confirmation (Results -> Verification, ADR-0014 Phase 4: "system-
 * queued automatically... no human actor performs it" — recorded as its
 * own history row all the same, so the real two-step lifecycle stays
 * auditable even though both happen within this one service call).
 */
export async function recordResults(
  client: SupabaseClient, schoolId: string, competitionId: string,
  position: string | null, resultsSummary: string | null, judges: string | null, feedback: string | null
): Promise<Competition> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  if (existing.status !== 'judging') throw new Error('Only a competition in judging can have results recorded.')

  const resultsRow = await repos.competitions.recordResults(competitionId, schoolId, position, resultsSummary, judges, feedback, existing.version + 1)
  await recordTransition(competitionId, 'judging', 'results', null, null, resultsRow.version)

  const queuedRow = await repos.competitions.queueForVerification(competitionId, schoolId, resultsRow.version + 1)
  await recordTransition(competitionId, 'results', 'verification', null, null, queuedRow.version)

  return withRelated(queuedRow)
}

/** Verification -> Published. The authorized school actor's confirmation (ADR-0014 Phase 4). Cannot publish anything not awaiting verification. */
export async function publishCompetition(client: SupabaseClient, schoolId: string, competitionId: string): Promise<Competition> {
  const membership = await requireSchoolStaff(client, schoolId)
  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  if (existing.status !== 'verification') throw new Error('Cannot publish: this competition is not awaiting verification.')

  const verifier = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!verifier) throw new Error('Verifying staff member has no school_users record — cannot attribute this verification.')

  const row = await repos.competitions.publish(competitionId, schoolId, verifier.id, existing.version + 1)
  await recordTransition(competitionId, 'verification', 'published', verifier.id, null, row.version)
  return withRelated(row)
}

/** Verification -> Rejected, a distinct terminal state from Withdrawn/Revoked (ADR-0014 Phase 4). */
export async function rejectCompetition(client: SupabaseClient, schoolId: string, competitionId: string, reason: string): Promise<Competition> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A rejection reason is required.')

  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  if (existing.status !== 'verification') throw new Error('Only a competition awaiting verification can be rejected.')

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  const row = await repos.competitions.reject(competitionId, schoolId, reason, existing.version + 1)
  await recordTransition(competitionId, 'verification', 'rejected', actor?.id ?? null, reason, row.version)
  return withRelated(row)
}

/** Reachable only from Registration/Preparation/Participation — a real exit, never a silent drop once judged (ADR-0014 Phase 4). */
export async function withdrawCompetition(client: SupabaseClient, schoolId: string, competitionId: string, reason: string): Promise<Competition> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A withdrawal reason is required.')

  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  if (!WITHDRAWABLE_STATUSES.includes(existing.status)) {
    throw new Error('Only a competition in Registration, Preparation, or Participation can be withdrawn.')
  }

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  const row = await repos.competitions.withdraw(competitionId, schoolId, reason, existing.version + 1)
  await recordTransition(competitionId, existing.status, 'withdrawn', actor?.id ?? null, reason, row.version)
  return withRelated(row)
}

/** Published -> Revoked, for a verified-then-disproven result (ADR-0014 Phase 4/8 "unverifiable awards" prevention). Never a delete. */
export async function revokeCompetition(client: SupabaseClient, schoolId: string, competitionId: string, reason: string): Promise<Competition> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A revocation reason is required.')

  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  if (existing.status !== 'published') throw new Error('Only a published competition can be revoked.')

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!actor) throw new Error('Revoking staff member has no school_users record — cannot attribute this revocation.')

  const row = await repos.competitions.revoke(competitionId, schoolId, actor.id, reason, existing.version + 1)
  await recordTransition(competitionId, 'published', 'revoked', actor.id, reason, row.version)
  return withRelated(row)
}

/** Published -> Historical — the same retention-only, time-based end state ADR-0014 Phase 4 freezes (reusing Blueprint's own "historical" vocabulary). Callable on demand; no cron wired this sprint (Stop Condition: no notifications/dashboards/analytics). */
export async function moveToHistorical(client: SupabaseClient, schoolId: string, competitionId: string): Promise<Competition> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  if (existing.status !== 'published') throw new Error('Only a published competition can move to historical.')
  const row = await repos.competitions.moveToHistorical(competitionId, schoolId, existing.version + 1)
  await recordTransition(competitionId, 'published', 'historical', null, null, row.version)
  return withRelated(row)
}

export async function addTeamMember(client: SupabaseClient, schoolId: string, competitionId: string, teammateLearnerId: string, role: string | null): Promise<Competition> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  await repos.competitions.addMember(competitionId, teammateLearnerId, role)
  return withRelated(existing)
}

export async function setMentor(client: SupabaseClient, schoolId: string, competitionId: string, mentorSchoolUserId: string | null): Promise<Competition> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  const row = await repos.competitions.setMentor(competitionId, schoolId, mentorSchoolUserId)
  return withRelated(row)
}

export async function addMediaLink(client: SupabaseClient, schoolId: string, competitionId: string, url: string, label: string | null): Promise<Competition> {
  await requireSchoolStaff(client, schoolId)
  if (!url || !url.trim()) throw new Error('A media URL is required.')
  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  await repos.competitions.addMedia(competitionId, url, label)
  return withRelated(existing)
}

export async function findCompetitionById(client: SupabaseClient, schoolId: string, competitionId: string): Promise<Competition | null> {
  await requireSchoolStaff(client, schoolId)
  const row = await repos.competitions.findById(competitionId, schoolId)
  return row ? withRelated(row) : null
}

/** Every competition for a learner, any status — the teacher/admin full view. */
export async function listForLearner(client: SupabaseClient, schoolId: string, learnerId: string): Promise<Competition[]> {
  await requireSchoolStaff(client, schoolId)
  const rows = await repos.competitions.listForLearner(learnerId, schoolId)
  return Promise.all(rows.map(withRelated))
}

/** Published competitions only — the surface every non-staff/summary consumer may read. */
export async function listPublished(learnerId: string, schoolId: string): Promise<Competition[]> {
  const rows = await repos.competitions.listPublished(learnerId, schoolId)
  return Promise.all(rows.map(withRelated))
}

export async function getVerificationHistory(client: SupabaseClient, schoolId: string, competitionId: string): Promise<CompetitionHistoryEntry[]> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.competitions.findById(competitionId, schoolId)
  if (!existing) throw new Error('Competition not found.')
  const rows = await repos.competitions.listHistory(competitionId)
  return rows.map(toHistoryEntry)
}

/**
 * Blueprint's field budget for Competitions (mission Phase 7) — total,
 * verified count, latest, current participation, URL. Never judging,
 * never raw feedback, never unpublished work (currentParticipation reads
 * only {name, level, category} from an in-flight row, the same discipline
 * Projects' currentActiveProject already applies).
 */
export async function getCompetitionsSummary(learnerId: string, schoolId: string): Promise<CompetitionsSummary> {
  const [published, inFlight] = await Promise.all([
    repos.competitions.listPublished(learnerId, schoolId),
    repos.competitions.listInFlight(learnerId, schoolId),
  ])

  const current = inFlight[0] ?? null

  if (published.length === 0 && !current) {
    return { available: false, totalCompetitions: 0, verifiedCompetitions: 0, latestCompetition: null, currentParticipation: null, competitionsUrl: null }
  }

  const sorted = [...published].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  const latest = sorted[0] ?? null

  return {
    available: true,
    totalCompetitions: published.length,
    verifiedCompetitions: published.length,
    latestCompetition: latest ? { name: latest.name, level: latest.level, category: latest.category, publishedAt: latest.published_at! } : null,
    currentParticipation: current ? { name: current.name, level: current.level, category: current.category } : null,
    competitionsUrl: null,
  }
}
