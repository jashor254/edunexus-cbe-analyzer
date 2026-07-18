// lib/parentExperience/actions.ts
//
// The Parent Action Centre (Sprint 12S) — "what can the parent do next,"
// the final layer after Blueprint ("who is this learner becoming") and
// Parent Experience/Growth Timeline ("how has this learner grown").
//
// This module owns nothing and computes nothing educational. It is a pure
// selector over sections `composeBlueprint()` (or, for the recency signal,
// `getLatestBlueprintSnapshot()`) already composed — no DB call, no AI
// call, no new calculation. Constitutional flow, permanently:
//
//   Evidence -> Domain Intelligence -> Blueprint -> Parent Experience -> Parent Action Centre
//
// Never Evidence -> Parent Action Centre directly. `composeParentActions()`
// is called exactly once, from inside `composeBlueprint()`
// (lib/learnerBlueprint/composeRecommendedNextSteps.ts) to populate
// Blueprint's own "Recommended Next Steps" section (Phase 5) — every other
// consumer (Parent Home's "Today's Actions," Phase 6) reads that section
// off the already-composed Blueprint object, never calling this function a
// second time. One composition, one list, reused everywhere.
//
// Phase 1 audit (full findings in sprint-12s-parent-action-centre.md §1)
// found at least six independent "tell the parent what to do" generators
// already in this codebase (`lib/academicClinic/reportGenerator.ts`'s
// `buildParentAction`, the legacy `lib/learnerIntelligence/blueprint.ts`'s
// own `buildParentAction`, `lib/parentPulse/builder.ts`'s `buildParentAction`,
// `lib/holiday/planner.ts`'s AI-generated `parent_action`,
// `lib/career/parentIntelligence.ts`'s conversation starters, and
// Blueprint's own `composeParentSummary`'s single `action` field) — none of
// them canonical, none reused here. This module does not touch, call, or
// duplicate any of them; it only reads the seven Blueprint-owned/Snapshot
// signals Phase 2 froze.

import type { BlueprintSection, LearningCompassData, TeacherReflectionData, AttendanceData, CareerData } from '@/lib/learnerBlueprint/types'
import { ATTENDANCE_ATTENTION_THRESHOLD_PERCENT } from '@/lib/learnerBlueprint/composeParentSummary'
import type { BlueprintSnapshotRow } from '@/lib/repositories/blueprintSnapshot.repository'

// ── Phase 3: Canonical Action Model ─────────────────────────────────────────

export type ParentActionType =
  | 'continue_holiday_learning'
  | 'read_teacher_reflection'
  | 'review_attendance'
  | 'celebrate_achievement'
  | 'view_report_card'
  | 'explore_career_journey'
  | 'no_action_needed'

/** Phase 7's frozen four-tier order — categorical only, never a numeric score. */
export type ParentActionPriority = 'critical' | 'important' | 'suggested' | 'completed'

export type ParentAction = {
  title: string
  description: string
  actionType: ParentActionType
  priority: ParentActionPriority
  /** Phase 2's frozen ownership table — the one domain this action's content traces to. */
  sourceDomain: string
  /** A real, existing route — never a page this module renders itself (Phase 9: "never embeds another domain"). */
  destination: string
  available: boolean
  reasonUnavailable: string | null
  generatedAt: string
}

export type ParentActionCentre = {
  actions: ParentAction[]
}

// ── Phase 2: Canonical Domain Ownership (frozen) ────────────────────────────
//
// Action                     | Owner
// Continue Holiday Learning  | Learning Compass
// Read Teacher Reflection    | Teacher Reflection
// Review Attendance          | Attendance
// Celebrate Achievement      | Blueprint Snapshot
// View Report Card           | Report Cards
// Explore Career Journey     | Career Intelligence
// No Action Needed           | Parent Action Centre (presentation only)

type ComposeParentActionsInput = {
  learnerId: string
  learningCompass: BlueprintSection<LearningCompassData>
  teacherReflection: BlueprintSection<TeacherReflectionData>
  attendance: BlueprintSection<AttendanceData>
  career: BlueprintSection<CareerData>
  /** The learner's most recently taken Blueprint Snapshot, or null — read once by the caller (`composeBlueprint()`), never re-fetched here. */
  latestSnapshot: BlueprintSnapshotRow | null
}

const NO_ACTION_COPY = 'Your learner is progressing well. There are no recommended actions at this time.'

/**
 * Phase 4: pure, synchronous, no DB access, no calculation beyond selecting
 * already-existing domain outputs. Called exactly once per Blueprint
 * composition (see the module header) — never a second, independent call
 * site anywhere else in the codebase.
 */
export function composeParentActions(input: ComposeParentActionsInput): ParentActionCentre {
  const generatedAt = new Date().toISOString()
  const candidates: ParentAction[] = []

  // ── Continue Holiday Learning (owner: Learning Compass) ───────────────────
  if (input.learningCompass.status === 'available' && input.learningCompass.data?.holidayProgrammeAvailable) {
    candidates.push({
      title: 'Continue Holiday Learning',
      description: 'A holiday learning programme is available for your child — a good way to keep momentum between terms.',
      actionType: 'continue_holiday_learning',
      priority: 'important',
      sourceDomain: 'Learning Compass',
      destination: `/child/${input.learnerId}/full`,
      available: true,
      reasonUnavailable: null,
      generatedAt,
    })
  }

  // ── Read Teacher Reflection (owner: Teacher Reflection) ───────────────────
  if (input.teacherReflection.status === 'available' && input.teacherReflection.data) {
    candidates.push({
      title: 'Read Teacher Reflection',
      description: `${input.teacherReflection.data.teacherSignature ?? 'Your child\'s teacher'} has shared a reflection on how your child is doing.`,
      actionType: 'read_teacher_reflection',
      priority: 'important',
      sourceDomain: 'Teacher Reflection',
      destination: `/child/${input.learnerId}/full`,
      available: true,
      reasonUnavailable: null,
      generatedAt,
    })
  }

  // ── Review Attendance (owner: Attendance) ─────────────────────────────────
  const attendancePct = input.attendance.status === 'available' ? input.attendance.data?.attendancePercentage ?? null : null
  if (attendancePct !== null) {
    const needsAttention = attendancePct < ATTENDANCE_ATTENTION_THRESHOLD_PERCENT
    candidates.push({
      title: 'Review Attendance',
      description: needsAttention
        ? `Learning Time is at ${attendancePct}% this term — consistent attendance would help most right now.`
        : `Learning Time is healthy at ${attendancePct}% this term — no action needed.`,
      actionType: 'review_attendance',
      priority: needsAttention ? 'critical' : 'completed',
      sourceDomain: 'Attendance',
      destination: `/child/${input.learnerId}/full`,
      available: true,
      reasonUnavailable: null,
      generatedAt,
    })
  }

  // ── Celebrate Achievement (owner: Blueprint Snapshot) ─────────────────────
  if (input.latestSnapshot && (input.latestSnapshot.snapshot_type === 'report_card_publication' || input.latestSnapshot.snapshot_type === 'graduation')) {
    candidates.push({
      title: 'Celebrate Achievement',
      description: input.latestSnapshot.snapshot_type === 'graduation'
        ? 'A graduation milestone was just recorded — a moment worth celebrating together.'
        : 'A new report card moment was just recorded — a good time to celebrate progress together.',
      actionType: 'celebrate_achievement',
      priority: 'suggested',
      sourceDomain: 'Blueprint Snapshot',
      destination: `/child/${input.learnerId}/history/${input.latestSnapshot.id}`,
      available: true,
      reasonUnavailable: null,
      generatedAt,
    })
  }

  // ── View Report Card (owner: Report Cards) ────────────────────────────────
  if (input.latestSnapshot?.snapshot_type === 'report_card_publication') {
    candidates.push({
      title: 'View Report Card',
      description: 'A report card has been published for your child this term.',
      actionType: 'view_report_card',
      priority: 'suggested',
      sourceDomain: 'Report Cards',
      destination: '/report-card',
      available: true,
      reasonUnavailable: null,
      generatedAt,
    })
  }

  // ── Explore Career Journey (owner: Career Intelligence) ───────────────────
  if (input.career.status === 'available' && input.career.data?.careerCluster) {
    candidates.push({
      title: 'Explore Career Journey',
      description: `Your child is showing interest in ${input.career.data.careerCluster} — explore this together.`,
      actionType: 'explore_career_journey',
      priority: 'suggested',
      sourceDomain: 'Career Intelligence',
      destination: '/career-intelligence',
      available: true,
      reasonUnavailable: null,
      generatedAt,
    })
  }

  // ── Phase 7: at most one 'critical' action ────────────────────────────────
  // Fixed, documented precedence — never a score. If a future domain adds a
  // second critical-eligible signal, only the first in this order stays
  // critical; every other critical candidate is demoted to 'important', not
  // dropped, so nothing silently disappears.
  const CRITICAL_PRECEDENCE: ParentActionType[] = ['review_attendance']
  let criticalKept = false
  for (const type of CRITICAL_PRECEDENCE) {
    const action = candidates.find(a => a.actionType === type && a.priority === 'critical')
    if (action) {
      if (criticalKept) action.priority = 'important'
      else criticalKept = true
    }
  }

  const PRIORITY_ORDER: Record<ParentActionPriority, number> = { critical: 0, important: 1, suggested: 2, completed: 3 }
  candidates.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  // ── Phase 8: empty state — never fabricate work ───────────────────────────
  if (candidates.length === 0) {
    return {
      actions: [{
        title: 'No Action Needed',
        description: NO_ACTION_COPY,
        actionType: 'no_action_needed',
        priority: 'completed',
        sourceDomain: 'Parent Action Centre',
        destination: `/child/${input.learnerId}`,
        available: true,
        reasonUnavailable: null,
        generatedAt,
      }],
    }
  }

  return { actions: candidates }
}
