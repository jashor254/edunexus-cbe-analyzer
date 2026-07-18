// lib/learnerAchievement/types.ts
//
// The canonical Learner Achievement domain types (Sprint 12W, ADR-0012).
// Achievement Type (Phase 2) and Category (Phase 8) are two separate
// frozen fields — never conflated into one classification.

import type {
  AchievementType,
  AchievementCategory,
  AchievementStatus,
  LearnerAchievementRow,
  AchievementMediaRow,
  AchievementTagRow,
  AchievementHistoryRow,
} from '@/lib/repositories/achievement.repository'

export type { AchievementType, AchievementCategory, AchievementStatus }

export const ACHIEVEMENT_TYPES: readonly AchievementType[] = [
  'certificate', 'competition', 'leadership', 'community_service',
  'innovation', 'creative_work', 'participation',
]

export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = [
  'academic', 'leadership', 'innovation', 'community_service',
  'creative_arts', 'sports', 'entrepreneurship', 'research',
  'technology', 'other',
]

/** Categories ranked for Blueprint's "highest-level achievement" pick (Phase 6) — never a fabricated ranking, just a fixed, documented ordering by how school-wide/external-facing a category typically is. Ties broken by most recent. */
export const CATEGORY_RANK: Record<AchievementCategory, number> = {
  academic: 5, technology: 5, research: 5,
  leadership: 4, entrepreneurship: 4,
  innovation: 3, creative_arts: 3, sports: 3,
  community_service: 2,
  other: 1,
}

export type AchievementFields = {
  achievementType: AchievementType
  category: AchievementCategory
  title: string
  description: string | null
  supportingEvidenceIds: string[]
  verifyingDocumentReference: string | null
  awardingOrganization: string | null
  awardDate: string
  expiresAt: string | null
}

export type Achievement = {
  id: string
  learnerId: string
  achievementType: AchievementType
  category: AchievementCategory
  title: string
  description: string | null
  supportingEvidenceIds: string[]
  verifyingDocumentReference: string | null
  awardingOrganization: string | null
  awardDate: string
  /** Not a stored status — computed from `expiresAt` at read time (ADR-0012 Phase 4). */
  isExpired: boolean
  status: AchievementStatus
  version: number
  recordedBy: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  rejectedReason: string | null
  publishedAt: string | null
  revokedBy: string | null
  revokedReason: string | null
  revokedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  media: { url: string; label: string | null }[]
  tags: string[]
}

export type AchievementHistoryEntry = {
  fromStatus: AchievementStatus
  toStatus: AchievementStatus
  actorSchoolUserId: string | null
  reason: string | null
  version: number
  createdAt: string
}

/**
 * Blueprint's field budget for Achievement (Phase 6) — count, latest
 * verified, highest-level, URL, availability. Never a full record.
 */
export type AchievementHighlight = { title: string; category: AchievementCategory; achievementType: AchievementType; publishedAt: string }

export type AchievementSummary = {
  available: boolean
  achievementCount: number
  latestVerifiedAchievement: AchievementHighlight | null
  highestLevelAchievement: AchievementHighlight | null
  profileUrl: string | null
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}

export function toAchievement(
  row: LearnerAchievementRow,
  media: AchievementMediaRow[],
  tags: AchievementTagRow[]
): Achievement {
  return {
    id: row.id,
    learnerId: row.learner_id,
    achievementType: row.achievement_type,
    category: row.category,
    title: row.title,
    description: row.description,
    supportingEvidenceIds: row.supporting_evidence_ids,
    verifyingDocumentReference: row.verifying_document_reference,
    awardingOrganization: row.awarding_organization,
    awardDate: row.award_date,
    isExpired: isExpired(row.expires_at),
    status: row.status,
    version: row.version,
    recordedBy: row.recorded_by,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    rejectedReason: row.rejected_reason,
    publishedAt: row.published_at,
    revokedBy: row.revoked_by,
    revokedReason: row.revoked_reason,
    revokedAt: row.revoked_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: media.map(m => ({ url: m.url, label: m.label })),
    tags: tags.map(t => t.tag),
  }
}

export function toHistoryEntry(row: AchievementHistoryRow): AchievementHistoryEntry {
  return {
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorSchoolUserId: row.actor_school_user_id,
    reason: row.reason,
    version: row.version,
    createdAt: row.created_at,
  }
}
