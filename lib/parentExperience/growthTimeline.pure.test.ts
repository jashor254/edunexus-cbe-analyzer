// lib/parentExperience/growthTimeline.pure.test.ts
//
// Sprint 12R — pure, DB-free unit tests for compareSnapshots/buildMilestones.
// No env vars, no network — these are pure comparison functions over
// already-constructed BlueprintSnapshotRow fixtures.
//
// Run: npx tsx --test lib/parentExperience/growthTimeline.pure.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareSnapshots, buildMilestones } from './growthTimeline'
import type { BlueprintSnapshotRow } from '@/lib/repositories/blueprintSnapshot.repository'
import type { LearnerBlueprint, BlueprintSection } from '@/lib/learnerBlueprint/types'
import { composeMetadata } from '@/lib/learnerBlueprint/composeMetadata'
import { asLearnerId } from '@/lib/core/identityTypes'

function na<T>(data: T | null = null): BlueprintSection<T> {
  return { status: 'unavailable', owner: 'owner', freshness: 'live', data, unavailableReason: 'n/a' }
}

function fixtureBlueprint(overrides: Partial<LearnerBlueprint> = {}): LearnerBlueprint {
  return {
    metadata: composeMetadata({ sectionStatuses: ['available'], ownerVersions: {}, evidenceWindowStart: null, gradeBand: 'grade_9' }),
    identity: na(),
    learningStory: na(),
    academicRecord: na(),
    attendance: na(),
    learningCompass: na(),
    career: na(),
    pathwayReadiness: { status: 'unavailable', owner: 'lib/pathwayCalculator.calculatePathwayGapAnalysis', freshness: 'live', data: null, unavailableReason: 'test fixture' } as never,
    portfolio: na(),
    achievement: na(),
    teacherReflection: na(),
    parentSummary: na(),
    growthTimeline: na([]),
    risk: na(),
    recommendedNextSteps: na(),
    ...overrides,
  }
}

function fixtureSnapshot(overrides: Partial<BlueprintSnapshotRow> & { blueprint_payload: LearnerBlueprint }): BlueprintSnapshotRow {
  return {
    id: 'snap-1',
    learner_id: asLearnerId('learner-1'),
    school_id: 'school-1',
    academic_year_id: null,
    term_id: null,
    snapshot_type: 'end_of_term',
    provenance: { trigger: 'end_of_term', sourceRecordId: null, actorUserId: 'actor-1' },
    schema_version: '1.0.0-composition-engine',
    created_at: '2026-07-01T00:00:00Z',
    created_by: null,
    ...overrides,
  }
}

test('compareSnapshots returns "Not enough historical information" for every signal when there is no previous snapshot', () => {
  const current = fixtureSnapshot({ blueprint_payload: fixtureBlueprint() })
  const result = compareSnapshots(current, null)
  assert.equal(result.attendance.direction, 'unknown')
  assert.equal(result.overallGrowthStatus, 'Not enough historical information.')
})

test('compareSnapshots detects attendance improving, declining, and steady correctly, from real rendered percentages only', () => {
  const attendanceData = (pct: number) => ({ presentCount: 1, absentCount: 0, lateCount: 0, excusedCount: 0, totalSessions: 1, attendancePercentage: pct, notes: [] })

  const previous = fixtureSnapshot({ id: 'p', blueprint_payload: fixtureBlueprint({ attendance: { status: 'available', owner: 'x', freshness: 'live', data: attendanceData(70) } }) })

  const improved = fixtureSnapshot({ id: 'c1', blueprint_payload: fixtureBlueprint({ attendance: { status: 'available', owner: 'x', freshness: 'live', data: attendanceData(85) } }) })
  assert.equal(compareSnapshots(improved, previous).attendance.direction, 'improving')

  const declined = fixtureSnapshot({ id: 'c2', blueprint_payload: fixtureBlueprint({ attendance: { status: 'available', owner: 'x', freshness: 'live', data: attendanceData(60) } }) })
  assert.equal(compareSnapshots(declined, previous).attendance.direction, 'declining')

  const steady = fixtureSnapshot({ id: 'c3', blueprint_payload: fixtureBlueprint({ attendance: { status: 'available', owner: 'x', freshness: 'live', data: attendanceData(70) } }) })
  assert.equal(compareSnapshots(steady, previous).attendance.direction, 'steady')
})

test('compareSnapshots never fabricates a comparison when either side is unavailable — always "unknown"', () => {
  const previous = fixtureSnapshot({ id: 'p', blueprint_payload: fixtureBlueprint() }) // attendance unavailable
  const current = fixtureSnapshot({ id: 'c', blueprint_payload: fixtureBlueprint({
    attendance: { status: 'available', owner: 'x', freshness: 'live', data: { presentCount: 1, absentCount: 0, lateCount: 0, excusedCount: 0, totalSessions: 1, attendancePercentage: 90, notes: [] } },
  }) })
  assert.equal(compareSnapshots(current, previous).attendance.direction, 'unknown')
})

test('compareSnapshots detects a teacher reflection version change as "improving," never as a fabricated content diff', () => {
  const reflectionData = (version: number) => ({
    strengths: 'x', growthArea: 'y', learningHabits: 'z', recommendedSupport: 'w',
    holidayFocus: null, teacherSignature: 'Teacher', writtenAt: '2026-01-01', publishedAt: '2026-01-01', version,
  })
  const previous = fixtureSnapshot({ id: 'p', blueprint_payload: fixtureBlueprint({ teacherReflection: { status: 'available', owner: 'x', freshness: 'live', data: reflectionData(1) } }) })
  const current = fixtureSnapshot({ id: 'c', blueprint_payload: fixtureBlueprint({ teacherReflection: { status: 'available', owner: 'x', freshness: 'live', data: reflectionData(2) } }) })
  assert.equal(compareSnapshots(current, previous).teacherReflection.direction, 'improving')
})

test('buildMilestones is empty for no snapshots, marks the earliest as "First Recorded Blueprint," never fabricates a Promotion milestone', () => {
  assert.deepEqual(buildMilestones([]), [])

  const s1 = fixtureSnapshot({ id: 's1', snapshot_type: 'end_of_term', created_at: '2026-01-01T00:00:00Z', blueprint_payload: fixtureBlueprint() })
  const s2 = fixtureSnapshot({ id: 's2', snapshot_type: 'report_card_publication', created_at: '2026-04-01T00:00:00Z', blueprint_payload: fixtureBlueprint() })
  const s3 = fixtureSnapshot({ id: 's3', snapshot_type: 'graduation', created_at: '2026-11-01T00:00:00Z', blueprint_payload: fixtureBlueprint() })

  // Repository returns newest-first.
  const milestones = buildMilestones([s3, s2, s1])

  assert.equal(milestones.length, 3)
  assert.equal(milestones[milestones.length - 1].label, 'First Recorded Blueprint')
  assert.equal(milestones[milestones.length - 1].snapshotId, 's1')
  assert.ok(milestones.some(m => m.label === 'Graduation'))
  assert.ok(milestones.some(m => m.label === 'Report Card Published'))
  assert.ok(!milestones.some(m => m.label.toLowerCase().includes('promotion')), 'no snapshot trigger exists for a generic promotion — must never be fabricated')
})
