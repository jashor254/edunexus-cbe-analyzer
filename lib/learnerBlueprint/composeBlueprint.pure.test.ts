// lib/learnerBlueprint/composeBlueprint.pure.test.ts
//
// Sprint 12G — pure, DB-free unit tests for the orchestration logic:
// validation, metadata freshness, parent summary templating, and the
// three static placeholders. No env vars, no network.
//
// Run: npx tsx --test lib/learnerBlueprint/composeBlueprint.pure.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeMetadata } from './composeMetadata'
import { validateBlueprint } from './validation'
import { composeParentSummary } from './composeParentSummary'
import { composeEducationalIdentity } from './composeEducationalIdentity'
import { composeGrowthTimeline } from './composeGrowthTimeline'
import { composeAcademicRecord } from './composeAcademicRecord'
import { composeLearningCompass } from './composeLearningCompass'
import { composeCareer } from './composeCareer'
import type { LearnerBlueprint, BlueprintSection, AcademicRecordData, AttendanceData } from './types'

// ── Placeholders (Educational Identity / Growth Timeline) ──────────────────────
// Teacher Reflection moved to composeBlueprint.integration.test.ts (Sprint
// 12O) — it now reads the real `teacher_reflections` table via
// `lib/teacherReflection/reflection.ts`, no longer a pure static placeholder.

test('composeEducationalIdentity always returns not_implemented, never a guessed label', () => {
  const section = composeEducationalIdentity()
  assert.equal(section.status, 'not_implemented')
  assert.equal(section.data, null)
})

test('composeGrowthTimeline always returns not_implemented with an empty array, never fabricated milestones', () => {
  const section = composeGrowthTimeline()
  assert.equal(section.status, 'not_implemented')
  assert.deepEqual(section.data, [])
})

// ── Missing legacy-student-identity short-circuits (no DB call attempted) ────

test('composeAcademicRecord is unavailable when no legacy student is bridged ("missing assessments")', async () => {
  const section = await composeAcademicRecord(null)
  assert.equal(section.status, 'unavailable')
  assert.equal(section.data, null)
  assert.match(section.unavailableReason ?? '', /bridged/)
})

test('composeLearningCompass is unavailable when no legacy student is bridged ("missing compass")', async () => {
  const section = await composeLearningCompass(null)
  assert.equal(section.status, 'unavailable')
  assert.equal(section.data, null)
})

test('composeCareer is unavailable when no legacy student is bridged ("missing career")', async () => {
  const section = await composeCareer(null)
  assert.equal(section.status, 'unavailable')
  assert.equal(section.data, null)
})

// ── composeMetadata ───────────────────────────────────────────────────────────

test('composeMetadata reports freshness "live" only when every section is available', () => {
  const m = composeMetadata({
    sectionStatuses: ['available', 'available', 'available'],
    ownerVersions: { a: 'x' },
    evidenceWindowStart: null,
  })
  assert.equal(m.freshness, 'live')
  assert.equal(m.snapshotState, 'current')
})

test('composeMetadata reports freshness "partial" when any section is unavailable or not_implemented', () => {
  const m = composeMetadata({
    sectionStatuses: ['available', 'unavailable', 'not_implemented'],
    ownerVersions: {},
    evidenceWindowStart: null,
  })
  assert.equal(m.freshness, 'partial')
})

// ── composeParentSummary — structured fields only, degrades on missing sources ──

const unavailable = <T>(owner: string): BlueprintSection<T> => ({ status: 'unavailable', owner, freshness: 'live', data: null, unavailableReason: 'test' })

test('composeParentSummary is unavailable when both Academic Record and Attendance are unavailable', () => {
  const section = composeParentSummary(
    'Amani',
    unavailable<AcademicRecordData>('academic'),
    unavailable<AttendanceData>('attendance')
  )
  assert.equal(section.status, 'unavailable')
  assert.equal(section.data?.headline, null)
  assert.equal(section.data?.detail, null)
  assert.equal(section.data?.action, null)
})

test('composeParentSummary produces a headline from Academic Record trend when available, and never a generated paragraph', () => {
  const academic: BlueprintSection<AcademicRecordData> = {
    status: 'available',
    owner: 'academic',
    freshness: 'live',
    data: { overallTrend: 'improving', bySubject: [{ subject: 'Mathematics', latestLevel: 3, trend: 'improving' }], competencies: [], confidence: 80, lastComputed: '2026-07-17T00:00:00Z' },
  }
  const section = composeParentSummary('Amani', academic, unavailable<AttendanceData>('attendance'))
  assert.equal(section.status, 'available')
  assert.equal(section.data?.headline, 'Amani is showing improving progress this term.')
  assert.ok(section.data?.detail?.includes('1 subject'))
})

test('composeParentSummary surfaces an attendance-based action when attendance is below 90%', () => {
  const attendance: BlueprintSection<AttendanceData> = {
    status: 'available',
    owner: 'attendance',
    freshness: 'snapshot',
    data: { presentCount: 5, absentCount: 5, lateCount: 0, excusedCount: 0, totalSessions: 10, attendancePercentage: 50, notes: [] },
  }
  const section = composeParentSummary('Amani', unavailable<AcademicRecordData>('academic'), attendance)
  assert.equal(section.status, 'available')
  assert.match(section.data?.detail ?? '', /50%/)
  assert.match(section.data?.action ?? '', /attendance/i)
})

// ── validateBlueprint ─────────────────────────────────────────────────────────

function fixtureBlueprint(overrides: Partial<LearnerBlueprint> = {}): LearnerBlueprint {
  const na = <T>(status: 'available' | 'unavailable' | 'not_implemented' = 'not_implemented', data: T | null = null): BlueprintSection<T> =>
    ({ status, owner: 'owner', freshness: 'live', data, ...(status !== 'available' ? { unavailableReason: 'n/a' } : {}) })

  return {
    metadata: composeMetadata({ sectionStatuses: ['available'], ownerVersions: {}, evidenceWindowStart: null }),
    identity: na('unavailable'),
    academicRecord: na('not_implemented'),
    attendance: na('not_implemented'),
    learningCompass: na('not_implemented'),
    career: na('not_implemented'),
    portfolio: na('not_implemented'),
    achievement: na('not_implemented'),
    projects: na('not_implemented'),
    teacherReflection: na('not_implemented'),
    parentSummary: na('not_implemented'),
    educationalIdentity: na('not_implemented'),
    growthTimeline: na('not_implemented', []),
    recommendedNextSteps: na('not_implemented'),
    ...overrides,
  }
}

test('validateBlueprint fails when Identity is not available ("required sections")', () => {
  const result = validateBlueprint(fixtureBlueprint())
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.field === 'identity'))
})

test('validateBlueprint passes for "identity only" — every other section not_implemented/unavailable is valid, not an error', () => {
  const result = validateBlueprint(fixtureBlueprint({
    identity: { status: 'available', owner: 'core', freshness: 'live', data: { learnerName: 'Amani', admissionNumber: '001', schoolName: 'Test', currentClassName: null, academicYearLabel: null, termLabel: null, guardians: [] } },
  }))
  assert.equal(result.valid, true, JSON.stringify(result.errors))
})

test('validateBlueprint fails when a section is missing its owner declaration', () => {
  const bp = fixtureBlueprint({
    identity: { status: 'available', owner: '', freshness: 'live', data: { learnerName: 'Amani', admissionNumber: '001', schoolName: 'Test', currentClassName: null, academicYearLabel: null, termLabel: null, guardians: [] } },
  })
  const result = validateBlueprint(bp)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.field === 'identity' && e.message.includes('owner')))
})

test('validateBlueprint fails if metadata.snapshotState is not "current" (composition engine never produces snapshots)', () => {
  const bp = fixtureBlueprint({
    identity: { status: 'available', owner: 'core', freshness: 'live', data: { learnerName: 'Amani', admissionNumber: '001', schoolName: 'Test', currentClassName: null, academicYearLabel: null, termLabel: null, guardians: [] } },
  })
  bp.metadata.snapshotState = 'snapshot'
  const result = validateBlueprint(bp)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => e.field === 'metadata.snapshotState'))
})

test('validateBlueprint passes for a "partial blueprint" — identity + attendance available, rest unavailable/not_implemented', () => {
  const result = validateBlueprint(fixtureBlueprint({
    identity: { status: 'available', owner: 'core', freshness: 'live', data: { learnerName: 'Amani', admissionNumber: '001', schoolName: 'Test', currentClassName: null, academicYearLabel: null, termLabel: null, guardians: [] } },
    attendance: { status: 'available', owner: 'attendance', freshness: 'snapshot', data: { presentCount: 1, absentCount: 0, lateCount: 0, excusedCount: 0, totalSessions: 1, attendancePercentage: 100, notes: [] } },
    academicRecord: { status: 'unavailable', owner: 'projection', freshness: 'live', data: null, unavailableReason: 'no legacy student' },
  }))
  assert.equal(result.valid, true, JSON.stringify(result.errors))
})

test('validateBlueprint passes for a "full blueprint" — every section available', () => {
  const result = validateBlueprint(fixtureBlueprint({
    identity: { status: 'available', owner: 'core', freshness: 'live', data: { learnerName: 'Amani', admissionNumber: '001', schoolName: 'Test', currentClassName: 'G7 East', academicYearLabel: '2026', termLabel: 'Term 2', guardians: [] } },
    academicRecord: { status: 'available', owner: 'projection', freshness: 'live', data: { overallTrend: 'stable', bySubject: [], competencies: [], confidence: 70, lastComputed: '2026-07-17T00:00:00Z' } },
    attendance: { status: 'available', owner: 'attendance', freshness: 'snapshot', data: { presentCount: 10, absentCount: 0, lateCount: 0, excusedCount: 0, totalSessions: 10, attendancePercentage: 100, notes: [] } },
    learningCompass: { status: 'available', owner: 'compass', freshness: 'live', data: { currentLearningFocus: null, nextRecommendedAction: null, holidayProgrammeAvailable: false, learningReadiness: null, notes: [] } },
    career: { status: 'available', owner: 'career', freshness: 'live', data: { careerCluster: null, strengthProfile: null, futureDirection: null, aiOutlook: null, confidence: null, notes: [] } },
    parentSummary: { status: 'available', owner: 'presentation', freshness: 'live', data: { headline: 'x', detail: 'x', action: null } },
  }))
  assert.equal(result.valid, true, JSON.stringify(result.errors))
})
