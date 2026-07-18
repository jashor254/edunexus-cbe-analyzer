// lib/learnerWellbeing/types.ts
//
// The canonical Learner Wellbeing domain types (Sprint 13G, ADR-0017).
// Wellbeing owns the confidential record that support was needed,
// provided, and closed. Nothing else — no diagnosis field, no score, no
// risk field, no AI-generated content anywhere in this shape (ADR-0017
// Phase 4/9).

import type {
  WellbeingCaseType,
  WellbeingStatus,
  WellbeingEscalationStatus,
  WellbeingVisibilityClassification,
  WellbeingUpdateType,
  SupportTeamRole,
  LearnerWellbeingCaseRow,
  WellbeingSupportTeamRow,
  WellbeingUpdateRow,
} from '@/lib/repositories/wellbeing.repository'

export type { WellbeingCaseType, WellbeingStatus, WellbeingEscalationStatus, WellbeingVisibilityClassification, WellbeingUpdateType, SupportTeamRole }

export type WellbeingCaseFields = {
  caseType: WellbeingCaseType
  concernSummary: string
  defaultVisibilityClassification: WellbeingVisibilityClassification
}

export type WellbeingCase = {
  id: string
  learnerId: string
  caseType: WellbeingCaseType
  concernSummary: string
  status: WellbeingStatus
  escalationStatus: WellbeingEscalationStatus
  escalatedBy: string | null
  escalatedAt: string | null
  supportGoal: string | null
  supportOutcome: string | null
  outcomeRecordedAt: string | null
  noActionReason: string | null
  withdrawnReason: string | null
  withdrawnAt: string | null
  closedAt: string | null
  defaultVisibilityClassification: WellbeingVisibilityClassification
  raisedBy: string | null
  assessedBy: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type WellbeingSupportTeamMember = {
  schoolUserId: string
  role: SupportTeamRole
  addedAt: string
}

export type WellbeingUpdate = {
  id: string
  updateType: WellbeingUpdateType
  fromStatus: WellbeingStatus | null
  toStatus: WellbeingStatus | null
  content: string | null
  visibilityClassification: WellbeingVisibilityClassification | null
  actorSchoolUserId: string | null
  version: number | null
  createdAt: string
}

export function toWellbeingCase(row: LearnerWellbeingCaseRow): WellbeingCase {
  return {
    id: row.id,
    learnerId: row.learner_id,
    caseType: row.case_type,
    concernSummary: row.concern_summary,
    status: row.status,
    escalationStatus: row.escalation_status,
    escalatedBy: row.escalated_by,
    escalatedAt: row.escalated_at,
    supportGoal: row.support_goal,
    supportOutcome: row.support_outcome,
    outcomeRecordedAt: row.outcome_recorded_at,
    noActionReason: row.no_action_reason,
    withdrawnReason: row.withdrawn_reason,
    withdrawnAt: row.withdrawn_at,
    closedAt: row.closed_at,
    defaultVisibilityClassification: row.default_visibility_classification,
    raisedBy: row.raised_by,
    assessedBy: row.assessed_by,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toSupportTeamMember(row: WellbeingSupportTeamRow): WellbeingSupportTeamMember {
  return { schoolUserId: row.school_user_id, role: row.role, addedAt: row.created_at }
}

export function toWellbeingUpdate(row: WellbeingUpdateRow): WellbeingUpdate {
  return {
    id: row.id,
    updateType: row.update_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    content: row.content,
    visibilityClassification: row.visibility_classification,
    actorSchoolUserId: row.actor_school_user_id,
    version: row.version,
    createdAt: row.created_at,
  }
}
