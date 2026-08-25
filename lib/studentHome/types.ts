// lib/studentHome/types.ts
//
// Phase 7 — Learner Home Convergence. Presentation-only view model for the
// learner Home surface. Every field here is either a direct read of
// existing canonical state (Projection, assignment/submission rows,
// approved+delivered Blueprint actions, Compass sessions) or a deterministic,
// pure derivation over that state (priority ordering, copy translation).
// Nothing in this file or lib/studentHome/*.ts computes new learner truth —
// see lib/studentHome/composeStudentHome.ts's header for the exact
// provenance of every field.

export type NextActionKind = 'assignment' | 'compass_action' | 'explore_compass'

/** How this item came to exist — drives the honest provenance copy (Phase 7 §5/§29): never implies automatic AI assignment unless it genuinely was teacher-approved and delivered. */
export type ActionProvenance = 'teacher_approved_action' | 'class_assignment' | 'learner_choice'

export type ActionState =
  | 'ready'
  | 'in_progress'
  | 'due_soon'
  | 'overdue'
  | 'completed'
  | 'waiting_for_review'
  | 'optional'

export type NextActionCandidate = {
  kind: NextActionKind
  id: string
  title: string
  subject: string | null
  provenance: ActionProvenance
  state: ActionState
  href: string
  dueDate: string | null
  daysLeft: number | null
  isOverdue: boolean
  /** Only set for a teacher-approved action — the rationale a teacher recorded, already learner-safe copy (LearnerSafeActionView). Never internal architecture terms. */
  whyItMatters: string | null
}

export type NextActionCard = {
  kind: NextActionKind
  /** The underlying assignment/Compass-delivery id — lets a caller correlate this card back to the canonical record it came from (e.g. to confirm Home never disagrees with the full assignments list). */
  id: string
  title: string
  subject: string | null
  subtitle: string
  href: string
  isOverdue: boolean
  dueDate: string | null
}

export type AttentionItem = {
  id: string
  label: string
  subject: string | null
  href: string | null
}

export type SubjectLearningState = {
  subject: string
  displayName: string
  level: 1 | 2 | 3 | 4
  levelLabel: string
  trendLabel: 'Improving' | 'Steady' | 'Needs practice' | 'Mixed' | 'Just started'
}

export type RecentProgressItem = {
  subject: string
  displayName: string
  message: string
}

export type ContinueAssignmentItem = {
  id: string
  title: string
  subject: string
  dueDate: string
  daysLeft: number
  isOverdue: boolean
}

export type ContinueSession = {
  id: string
  subject: string
  subjectLabel: string
  xpEarned: number
  levelGained: boolean
  summary: string | null
  relativeDate: string
}

export type BlueprintTeaser = {
  insight: string | null
}

export type LearnerHomeView = {
  student: {
    id: string
    name: string
    firstName: string
    grade: number
    school: string | null
    pathway: string | null
    curriculum: string
  }
  stats: {
    totalXp: number
    totalSessions: number
    sessionsThisWeek: number
    streak: number
    futureReadiness: number
    frsLabel: 'Leading' | 'Strong' | 'Growing' | 'Emerging' | 'Building'
  }
  nextAction: NextActionCard | null
  attention: AttentionItem[]
  learningState: SubjectLearningState[]
  recentProgress: RecentProgressItem[]
  continueAssignments: ContinueAssignmentItem[]
  continueSessions: ContinueSession[]
  blueprintTeaser: BlueprintTeaser
  blueprintHref: string
  hasAssessment: boolean
  hasTeacher: boolean
  /** True only when at least one approved, delivered, not-yet-completed teacher action exists — lets the UI distinguish "no action" from "teacher is still reviewing." */
  hasPendingApprovedAction: boolean
}
