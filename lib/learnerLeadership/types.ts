// lib/learnerLeadership/types.ts
//
// The canonical Learner Leadership domain types (Sprint 13D, ADR-0015).
// Leadership owns demonstrated responsibility held over time — position,
// selection, active service, review, completion, reflection, mentor
// verification. Nothing else (never a recognition claim — see
// "Relationship to ADR-0012" in ADR-0015 Phase 7 — and never a
// disciplinary record, ADR-0015 Phase 2/11).

import type {
  LeadershipStatus,
  LearnerLeadershipRow,
  LeadershipHistoryRow,
} from '@/lib/repositories/leadership.repository'

export type { LeadershipStatus }

export type LeadershipFields = {
  positionTitle: string
  scope: string | null
  body: string | null
  responsibilities: string | null
  isActing: boolean
  supportingEvidenceIds: string[]
}

export type Leadership = {
  id: string
  learnerId: string
  positionTitle: string
  scope: string | null
  body: string | null
  responsibilities: string | null
  isActing: boolean
  startDate: string | null
  endDate: string | null
  mentorSchoolUserId: string | null
  status: LeadershipStatus
  reviewNotes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  completedNotes: string | null
  reflection: string | null
  supportingEvidenceIds: string[]
  recordedBy: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  publishedAt: string | null
  historicalAt: string | null
  notSelectedReason: string | null
  discontinuedReason: string | null
  discontinuedAt: string | null
  rejectedReason: string | null
  revokedBy: string | null
  revokedReason: string | null
  revokedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type LeadershipHistoryEntry = {
  fromStatus: LeadershipStatus
  toStatus: LeadershipStatus
  actorSchoolUserId: string | null
  reason: string | null
  version: number
  createdAt: string
}

/**
 * Blueprint's field budget for Leadership (ADR-0015 Phase 5) — current
 * role, completed verified service, brief service summary, URL. Never
 * review notes, election data, meeting history, mentor comments, or
 * disciplinary information (mission Phase 6) — none of those fields exist
 * anywhere in this type's shape.
 */
export type LeadershipHighlight = { title: string; scope: string | null; publishedAt: string }

export type LeadershipSummary = {
  available: boolean
  currentRole: { title: string; scope: string | null } | null
  completedRoleCount: number
  latestCompletedRole: LeadershipHighlight | null
  leadershipUrl: string | null
}

export function toLeadership(row: LearnerLeadershipRow): Leadership {
  return {
    id: row.id,
    learnerId: row.learner_id,
    positionTitle: row.position_title,
    scope: row.scope,
    body: row.body,
    responsibilities: row.responsibilities,
    isActing: row.is_acting,
    startDate: row.start_date,
    endDate: row.end_date,
    mentorSchoolUserId: row.mentor_school_user_id,
    status: row.status,
    reviewNotes: row.review_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    completedNotes: row.completed_notes,
    reflection: row.reflection,
    supportingEvidenceIds: row.supporting_evidence_ids,
    recordedBy: row.recorded_by,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    publishedAt: row.published_at,
    historicalAt: row.historical_at,
    notSelectedReason: row.not_selected_reason,
    discontinuedReason: row.discontinued_reason,
    discontinuedAt: row.discontinued_at,
    rejectedReason: row.rejected_reason,
    revokedBy: row.revoked_by,
    revokedReason: row.revoked_reason,
    revokedAt: row.revoked_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toHistoryEntry(row: LeadershipHistoryRow): LeadershipHistoryEntry {
  return {
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorSchoolUserId: row.actor_school_user_id,
    reason: row.reason,
    version: row.version,
    createdAt: row.created_at,
  }
}
