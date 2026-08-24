// lib/parentExperience/attentionAction.ts
//
// Parent Portal Phase P4 — Attention + Action Model.
//
// Pure, deterministic, LLM-free composition over data ALREADY produced by
// `composeBlueprint()` (attendance, risk, recommendedNextSteps) plus one
// optional cheap assignment-attention summary computed server-side by the
// caller from the existing, already-batched
// `repos.assignments.findSubmissionsWithAssignmentsForStudents()` (never a
// second Blueprint composition, never a Projection recomputation, never a
// loop query — see the Home page call site).
//
// ATTENTION vs ACTION (mission's Step 6 distinction, held throughout this
// module): ATTENTION = something about the child's current state deserves
// parent awareness. ACTION = something appropriate for the parent to do.
// A learner can have an attention item with no attached action; an action
// can exist with no underlying concern (e.g. "explore career interests
// together"). The two lists below are never collapsed into one.
//
// No raw risk vocabulary is ever rendered — `RiskFlag.reason` (teacher-
// facing, e.g. "Conflicting evidence... a teacher should review") is never
// read here, only `subject` and `severity`, translated through the
// deterministic copy table below (extends, in spirit, the same translation
// discipline `lib/parentExperience/terminology.ts` already established).
//
// Zero DB access, zero repository imports, zero AI calls in this file —
// every input is an already-resolved domain fact the caller supplies.

import type { ParentAction, ParentActionType } from './actions'
import type { BlueprintSection, AttendanceData, RiskData } from '@/lib/learnerBlueprint/types'
import type { RiskFlag } from '@/lib/projection/types'
import { ATTENDANCE_ATTENTION_THRESHOLD_PERCENT } from '@/lib/learnerBlueprint/composeParentSummary'

// ── Attention model ──────────────────────────────────────────────────────

export type AttentionSeverity = 'primary' | 'secondary'

export type AttentionItem = {
  /** Dedup key — see `buildParentHomeAttentionAction`'s dedup rule below. Never rendered. */
  key: string
  headline: string
  detail: string | null
  /** A real internal route, or null when no safe deeper destination exists yet. */
  destination: string | null
  severity: AttentionSeverity
  sourceDomain: string
}

export type ParentHomeAttentionAction = {
  primaryAttention: AttentionItem | null
  secondaryAttention: AttentionItem[]
  /** 1-3 real parent-safe actions, already priority-ordered, capped for Home. Never includes a 'completed'/'no_action_needed' entry. */
  actions: ParentAction[]
  /** True only when nothing needed attention AND every attempted read succeeded — never a false all-clear (mission Step 35). */
  zeroAttention: boolean
  /** Non-null only when the optional assignment-attention read failed — surfaced as an honest caveat, never silently absorbed into "all good." */
  assignmentCheckFailedNote: string | null
}

/** Assignment counts already computed by the caller from a real batched read — see Home page's call site. `null` means the read failed (ERROR), never coerced to zero (EMPTY). */
export type AssignmentAttentionSummary = {
  overdueCount: number
  dueSoonCount: number
} | null

export type BuildParentHomeAttentionActionInput = {
  learnerId: string
  attendance: BlueprintSection<AttendanceData>
  risk: BlueprintSection<RiskData>
  /** `blueprint.recommendedNextSteps.data.actions ?? []` — the existing canonical Parent Action Centre output, unmodified. */
  recommendedActions: ParentAction[]
  assignmentAttention: AssignmentAttentionSummary
  /** True when the assignment read genuinely errored (distinct from `assignmentAttention === null` meaning "not attempted," e.g. no legacy bridge). */
  assignmentCheckFailed: boolean
}

const DUE_SOON_WINDOW_DAYS = 3

/** Parent-safe severity copy — never the raw `RiskFlag.reason`. */
const RISK_SEVERITY_HEADLINE: Record<RiskFlag['severity'], (subject: string | null) => string> = {
  watch: (subject) =>
    subject ? `${subject} may need a little extra attention.` : "Your child's progress may need a little extra attention.",
  at_risk: (subject) =>
    subject ? `Recent work suggests ${subject} has become harder.` : 'Recent work suggests things have become harder recently.',
  critical: (subject) =>
    subject ? `${subject} needs support soon.` : 'Your child may need some support soon.',
}

const RISK_SEVERITY_DETAIL: Record<RiskFlag['severity'], string> = {
  watch: 'Worth keeping an eye on together.',
  at_risk: 'A short conversation with the class teacher could help.',
  critical: 'Talking with the class teacher soon would help most.',
}

/** Actions this Home teaser suppresses because an existing card already covers the same content (dedup, mission Step 10). Documented here, not silently dropped. */
const HOME_ACTION_SUPPRESSED_TYPES: ParentActionType[] = ['read_teacher_reflection']

/** Fixed source priority — tested against real domain semantics in `attentionAction.test.ts`. No returned/resubmission-required-work source exists here: no canonical `assignment_submissions.status` value for it was found anywhere in this codebase (only pending/submitted/marked). */
const SOURCE_ORDER = [
  'assignments:overdue',
  'teacher_action',
  'academic',
  'attendance',
  'assignments:duesoon',
] as const

function sourceRank(key: string): number {
  const prefix = SOURCE_ORDER.find((p) => key === p || key.startsWith(`${p}:`))
  return prefix ? SOURCE_ORDER.indexOf(prefix) : SOURCE_ORDER.length
}

function buildOverdueItem(learnerId: string, count: number): AttentionItem | null {
  if (count <= 0) return null
  return {
    key: 'assignments:overdue',
    headline: count === 1 ? '1 assignment is overdue.' : `${count} assignments are overdue.`,
    detail: 'Reviewing what\'s due can help get things back on track.',
    destination: `/child/${learnerId}/assignments`,
    severity: 'primary',
    sourceDomain: 'Assignments',
  }
}

function buildDueSoonItem(learnerId: string, count: number): AttentionItem | null {
  if (count <= 0) return null
  return {
    key: 'assignments:duesoon',
    headline: count === 1 ? '1 assignment is due soon.' : `${count} assignments are due soon.`,
    detail: `Due within the next ${DUE_SOON_WINDOW_DAYS} days.`,
    destination: `/child/${learnerId}/assignments`,
    severity: 'secondary',
    sourceDomain: 'Assignments',
  }
}

function buildTeacherActionItems(learnerId: string, actions: ParentAction[]): AttentionItem[] {
  return actions
    .filter((a) => a.actionType === 'canonical_action_item' && a.priority === 'critical')
    .map((a) => ({
      key: `teacher_action:${a.title}`,
      headline: a.title,
      detail: a.description || null,
      destination: a.destination || `/child/${learnerId}/full`,
      severity: 'primary' as const,
      sourceDomain: a.sourceDomain,
    }))
}

function buildRiskItems(learnerId: string, risk: BlueprintSection<RiskData>): AttentionItem[] {
  if (risk.status !== 'available' || !risk.data) return []
  if (risk.data.overallRiskLevel === 'normal') return []

  const subjectFlags = risk.data.flags.filter((f) => f.subject !== null)
  if (subjectFlags.length === 0) {
    // A real, non-normal overall level with no per-subject flag to attach it
    // to — still worth surfacing, generically, never fabricating a subject.
    const level = risk.data.overallRiskLevel as RiskFlag['severity']
    return [
      {
        key: 'academic:overall',
        headline: RISK_SEVERITY_HEADLINE[level](null),
        detail: RISK_SEVERITY_DETAIL[level],
        destination: `/child/${learnerId}/full`,
        severity: 'primary',
        sourceDomain: 'Academic Record',
      },
    ]
  }

  // One item per distinct subject, worst severity first, capped by the
  // caller's overall 3-item budget (via sort+slice below) — never every
  // flag unconditionally rendered.
  const bySubject = new Map<string, RiskFlag>()
  const SEVERITY_RANK: Record<RiskFlag['severity'], number> = { critical: 0, at_risk: 1, watch: 2 }
  for (const flag of subjectFlags) {
    const subject = flag.subject as string
    const existing = bySubject.get(subject)
    if (!existing || SEVERITY_RANK[flag.severity] < SEVERITY_RANK[existing.severity]) {
      bySubject.set(subject, flag)
    }
  }

  return Array.from(bySubject.entries())
    .sort((a, b) => SEVERITY_RANK[a[1].severity] - SEVERITY_RANK[b[1].severity])
    .map(([subject, flag]) => ({
      key: `academic:${subject}`,
      headline: RISK_SEVERITY_HEADLINE[flag.severity](subject),
      detail: RISK_SEVERITY_DETAIL[flag.severity],
      destination: `/child/${learnerId}/full`,
      severity: 'primary' as const,
      sourceDomain: 'Academic Record',
    }))
}

function buildAttendanceItem(learnerId: string, attendance: BlueprintSection<AttendanceData>): AttentionItem | null {
  if (attendance.status !== 'available' || !attendance.data) return null
  const pct = attendance.data.attendancePercentage
  if (pct === null || pct === undefined) return null
  if (pct >= ATTENDANCE_ATTENTION_THRESHOLD_PERCENT) return null
  return {
    key: 'attendance',
    headline: `Attendance has been less consistent recently — ${pct}% this term.`,
    detail: 'Consistent attendance most days would help most right now.',
    destination: `/child/${learnerId}/full`,
    severity: 'secondary',
    sourceDomain: 'Attendance',
  }
}

/**
 * The prioritizer + composer (mission Step 30 — this is the pure,
 * heavily-unit-tested piece). Zero DB access, zero repository imports,
 * zero AI calls. Deterministic: identical input always produces identical
 * output.
 */
export function buildParentHomeAttentionAction(input: BuildParentHomeAttentionActionInput): ParentHomeAttentionAction {
  const { learnerId } = input

  // ── Attention ─────────────────────────────────────────────────────────
  const candidates: AttentionItem[] = []

  const overdue = input.assignmentAttention ? buildOverdueItem(learnerId, input.assignmentAttention.overdueCount) : null
  if (overdue) candidates.push(overdue)

  candidates.push(...buildTeacherActionItems(learnerId, input.recommendedActions))
  candidates.push(...buildRiskItems(learnerId, input.risk))

  const attendanceItem = buildAttendanceItem(learnerId, input.attendance)
  if (attendanceItem) candidates.push(attendanceItem)

  const dueSoon = input.assignmentAttention ? buildDueSoonItem(learnerId, input.assignmentAttention.dueSoonCount) : null
  if (dueSoon) candidates.push(dueSoon)

  // ── Dedup: one attention item per key, first occurrence (already in
  // priority order) wins. ────────────────────────────────────────────────
  const seen = new Set<string>()
  const deduped: AttentionItem[] = []
  for (const item of candidates) {
    if (seen.has(item.key)) continue
    seen.add(item.key)
    deduped.push(item)
  }

  // ── Priority ordering (mission Step 9's candidate order, tested and
  // adopted — see attentionAction.test.ts) ────────────────────────────────
  deduped.sort((a, b) => sourceRank(a.key) - sourceRank(b.key))

  // ── Attention limit: 1 primary + up to 2 secondary (mission Step 11) ───
  const limited = deduped.slice(0, 3)
  const primaryAttention = limited[0] ?? null
  const secondaryAttention = limited.slice(1).map((item) => ({ ...item, severity: 'secondary' as const }))
  if (primaryAttention) primaryAttention.severity = 'primary'

  // ── Actions: existing canonical Parent Action Centre output, filtered to
  // real "things to do" (never 'completed'/'no_action_needed', never a
  // type an existing Home card already fully covers), capped at 3. ───────
  const actions = input.recommendedActions
    .filter((a) => a.priority !== 'completed' && !HOME_ACTION_SUPPRESSED_TYPES.includes(a.actionType) && a.actionType !== 'no_action_needed')
    .slice(0, 3)

  const zeroAttention = limited.length === 0 && !input.assignmentCheckFailed
  const assignmentCheckFailedNote =
    input.assignmentCheckFailed && limited.length === 0
      ? "We couldn't check assignments right now — everything else looks fine."
      : null

  return { primaryAttention, secondaryAttention, actions, zeroAttention, assignmentCheckFailedNote }
}

/**
 * Pure summarizer over the exact rows
 * `repos.assignments.findSubmissionsWithAssignmentsForStudents([studentId])`
 * already returns (one batched query, reused unmodified — see Home page's
 * call site). No DB access here; this only counts.
 */
export function summarizeAssignmentAttention(
  rows: Array<{ status: string; assignments: { due_date: string } }>,
  now: Date
): AssignmentAttentionSummary {
  let overdueCount = 0
  let dueSoonCount = 0
  const dueSoonMs = DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000

  for (const row of rows) {
    if (row.status !== 'pending') continue
    const dueMs = new Date(row.assignments.due_date).getTime()
    const diff = dueMs - now.getTime()
    if (diff < 0) overdueCount += 1
    else if (diff <= dueSoonMs) dueSoonCount += 1
  }

  return { overdueCount, dueSoonCount }
}
