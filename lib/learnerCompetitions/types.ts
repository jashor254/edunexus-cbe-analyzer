// lib/learnerCompetitions/types.ts
//
// The canonical Learner Competitions domain types (Sprint 13B, ADR-0014).
// Competitions owns the live, external, multi-week competitive process —
// name, level, category, dates, team, mentor, position/results/judges/
// feedback, media (including certificates), lifecycle. Nothing else
// (never a score achievement claims for itself — see "Relationship to
// ADR-0012" in ADR-0014 Phase 3 — and never a Project's own work).

import type {
  CompetitionLevel,
  CompetitionCategory,
  CompetitionStatus,
  LearnerCompetitionRow,
  CompetitionMemberRow,
  CompetitionMediaRow,
  CompetitionHistoryRow,
} from '@/lib/repositories/competition.repository'

export type { CompetitionLevel, CompetitionCategory, CompetitionStatus }

export const COMPETITION_LEVELS: readonly CompetitionLevel[] = [
  'school', 'regional', 'national', 'international',
]

export const COMPETITION_CATEGORIES: readonly CompetitionCategory[] = [
  'academic', 'robotics', 'coding', 'debate', 'sports',
  'music', 'drama', 'science', 'innovation', 'quiz', 'other',
]

export type CompetitionFields = {
  name: string
  organizingBody: string | null
  level: CompetitionLevel
  category: CompetitionCategory
  eventDate: string | null
  venue: string | null
  projectId: string | null
  supportingEvidenceIds: string[]
}

export type Competition = {
  id: string
  learnerId: string
  name: string
  organizingBody: string | null
  level: CompetitionLevel
  category: CompetitionCategory
  eventDate: string | null
  venue: string | null
  projectId: string | null
  mentorSchoolUserId: string | null
  status: CompetitionStatus
  position: string | null
  resultsSummary: string | null
  judges: string | null
  feedback: string | null
  supportingEvidenceIds: string[]
  recordedBy: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  rejectedReason: string | null
  publishedAt: string | null
  historicalAt: string | null
  revokedBy: string | null
  revokedReason: string | null
  revokedAt: string | null
  withdrawnReason: string | null
  withdrawnAt: string | null
  version: number
  createdAt: string
  updatedAt: string
  members: { learnerId: string; role: string | null }[]
  media: { url: string; label: string | null }[]
}

export type CompetitionHistoryEntry = {
  fromStatus: CompetitionStatus
  toStatus: CompetitionStatus
  actorSchoolUserId: string | null
  reason: string | null
  version: number
  createdAt: string
}

/**
 * Blueprint's field budget for Competitions (mission Phase 7) — total
 * published, verified count, latest, current participation, URL. Never a
 * full record. Never judging/feedback (mission: "never expose judging,
 * never expose raw feedback, never expose unpublished work").
 */
export type CompetitionHighlight = { name: string; level: CompetitionLevel; category: CompetitionCategory; publishedAt: string }

export type CompetitionsSummary = {
  available: boolean
  totalCompetitions: number
  /**
   * A published competition was, by construction, verified before it could
   * publish (Verification -> Published is the only path to Published) — so
   * this is always equal to `totalCompetitions` today. Kept as its own
   * named field, not aliased away, for the same reason Achievement names
   * `latestVerifiedAchievement` explicitly even though every published
   * Achievement was verified: the vocabulary is a trust signal in its own
   * right, and a future distinct verification-without-publication surface
   * (if ever built) would give this field a genuinely different value
   * without changing this type's shape.
   */
  verifiedCompetitions: number
  latestCompetition: CompetitionHighlight | null
  /** In-flight only (registration/preparation/participation/judging/results/verification) — never a full record, matching Projects' currentActiveProject shape exactly. */
  currentParticipation: { name: string; level: CompetitionLevel; category: CompetitionCategory } | null
  competitionsUrl: string | null
}

export function toCompetition(
  row: LearnerCompetitionRow,
  members: CompetitionMemberRow[],
  media: CompetitionMediaRow[]
): Competition {
  return {
    id: row.id,
    learnerId: row.learner_id,
    name: row.name,
    organizingBody: row.organizing_body,
    level: row.level,
    category: row.category,
    eventDate: row.event_date,
    venue: row.venue,
    projectId: row.project_id,
    mentorSchoolUserId: row.mentor_school_user_id,
    status: row.status,
    position: row.position,
    resultsSummary: row.results_summary,
    judges: row.judges,
    feedback: row.feedback,
    supportingEvidenceIds: row.supporting_evidence_ids,
    recordedBy: row.recorded_by,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    rejectedReason: row.rejected_reason,
    publishedAt: row.published_at,
    historicalAt: row.historical_at,
    revokedBy: row.revoked_by,
    revokedReason: row.revoked_reason,
    revokedAt: row.revoked_at,
    withdrawnReason: row.withdrawn_reason,
    withdrawnAt: row.withdrawn_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    members: members.map(m => ({ learnerId: m.learner_id, role: m.role })),
    media: media.map(m => ({ url: m.url, label: m.label })),
  }
}

export function toHistoryEntry(row: CompetitionHistoryRow): CompetitionHistoryEntry {
  return {
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorSchoolUserId: row.actor_school_user_id,
    reason: row.reason,
    version: row.version,
    createdAt: row.created_at,
  }
}
