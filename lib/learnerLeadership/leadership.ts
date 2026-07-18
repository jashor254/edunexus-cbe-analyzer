// lib/learnerLeadership/leadership.ts
//
// The canonical Learner Leadership service (Sprint 13D, ADR-0015). Owns:
// permission checks, lifecycle transitions (ADR-0015 Phase 4's frozen
// eight-state main line — Nomination/Selection/Active Service/Review/
// Completion/Verification/Published/Historical — plus four named terminal
// branches: Not Selected from Nomination, Discontinued from Active
// Service/Review, Rejected from Verification, Revoked from Published),
// versioning, and field validation. No Supabase client is ever used
// directly here — every read/write goes through `repos.leadership`
// (lib/repositories/leadership.repository.ts), which owns the tables
// exclusively.
//
// This service owns lifecycle only — never educational meaning. It never
// imports Blueprint, Portfolio, Achievement, or Career (mission Phase 4).
// The one exception is `getLeadershipSummary()`, which Blueprint's own
// composeLeadership() calls — that direction (Blueprint reads Leadership)
// is exactly the discipline every sibling domain in this series already
// follows; nothing here ever reads back.
//
// Teacher/staff action only (mission Phase 3, matching Achievement/
// Projects/Portfolio/Competitions exactly) — every write action requires
// `requireSchoolStaff`. No learner- or parent-facing write path exists
// this sprint (Stop Condition: no UI).
//
// No AI, no election, no vote tally, no ranking engine anywhere in this
// module (Stop Condition). "Discontinued" always carries only a neutral,
// factual reason string — this module has no disciplinary-case concept
// at all (ADR-0015 Phase 2/11).

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSchoolStaff } from '@/lib/core/permissions'
import { repos } from '@/lib/repositories'
import type { LearnerLeadershipRow, LeadershipStatus } from '@/lib/repositories/leadership.repository'
import { validateLeadershipFields } from './validation'
import { toLeadership, toHistoryEntry, type Leadership, type LeadershipFields, type LeadershipHistoryEntry, type LeadershipSummary } from './types'

const DISCONTINUABLE_STATUSES: LeadershipStatus[] = ['active_service', 'review']

async function recordTransition(
  leadershipId: string, from: LeadershipStatus, to: LeadershipStatus,
  actorSchoolUserId: string | null, reason: string | null, version: number
): Promise<void> {
  await repos.leadership.recordTransition(leadershipId, from, to, actorSchoolUserId, reason, version)
}

function toDomain(row: LearnerLeadershipRow): Leadership {
  return toLeadership(row)
}

/** Records a new Nomination — the earliest, editable state (ADR-0015 Phase 4). */
export async function createNomination(
  client: SupabaseClient,
  schoolId: string,
  learnerId: string,
  actorUserId: string,
  fields: LeadershipFields
): Promise<Leadership> {
  await requireSchoolStaff(client, schoolId)
  validateLeadershipFields(fields)

  const recorder = await repos.teachers.findSchoolUser(actorUserId, schoolId).catch(() => null)

  const row = await repos.leadership.create({
    learner_id: learnerId,
    school_id: schoolId,
    position_title: fields.positionTitle,
    scope: fields.scope,
    body: fields.body,
    responsibilities: fields.responsibilities,
    is_acting: fields.isActing,
    supporting_evidence_ids: fields.supportingEvidenceIds,
    recorded_by: recorder?.id ?? null,
  })
  return toDomain(row)
}

/** Edits an existing Nomination. Throws a clean error once it has moved on — the DB trigger is the final backstop. */
export async function updateNomination(
  client: SupabaseClient,
  schoolId: string,
  leadershipId: string,
  fields: Partial<LeadershipFields>
): Promise<Leadership> {
  await requireSchoolStaff(client, schoolId)

  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (existing.status !== 'nomination') throw new Error('This leadership entry has already moved past nomination and can no longer be edited directly.')

  const merged: LeadershipFields = {
    positionTitle: fields.positionTitle ?? existing.position_title,
    scope: fields.scope !== undefined ? fields.scope : existing.scope,
    body: fields.body !== undefined ? fields.body : existing.body,
    responsibilities: fields.responsibilities !== undefined ? fields.responsibilities : existing.responsibilities,
    isActing: fields.isActing !== undefined ? fields.isActing : existing.is_acting,
    supportingEvidenceIds: fields.supportingEvidenceIds ?? existing.supporting_evidence_ids,
  }
  validateLeadershipFields(merged)

  const row = await repos.leadership.updateNomination(leadershipId, schoolId, {
    position_title: merged.positionTitle,
    scope: merged.scope,
    body: merged.body,
    responsibilities: merged.responsibilities,
    is_acting: merged.isActing,
    supporting_evidence_ids: merged.supportingEvidenceIds,
  })
  return toDomain(row)
}

/** Nomination -> Selection. The learner is confirmed into the role (ADR-0015 Phase 4). */
export async function selectForLeadership(client: SupabaseClient, schoolId: string, leadershipId: string): Promise<Leadership> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (existing.status !== 'nomination') throw new Error('Only a nomination can be selected.')
  const row = await repos.leadership.select(leadershipId, schoolId, existing.version + 1)
  await recordTransition(leadershipId, 'nomination', 'selection', null, null, row.version)
  return toDomain(row)
}

/** Nomination -> Not Selected, terminal (ADR-0015 Phase 4). */
export async function markNotSelected(client: SupabaseClient, schoolId: string, leadershipId: string, reason: string): Promise<Leadership> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A reason is required.')

  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (existing.status !== 'nomination') throw new Error('Only a nomination can be marked not selected.')

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  const row = await repos.leadership.markNotSelected(leadershipId, schoolId, reason, existing.version + 1)
  await recordTransition(leadershipId, 'nomination', 'not_selected', actor?.id ?? null, reason, row.version)
  return toDomain(row)
}

/** Selection -> Active Service. The term of service begins (ADR-0015 Phase 4). */
export async function beginActiveService(client: SupabaseClient, schoolId: string, leadershipId: string): Promise<Leadership> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (existing.status !== 'selection') throw new Error('Only a selected entry can begin active service.')
  const row = await repos.leadership.beginActiveService(leadershipId, schoolId, existing.version + 1)
  await recordTransition(leadershipId, 'selection', 'active_service', null, null, row.version)
  return toDomain(row)
}

/** Active Service -> Review. A staff member assesses the service (ADR-0015 Phase 4). */
export async function reviewLeadership(client: SupabaseClient, schoolId: string, leadershipId: string, notes: string | null): Promise<Leadership> {
  const membership = await requireSchoolStaff(client, schoolId)
  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (existing.status !== 'active_service') throw new Error('Only an entry in active service can be reviewed.')

  const reviewer = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!reviewer) throw new Error('Reviewing staff member has no school_users record — cannot attribute this review.')

  const row = await repos.leadership.review(leadershipId, schoolId, reviewer.id, notes, existing.version + 1)
  await recordTransition(leadershipId, 'active_service', 'review', reviewer.id, null, row.version)
  return toDomain(row)
}

/**
 * Active Service or Review -> Discontinued, terminal. Carries only a
 * neutral, factual reason — never a disciplinary case record (ADR-0015
 * Phase 2/11: this domain has no disciplinary-case concept at all).
 */
export async function discontinueLeadership(client: SupabaseClient, schoolId: string, leadershipId: string, reason: string): Promise<Leadership> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A discontinuation reason is required.')

  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (!DISCONTINUABLE_STATUSES.includes(existing.status)) {
    throw new Error('Only an entry in Active Service or Review can be discontinued.')
  }

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  const row = await repos.leadership.discontinue(leadershipId, schoolId, reason, existing.version + 1)
  await recordTransition(leadershipId, existing.status, 'discontinued', actor?.id ?? null, reason, row.version)
  return toDomain(row)
}

/** Review -> Completion. The term concludes as planned (ADR-0015 Phase 4). */
export async function completeLeadership(client: SupabaseClient, schoolId: string, leadershipId: string, notes: string | null): Promise<Leadership> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (existing.status !== 'review') throw new Error('Only a reviewed entry can be completed.')
  const row = await repos.leadership.complete(leadershipId, schoolId, notes, existing.version + 1)
  await recordTransition(leadershipId, 'review', 'completion', null, null, row.version)
  return toDomain(row)
}

/**
 * Completion -> Verification. System-queued automatically on Completion
 * entry (ADR-0015 Phase 4: "no human actor performs it" — recorded as its
 * own history row all the same, mirroring Competition's identical
 * Results -> Verification pattern from Sprint 13B).
 */
export async function queueLeadershipForVerification(client: SupabaseClient, schoolId: string, leadershipId: string): Promise<Leadership> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (existing.status !== 'completion') throw new Error('Only a completed entry can be queued for verification.')
  const row = await repos.leadership.queueForVerification(leadershipId, schoolId, existing.version + 1)
  await recordTransition(leadershipId, 'completion', 'verification', null, null, row.version)
  return toDomain(row)
}

/** Verification -> Published. The authorized school actor's confirmation (ADR-0015 Phase 4). */
export async function publishLeadership(client: SupabaseClient, schoolId: string, leadershipId: string): Promise<Leadership> {
  const membership = await requireSchoolStaff(client, schoolId)
  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (existing.status !== 'verification') throw new Error('Cannot publish: this entry is not awaiting verification.')

  const verifier = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!verifier) throw new Error('Verifying staff member has no school_users record — cannot attribute this verification.')

  const row = await repos.leadership.publish(leadershipId, schoolId, verifier.id, existing.version + 1)
  await recordTransition(leadershipId, 'verification', 'published', verifier.id, null, row.version)
  return toDomain(row)
}

/** Verification -> Rejected, terminal, distinct from Not Selected/Discontinued/Revoked (ADR-0015 Phase 4). */
export async function rejectLeadership(client: SupabaseClient, schoolId: string, leadershipId: string, reason: string): Promise<Leadership> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A rejection reason is required.')

  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (existing.status !== 'verification') throw new Error('Only an entry awaiting verification can be rejected.')

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  const row = await repos.leadership.reject(leadershipId, schoolId, reason, existing.version + 1)
  await recordTransition(leadershipId, 'verification', 'rejected', actor?.id ?? null, reason, row.version)
  return toDomain(row)
}

/** Published -> Revoked, for a verified-then-disproven claim (ADR-0015 Phase 4/11). Never a delete. */
export async function revokeLeadership(client: SupabaseClient, schoolId: string, leadershipId: string, reason: string): Promise<Leadership> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A revocation reason is required.')

  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (existing.status !== 'published') throw new Error('Only a published entry can be revoked.')

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!actor) throw new Error('Revoking staff member has no school_users record — cannot attribute this revocation.')

  const row = await repos.leadership.revoke(leadershipId, schoolId, actor.id, reason, existing.version + 1)
  await recordTransition(leadershipId, 'published', 'revoked', actor.id, reason, row.version)
  return toDomain(row)
}

/** Published -> Historical — the same retention-only, time-based end state ADR-0015 Phase 4 freezes. Callable on demand; no cron wired this sprint (Stop Condition). */
export async function moveLeadershipToHistorical(client: SupabaseClient, schoolId: string, leadershipId: string): Promise<Leadership> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  if (existing.status !== 'published') throw new Error('Only a published entry can move to historical.')
  const row = await repos.leadership.moveToHistorical(leadershipId, schoolId, existing.version + 1)
  await recordTransition(leadershipId, 'published', 'historical', null, null, row.version)
  return toDomain(row)
}

export async function setMentor(client: SupabaseClient, schoolId: string, leadershipId: string, mentorSchoolUserId: string | null): Promise<Leadership> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  const row = await repos.leadership.setMentor(leadershipId, schoolId, mentorSchoolUserId)
  return toDomain(row)
}

/** Leadership Reflection (ADR-0015 Phase 3) — scoped narrowly to this service, never the general Teacher Reflection domain. */
export async function setReflection(client: SupabaseClient, schoolId: string, leadershipId: string, reflection: string): Promise<Leadership> {
  await requireSchoolStaff(client, schoolId)
  if (!reflection || !reflection.trim()) throw new Error('A reflection is required.')
  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  const row = await repos.leadership.setReflection(leadershipId, schoolId, reflection)
  return toDomain(row)
}

export async function findLeadershipById(client: SupabaseClient, schoolId: string, leadershipId: string): Promise<Leadership | null> {
  await requireSchoolStaff(client, schoolId)
  const row = await repos.leadership.findById(leadershipId, schoolId)
  return row ? toDomain(row) : null
}

/** Every leadership entry for a learner, any status — the teacher/admin full view. */
export async function listForLearner(client: SupabaseClient, schoolId: string, learnerId: string): Promise<Leadership[]> {
  await requireSchoolStaff(client, schoolId)
  const rows = await repos.leadership.listForLearner(learnerId, schoolId)
  return rows.map(toDomain)
}

/** Published entries only — the surface every non-staff/summary consumer may read. */
export async function listPublished(learnerId: string, schoolId: string): Promise<Leadership[]> {
  const rows = await repos.leadership.listPublished(learnerId, schoolId)
  return rows.map(toDomain)
}

export async function getVerificationHistory(client: SupabaseClient, schoolId: string, leadershipId: string): Promise<LeadershipHistoryEntry[]> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.leadership.findById(leadershipId, schoolId)
  if (!existing) throw new Error('Leadership entry not found.')
  const rows = await repos.leadership.listHistory(leadershipId)
  return rows.map(toHistoryEntry)
}

/**
 * Blueprint's field budget for Leadership (mission Phase 6) — current
 * role, completed verified service, brief service summary, URL. Never
 * review notes, election data, meeting history, mentor comments, or
 * disciplinary information (currentRole reads only {title, scope} from an
 * in-progress entry, the same discipline Competitions'
 * currentParticipation already applies).
 */
export async function getLeadershipSummary(learnerId: string, schoolId: string): Promise<LeadershipSummary> {
  const [published, current] = await Promise.all([
    repos.leadership.listPublished(learnerId, schoolId),
    repos.leadership.listCurrent(learnerId, schoolId),
  ])

  const currentEntry = current[0] ?? null

  if (published.length === 0 && !currentEntry) {
    return { available: false, currentRole: null, completedRoleCount: 0, latestCompletedRole: null, leadershipUrl: null }
  }

  const sorted = [...published].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  const latest = sorted[0] ?? null

  return {
    available: true,
    currentRole: currentEntry ? { title: currentEntry.position_title, scope: currentEntry.scope } : null,
    completedRoleCount: published.length,
    latestCompletedRole: latest ? { title: latest.position_title, scope: latest.scope, publishedAt: latest.published_at! } : null,
    leadershipUrl: null,
  }
}
