// lib/teacherWorkspace/classInsightsProjectionPure.test.ts
// Run: npx tsx --test lib/teacherWorkspace/classInsightsProjectionPure.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeClassInsightsProjection } from './classInsightsProjectionPure'

const NOW = new Date('2026-08-03T00:00:00.000Z').getTime()

test('empty class (no students) returns the same default shape the route used to return early', () => {
  const result = computeClassInsightsProjection({ studentIds: [], sessions: [], assessments: [], students: [], nowMs: NOW })
  assert.deepEqual(result, {
    totalStudents: 0,
    activeStudents: 0,
    holidayRisk: [],
    subjectDistribution: {},
    riskLevels: { high: 0, medium: 0, low: 0 },
  })
})

test('a student active in the last 7 days counts toward activeStudents', () => {
  const result = computeClassInsightsProjection({
    studentIds: ['s1'],
    sessions: [{ learner_id: 's1', updated_at: new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString() }],
    assessments: [],
    students: [{ id: 's1', name: 'Amina', grade: 8 }],
    nowMs: NOW,
  })
  assert.equal(result.activeStudents, 1)
})

test('a session older than 7 days does not count as active', () => {
  const result = computeClassInsightsProjection({
    studentIds: ['s1'],
    sessions: [{ learner_id: 's1', updated_at: new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString() }],
    assessments: [],
    students: [{ id: 's1', name: 'Amina', grade: 8 }],
    nowMs: NOW,
  })
  assert.equal(result.activeStudents, 0)
})

test('a student with no assessments and no recent activity defaults to medium risk (computeStudentRiskLevel\'s own default average is 2.5, not below the "high" threshold of 2)', () => {
  const result = computeClassInsightsProjection({
    studentIds: ['s1'],
    sessions: [],
    assessments: [],
    students: [{ id: 's1', name: 'Amina', grade: 8 }],
    nowMs: NOW,
  })
  assert.equal(result.riskLevels.medium, 1)
  assert.equal(result.holidayRisk.length, 1)
  assert.equal(result.holidayRisk[0].riskLevel, 'medium')
})

test('a student with a genuinely low average and no recent activity is classified high risk', () => {
  const result = computeClassInsightsProjection({
    studentIds: ['s1'],
    sessions: [],
    assessments: [{ student_id: 's1', subject_scores: { math: 1 }, created_at: '2026-01-01' }],
    students: [{ id: 's1', name: 'Amina', grade: 8 }],
    nowMs: NOW,
  })
  assert.equal(result.riskLevels.high, 1)
  assert.equal(result.holidayRisk[0].riskLevel, 'high')
})

test('subjectDistribution only uses the latest assessment per student, not every historical one', () => {
  const result = computeClassInsightsProjection({
    studentIds: ['s1'],
    sessions: [],
    assessments: [
      { student_id: 's1', subject_scores: { math: 1 }, created_at: '2026-01-01' },
      { student_id: 's1', subject_scores: { math: 4 }, created_at: '2026-06-01' },
    ],
    students: [{ id: 's1', name: 'Amina', grade: 8 }],
    nowMs: NOW,
  })
  assert.deepEqual(result.subjectDistribution, { math: [4] })
})

test('subjectDistribution ties (equal created_at) keep the first-seen row, not an arbitrary later one', () => {
  const result = computeClassInsightsProjection({
    studentIds: ['s1'],
    sessions: [],
    assessments: [
      { student_id: 's1', subject_scores: { math: 1 }, created_at: '2026-01-01' },
      { student_id: 's1', subject_scores: { math: 4 }, created_at: '2026-01-01' },
    ],
    students: [{ id: 's1', name: 'Amina', grade: 8 }],
    nowMs: NOW,
  })
  assert.deepEqual(result.subjectDistribution, { math: [1] })
})

test('holidayRisk excludes low-risk students', () => {
  const result = computeClassInsightsProjection({
    studentIds: ['s1'],
    sessions: [{ learner_id: 's1', updated_at: new Date(NOW - 1 * 24 * 60 * 60 * 1000).toISOString() }],
    assessments: [{ student_id: 's1', subject_scores: { math: 4 }, created_at: '2026-06-01' }],
    students: [{ id: 's1', name: 'Amina', grade: 8 }],
    nowMs: NOW,
  })
  assert.equal(result.riskLevels.low, 1)
  assert.deepEqual(result.holidayRisk, [])
})

test('riskLevels always includes all three keys even when a bucket is empty', () => {
  const result = computeClassInsightsProjection({
    studentIds: ['s1'],
    sessions: [{ learner_id: 's1', updated_at: new Date(NOW - 1 * 24 * 60 * 60 * 1000).toISOString() }],
    assessments: [{ student_id: 's1', subject_scores: { math: 4 }, created_at: '2026-06-01' }],
    students: [{ id: 's1', name: 'Amina', grade: 8 }],
    nowMs: NOW,
  })
  assert.deepEqual(result.riskLevels, { high: 0, medium: 0, low: 1 })
})
