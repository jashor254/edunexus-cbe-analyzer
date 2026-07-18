// lib/learnerProjects/types.ts
//
// The canonical Learner Projects domain types (Sprint 12Z, ADR-0013).
// Projects owns the work — title, description, goal, category, status,
// dates, artifacts, team, reflection, mentor, verification. Nothing else
// (never a score, never a competency, never an achievement).

import type {
  ProjectCategory,
  ProjectStatus,
  ProjectVerificationType,
  LearnerProjectRow,
  ProjectMemberRow,
  ProjectMentorRow,
  ProjectUpdateRow,
  ProjectArtifactRow,
} from '@/lib/repositories/project.repository'

export type { ProjectCategory, ProjectStatus, ProjectVerificationType }

export const PROJECT_CATEGORIES: readonly ProjectCategory[] = [
  'academic', 'cbc', 'research', 'innovation', 'technology',
  'creative_arts', 'music', 'drama', 'business', 'agriculture',
  'engineering', 'community', 'environmental', 'leadership',
  'entrepreneurship', 'digital',
]

export const PROJECT_VERIFICATION_TYPES: readonly ProjectVerificationType[] = [
  'teacher_verified', 'school_verified', 'competition_verified',
  'external_verified', 'self_only', 'pending',
]

export type ProjectFields = {
  title: string
  description: string | null
  goal: string | null
  category: ProjectCategory
  startDate: string | null
  completionDate: string | null
  reflection: string | null
  supportingEvidenceIds: string[]
}

export type Project = {
  id: string
  learnerId: string
  title: string
  description: string | null
  goal: string | null
  category: ProjectCategory
  status: ProjectStatus
  startDate: string | null
  completionDate: string | null
  reflection: string | null
  supportingEvidenceIds: string[]
  verificationType: ProjectVerificationType | null
  verifyingDocumentReference: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  reviewNotes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  rejectedReason: string | null
  publishedAt: string | null
  archivedAt: string | null
  cancelledAt: string | null
  createdBy: string | null
  version: number
  createdAt: string
  updatedAt: string
  members: { learnerId: string; role: string | null }[]
  mentors: { mentorName: string; role: string | null }[]
  updates: { note: string; createdAt: string }[]
  artifacts: { url: string; label: string | null }[]
}

/**
 * Blueprint's field budget for Projects (ADR-0013 Phase 2/6) — count,
 * latest published, current active, featured, URL. Never a full record,
 * never internal lifecycle state (Phase 6: "never expose internal lifecycle").
 */
export type ProjectHighlight = { title: string; category: ProjectCategory; publishedAt: string | null }

export type ProjectsSummary = {
  available: boolean
  projectCount: number
  latestPublishedProject: ProjectHighlight | null
  currentActiveProject: { title: string; category: ProjectCategory } | null
  featuredProject: ProjectHighlight | null
  projectsUrl: string | null
}

/**
 * ADR-0013 "Relationship to ADR-0011" — what a Portfolio item's `projects`
 * category resolves to. `reserved` means the category is set but no
 * project_id link exists yet — never fabricated as a real reference.
 */
export type PortfolioProjectReference =
  | { status: 'linked'; project: ProjectHighlight }
  | { status: 'reserved' }
  | { status: 'not_applicable' }

export function toProject(
  row: LearnerProjectRow,
  members: ProjectMemberRow[],
  mentors: ProjectMentorRow[],
  updates: ProjectUpdateRow[],
  artifacts: ProjectArtifactRow[]
): Project {
  return {
    id: row.id,
    learnerId: row.learner_id,
    title: row.title,
    description: row.description,
    goal: row.goal,
    category: row.category,
    status: row.status,
    startDate: row.start_date,
    completionDate: row.completion_date,
    reflection: row.reflection,
    supportingEvidenceIds: row.supporting_evidence_ids,
    verificationType: row.verification_type,
    verifyingDocumentReference: row.verifying_document_reference,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    reviewNotes: row.review_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectedReason: row.rejected_reason,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    cancelledAt: row.cancelled_at,
    createdBy: row.created_by,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    members: members.map(m => ({ learnerId: m.learner_id, role: m.role })),
    mentors: mentors.map(m => ({ mentorName: m.mentor_name, role: m.role })),
    updates: updates.map(u => ({ note: u.note, createdAt: u.created_at })),
    artifacts: artifacts.map(a => ({ url: a.url, label: a.label })),
  }
}
