// lib/parentExperience/attentionAction.test.ts
//
// Parent Portal Phase P4 — pure unit tests for the Attention/Action
// prioritizer/composer. Zero DB, zero mocks needed (the module under test
// takes only already-resolved domain facts) — tested purely on semantics,
// per the mission's own instruction, never JSX snapshots.
//
// Run: npm test -- lib/parentExperience/attentionAction.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildParentHomeAttentionAction, summarizeAssignmentAttention } from './attentionAction'
import type { ParentAction } from './actions'
import type { BlueprintSection, AttendanceData, RiskData } from '@/lib/learnerBlueprint/types'

const LEARNER_ID = 'learner-1'

function attendance(data: Partial<AttendanceData> | null, status: 'available' | 'unavailable' = data ? 'available' : 'unavailable'): BlueprintSection<AttendanceData> {
  return {
    status,
    owner: 'test',
    freshness: 'live',
    data: data
      ? { presentCount: 0, absentCount: 0, lateCount: 0, excusedCount: 0, totalSessions: 0, attendancePercentage: null, notes: [], ...data }
      : null,
  }
}

function risk(data: Partial<RiskData> | null, status: 'available' | 'unavailable' = data ? 'available' : 'unavailable'): BlueprintSection<RiskData> {
  return {
    status,
    owner: 'test',
    freshness: 'live',
    data: data
      ? { overallRiskLevel: 'normal', flags: [], supportingEvidenceIds: [], confidence: 0, coverage: 'thin' as never, lastComputed: '2026-01-01', ...data }
      : null,
  }
}

function action(overrides: Partial<ParentAction>): ParentAction {
  return {
    title: 'Some Action',
    description: 'desc',
    actionType: 'explore_career_journey',
    priority: 'suggested',
    sourceDomain: 'Test',
    destination: `/child/${LEARNER_ID}/full`,
    available: true,
    reasonUnavailable: null,
    generatedAt: '2026-01-01',
    ...overrides,
  }
}

// ── No signals ───────────────────────────────────────────────────────────

test('P4 unit: no signals at all -> zero-attention state, no fabricated concern', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk(null),
    recommendedActions: [],
    assignmentAttention: { overdueCount: 0, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  assert.equal(result.primaryAttention, null)
  assert.deepEqual(result.secondaryAttention, [])
  assert.equal(result.zeroAttention, true)
  assert.equal(result.assignmentCheckFailedNote, null)
})

// ── One attention item ──────────────────────────────────────────────────

test('P4 unit: exactly one attention item (overdue assignment) becomes primary', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk(null),
    recommendedActions: [],
    assignmentAttention: { overdueCount: 2, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  assert.ok(result.primaryAttention)
  assert.equal(result.primaryAttention?.key, 'assignments:overdue')
  assert.equal(result.primaryAttention?.headline, '2 assignments are overdue.')
  assert.deepEqual(result.secondaryAttention, [])
  assert.equal(result.zeroAttention, false)
})

// ── Multiple items, correct priority ordering ───────────────────────────

test('P4 unit: multiple attention items ordered overdue > teacher-urgent > academic > attendance > due-soon', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance({ attendancePercentage: 70 }),
    risk: risk({ overallRiskLevel: 'at_risk', flags: [{ subject: 'Mathematics', reason: 'internal', severity: 'at_risk', evidenceIds: [] }] }),
    recommendedActions: [
      action({ actionType: 'canonical_action_item', priority: 'critical', title: 'Teacher urgent item' }),
    ],
    assignmentAttention: { overdueCount: 1, dueSoonCount: 3 },
    assignmentCheckFailed: false,
  })
  const keys = [result.primaryAttention?.key, ...result.secondaryAttention.map((i) => i.key)]
  // capped at 3 total (1 primary + up to 2 secondary)
  assert.equal(keys.length, 3)
  assert.deepEqual(keys, ['assignments:overdue', 'teacher_action:Teacher urgent item', 'academic:Mathematics'])
})

// ── Same-subject duplicate candidates (dedup) ───────────────────────────

test('P4 unit: two risk flags for the same subject collapse into one attention item (worst severity wins)', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk({
      overallRiskLevel: 'critical',
      flags: [
        { subject: 'Mathematics', reason: 'internal-a', severity: 'watch', evidenceIds: [] },
        { subject: 'Mathematics', reason: 'internal-b', severity: 'critical', evidenceIds: [] },
      ],
    }),
    recommendedActions: [],
    assignmentAttention: { overdueCount: 0, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  const mathItems = [result.primaryAttention, ...result.secondaryAttention].filter((i) => i?.key === 'academic:Mathematics')
  assert.equal(mathItems.length, 1)
  assert.equal(mathItems[0]?.headline, 'Mathematics needs support soon.')
})

// ── Distinct same-subject obligations (no over-suppression) ────────────

test('P4 unit: an academic concern in Mathematics and an overdue Mathematics-labelled assignment are NOT over-suppressed (different keys)', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk({ overallRiskLevel: 'watch', flags: [{ subject: 'Mathematics', reason: 'internal', severity: 'watch', evidenceIds: [] }] }),
    recommendedActions: [],
    assignmentAttention: { overdueCount: 1, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  const keys = [result.primaryAttention?.key, ...result.secondaryAttention.map((i) => i.key)]
  assert.ok(keys.includes('assignments:overdue'))
  assert.ok(keys.includes('academic:Mathematics'))
})

// ── Teacher-originated action ────────────────────────────────────────────

test('P4 unit: a non-critical canonical_action_item does not become an attention item, only an action', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk(null),
    recommendedActions: [action({ actionType: 'canonical_action_item', priority: 'important', title: 'Non-urgent teacher item' })],
    assignmentAttention: { overdueCount: 0, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  assert.equal(result.primaryAttention, null)
  assert.equal(result.actions.some((a) => a.title === 'Non-urgent teacher item'), true)
})

// ── Projection concern ────────────────────────────────────────────────────

test('P4 unit: overallRiskLevel non-normal with no per-subject flag produces a generic, non-fabricated item', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk({ overallRiskLevel: 'watch', flags: [] }),
    recommendedActions: [],
    assignmentAttention: { overdueCount: 0, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  assert.equal(result.primaryAttention?.key, 'academic:overall')
  assert.equal(result.primaryAttention?.headline, "Your child's progress may need a little extra attention.")
})

test('P4 unit: overallRiskLevel normal never produces an attention item, even with stray flags', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk({ overallRiskLevel: 'normal', flags: [{ subject: 'Mathematics', reason: 'internal', severity: 'watch', evidenceIds: [] }] }),
    recommendedActions: [],
    assignmentAttention: { overdueCount: 0, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  assert.equal(result.primaryAttention, null)
})

// ── Overdue / due-soon assignment ────────────────────────────────────────

test('P4 unit: due-soon-only (no overdue) produces a secondary, not primary, item', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk(null),
    recommendedActions: [],
    assignmentAttention: { overdueCount: 0, dueSoonCount: 1 },
    assignmentCheckFailed: false,
  })
  assert.equal(result.primaryAttention?.key, 'assignments:duesoon')
})

// ── Attendance ─────────────────────────────────────────────────────────

test('P4 unit: attendance at or above the canonical threshold produces no attention item', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance({ attendancePercentage: 95 }),
    risk: risk(null),
    recommendedActions: [],
    assignmentAttention: { overdueCount: 0, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  assert.equal(result.primaryAttention, null)
})

test('P4 unit: attendance below the canonical threshold produces an attention item with the real percentage, no invented threshold', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance({ attendancePercentage: 82 }),
    risk: risk(null),
    recommendedActions: [],
    assignmentAttention: { overdueCount: 0, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  assert.equal(result.primaryAttention?.key, 'attendance')
  assert.match(result.primaryAttention!.headline, /82%/)
})

// ── Unsupported / raw-risk input handling ────────────────────────────────

test('P4 unit: raw RiskFlag.reason text never appears in any rendered headline or detail', () => {
  const rawReason = 'Conflicting evidence for Mathematics — two confirmed sources disagree; a teacher should review before relying on this.'
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk({ overallRiskLevel: 'critical', flags: [{ subject: 'Mathematics', reason: rawReason, severity: 'critical', evidenceIds: [] }] }),
    recommendedActions: [],
    assignmentAttention: { overdueCount: 0, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  const serialized = JSON.stringify(result)
  assert.equal(serialized.includes('Conflicting evidence'), false)
  assert.equal(serialized.includes('a teacher should review'), false)
})

// ── Missing / unsafe destination ─────────────────────────────────────────

test('P4 unit: every emitted attention destination is a safe internal relative path', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance({ attendancePercentage: 50 }),
    risk: risk({ overallRiskLevel: 'critical', flags: [{ subject: 'English', reason: 'x', severity: 'critical', evidenceIds: [] }] }),
    recommendedActions: [action({ actionType: 'canonical_action_item', priority: 'critical', title: 'T', destination: '/child/x/full' })],
    assignmentAttention: { overdueCount: 1, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  for (const item of [result.primaryAttention, ...result.secondaryAttention]) {
    if (!item) continue
    assert.ok(item.destination === null || (item.destination.startsWith('/') && !item.destination.startsWith('//')))
  }
})

// ── Zero parent actions ──────────────────────────────────────────────────

test('P4 unit: zero real actions after filtering completed/no_action_needed/suppressed types', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk(null),
    recommendedActions: [
      action({ actionType: 'no_action_needed', priority: 'completed' }),
      action({ actionType: 'review_attendance', priority: 'completed' }),
      action({ actionType: 'read_teacher_reflection', priority: 'important' }),
    ],
    assignmentAttention: { overdueCount: 0, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  assert.deepEqual(result.actions, [])
})

// ── Wrong-role action never leaks (defense-in-depth on top of composeParentActions) ──

test('P4 unit: actions list is capped at 3 and preserves incoming priority order', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk(null),
    recommendedActions: [
      action({ actionType: 'review_attendance', priority: 'critical', title: 'A' }),
      action({ actionType: 'continue_holiday_learning', priority: 'important', title: 'B' }),
      action({ actionType: 'view_report_card', priority: 'suggested', title: 'C' }),
      action({ actionType: 'explore_career_journey', priority: 'suggested', title: 'D' }),
    ],
    assignmentAttention: { overdueCount: 0, dueSoonCount: 0 },
    assignmentCheckFailed: false,
  })
  assert.deepEqual(result.actions.map((a) => a.title), ['A', 'B', 'C'])
})

// ── Assignment check failure (error, not empty) ──────────────────────────

test('P4 unit: assignment check failure with no other signal produces an honest caveat, never a false all-clear collapse', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance(null),
    risk: risk(null),
    recommendedActions: [],
    assignmentAttention: null,
    assignmentCheckFailed: true,
  })
  assert.equal(result.zeroAttention, false)
  assert.ok(result.assignmentCheckFailedNote)
  assert.match(result.assignmentCheckFailedNote!, /couldn't check assignments/)
})

test('P4 unit: assignment check failure alongside a real attention item surfaces the real item, no caveat needed', () => {
  const result = buildParentHomeAttentionAction({
    learnerId: LEARNER_ID,
    attendance: attendance({ attendancePercentage: 60 }),
    risk: risk(null),
    recommendedActions: [],
    assignmentAttention: null,
    assignmentCheckFailed: true,
  })
  assert.equal(result.primaryAttention?.key, 'attendance')
  assert.equal(result.assignmentCheckFailedNote, null)
})

// ── summarizeAssignmentAttention ──────────────────────────────────────────

test('P4 unit: summarizeAssignmentAttention counts only pending submissions, split overdue vs due-soon', () => {
  const now = new Date('2026-08-24T00:00:00Z')
  const rows = [
    { status: 'pending', assignments: { due_date: '2026-08-20T00:00:00Z' } }, // overdue
    { status: 'pending', assignments: { due_date: '2026-08-25T00:00:00Z' } }, // due soon
    { status: 'submitted', assignments: { due_date: '2026-08-10T00:00:00Z' } }, // ignored — not pending
    { status: 'pending', assignments: { due_date: '2026-09-30T00:00:00Z' } }, // far future — ignored
  ]
  const result = summarizeAssignmentAttention(rows, now)
  assert.deepEqual(result, { overdueCount: 1, dueSoonCount: 1 })
})

test('P4 unit: summarizeAssignmentAttention with zero rows returns zero counts, not null (EMPTY, not ERROR)', () => {
  const result = summarizeAssignmentAttention([], new Date())
  assert.deepEqual(result, { overdueCount: 0, dueSoonCount: 0 })
})
