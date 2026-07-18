// lib/gradebook/gradebook.pure.test.ts
// Run: npx tsx --test lib/gradebook/gradebook.pure.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeGradebook, gradebookToCSV } from './gradebookPure'

test('mergeGradebook: builds one column per assessment and assignment', () => {
  const gb = mergeGradebook({
    students: [{ id: 's1', name: 'Amina' }],
    assessments: [{ id: 'a1', title: 'Midterm', max_score: 100, created_at: '2026-01-01' }],
    assignments: [{ id: 'w1', title: 'Homework 1', due_date: '2026-01-05', max_score: 20 }],
    marks: [],
    submissions: [],
  })
  assert.equal(gb.columns.length, 2)
  assert.equal(gb.columns[0].kind, 'assessment')
  assert.equal(gb.columns[1].kind, 'assignment')
})

test('mergeGradebook: fills score from marks/submissions, null when ungraded', () => {
  const gb = mergeGradebook({
    students: [{ id: 's1', name: 'Amina' }, { id: 's2', name: 'Brian' }],
    assessments: [{ id: 'a1', title: 'Midterm', max_score: 100, created_at: '2026-01-01' }],
    assignments: [{ id: 'w1', title: 'Homework 1', due_date: '2026-01-05', max_score: 20 }],
    marks: [{ assessment_id: 'a1', student_id: 's1', total_marks: 88 }],
    submissions: [{ assignment_id: 'w1', student_id: 's1', score: 18 }],
  })
  const amina = gb.rows.find(r => r.studentId === 's1')!
  const brian = gb.rows.find(r => r.studentId === 's2')!
  assert.equal(amina.scores.a1, 88)
  assert.equal(amina.scores.w1, 18)
  assert.equal(brian.scores.a1, null)
  assert.equal(brian.scores.w1, null)
})

test('mergeGradebook: assignment with null max_score defaults to 100', () => {
  const gb = mergeGradebook({
    students: [],
    assessments: [],
    assignments: [{ id: 'w1', title: 'Homework', due_date: '2026-01-05', max_score: null }],
    marks: [],
    submissions: [],
  })
  assert.equal(gb.columns[0].maxScore, 100)
})

test('mergeGradebook: empty class produces empty rows/columns, not an error', () => {
  const gb = mergeGradebook({ students: [], assessments: [], assignments: [], marks: [], submissions: [] })
  assert.deepEqual(gb, { columns: [], rows: [] })
})

test('gradebookToCSV: header row lists each column with its max score', () => {
  const csv = gradebookToCSV({
    columns: [{ id: 'a1', kind: 'assessment', title: 'Midterm', maxScore: 100, date: null }],
    rows: [],
  })
  assert.ok(csv.startsWith('Student,Midterm (/100)'))
})

test('gradebookToCSV: ungraded cell renders as empty string, not "null"', () => {
  const csv = gradebookToCSV({
    columns: [{ id: 'a1', kind: 'assessment', title: 'Midterm', maxScore: 100, date: null }],
    rows: [{ studentId: 's1', studentName: 'Amina', scores: { a1: null } }],
  })
  const lines = csv.split('\n')
  assert.equal(lines[1], '"Amina",""')
})

test('gradebookToCSV: escapes double quotes in student names', () => {
  const csv = gradebookToCSV({
    columns: [],
    rows: [{ studentId: 's1', studentName: 'Amina "Ace" Wanjiru', scores: {} }],
  })
  assert.ok(csv.includes('"Amina ""Ace"" Wanjiru"'))
})
