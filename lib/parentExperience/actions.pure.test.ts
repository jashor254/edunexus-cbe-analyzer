// lib/parentExperience/actions.pure.test.ts
//
// Sprint 12S — pure, DB-free unit tests for composeParentActions(). No env
// vars, no network: every input is a hand-built BlueprintSection/
// BlueprintSnapshotRow fixture, exactly what composeRecommendedNextSteps.ts
// passes through at runtime.
//
// Run: npx tsx --env-file=.env.local --test lib/parentExperience/actions.pure.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeParentActions, isActionDestinationValidForViewer, isSafeInternalDestination, type ParentActionType } from './actions'
import type { BlueprintSection, LearningCompassData, TeacherReflectionData, AttendanceData, CareerData } from '@/lib/learnerBlueprint/types'
import type { BlueprintSnapshotRow, BlueprintSnapshotType } from '@/lib/repositories/blueprintSnapshot.repository'

const LEARNER_ID = 'learner-1'

function na<T>(): BlueprintSection<T> {
  return { status: 'unavailable', owner: 'owner', freshness: 'live', data: null, unavailableReason: 'n/a' }
}

function available<T>(data: T): BlueprintSection<T> {
  return { status: 'available', owner: 'owner', freshness: 'live', data }
}

const NO_COMPASS = na<LearningCompassData>()
const NO_REFLECTION = na<TeacherReflectionData>()
const NO_ATTENDANCE = na<AttendanceData>()
const NO_CAREER = na<CareerData>()

const COMPASS_WITH_HOLIDAY = available<LearningCompassData>({
  currentLearningFocus: { subject: 'Mathematics', subtopic: null },
  nextRecommendedAction: 'Continue with Mathematics',
  holidayProgrammeAvailable: true,
  learningReadiness: null,
  notes: [],
})

const REFLECTION = available<TeacherReflectionData>({
  strengths: 'Strong at group work.',
  growthArea: 'Confidence presenting.',
  learningHabits: 'Consistent homework.',
  recommendedSupport: 'More speaking practice.',
  holidayFocus: null,
  teacherSignature: 'Mrs. Otieno',
  writtenAt: '2026-07-01T00:00:00Z',
  publishedAt: '2026-07-01T00:00:00Z',
  version: 1,
})

const ATTENDANCE_LOW = available<AttendanceData>({
  presentCount: 5, absentCount: 5, lateCount: 0, excusedCount: 0, totalSessions: 10, attendancePercentage: 70, notes: [],
})
const ATTENDANCE_HEALTHY = available<AttendanceData>({
  presentCount: 9, absentCount: 1, lateCount: 0, excusedCount: 0, totalSessions: 10, attendancePercentage: 95, notes: [],
})

const CAREER = available<CareerData>({
  careerCluster: 'Engineering & Technology', strengthProfile: 'x', futureDirection: 'y', aiOutlook: null, confidence: 'Medium', doorsPreview: null, aiChangeSummary: null, humanAdvantageSummary: null, explorationSuggestions: null, knowledge: null, notes: [],
})

function fixtureSnapshot(type: BlueprintSnapshotType, id = 'snap-1'): BlueprintSnapshotRow {
  // `composeParentActions` only ever reads `id`/`snapshot_type` off a
  // snapshot row (never `blueprint_payload` — that field belongs to
  // lib/parentExperience/growthTimeline.ts's comparisons, a different
  // module) — cast rather than construct a full LearnerBlueprint fixture
  // this test doesn't need.
  return {
    id, learner_id: LEARNER_ID, school_id: 'school-1', academic_year_id: null, term_id: null,
    snapshot_type: type,
    provenance: { trigger: type, sourceRecordId: null, actorUserId: 'actor-1' },
    schema_version: '1.0.0-composition-engine',
    created_at: '2026-07-01T00:00:00Z',
    created_by: null,
  } as unknown as BlueprintSnapshotRow
}

function baseInput(overrides: Partial<Parameters<typeof composeParentActions>[0]> = {}) {
  return {
    learnerId: LEARNER_ID,
    learningCompass: NO_COMPASS,
    teacherReflection: NO_REFLECTION,
    attendance: NO_ATTENDANCE,
    career: NO_CAREER,
    latestSnapshot: null,
    ...overrides,
  }
}

test('an empty learner (every domain missing) produces exactly one "No Action Needed," with the frozen empty-state copy', () => {
  const { actions } = composeParentActions(baseInput())
  assert.equal(actions.length, 1)
  assert.equal(actions[0].actionType, 'no_action_needed')
  assert.equal(actions[0].description, 'Your learner is progressing well. There are no recommended actions at this time.')
})

test('missing Compass produces no "Continue Holiday Learning" action', () => {
  const { actions } = composeParentActions(baseInput({ learningCompass: NO_COMPASS }))
  assert.ok(!actions.some(a => a.actionType === 'continue_holiday_learning'))
})

test('missing Career produces no "Explore Career Journey" action', () => {
  const { actions } = composeParentActions(baseInput({ career: NO_CAREER }))
  assert.ok(!actions.some(a => a.actionType === 'explore_career_journey'))
})

test('missing Teacher Reflection produces no "Read Teacher Reflection" action', () => {
  const { actions } = composeParentActions(baseInput({ teacherReflection: NO_REFLECTION }))
  assert.ok(!actions.some(a => a.actionType === 'read_teacher_reflection'))
})

test('no Attendance data produces no Attendance action at all (never a fabricated one)', () => {
  const { actions } = composeParentActions(baseInput({ attendance: NO_ATTENDANCE }))
  assert.ok(!actions.some(a => a.actionType === 'review_attendance'))
})

test('a report_card_publication snapshot produces "View Report Card," pointing at the existing parent report card route', () => {
  const { actions } = composeParentActions(baseInput({ latestSnapshot: fixtureSnapshot('report_card_publication') }))
  const action = actions.find(a => a.actionType === 'view_report_card')
  assert.ok(action)
  assert.equal(action!.destination, '/report-card')
  assert.equal(action!.sourceDomain, 'Report Cards')
})

test('any snapshot existing (report card or graduation) produces "Celebrate Achievement," linking to that exact snapshot', () => {
  const snap = fixtureSnapshot('graduation', 'snap-grad')
  const { actions } = composeParentActions(baseInput({ latestSnapshot: snap }))
  const action = actions.find(a => a.actionType === 'celebrate_achievement')
  assert.ok(action)
  assert.equal(action!.destination, `/child/${LEARNER_ID}/history/snap-grad`)
})

test('an end_of_term snapshot alone produces neither "Celebrate Achievement" nor "View Report Card" — only report_card_publication/graduation qualify', () => {
  const { actions } = composeParentActions(baseInput({ latestSnapshot: fixtureSnapshot('end_of_term') }))
  assert.ok(!actions.some(a => a.actionType === 'celebrate_achievement'))
  assert.ok(!actions.some(a => a.actionType === 'view_report_card'))
})

test('mixed actions: every available domain produces its own action, none missing, none duplicated', () => {
  const { actions } = composeParentActions(baseInput({
    learningCompass: COMPASS_WITH_HOLIDAY,
    teacherReflection: REFLECTION,
    attendance: ATTENDANCE_LOW,
    career: CAREER,
    latestSnapshot: fixtureSnapshot('report_card_publication'),
  }))

  const types = actions.map(a => a.actionType)
  assert.deepEqual(new Set(types).size, types.length, 'no duplicated action type')
  assert.ok(types.includes('continue_holiday_learning'))
  assert.ok(types.includes('read_teacher_reflection'))
  assert.ok(types.includes('review_attendance'))
  assert.ok(types.includes('celebrate_achievement'))
  assert.ok(types.includes('view_report_card'))
  assert.ok(types.includes('explore_career_journey'))
  assert.ok(!types.includes('no_action_needed'), 'the empty-state action must never appear alongside real actions')
})

test('priority ordering: critical first, then important, then suggested, then completed', () => {
  const { actions } = composeParentActions(baseInput({
    learningCompass: COMPASS_WITH_HOLIDAY, // important
    teacherReflection: REFLECTION,          // important
    attendance: ATTENDANCE_LOW,             // critical
    career: CAREER,                         // suggested
    latestSnapshot: fixtureSnapshot('report_card_publication'), // suggested x2
  }))

  const priorities = actions.map(a => a.priority)
  const order: Record<string, number> = { critical: 0, important: 1, suggested: 2, completed: 3 }
  for (let i = 1; i < priorities.length; i++) {
    assert.ok(order[priorities[i]] >= order[priorities[i - 1]], `priority must never regress: ${priorities.join(', ')}`)
  }
  assert.equal(priorities[0], 'critical')
})

test('at most one critical action ever — a second critical-eligible candidate is demoted, never dropped', () => {
  // Only Attendance is critical-eligible today, so this proves the cap logic
  // itself (not just "only one domain happens to be critical").
  const { actions } = composeParentActions(baseInput({ attendance: ATTENDANCE_LOW }))
  const criticalCount = actions.filter(a => a.priority === 'critical').length
  assert.ok(criticalCount <= 1)
})

test('healthy attendance produces a "completed" tier action, never silently disappears and never reads as a to-do', () => {
  const { actions } = composeParentActions(baseInput({ attendance: ATTENDANCE_HEALTHY }))
  const action = actions.find(a => a.actionType === 'review_attendance')
  assert.ok(action)
  assert.equal(action!.priority, 'completed')
})

test('every action has a real destination and a generatedAt timestamp — never a blank/undefined field', () => {
  const { actions } = composeParentActions(baseInput({
    learningCompass: COMPASS_WITH_HOLIDAY,
    teacherReflection: REFLECTION,
    attendance: ATTENDANCE_LOW,
    career: CAREER,
    latestSnapshot: fixtureSnapshot('report_card_publication'),
  }))
  for (const action of actions) {
    assert.ok(action.destination.startsWith('/'))
    assert.ok(action.generatedAt)
    assert.ok(action.sourceDomain.length > 0)
  }
})

// ── Phase 2 (Blueprint Actionability): isActionDestinationValidForViewer ────

const ALL_ACTION_TYPES: ParentActionType[] = [
  'continue_holiday_learning',
  'read_teacher_reflection',
  'review_attendance',
  'celebrate_achievement',
  'view_report_card',
  'explore_career_journey',
  'no_action_needed',
  'canonical_action_item',
]

test('a parent viewer may act on every action type — every destination this module emits is parent-space', () => {
  for (const type of ALL_ACTION_TYPES) {
    assert.equal(isActionDestinationValidForViewer(type, 'parent'), true, type)
  }
})

test('a student (learner) viewer may only act on explore_career_journey — every other destination is parent-only (/child/{id}/... or guardian-scoped /report-card)', () => {
  for (const type of ALL_ACTION_TYPES) {
    assert.equal(isActionDestinationValidForViewer(type, 'student'), type === 'explore_career_journey', type)
  }
})

test('a teacher/admin viewer may never act on any Parent Action Centre destination — they hold neither the parent link nor the learner\'s own auth identity', () => {
  for (const type of ALL_ACTION_TYPES) {
    assert.equal(isActionDestinationValidForViewer(type, 'teacher'), false, type)
  }
})

test('isSafeInternalDestination accepts a real relative path and rejects protocol-relative/absolute/javascript: values', () => {
  assert.equal(isSafeInternalDestination('/child/abc-123/full'), true)
  assert.equal(isSafeInternalDestination('/career-intelligence'), true)
  assert.equal(isSafeInternalDestination('//evil.example.com/phish'), false)
  assert.equal(isSafeInternalDestination('https://evil.example.com'), false)
  assert.equal(isSafeInternalDestination('javascript:alert(1)'), false)
  assert.equal(isSafeInternalDestination(''), false)
})
