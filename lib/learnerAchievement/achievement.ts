// lib/learnerAchievement/achievement.ts
//
// The canonical Learner Achievement service (Sprint 12W, ADR-0012). Owns:
// permission checks, lifecycle transitions (Draft -> Verified -> Published
// -> Archived, with Rejected reachable from Draft and Revoked reachable
// from Published — ADR-0012's own frozen six states, no separate
// "Submitted" state), evidence-requirement enforcement, versioning, and
// verification history. No Supabase client is ever used directly here —
// every read/write goes through `repos.achievements`
// (lib/repositories/achievement.repository.ts), which owns the tables
// exclusively.
//
// Teacher verification only (Phase 10/CLAUDE.md) — every write action
// requires `requireSchoolStaff`, which structurally excludes learners and
// parents (neither role is in SCHOOL_STAFF_ROLES): "no learner may
// publish, no parent may modify" is enforced by the existing shared
// permission service, never a duplicated check here.
//
// Business rules enforced here, not the repository (mirrors Portfolio's
// Sprint 12V discipline):
//  - Cannot verify without at least one Evidence reference or a verifying
//    document reference (ADR-0012 Phase 5 — the domain's central,
//    non-negotiable rule, stricter than Portfolio's own Evidence rule).
//  - Cannot publish an achievement that hasn't been verified.
//  - Cannot revoke/archive anything but a published achievement.
//  - Cannot edit anything but a draft (repository/DB trigger is the final
//    backstop; this throws a clean error before that raw exception).

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSchoolStaff } from '@/lib/core/permissions'
import { repos } from '@/lib/repositories'
import type { LearnerAchievementRow, AchievementStatus } from '@/lib/repositories/achievement.repository'
import { validateAchievementFields } from './validation'
import { toAchievement, toHistoryEntry, CATEGORY_RANK, type Achievement, type AchievementFields, type AchievementHistoryEntry, type AchievementSummary } from './types'

async function withRelated(row: LearnerAchievementRow): Promise<Achievement> {
  const [media, tags] = await Promise.all([repos.achievements.listMedia(row.id), repos.achievements.listTags(row.id)])
  return toAchievement(row, media, tags)
}

async function recordTransition(
  achievementId: string, from: AchievementStatus, to: AchievementStatus,
  actorSchoolUserId: string | null, reason: string | null, version: number
): Promise<void> {
  await repos.achievements.recordTransition(achievementId, from, to, actorSchoolUserId, reason, version)
}

function hasEvidence(row: LearnerAchievementRow): boolean {
  return row.supporting_evidence_ids.length > 0 || !!row.verifying_document_reference
}

/** Records a new Draft achievement. */
export async function createAchievement(
  client: SupabaseClient,
  schoolId: string,
  learnerId: string,
  actorUserId: string,
  fields: AchievementFields
): Promise<Achievement> {
  await requireSchoolStaff(client, schoolId)
  validateAchievementFields(fields)

  const recorder = await repos.teachers.findSchoolUser(actorUserId, schoolId).catch(() => null)

  const row = await repos.achievements.create({
    learner_id: learnerId,
    school_id: schoolId,
    achievement_type: fields.achievementType,
    category: fields.category,
    title: fields.title,
    description: fields.description,
    supporting_evidence_ids: fields.supportingEvidenceIds,
    verifying_document_reference: fields.verifyingDocumentReference,
    awarding_organization: fields.awardingOrganization,
    award_date: fields.awardDate,
    expires_at: fields.expiresAt,
    recorded_by: recorder?.id ?? null,
  })
  return withRelated(row)
}

/** Edits an existing Draft. Throws a clean error if the achievement has left draft — the DB trigger is the final backstop. */
export async function updateDraft(
  client: SupabaseClient,
  schoolId: string,
  achievementId: string,
  fields: Partial<AchievementFields>
): Promise<Achievement> {
  await requireSchoolStaff(client, schoolId)

  const existing = await repos.achievements.findById(achievementId, schoolId)
  if (!existing) throw new Error('Achievement not found.')
  if (existing.status !== 'draft') throw new Error('This achievement is no longer a draft and cannot be edited directly.')

  const merged: AchievementFields = {
    achievementType: fields.achievementType ?? existing.achievement_type,
    category: fields.category ?? existing.category,
    title: fields.title ?? existing.title,
    description: fields.description !== undefined ? fields.description : existing.description,
    supportingEvidenceIds: fields.supportingEvidenceIds ?? existing.supporting_evidence_ids,
    verifyingDocumentReference: fields.verifyingDocumentReference !== undefined ? fields.verifyingDocumentReference : existing.verifying_document_reference,
    awardingOrganization: fields.awardingOrganization !== undefined ? fields.awardingOrganization : existing.awarding_organization,
    awardDate: fields.awardDate ?? existing.award_date,
    expiresAt: fields.expiresAt !== undefined ? fields.expiresAt : existing.expires_at,
  }
  validateAchievementFields(merged)

  const row = await repos.achievements.updateDraft(achievementId, schoolId, {
    achievement_type: merged.achievementType,
    category: merged.category,
    title: merged.title,
    description: merged.description,
    supporting_evidence_ids: merged.supportingEvidenceIds,
    verifying_document_reference: merged.verifyingDocumentReference,
    awarding_organization: merged.awardingOrganization,
    award_date: merged.awardDate,
    expires_at: merged.expiresAt,
  })
  return withRelated(row)
}

/** Teacher Verify — Draft -> Verified. Requires Evidence or a verifying document reference (ADR-0012 Phase 5, non-negotiable). */
export async function verifyAchievement(client: SupabaseClient, schoolId: string, achievementId: string): Promise<Achievement> {
  const membership = await requireSchoolStaff(client, schoolId)

  const existing = await repos.achievements.findById(achievementId, schoolId)
  if (!existing) throw new Error('Achievement not found.')
  if (existing.status !== 'draft') throw new Error('Only a draft achievement can be verified.')
  if (!hasEvidence(existing)) {
    throw new Error('Cannot verify: this achievement has no supporting Evidence reference and no verifying document reference (ADR-0012 Phase 5).')
  }

  const verifier = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!verifier) throw new Error('Verifying staff member has no school_users record — cannot attribute this verification.')

  const nextVersion = existing.version + 1
  const row = await repos.achievements.verify(achievementId, schoolId, verifier.id, nextVersion)
  await recordTransition(achievementId, 'draft', 'verified', verifier.id, null, nextVersion)
  return withRelated(row)
}

/** Teacher Reject — Draft -> Rejected, a distinct terminal state from Revoked (ADR-0012 Phase 4). */
export async function rejectAchievement(client: SupabaseClient, schoolId: string, achievementId: string, reason: string): Promise<Achievement> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A rejection reason is required.')

  const existing = await repos.achievements.findById(achievementId, schoolId)
  if (!existing) throw new Error('Achievement not found.')
  if (existing.status !== 'draft') throw new Error('Only a draft achievement can be rejected.')

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  const nextVersion = existing.version + 1
  const row = await repos.achievements.reject(achievementId, schoolId, reason, nextVersion)
  await recordTransition(achievementId, 'draft', 'rejected', actor?.id ?? null, reason, nextVersion)
  return withRelated(row)
}

/** Teacher Publish — Verified -> Published. Cannot publish an unverified achievement. */
export async function publishAchievement(client: SupabaseClient, schoolId: string, achievementId: string): Promise<Achievement> {
  const membership = await requireSchoolStaff(client, schoolId)

  const existing = await repos.achievements.findById(achievementId, schoolId)
  if (!existing) throw new Error('Achievement not found.')
  if (existing.status !== 'verified') throw new Error('Cannot publish: this achievement has not been verified yet.')

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  const nextVersion = existing.version + 1
  const row = await repos.achievements.publish(achievementId, schoolId, nextVersion)
  await recordTransition(achievementId, 'verified', 'published', actor?.id ?? null, null, nextVersion)
  return withRelated(row)
}

/** Teacher Revoke — Published -> Revoked, for a verified-then-disproven claim (ADR-0012 Phase 4/11 "fake certificates" prevention). Never a delete. */
export async function revokeAchievement(client: SupabaseClient, schoolId: string, achievementId: string, reason: string): Promise<Achievement> {
  const membership = await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A revocation reason is required.')

  const existing = await repos.achievements.findById(achievementId, schoolId)
  if (!existing) throw new Error('Achievement not found.')
  if (existing.status !== 'published') throw new Error('Only a published achievement can be revoked.')

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!actor) throw new Error('Revoking staff member has no school_users record — cannot attribute this revocation.')

  const nextVersion = existing.version + 1
  const row = await repos.achievements.revoke(achievementId, schoolId, actor.id, reason, nextVersion)
  await recordTransition(achievementId, 'published', 'revoked', actor.id, reason, nextVersion)
  return withRelated(row)
}

/** Published -> Archived — the same retention-only end state ADR-0008 Part 2 already froze for Blueprint's own lifecycle. */
export async function archiveAchievement(client: SupabaseClient, schoolId: string, achievementId: string): Promise<Achievement> {
  const membership = await requireSchoolStaff(client, schoolId)

  const existing = await repos.achievements.findById(achievementId, schoolId)
  if (!existing) throw new Error('Achievement not found.')
  if (existing.status !== 'published') throw new Error('Only a published achievement can be archived.')

  const actor = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  const nextVersion = existing.version + 1
  const row = await repos.achievements.archive(achievementId, schoolId, nextVersion)
  await recordTransition(achievementId, 'published', 'archived', actor?.id ?? null, null, nextVersion)
  return withRelated(row)
}

export async function findAchievementById(client: SupabaseClient, schoolId: string, achievementId: string): Promise<Achievement | null> {
  await requireSchoolStaff(client, schoolId)
  const row = await repos.achievements.findById(achievementId, schoolId)
  return row ? withRelated(row) : null
}

/** Every achievement for a learner, any status — the teacher/admin full view. */
export async function listForLearner(client: SupabaseClient, schoolId: string, learnerId: string): Promise<Achievement[]> {
  await requireSchoolStaff(client, schoolId)
  const rows = await repos.achievements.listForLearner(learnerId, schoolId)
  return Promise.all(rows.map(withRelated))
}

/** Published achievements only — the surface every non-staff/summary consumer may read. Revoked achievements never appear here, even though they were once published (ADR-0012 Phase 10). */
export async function listPublished(learnerId: string, schoolId: string): Promise<Achievement[]> {
  const rows = await repos.achievements.listPublished(learnerId, schoolId)
  return Promise.all(rows.map(withRelated))
}

export async function getVerificationHistory(client: SupabaseClient, schoolId: string, achievementId: string): Promise<AchievementHistoryEntry[]> {
  await requireSchoolStaff(client, schoolId)
  const existing = await repos.achievements.findById(achievementId, schoolId)
  if (!existing) throw new Error('Achievement not found.')
  const rows = await repos.achievements.listHistory(achievementId)
  return rows.map(toHistoryEntry)
}

/**
 * Blueprint's field budget for Achievement (ADR-0012 Phase 6/7) — count,
 * latest verified, highest-level, URL, availability. Never a full record,
 * never a raw score. Only Published achievements are ever surfaced.
 */
export async function getAchievementSummary(learnerId: string, schoolId: string): Promise<AchievementSummary> {
  const published = await repos.achievements.listPublished(learnerId, schoolId)

  if (published.length === 0) {
    return { available: false, achievementCount: 0, latestVerifiedAchievement: null, highestLevelAchievement: null, profileUrl: null }
  }

  const byRecency = [...published].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  const latest = byRecency[0]

  const highest = [...published].sort((a, b) => {
    const rankDiff = CATEGORY_RANK[b.category] - CATEGORY_RANK[a.category]
    if (rankDiff !== 0) return rankDiff
    return (b.published_at ?? '').localeCompare(a.published_at ?? '')
  })[0]

  return {
    available: true,
    achievementCount: published.length,
    latestVerifiedAchievement: { title: latest.title, category: latest.category, achievementType: latest.achievement_type, publishedAt: latest.published_at! },
    highestLevelAchievement: { title: highest.title, category: highest.category, achievementType: highest.achievement_type, publishedAt: highest.published_at! },
    profileUrl: null,
  }
}
