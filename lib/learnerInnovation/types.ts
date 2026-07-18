// lib/learnerInnovation/types.ts
//
// The canonical Learner Innovation domain types (Sprint 13I, ADR-0018).
// Innovation owns the creation, refinement, and documented evolution of a
// novel educational solution — problem, idea, prototype history,
// iterations, evidence of testing, mentor guidance, impact evidence,
// adoption. Nothing else — no score, no ranking, no popularity metric, no
// AI field anywhere in this shape (ADR-0018 Phase 8 Principle 9).

import type {
  InnovationStatus,
  LearnerInnovationRow,
  InnovationIterationRow,
  InnovationArtifactRow,
  InnovationReviewHistoryRow,
} from '@/lib/repositories/innovation.repository'

export type { InnovationStatus }

export type InnovationFields = {
  problemAddressed: string
  ideaSummary: string
  supportingEvidenceIds: string[]
}

export type Innovation = {
  id: string
  learnerId: string
  problemAddressed: string
  ideaSummary: string
  status: InnovationStatus
  mentorSchoolUserId: string | null
  projectId: string | null
  competitionId: string | null
  validatedBy: string | null
  validatedAt: string | null
  impactEvidence: string | null
  adoptionNote: string | null
  publicDemonstration: string | null
  discontinuedReason: string | null
  lessonsLearned: string | null
  discontinuedAt: string | null
  notValidatedReason: string | null
  notValidatedAt: string | null
  revokedBy: string | null
  revokedReason: string | null
  revokedAt: string | null
  archivedAt: string | null
  publishedAt: string | null
  supportingEvidenceIds: string[]
  recordedBy: string | null
  version: number
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export type InnovationIteration = {
  id: string
  problem: string
  hypothesis: string
  changeIntroduced: string
  evidence: string
  outcome: string
  teacherNote: string | null
  actorSchoolUserId: string | null
  createdAt: string
}

export type InnovationHistoryEntry = {
  fromStatus: InnovationStatus
  toStatus: InnovationStatus
  actorSchoolUserId: string | null
  reason: string | null
  version: number
  createdAt: string
}

/**
 * Blueprint's field budget for Innovation (mission Phase 6) — availability,
 * current stage, iteration count, latest milestone, latest implementation
 * date, URL. Never iteration history, teacher notes, internal review,
 * artifacts, or testing data — none of those fields exist anywhere in
 * this type's shape.
 */
export type InnovationsSummary = {
  available: boolean
  currentStage: { problemAddressed: string; status: InnovationStatus } | null
  iterationCount: number
  latestMilestone: string | null
  latestImplementationDate: string | null
  innovationsUrl: string | null
}

export function toInnovation(row: LearnerInnovationRow): Innovation {
  return {
    id: row.id,
    learnerId: row.learner_id,
    problemAddressed: row.problem_addressed,
    ideaSummary: row.idea_summary,
    status: row.status,
    mentorSchoolUserId: row.mentor_school_user_id,
    projectId: row.project_id,
    competitionId: row.competition_id,
    validatedBy: row.validated_by,
    validatedAt: row.validated_at,
    impactEvidence: row.impact_evidence,
    adoptionNote: row.adoption_note,
    publicDemonstration: row.public_demonstration,
    discontinuedReason: row.discontinued_reason,
    lessonsLearned: row.lessons_learned,
    discontinuedAt: row.discontinued_at,
    notValidatedReason: row.not_validated_reason,
    notValidatedAt: row.not_validated_at,
    revokedBy: row.revoked_by,
    revokedReason: row.revoked_reason,
    revokedAt: row.revoked_at,
    archivedAt: row.archived_at,
    publishedAt: row.published_at,
    supportingEvidenceIds: row.supporting_evidence_ids,
    recordedBy: row.recorded_by,
    version: row.version,
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toIteration(row: InnovationIterationRow): InnovationIteration {
  return {
    id: row.id,
    problem: row.problem,
    hypothesis: row.hypothesis,
    changeIntroduced: row.change_introduced,
    evidence: row.evidence,
    outcome: row.outcome,
    teacherNote: row.teacher_note,
    actorSchoolUserId: row.actor_school_user_id,
    createdAt: row.created_at,
  }
}

export function toArtifact(row: InnovationArtifactRow): { url: string; label: string | null } {
  return { url: row.url, label: row.label }
}

export function toHistoryEntry(row: InnovationReviewHistoryRow): InnovationHistoryEntry {
  return {
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorSchoolUserId: row.actor_school_user_id,
    reason: row.reason,
    version: row.version,
    createdAt: row.created_at,
  }
}
