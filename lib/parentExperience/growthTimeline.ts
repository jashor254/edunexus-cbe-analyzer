// lib/parentExperience/growthTimeline.ts
//
// Sprint 12R — pure presentation-layer comparisons over already-composed
// Blueprint Snapshot data (ADR-0008 Part 3, ADR-0010). No database call, no
// educational calculation, no new metric: every value compared here
// (attendance percentage, learning focus subject, teacher reflection
// version, career cluster) is a field `composeBlueprint()`/Career
// Intelligence/Learning Compass/Teacher Reflection already computed and
// stored verbatim inside `blueprint_payload` at snapshot time (Sprint 12K).
// This module only asks "is this later value the same, higher, lower, or
// different from the earlier one" — a comparison, never a projection.

import type { BlueprintSnapshotRow } from '@/lib/repositories/blueprintSnapshot.repository'

export type GrowthDirection = 'improving' | 'steady' | 'declining' | 'unknown'

export type GrowthSignal = { direction: GrowthDirection; label: string }

export type GrowthComparison = {
  attendance: GrowthSignal
  learningFocus: GrowthSignal
  teacherReflection: GrowthSignal
  career: GrowthSignal
  overallGrowthStatus: string
}

const NOT_ENOUGH_HISTORY = 'Not enough historical information.'

/**
 * Compares `current` against the *immediately preceding* snapshot (`previous`
 * — the next-older one in the same learner's timeline, or null for the
 * first-ever snapshot). Phase 5: "If comparison cannot be made safely:
 * display 'Not enough historical information.'" — applied per-signal, not
 * just for a missing `previous`, since any individual section can be
 * `unavailable` in either snapshot even when others are comparable.
 */
export function compareSnapshots(
  current: BlueprintSnapshotRow,
  previous: BlueprintSnapshotRow | null
): GrowthComparison {
  const unknown: GrowthSignal = { direction: 'unknown', label: NOT_ENOUGH_HISTORY }

  if (!previous) {
    return { attendance: unknown, learningFocus: unknown, teacherReflection: unknown, career: unknown, overallGrowthStatus: NOT_ENOUGH_HISTORY }
  }

  const currAttendance = current.blueprint_payload.attendance.data?.attendancePercentage ?? null
  const prevAttendance = previous.blueprint_payload.attendance.data?.attendancePercentage ?? null
  const attendance: GrowthSignal =
    currAttendance === null || prevAttendance === null
      ? unknown
      : currAttendance > prevAttendance
        ? { direction: 'improving', label: 'Attendance improving' }
        : currAttendance < prevAttendance
          ? { direction: 'declining', label: 'Attendance needs attention' }
          : { direction: 'steady', label: 'Attendance steady' }

  const currFocus = current.blueprint_payload.learningCompass.data?.currentLearningFocus?.subject ?? null
  const prevFocus = previous.blueprint_payload.learningCompass.data?.currentLearningFocus?.subject ?? null
  const learningFocus: GrowthSignal =
    currFocus === null || prevFocus === null
      ? unknown
      : currFocus !== prevFocus
        ? { direction: 'steady', label: `Learning focus changed to ${currFocus}` }
        : { direction: 'steady', label: `Still focused on ${currFocus}` }

  const currReflectionVersion = current.blueprint_payload.teacherReflection.data?.version ?? null
  const prevReflectionVersion = previous.blueprint_payload.teacherReflection.data?.version ?? null
  const teacherReflection: GrowthSignal =
    currReflectionVersion === null
      ? unknown
      : prevReflectionVersion === null || currReflectionVersion !== prevReflectionVersion
        ? { direction: 'improving', label: 'Teacher reflection updated' }
        : { direction: 'steady', label: 'Same teacher reflection as before' }

  const currCluster = current.blueprint_payload.career.data?.careerCluster ?? null
  const prevCluster = previous.blueprint_payload.career.data?.careerCluster ?? null
  const career: GrowthSignal =
    currCluster === null || prevCluster === null
      ? unknown
      : currCluster !== prevCluster
        ? { direction: 'improving', label: `Career interest refined to ${currCluster}` }
        : { direction: 'steady', label: `Still exploring ${currCluster}` }

  const known = [attendance, learningFocus, teacherReflection, career].filter(s => s.direction !== 'unknown')
  const overallGrowthStatus =
    known.length === 0
      ? NOT_ENOUGH_HISTORY
      : known.some(s => s.direction === 'improving')
        ? 'Growing Well'
        : known.every(s => s.direction === 'steady')
          ? 'Steady Progress'
          : 'An Area to Focus On Together'

  return { attendance, learningFocus, teacherReflection, career, overallGrowthStatus }
}

export type Milestone = {
  snapshotId: string
  date: string
  label: string
}

/**
 * Phase 4: "Present milestones... Only if they already exist. Never
 * fabricate milestones." Built entirely from the snapshots already fetched
 * — no second read, no invented milestone type. Generic "Promotion" is
 * deliberately not a milestone type here: no Blueprint Snapshot trigger
 * exists for a non-graduating promotion (ADR-0008 Part 3 froze exactly
 * three triggers — report card publication, end of term, graduation), so
 * there is no evidence source for it. Documented as a gap, not invented.
 */
export function buildMilestones(snapshots: BlueprintSnapshotRow[]): Milestone[] {
  if (snapshots.length === 0) return []

  // snapshots is newest-first (the repository's own ordering) — the last
  // element is the earliest.
  const earliest = snapshots[snapshots.length - 1]
  const milestones: Milestone[] = [
    { snapshotId: earliest.id, date: earliest.created_at, label: 'First Recorded Blueprint' },
  ]

  const TYPE_LABEL: Record<BlueprintSnapshotRow['snapshot_type'], string> = {
    report_card_publication: 'Report Card Published',
    end_of_term: 'End of Term',
    graduation: 'Graduation',
  }

  for (const s of snapshots) {
    if (s.id === earliest.id) continue // already the "First Recorded Blueprint" milestone
    milestones.push({ snapshotId: s.id, date: s.created_at, label: TYPE_LABEL[s.snapshot_type] })
  }

  // Newest first, matching the rest of the Parent Portal's timeline convention.
  return milestones.sort((a, b) => (a.date < b.date ? 1 : -1))
}
