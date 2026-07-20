// lib/quiz/quizIdentityLock.integration.test.ts
//
// Sprint 9 Slice 1 (ADR-0028 / Sprint 4A.1) — validates against real,
// synthetic (throwaway) data that replaceQuestions() now preserves question
// identity across edits, and that the DB-level lock trigger rejects any
// write to a locked assignment's questions atomically (no partial
// application), the two non-negotiable conditions the Sprint 4A.1 design
// required before any variant table could safely exist.
//
// Run: npx tsx --env-file=.env.local --test lib/quiz/quizIdentityLock.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { replaceQuestions, findQuestionsForTeacher, gradeAndSubmitQuiz } from './quiz'

const SYNTHETIC_MARKER = 'SYNTHETIC_LOCK_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let classId: string
let studentId: string
let assignmentId: string

before(async () => {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `lms-lock-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = auth.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers').insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_${Date.now()}` })
    .select('id').single()
  if (clsErr) throw clsErr
  classId = cls.id

  const { data: student, error: studentErr } = await db
    .from('students').insert({ user_id: authUserId, name: 'Lock Test Student', grade: 8, level: 'Junior School' })
    .select('id').single()
  if (studentErr) throw studentErr
  studentId = student.id

  await db.from('class_students').insert({ class_id: classId, student_id: studentId })

  const { data: assignment, error: assignErr } = await db
    .from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: 'Lock Test Quiz',
      subject: 'Mathematics', topic: 'Fractions', instructions: 'Answer all questions',
      due_date: new Date(Date.now() + 86400_000).toISOString(), max_score: 10, is_quiz: true,
    })
    .select('id').single()
  if (assignErr) throw assignErr
  assignmentId = assignment.id
})

after(async () => {
  if (classId) await db.from('teacher_classes').delete().eq('id', classId)
  if (studentId) await db.from('students').delete().eq('id', studentId)
  if (teacherId) await db.from('teachers').delete().eq('id', teacherId)
  if (authUserId) await db.auth.admin.deleteUser(authUserId)
})

test('replaceQuestions: an edited question (same id sent back) keeps its id', async () => {
  await replaceQuestions(assignmentId, [
    { questionText: 'Original text', choices: ['A', 'B'], correctIndex: 0 },
  ])
  const [original] = await findQuestionsForTeacher(assignmentId)
  const originalId = original.id

  await replaceQuestions(assignmentId, [
    { id: originalId, questionText: 'Edited text', choices: ['A', 'B', 'C'], correctIndex: 2 },
  ])

  const [edited] = await findQuestionsForTeacher(assignmentId)
  assert.equal(edited.id, originalId, 'the id must survive the edit')
  assert.equal(edited.question_text, 'Edited text')
  assert.equal(edited.correct_index, 2)
})

test('replaceQuestions: a new question (no id) gets inserted alongside an edited one, both ids distinct', async () => {
  const [existing] = await findQuestionsForTeacher(assignmentId)

  await replaceQuestions(assignmentId, [
    { id: existing.id, questionText: existing.question_text, choices: existing.choices, correctIndex: existing.correct_index },
    { questionText: 'Brand new question', choices: ['X', 'Y'], correctIndex: 0 },
  ])

  const rows = await findQuestionsForTeacher(assignmentId)
  assert.equal(rows.length, 2)
  assert.ok(rows.some(r => r.id === existing.id))
  assert.ok(rows.some(r => r.question_text === 'Brand new question' && r.id !== existing.id))
})

test('replaceQuestions: a question present before but absent from the new array is deleted, only that one', async () => {
  const rows = await findQuestionsForTeacher(assignmentId)
  const [keep, remove] = rows

  await replaceQuestions(assignmentId, [
    { id: keep.id, questionText: keep.question_text, choices: keep.choices, correctIndex: keep.correct_index },
  ])

  const after1 = await findQuestionsForTeacher(assignmentId)
  assert.equal(after1.length, 1)
  assert.equal(after1[0].id, keep.id)
  assert.ok(!after1.some(r => r.id === remove.id))
})

test('replaceQuestions: once real submission activity exists, further edits are rejected atomically', async () => {
  const [question] = await findQuestionsForTeacher(assignmentId)

  // Real submission activity: grade a submission for this assignment.
  await gradeAndSubmitQuiz({
    assignmentId, studentId, classId, maxScore: 10,
    answers: [{ questionId: question.id, selectedIndex: 0 }],
  })

  const before1 = await findQuestionsForTeacher(assignmentId)

  await assert.rejects(
    () => replaceQuestions(assignmentId, [
      { id: question.id, questionText: 'Trying to sneak an edit in', choices: ['A', 'B'], correctIndex: 1 },
    ]),
    /locked/i,
  )

  // Atomicity: the rejected write left every row exactly as it was.
  const after1 = await findQuestionsForTeacher(assignmentId)
  assert.deepEqual(after1, before1)
})

test('replaceQuestions: locked also rejects adding a brand-new question, not just editing existing ones', async () => {
  await assert.rejects(
    () => replaceQuestions(assignmentId, [
      { questionText: 'A whole new question on a locked assignment', choices: ['A', 'B'], correctIndex: 0 },
    ]),
    /locked/i,
  )
})
