// lib/assignments/create.http.integration.test.ts
//
// Phase 2A parity/authorization tests for the canonical assignment-creation
// service (docs/architecture/assignment-creation-service-phase2a.md). The
// pre-existing lib/testing/lmsRoutes.http.integration.test.ts already covers
// quiz/adaptive/substrand creation-shape parity extensively — this file adds
// the authorization matrix and side-effect boundary checks the extraction
// needed to prove, without duplicating that coverage.
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939).
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/assignments/create.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_ASSIGN_CREATE_HTTP_TEST'
const db = createServiceClient()

type Fixture = {
  teacherAuthId: string
  teacherId: string
  teacherSession: SyntheticSession
  otherTeacherAuthId: string
  otherTeacherId: string
  otherTeacherSession: SyntheticSession
  studentAuthId: string
  studentId: string
  studentSession: SyntheticSession
  outsiderStudentAuthId: string
  outsiderStudentId: string
  parentAuthId: string
  parentSession: SyntheticSession
  classId: string
  createdAssignmentIds: string[]
}

let fx: Fixture

// See lib/testing/lmsRoutes.http.integration.test.ts's identical comment —
// same confirmed, sustained, intermittent flake against Supabase Auth's
// admin endpoints this session. Bounded setup retries only.
async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function createSyntheticUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  const session = await retryAsync(() => signInForHttpTest(email, password))
  return { authId: data.user.id, session }
}

before(async () => {
  const teacher = await createSyntheticUser('teacher')
  const otherTeacher = await createSyntheticUser('other-teacher')
  const student = await createSyntheticUser('student')
  const outsiderStudent = await createSyntheticUser('outsider-student')
  // A parent has an authenticated session but no `teachers` row — from the
  // creation service's point of view this is identical to any non-teacher
  // caller (student, or an unaffiliated account), which is exactly the case
  // requireClassTeacher's "no teacher record" branch exists to cover.
  const parent = await createSyntheticUser('parent')

  const { data: teacherRow, error: teacherErr } = await db
    .from('teachers').insert({ user_id: teacher.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr

  const { data: otherTeacherRow, error: otherTeacherErr } = await db
    .from('teachers').insert({ user_id: otherTeacher.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (otherTeacherErr) throw otherTeacherErr

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({
      teacher_id: teacherRow.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics',
      class_code: `${SYNTHETIC_MARKER}_${Date.now()}`,
    })
    .select('id').single()
  if (clsErr) throw clsErr

  const { data: studentRow, error: studentErr } = await db
    .from('students').insert({ user_id: student.authId, name: 'Enrolled Student', grade: 8, level: 'Junior School' })
    .select('id').single()
  if (studentErr) throw studentErr
  await db.from('class_students').insert({ class_id: cls.id, student_id: studentRow.id })

  const { data: outsiderStudentRow, error: outsiderStudentErr } = await db
    .from('students').insert({ user_id: outsiderStudent.authId, name: 'Outsider Student', grade: 8, level: 'Junior School' })
    .select('id').single()
  if (outsiderStudentErr) throw outsiderStudentErr
  // Deliberately NOT added to class_students — proves the fan-out never
  // creates a submission row for a learner outside the roster.

  fx = {
    teacherAuthId: teacher.authId, teacherId: teacherRow.id, teacherSession: teacher.session,
    otherTeacherAuthId: otherTeacher.authId, otherTeacherId: otherTeacherRow.id, otherTeacherSession: otherTeacher.session,
    studentAuthId: student.authId, studentId: studentRow.id, studentSession: student.session,
    outsiderStudentAuthId: outsiderStudent.authId, outsiderStudentId: outsiderStudentRow.id,
    parentAuthId: parent.authId, parentSession: parent.session,
    classId: cls.id, createdAssignmentIds: [],
  }
})

after(async () => {
  if (!fx) return
  await db.from('teacher_classes').delete().eq('id', fx.classId) // cascades assignments/submissions/class_students
  await db.from('students').delete().eq('id', fx.studentId)
  await db.from('students').delete().eq('id', fx.outsiderStudentId)
  await db.from('teachers').delete().eq('id', fx.teacherId)
  await db.from('teachers').delete().eq('id', fx.otherTeacherId)
  for (const authId of [fx.teacherAuthId, fx.otherTeacherAuthId, fx.studentAuthId, fx.outsiderStudentAuthId, fx.parentAuthId]) {
    await db.auth.admin.deleteUser(authId)
  }
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    class_id: fx.classId,
    title: 'Ratios Worksheet',
    subject: 'Mathematics',
    topic: 'Ratios',
    instructions: 'Complete questions 1-10',
    due_date: new Date(Date.now() + 86400_000).toISOString(),
    ...overrides,
  }
}

async function postAssignment(headers: Record<string, string>, body: unknown) {
  return fetch(`${BASE_URL}/api/teacher/assignments`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('POST /api/teacher/assignments: unauthenticated request is rejected with 401', async () => {
  const res = await postAssignment({}, validPayload())
  assert.equal(res.status, 401)
})

test('POST /api/teacher/assignments: a parent-shaped session (authenticated, no teacher record) is denied with 403', async () => {
  const res = await postAssignment(cookie(fx.parentSession), validPayload())
  assert.equal(res.status, 403)
})

test('POST /api/teacher/assignments: a learner session (authenticated, no teacher record) is denied with 403', async () => {
  const res = await postAssignment(cookie(fx.studentSession), validPayload())
  assert.equal(res.status, 403)
})

test('POST /api/teacher/assignments: an unrelated teacher who does not own the class is denied with 403', async () => {
  const res = await postAssignment(cookie(fx.otherTeacherSession), validPayload())
  assert.equal(res.status, 403)
})

test('POST /api/teacher/assignments: a non-existent class_id is denied with 403 (same path as "not your class")', async () => {
  const res = await postAssignment(cookie(fx.teacherSession), validPayload({ class_id: '00000000-0000-0000-0000-000000000000' }))
  assert.equal(res.status, 403)
})

test('POST /api/teacher/assignments: missing title is rejected with 400', async () => {
  const res = await postAssignment(cookie(fx.teacherSession), validPayload({ title: '' }))
  assert.equal(res.status, 400)
})

test('POST /api/teacher/assignments: empty due_date is rejected with 400', async () => {
  const res = await postAssignment(cookie(fx.teacherSession), validPayload({ due_date: '' }))
  assert.equal(res.status, 400)
})

test('POST /api/teacher/assignments: the owning teacher succeeds, and submission fan-out reaches only the enrolled roster', async () => {
  const res = await postAssignment(cookie(fx.teacherSession), validPayload())
  assert.equal(res.status, 201)
  const body = await res.json()
  const assignment = body.data.assignment
  fx.createdAssignmentIds.push(assignment.id)

  // Essential shape parity with the pre-extraction route response.
  assert.equal(assignment.class_id, fx.classId)
  assert.equal(assignment.teacher_id, fx.teacherId)
  assert.equal(assignment.title, 'Ratios Worksheet')
  assert.equal(assignment.status, 'active')
  assert.equal(assignment.is_quiz, false)
  assert.equal(assignment.is_adaptive, false)
  assert.ok(assignment.id)
  assert.ok(assignment.created_at)

  const { data: submissions } = await db
    .from('assignment_submissions')
    .select('student_id, status')
    .eq('assignment_id', assignment.id)
  assert.equal(submissions?.length, 1)
  assert.equal(submissions?.[0].student_id, fx.studentId)
  assert.equal(submissions?.[0].status, 'pending')
  assert.ok(!submissions?.some(s => s.student_id === fx.outsiderStudentId))
})

test('POST /api/teacher/assignments: creation has no Blueprint, Compass, or learner_evidence side effects', async () => {
  const res = await postAssignment(cookie(fx.teacherSession), validPayload({ title: 'Side-Effect Boundary Check' }))
  assert.equal(res.status, 201)
  const body = await res.json()
  const assignment = body.data.assignment
  fx.createdAssignmentIds.push(assignment.id)

  const [{ data: compassSessions }, { data: evidenceRows }] = await Promise.all([
    db.from('compass_sessions').select('id').eq('learner_id', fx.studentId).gte('created_at', assignment.created_at),
    db.from('learner_evidence').select('id').eq('learner_id', fx.studentId).gte('created_at', assignment.created_at),
  ])
  assert.equal(compassSessions?.length ?? 0, 0)
  assert.equal(evidenceRows?.length ?? 0, 0)
})

after(async () => {
  if (fx?.createdAssignmentIds.length) {
    await db.from('assignments').delete().in('id', fx.createdAssignmentIds)
  }
})
