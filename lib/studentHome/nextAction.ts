// lib/studentHome/nextAction.ts
//
// Phase 7 — Learner Home Convergence. Pure, deterministic business rules
// only — no database access, no AI call, no new learner-truth computation.
// Every function here takes already-canonical candidates (assembled by
// lib/studentHome/composeStudentHome.ts from existing domain reads) and
// applies a fixed, auditable priority/translation rule. Phase 6's audit
// explicitly forbade asking an LLM to choose Home's priority (§33) — this
// file is the deterministic alternative.

import type {
  NextActionCandidate, NextActionCard, ActionState, AttentionItem,
} from './types'
import type { Trend } from '@/lib/projection/types'

/**
 * Precedence (Phase 7 §4, adapted to what real product semantics support —
 * confirmed by Phase 6's audit of the teacher-approved action pipeline):
 *
 *   1. an overdue assignment (required work, already late)
 *   2. a teacher-approved action that has actually been delivered
 *      (assignment or Compass) — explicit teacher intent for this learner
 *   3. an assignment due within 2 days
 *   4. any other pending assignment (earliest due first)
 *   5. nothing — the caller falls back to an "explore Compass" card
 *
 * A candidate already marked 'completed' is never chosen — it belongs in
 * recent progress, not Next Action.
 */
export function chooseNextAction(candidates: NextActionCandidate[]): NextActionCandidate | null {
  const live = candidates.filter(c => c.state !== 'completed')
  if (live.length === 0) return null

  const overdue = live.filter(c => c.isOverdue)
  if (overdue.length > 0) return earliestDue(overdue)

  const approvedActions = live.filter(c => c.provenance === 'teacher_approved_action')
  if (approvedActions.length > 0) return approvedActions[0]

  const dueSoon = live.filter(c => c.kind === 'assignment' && c.daysLeft !== null && c.daysLeft <= 2)
  if (dueSoon.length > 0) return earliestDue(dueSoon)

  const anyAssignment = live.filter(c => c.kind === 'assignment')
  if (anyAssignment.length > 0) return earliestDue(anyAssignment)

  return null
}

function earliestDue(items: NextActionCandidate[]): NextActionCandidate {
  return [...items].sort((a, b) => {
    if (a.dueDate === null) return 1
    if (b.dueDate === null) return -1
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })[0]
}

const SUBTITLE_BY_PROVENANCE: Record<NextActionCandidate['provenance'], (c: NextActionCandidate) => string> = {
  teacher_approved_action: c => c.whyItMatters ?? 'Recommended by your teacher',
  class_assignment:        c => c.isOverdue ? overdueSubtitle(c) : dueSubtitle(c),
  learner_choice:          () => 'Ready when you are',
}

function overdueSubtitle(c: NextActionCandidate): string {
  const days = c.daysLeft !== null ? Math.abs(c.daysLeft) : null
  return days ? `${days}d overdue` : 'Overdue'
}

function dueSubtitle(c: NextActionCandidate): string {
  if (c.daysLeft === null) return 'Due soon'
  if (c.daysLeft <= 0) return 'Due today'
  return `Due in ${c.daysLeft}d`
}

export function toNextActionCard(c: NextActionCandidate): NextActionCard {
  return {
    kind: c.kind,
    id: c.id,
    title: c.title,
    subject: c.subject,
    subtitle: SUBTITLE_BY_PROVENANCE[c.provenance](c),
    href: c.href,
    isOverdue: c.isOverdue,
    dueDate: c.dueDate,
  }
}

/**
 * "Needs attention" — overdue work plus at most a couple of subjects with a
 * genuine canonical risk flag (Phase 6 §23: risk stays subject-scoped, never
 * sub-strand-specific — copy below deliberately never claims more precision
 * than that). Deliberately excludes anything already surfaced as Next
 * Action, so the two sections never repeat the same item (Phase 7 §8: one
 * coherent attention area, not scattered warnings).
 */
export function buildAttentionItems(
  overdueCandidates: NextActionCandidate[],
  riskedSubjects: Array<{ subject: string; displayName: string }>,
  excludeSubject: string | null,
  assignmentsHref: string,
): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const c of overdueCandidates) {
    items.push({ id: `overdue-${c.id}`, label: `${c.title} is overdue`, subject: c.subject, href: assignmentsHref })
  }
  for (const s of riskedSubjects) {
    if (s.subject === excludeSubject) continue
    items.push({ id: `risk-${s.subject}`, label: `${s.displayName} needs more practice`, subject: s.subject, href: '/learn' })
  }
  return items.slice(0, 4)
}

/** Learner-safe trend copy — never the internal Trend union value verbatim, never punitive language (Phase 7 §21/§28). */
export function trendLabel(trend: Trend): 'Improving' | 'Steady' | 'Needs practice' | 'Mixed' | 'Just started' {
  switch (trend) {
    case 'improving':         return 'Improving'
    case 'declining':         return 'Needs practice'
    case 'stable':            return 'Steady'
    case 'mixed':             return 'Mixed'
    case 'insufficient_data': return 'Just started'
  }
}

/** Same action state vocabulary the assignment/Compass-delivery domain already uses, translated to the fixed enum Home renders against (Phase 7 §7 — never an independently-invented status). */
export function deriveAssignmentState(submissionStatus: string, isOverdue: boolean, daysLeft: number): ActionState {
  if (submissionStatus === 'marked') return 'completed'
  if (isOverdue) return 'overdue'
  if (submissionStatus === 'submitted') return 'waiting_for_review'
  if (daysLeft <= 2) return 'due_soon'
  return 'ready'
}

export function deriveCompassDeliveryState(status: 'available' | 'started' | 'completed' | 'expired'): ActionState {
  switch (status) {
    case 'completed': return 'completed'
    case 'started':   return 'in_progress'
    case 'expired':   return 'completed' // expired without completion is not re-surfaced as a live next action — treated as no longer live, never re-invented as "overdue" (no due date semantics exist for a Compass delivery).
    case 'available': return 'ready'
  }
}
