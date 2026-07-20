// lib/teacherWorkflow/nextAction.ts
//
// PRP-3 (Teacher Workflow Engine, Phase 3) — the Next Action Engine.
//
// This is deterministic workflow composition, not intelligence. It takes
// facts that already exist (composed by other domains' own services,
// never recomputed here) and orders them into "what to do next," the same
// way lib/attentionFeed/prioritize.ts orders attention items — a sibling
// pattern, not a new kind of thing in this codebase.
//
// It never calculates an educational insight (no risk score, no capability
// judgment, no confidence value). It only prioritizes existing, already-
// composed operational facts: is attendance marked, are marks entered, is
// teaching material prepared. The priority order below mirrors the actual
// shape of a Kenyan school day (PRP-1 Phase 2: attendance happens first,
// teaching happens during the day, assessment entry happens in the gaps) —
// not a guess, a direct application of that earlier audit.
//
// Core Principle (PRP-3 mission): "Teacher Workflow suggests. Teachers
// decide." This module returns suggestions with links; it never performs
// an action, publishes anything, or sends any communication itself.

export type AttendanceGapFact = { classId: string; className: string }
export type PendingAssessmentFact = { id: string; classId: string; title: string; className: string }
export type TeachingGapFact = { schemeId: string; label: string; track: 'lp' | 'row'; done: number; total: number }

export type NextActionFacts = {
  attendanceGaps: AttendanceGapFact[]
  pendingAssessments: PendingAssessmentFact[]
  teachingGaps: TeachingGapFact[]
}

export type NextAction = {
  key: string
  kind: 'attendance' | 'assessment' | 'teaching'
  title: string
  description: string
  href: string
}

// Deterministic priority: Attendance before Teaching before Assessment —
// matches the order these actually happen in a school day (mark the
// register, then teach, then enter marks in a gap). Ties within a kind
// preserve input order (whatever order the source data arrived in), not
// re-sorted by any heuristic.
export function composeNextActions(facts: NextActionFacts): NextAction[] {
  const actions: NextAction[] = []

  for (const gap of facts.attendanceGaps) {
    actions.push({
      key: `attendance-${gap.classId}`,
      kind: 'attendance',
      title: `Complete attendance for ${gap.className}`,
      description: 'Not yet marked today.',
      href: `/teacher/attendance`,
    })
  }

  for (const gap of facts.teachingGaps) {
    const trackLabel = gap.track === 'lp' ? 'Lesson Plans' : 'Record of Work'
    actions.push({
      key: `teaching-${gap.schemeId}-${gap.track}`,
      kind: 'teaching',
      title: `Continue ${trackLabel} for ${gap.label}`,
      description: `${gap.done} of ${gap.total} complete.`,
      href: gap.track === 'lp' ? `/teacher/lesson-plans?sowId=${gap.schemeId}` : `/teacher/record-of-work`,
    })
  }

  for (const a of facts.pendingAssessments) {
    actions.push({
      key: `assessment-${a.id}`,
      kind: 'assessment',
      title: `Enter marks for ${a.title}`,
      description: `${a.className} — awaiting scores.`,
      href: `/teacher/classes/${a.classId}/assessments/${a.id}`,
    })
  }

  return actions
}

// The single top suggestion for a "what's next" card — the first action
// in priority order, or null when nothing is outstanding (Phase 4:
// Momentum — the workspace has nothing left to suggest, so it says
// nothing, rather than inventing a filler prompt).
export function topNextAction(facts: NextActionFacts): NextAction | null {
  return composeNextActions(facts)[0] ?? null
}
