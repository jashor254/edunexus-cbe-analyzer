// lib/teacherWorkspace/classListProjectionPure.test.ts
// Run: npx tsx --test lib/teacherWorkspace/classListProjectionPure.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeClassListStats } from './classListProjectionPure'

test('empty classes input returns empty output', () => {
  assert.deepEqual(computeClassListStats([], [], []), [])
})

test('a class with no students gets student_count 0 and avg_level null', () => {
  const result = computeClassListStats([{ id: 'c1', name: 'Grade 8' }], [], [])
  assert.deepEqual(result, [{ id: 'c1', name: 'Grade 8', student_count: 0, avg_level: null }])
})

test('a class with students but no assessments gets a student_count and null avg_level', () => {
  const result = computeClassListStats(
    [{ id: 'c1' }],
    [{ class_id: 'c1', student_id: 's1' }, { class_id: 'c1', student_id: 's2' }],
    [],
  )
  assert.equal(result[0].student_count, 2)
  assert.equal(result[0].avg_level, null)
})

test('computes average-of-per-assessment-averages, rounded to 1 decimal', () => {
  const result = computeClassListStats(
    [{ id: 'c1' }],
    [{ class_id: 'c1', student_id: 's1' }],
    [{ student_id: 's1', subject_scores: { math: 3, eng: 4 } }], // per-assessment avg 3.5
  )
  assert.equal(result[0].avg_level, 3.5)
})

test('limits to the most recent N assessments where N = student count, matching the original .limit(studentIds.length)', () => {
  const result = computeClassListStats(
    [{ id: 'c1' }],
    [{ class_id: 'c1', student_id: 's1' }], // 1 student -> limit 1
    [
      { student_id: 's1', subject_scores: { math: 4 } }, // most recent (array is pre-sorted desc)
      { student_id: 's1', subject_scores: { math: 1 } }, // older, should be excluded by the limit
    ],
  )
  assert.equal(result[0].avg_level, 4)
})

test('multiple classes are computed independently from one batched student-link/assessment set (the N+1 fix)', () => {
  const result = computeClassListStats(
    [{ id: 'c1' }, { id: 'c2' }],
    [
      { class_id: 'c1', student_id: 's1' },
      { class_id: 'c2', student_id: 's2' },
    ],
    [
      { student_id: 's1', subject_scores: { math: 4 } },
      { student_id: 's2', subject_scores: { math: 1 } },
    ],
  )
  const c1 = result.find(r => r.id === 'c1')!
  const c2 = result.find(r => r.id === 'c2')!
  assert.equal(c1.avg_level, 4)
  assert.equal(c2.avg_level, 1)
})

test('a student assessment for a student not in this class is never counted (class isolation)', () => {
  const result = computeClassListStats(
    [{ id: 'c1' }],
    [{ class_id: 'c1', student_id: 's1' }],
    [{ student_id: 'someone-else', subject_scores: { math: 4 } }],
  )
  assert.equal(result[0].avg_level, null)
})

test('preserves the original truthy-check quirk: an avg_level of exactly 0 is reported as null, not 0', () => {
  const result = computeClassListStats(
    [{ id: 'c1' }],
    [{ class_id: 'c1', student_id: 's1' }],
    [{ student_id: 's1', subject_scores: { math: 0 } }],
  )
  assert.equal(result[0].avg_level, null)
})

test('spreads through arbitrary extra fields already present on the raw class row unchanged', () => {
  const result = computeClassListStats([{ id: 'c1', class_code: 'MAT8AB', class_students: [{ count: 3 }] }], [], [])
  assert.equal(result[0].class_code, 'MAT8AB')
  assert.deepEqual(result[0].class_students, [{ count: 3 }])
})
