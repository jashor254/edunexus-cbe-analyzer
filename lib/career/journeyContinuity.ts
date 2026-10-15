// lib/career/journeyContinuity.ts
//
// Junior → Senior journey continuity (Senior / planning reports only).
//
// A Senior Career Intelligence report should CONTINUE the Junior record, not
// recompute cold when the Career Principle mode flips from 'exploration' to
// 'planning' at Grade 10. This module turns the learner's already-longitudinal
// data — the canonical getLearnerTimeline() (Evidence + promotions) and the
// cumulative, evidence-derived CapabilityProfile — into one "journey so far"
// section the Senior report carries.
//
// Invariants (ADR-0033 + ADR-0006 §4):
//   - Deterministic and token-free. No AI anywhere in this path.
//   - DB-free: it takes already-fetched data in and returns plain data out —
//     the strongest boundary, the same one capabilityExtractor.ts holds.
//   - It describes what is RECORDED. It never retroactively assigns a career
//     to the Junior years: the Career Principle gates Junior OUTPUT, and this
//     is Senior output describing the documented past factually.

import type { TimelineEntry } from '@/lib/learnerRecord/timeline'
import type { CapabilityProfile, JourneyContinuity, JourneyContinuityPromotion } from './types'
import { CAPABILITY_LABELS } from './capabilityExtractor'

const JUNIOR_GRADES: ReadonlySet<number> = new Set([7, 8, 9])

// Evidence that no longer stands (retracted/erased) is part of "what happened"
// in the timeline, but it is not "work the journey is built on," so it is not
// counted here. Every other lifecycle state (confirmed, pending, superseded)
// represents real recorded work.
const countsAsWork = (lifecycleState: string): boolean =>
  lifecycleState !== 'retracted' && lifecycleState !== 'erased'

/** Human-readable comma list: ["A"] → "A", ["A","B"] → "A and B", more → "A, B, and C". */
function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function buildContinuityNote(
  firstName: string,
  grade: number,
  spansJunior: boolean,
  juniorGrades: number[],
  evidenceCount: number,
  carried: string[],
): string {
  if (!spansJunior) {
    return `${firstName}'s documented record begins in Senior School. As more work is recorded, this grows into a continuous picture rather than a single snapshot.`
  }

  const startGrade = juniorGrades[0]
  const span = evidenceCount > 0
    ? `${firstName}'s record runs from Grade ${startGrade} through to Grade ${grade}, built from ${evidenceCount} recorded ${evidenceCount === 1 ? 'piece' : 'pieces'} of work.`
    : `${firstName}'s record runs from Grade ${startGrade} through to Grade ${grade}.`

  if (carried.length === 0) {
    return `${span} Senior guidance builds on that record rather than starting over.`
  }

  // Keep the prose list short; the full set stays in carried_capabilities.
  const named = carried.slice(0, 3)
  const cap = named.length === 1 ? 'capability' : 'capabilities'
  return `${span} The ${formatList(named)} ${cap} evident in Junior School continue to show in Senior School — Senior guidance builds on that record rather than starting over.`
}

/**
 * Build the Junior → Senior continuity section from already-fetched data.
 * Pure and synchronous. Callers pass the learner's getLearnerTimeline() result
 * and their cumulative CapabilityProfile (may be null when there is no
 * evidence yet).
 */
export function buildJourneyContinuity(
  firstName: string,
  grade: number,
  timeline: TimelineEntry[],
  profile: CapabilityProfile | null,
): JourneyContinuity {
  const promotion_path: JourneyContinuityPromotion[] = timeline
    .filter((e): e is Extract<TimelineEntry, { kind: 'promotion' }> => e.kind === 'promotion')
    .map((p) => ({
      from_grade:    p.fromGrade,
      to_grade:      p.toGrade,
      academic_year: p.academicYear,
    }))

  const juniorGradeSet = new Set<number>()
  for (const p of promotion_path) {
    if (p.from_grade != null && JUNIOR_GRADES.has(p.from_grade)) juniorGradeSet.add(p.from_grade)
    if (JUNIOR_GRADES.has(p.to_grade)) juniorGradeSet.add(p.to_grade)
  }
  const junior_grades_covered = [...juniorGradeSet].sort((a, b) => a - b)
  const spans_junior = junior_grades_covered.length > 0

  const total_evidence_count = timeline.filter(
    (e) => e.kind === 'evidence' && countsAsWork(e.lifecycleState),
  ).length

  const carried_capabilities = (profile?.dominant_cluster ?? []).map(
    (d) => CAPABILITY_LABELS[d] ?? d,
  )

  const continuity_note = buildContinuityNote(
    firstName,
    grade,
    spans_junior,
    junior_grades_covered,
    total_evidence_count,
    carried_capabilities,
  )

  return {
    spans_junior,
    junior_grades_covered,
    total_evidence_count,
    promotion_path,
    carried_capabilities,
    continuity_note,
  }
}
