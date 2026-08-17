// lib/gradebook/gradebook.integration.test.ts
//
// LMS Basics Phase 0b — validates buildGradebook() end-to-end against real,
// synthetic (throwaway) data: a real teacher, class, two students, one
// class_assessment with learner_marks, one assignment with
// assignment_submissions. gradebook.pure.test.ts already covers the merge
// logic in isolation; this proves the real Supabase queries (roster join,
// findAssessmentsByClass, findMarksByAssessmentIds, assignment_submissions)
// feed that logic correctly end-to-end.
//
// Run: npx tsx --env-file=.env.local --test lib/gradebook/gradebook.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { buildGradebook } from './gradebook'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_LMS_GRADEBOOK_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let classId: string
let student1Id: string
let student2Id: string
let assessmentId: string
let assignmentId: string

before(async () => {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `lms-gradebook-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = auth.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({
      teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics',
      class_code: `${SYNTHETIC_MARKER}_${Date.now()}`,
    })
    .select('id')
    .single()
  if (clsErr) throw clsErr
  classId = cls.id

  const { data: student1, error: s1Err } = await db
    .from('students')
    .insert({ user_id: authUserId, name: 'Amina Wanjiru', grade: 8, level: 'Junior School' })
    .select('id')
    .single()
  if (s1Err) throw s1Err
  student1Id = student1.id

  const { data: student2, error: s2Err } = await db
    .from('students')
    .insert({ user_id: authUserId, name: 'Brian Otieno', grade: 8, level: 'Junior School' })
    .select('id')
    .single()
  if (s2Err) throw s2Err
  student2Id = student2.id

  await db.from('class_students').insert([
    { class_id: classId, student_id: student1Id },
    { class_id: classId, student_id: student2Id },
  ])

  const { data: assessment, error: assessErr } = await db
    .from('class_assessments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: 'Midterm CAT',
      term: '1', year: 2026, max_score: 100, subjects: ['Mathematics'],
    })
    .select('id')
    .single()
  if (assessErr) throw assessErr
  assessmentId = assessment.id

  // Only student1 has a mark — student2's cell should come back null, not
  // throw or get silently skipped.
  await db.from('learner_marks').insert({
    assessment_id: assessmentId, class_id: classId, teacher_id: teacherId,
    student_id: student1Id, student_name: 'Amina Wanjiru', total_marks: 82,
  })

  const { data: assignment, error: assignErr } = await db
    .from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: 'Homework 1',
      subject: 'Mathematics', topic: 'Algebra', instructions: 'Solve 1-10',
      due_date: new Date().toISOString(), max_score: 20,
    })
    .select('id')
    .single()
  if (assignErr) throw assignErr
  assignmentId = assignment.id

  // Both students have a submission row (pre-created, matching real
  // assignment-creation behaviour), only student2's is scored.
  await db.from('assignment_submissions').insert([
    { assignment_id: assignmentId, student_id: student1Id, class_id: classId, status: 'pending' },
    { assignment_id: assignmentId, student_id: student2Id, class_id: classId, status: 'marked', score: 18 },
  ])
})

after(async () => {
  if (classId) await db.from('teacher_classes').delete().eq('id', classId)
  if (student1Id) await db.from('students').delete().eq('id', student1Id)
  if (student2Id) await db.from('students').delete().eq('id', student2Id)
  if (teacherId) await db.from('teachers').delete().eq('id', teacherId)
  if (authUserId) await deleteAuthUserOrThrow(db, authUserId)
})

test('buildGradebook: one column per assessment and assignment', async () => {
  const gb = await buildGradebook(classId, teacherId)
  assert.equal(gb.columns.length, 2)
  const assessmentCol = gb.columns.find(c => c.id === assessmentId)
  const assignmentCol = gb.columns.find(c => c.id === assignmentId)
  assert.equal(assessmentCol?.kind, 'assessment')
  assert.equal(assignmentCol?.kind, 'assignment')
  assert.equal(assignmentCol?.maxScore, 20)
})

test('buildGradebook: one row per roster student, correct scores, null for ungraded', async () => {
  const gb = await buildGradebook(classId, teacherId)
  assert.equal(gb.rows.length, 2)

  const amina = gb.rows.find(r => r.studentId === student1Id)!
  const brian = gb.rows.find(r => r.studentId === student2Id)!

  assert.equal(amina.scores[assessmentId], 82)
  assert.equal(amina.scores[assignmentId], null) // submission exists but unscored

  assert.equal(brian.scores[assessmentId], null) // no mark row at all
  assert.equal(brian.scores[assignmentId], 18)
})

test('buildGradebook: a class with no assessments/assignments returns an empty column set, not an error', async () => {
  const { data: emptyCls } = await db
    .from('teacher_classes')
    .insert({
      teacher_id: teacherId, name: `${SYNTHETIC_MARKER}_empty`, grade: 8, subject: 'Mathematics',
      class_code: `${SYNTHETIC_MARKER}_empty_${Date.now()}`,
    })
    .select('id')
    .single()

  const gb = await buildGradebook(emptyCls!.id, teacherId)
  assert.deepEqual(gb, { columns: [], rows: [] })

  await db.from('teacher_classes').delete().eq('id', emptyCls!.id)
})
