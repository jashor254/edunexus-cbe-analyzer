// lib/teacherWorkspace/classDetailProjectionPure.test.ts
// Run: npx tsx --test lib/teacherWorkspace/classDetailProjectionPure.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeClassDetailProjection } from './classDetailProjectionPure'

const NOW = new Date('2026-08-03T00:00:00.000Z').getTime()

test('empty class (no students) returns empty students/insights/topGaps/recommendations', () => {
  const result = computeClassDetailProjection({
    cls: { id: 'c1' },
    links: [],
    studentData: [],
    allAssessments: [],
    allSessions: [],
    nowMs: NOW,
  })
  assert.deepEqual(result.students, [])
  assert.deepEqual(result.insights, [])
  assert.deepEqual(result.topGaps, [])
  assert.deepEqual(result.recommendations, [])
})

test('a student with no assessment gets null overallLevel/avgScore/lastActive/daysInactive', () => {
  const result = computeClassDetailProjection({
    cls: { id: 'c1' },
    links: [{ student_id: 's1', parent_id: null, joined_at: '2026-01-01' }],
    studentData: [{ id: 's1', name: 'Amina', grade: 8, school: 'Test', parent_email: null, parent_phone: null }],
    allAssessments: [],
    allSessions: [],
    nowMs: NOW,
  })
  const s = result.students[0]
  assert.equal(s.overallLevel, null)
  assert.equal(s.avgScore, null)
  assert.equal(s.lastActive, null)
  assert.equal(s.daysInactive, null)
  assert.deepEqual(s.subjectScores, {})
})

test('daysInactive is computed from the latest session, floored to whole days', () => {
  const result = computeClassDetailProjection({
    cls: { id: 'c1' },
    links: [{ student_id: 's1', parent_id: null, joined_at: '2026-01-01' }],
    studentData: [{ id: 's1', name: 'Amina', grade: 8, school: 'Test', parent_email: null, parent_phone: null }],
    allAssessments: [],
    allSessions: [{ learner_id: 's1', updated_at: new Date(NOW - 3.7 * 24 * 60 * 60 * 1000).toISOString() }],
    nowMs: NOW,
  })
  assert.equal(result.students[0].daysInactive, 3)
})

test('takes the latest assessment/session per student from a pre-sorted-desc array (first occurrence wins)', () => {
  const result = computeClassDetailProjection({
    cls: { id: 'c1' },
    links: [{ student_id: 's1', parent_id: null, joined_at: '2026-01-01' }],
    studentData: [{ id: 's1', name: 'Amina', grade: 8, school: 'Test', parent_email: null, parent_phone: null }],
    allAssessments: [
      { id: 'a-new', student_id: 's1', subject_scores: { math: 4 }, term: 2, year: 2026, created_at: '2026-06-01' },
      { id: 'a-old', student_id: 's1', subject_scores: { math: 1 }, term: 1, year: 2026, created_at: '2026-01-01' },
    ],
    allSessions: [],
    nowMs: NOW,
  })
  assert.equal(result.students[0].latestAssessmentId, 'a-new')
  assert.equal(result.students[0].avgScore, 4)
})

test('classifies overallLevel from the raw (unrounded) average, not the rounded display value', () => {
  // mean(3.4, 3.5) = 3.45 raw -> "Meets Expectations" (below 3.5), even
  // though the rounded display avgScore (3.5) would look like "exceeds".
  const result = computeClassDetailProjection({
    cls: { id: 'c1' },
    links: [{ student_id: 's1', parent_id: null, joined_at: '2026-01-01' }],
    studentData: [{ id: 's1', name: 'Amina', grade: 8, school: 'Test', parent_email: null, parent_phone: null }],
    allAssessments: [
      { id: 'a1', student_id: 's1', subject_scores: { math: 3.4, eng: 3.5 }, term: 1, year: 2026, created_at: '2026-01-01' },
    ],
    allSessions: [],
    nowMs: NOW,
  })
  assert.equal(result.students[0].avgScore, 3.5)
  assert.equal(result.students[0].overallLevel, 'Meets Expectations')
})

test('subject insights aggregate each student\'s latest-assessment subject scores, sorted ascending by average', () => {
  const result = computeClassDetailProjection({
    cls: { id: 'c1' },
    links: [
      { student_id: 's1', parent_id: null, joined_at: '2026-01-01' },
      { student_id: 's2', parent_id: null, joined_at: '2026-01-01' },
    ],
    studentData: [
      { id: 's1', name: 'Amina', grade: 8, school: 'Test', parent_email: null, parent_phone: null },
      { id: 's2', name: 'Brian', grade: 8, school: 'Test', parent_email: null, parent_phone: null },
    ],
    allAssessments: [
      { id: 'a1', student_id: 's1', subject_scores: { math: 4, eng: 1 }, term: 1, year: 2026, created_at: '2026-01-02' },
      { id: 'a2', student_id: 's2', subject_scores: { math: 2, eng: 1 }, term: 1, year: 2026, created_at: '2026-01-01' },
    ],
    allSessions: [],
    nowMs: NOW,
  })
  assert.equal(result.insights.length, 2)
  // eng avg = 1 (below), math avg = 3 (meets) -> eng sorts first (ascending)
  assert.equal(result.insights[0].subject, 'eng')
  assert.equal(result.insights[0].avg, 1)
  assert.equal(result.insights[0].level, 'Below Expectations')
  assert.equal(result.insights[1].subject, 'math')
})

test('studentsBelow counts below + approaching buckets', () => {
  const result = computeClassDetailProjection({
    cls: { id: 'c1' },
    links: [
      { student_id: 's1', parent_id: null, joined_at: '2026-01-01' },
      { student_id: 's2', parent_id: null, joined_at: '2026-01-01' },
    ],
    studentData: [
      { id: 's1', name: 'Amina', grade: 8, school: 'Test', parent_email: null, parent_phone: null },
      { id: 's2', name: 'Brian', grade: 8, school: 'Test', parent_email: null, parent_phone: null },
    ],
    allAssessments: [
      { id: 'a1', student_id: 's1', subject_scores: { math: 1 }, term: 1, year: 2026, created_at: '2026-01-02' },
      { id: 'a2', student_id: 's2', subject_scores: { math: 2 }, term: 1, year: 2026, created_at: '2026-01-01' },
    ],
    allSessions: [],
    nowMs: NOW,
  })
  assert.equal(result.insights[0].studentsBelow, 2) // one "below" (1.0) + one "approaching" (2.0)
})

test('topGaps is at most the 3 lowest-average subjects', () => {
  const result = computeClassDetailProjection({
    cls: { id: 'c1' },
    links: [{ student_id: 's1', parent_id: null, joined_at: '2026-01-01' }],
    studentData: [{ id: 's1', name: 'Amina', grade: 8, school: 'Test', parent_email: null, parent_phone: null }],
    allAssessments: [{
      id: 'a1', student_id: 's1',
      subject_scores: { a: 1, b: 2, c: 3, d: 4 },
      term: 1, year: 2026, created_at: '2026-01-01',
    }],
    allSessions: [],
    nowMs: NOW,
  })
  assert.equal(result.topGaps.length, 3)
  assert.deepEqual(result.topGaps.map(g => g.subject), ['a', 'b', 'c'])
})

test('recommendation only appears when the lowest-avg subject has students below/approaching', () => {
  const withGap = computeClassDetailProjection({
    cls: { id: 'c1' },
    links: [{ student_id: 's1', parent_id: null, joined_at: '2026-01-01' }],
    studentData: [{ id: 's1', name: 'Amina', grade: 8, school: 'Test', parent_email: null, parent_phone: null }],
    allAssessments: [{ id: 'a1', student_id: 's1', subject_scores: { math: 1 }, term: 1, year: 2026, created_at: '2026-01-01' }],
    allSessions: [],
    nowMs: NOW,
  })
  assert.equal(withGap.recommendations.length, 1)
  assert.match(withGap.recommendations[0], /1 students need support in math/)

  const noGap = computeClassDetailProjection({
    cls: { id: 'c1' },
    links: [{ student_id: 's1', parent_id: null, joined_at: '2026-01-01' }],
    studentData: [{ id: 's1', name: 'Amina', grade: 8, school: 'Test', parent_email: null, parent_phone: null }],
    allAssessments: [{ id: 'a1', student_id: 's1', subject_scores: { math: 4 }, term: 1, year: 2026, created_at: '2026-01-01' }],
    allSessions: [],
    nowMs: NOW,
  })
  assert.deepEqual(noGap.recommendations, [])
})

test('the class object passed in is returned unchanged', () => {
  const cls = { id: 'c1', name: 'Grade 8 Maths', teacher_id: 't1' }
  const result = computeClassDetailProjection({
    cls, links: [], studentData: [], allAssessments: [], allSessions: [], nowMs: NOW,
  })
  assert.deepEqual(result.class, cls)
})
