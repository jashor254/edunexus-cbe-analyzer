// lib/quiz/quiz.integration.test.ts
//
// LMS Basics Phase 3a — validates the quiz DB functions against real,
// synthetic (throwaway) data: a real teacher, class, student, quiz-type
// assignment. Mirrors lib/gradebook/gradebook.integration.test.ts's setup
// shape.
//
// Run: npx tsx --env-file=.env.local --test lib/quiz/quiz.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { replaceQuestions, findQuestionsForTeacher, findQuestionsForStudent, gradeAndSubmitQuiz } from './quiz'

const SYNTHETIC_MARKER = 'SYNTHETIC_LMS_QUIZ_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let classId: string
let studentId: string
let assignmentId: string

before(async () => {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `lms-quiz-${Date.now()}@example.com`,
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
    .from('students').insert({ user_id: authUserId, name: 'Quiz Test Student', grade: 8, level: 'Junior School' })
    .select('id').single()
  if (studentErr) throw studentErr
  studentId = student.id

  await db.from('class_students').insert({ class_id: classId, student_id: studentId })

  const { data: assignment, error: assignErr } = await db
    .from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: 'Fractions Quiz',
      subject: 'Mathematics', topic: 'Fractions', instructions: 'Answer all questions',
      due_date: new Date(Date.now() + 86400_000).toISOString(), max_score: 20, is_quiz: true,
    })
    .select('id').single()
  if (assignErr) throw assignErr
  assignmentId = assignment.id
})

after(async () => {
  if (classId) await db.from('teacher_classes').delete().eq('id', classId) // cascades assignments/assignment_questions/submissions/class_students
  if (studentId) await db.from('students').delete().eq('id', studentId)
  if (teacherId) await db.from('teachers').delete().eq('id', teacherId)
  if (authUserId) await db.auth.admin.deleteUser(authUserId)
})

test('replaceQuestions + findQuestionsForTeacher: questions round-trip with correct_index intact', async () => {
  await replaceQuestions(assignmentId, [
    { questionText: '1/2 + 1/2 = ?', choices: ['1', '2', '0', '1/4'], correctIndex: 0 },
    { questionText: '3/4 - 1/4 = ?', choices: ['1/2', '1', '2', '4'], correctIndex: 0 },
  ])

  const teacherView = await findQuestionsForTeacher(assignmentId)
  assert.equal(teacherView.length, 2)
  assert.equal(teacherView[0].correct_index, 0)
  assert.equal(teacherView[0].order_index, 0)
  assert.equal(teacherView[1].order_index, 1)
})

test('findQuestionsForStudent: never includes correct_index', async () => {
  const studentView = await findQuestionsForStudent(assignmentId)
  assert.equal(studentView.length, 2)
  for (const q of studentView) {
    assert.equal('correct_index' in q, false)
  }
})

test('replaceQuestions: calling again fully replaces the prior set (no leftover rows)', async () => {
  await replaceQuestions(assignmentId, [
    { questionText: 'Only question now', choices: ['A', 'B'], correctIndex: 1 },
  ])
  const teacherView = await findQuestionsForTeacher(assignmentId)
  assert.equal(teacherView.length, 1)
  assert.equal(teacherView[0].question_text, 'Only question now')
})

test('gradeAndSubmitQuiz: grades correctly and records the submission as marked', async () => {
  await replaceQuestions(assignmentId, [
    { questionText: 'Q1', choices: ['A', 'B'], correctIndex: 0 },
    { questionText: 'Q2', choices: ['A', 'B'], correctIndex: 1 },
  ])
  const [q1, q2] = await findQuestionsForTeacher(assignmentId)

  const { submission, grade } = await gradeAndSubmitQuiz({
    assignmentId, studentId, classId, maxScore: 20,
    answers: [
      { questionId: q1.id, selectedIndex: 0 }, // correct
      { questionId: q2.id, selectedIndex: 0 }, // wrong (correct is 1)
    ],
  })

  assert.equal(grade.correctCount, 1)
  assert.equal(grade.total, 2)
  assert.equal(grade.score, 10) // 1/2 * 20
  assert.equal(submission.status, 'marked')
  assert.equal(submission.score, 10)
  assert.ok(submission.marked_at)
})

test('gradeAndSubmitQuiz: resubmitting updates the existing submission row, not a duplicate', async () => {
  const [q1, q2] = await findQuestionsForTeacher(assignmentId)

  await gradeAndSubmitQuiz({
    assignmentId, studentId, classId, maxScore: 20,
    answers: [{ questionId: q1.id, selectedIndex: 0 }, { questionId: q2.id, selectedIndex: 1 }],
  })

  const { count } = await db
    .from('assignment_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)

  assert.equal(count, 1)
})
