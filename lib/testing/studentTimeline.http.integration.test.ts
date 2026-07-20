// lib/testing/studentTimeline.http.integration.test.ts
//
// Sprint 6 — proves the new `/student/timeline/[learnerId]` page (exposing
// the canonical `getLearnerTimeline()`, previously reachable only by
// `app/api/teacher/students/[studentId]/timeline`) is reachable by the
// learner's own account and correctly denied to an unrelated student —
// reusing the exact same `requireLearnerAccess` gate proven in
// studentBlueprintSelfAccess.http.integration.test.ts, not a bespoke check.
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/testing/studentTimeline.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_SPRINT6_TIMELINE_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 10)}`

const authUserIds: string[] = []
const schoolIds: string[] = []
const learnerIds: string[] = []
const studentIds: string[] = []
const teacherRowIds: string[] = []

let studentSession: SyntheticSession
let otherStudentSession: SyntheticSession
let coreLearnerId: string

async function createUser(label: string, profileRole?: 'student'): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  if (profileRole) {
    const { error: profileErr } = await db.from('profiles').upsert({ id: data.user.id, role: profileRole })
    if (profileErr) throw profileErr
  }
  const session = await signInForHttpTest(email, PASSWORD)
  return { authId: data.user.id, session }
}

before(async () => {
  const student = await createUser('student', 'student')
  const otherStudent = await createUser('other-student', 'student')
  studentSession = student.session
  otherStudentSession = otherStudent.session

  const { data: school, error: schoolErr } = await db
    .from('schools').insert({ school_name: SYNTHETIC_MARKER, created_by: student.authId }).select('id').single()
  if (schoolErr) throw schoolErr
  schoolIds.push(school.id)

  const { data: learner, error: learnerErr } = await db
    .from('learners')
    .insert({ school_id: school.id, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Test', last_name: 'Learner' })
    .select('id').single()
  if (learnerErr) throw learnerErr
  coreLearnerId = learner.id
  learnerIds.push(learner.id)

  const { data: teacherRow, error: teacherErr } = await db
    .from('teachers').insert({ user_id: (await createUser('teacher')).authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherRowIds.push(teacherRow.id)

  const { data: studentRow, error: studentErr } = await db
    .from('students')
    .insert({
      teacher_id: teacherRow.id, name: SYNTHETIC_MARKER, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER,
      added_by: 'teacher', external_id: coreLearnerId, user_id: student.authId,
    })
    .select('id').single()
  if (studentErr) throw studentErr
  studentIds.push(studentRow.id)
})

after(async () => {
  await db.from('students').delete().in('id', studentIds)
  await db.from('teachers').delete().in('id', teacherRowIds)
  await db.from('learners').delete().in('id', learnerIds)
  await db.from('schools').delete().in('id', schoolIds)
  for (const id of authUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
  console.log('[cleanup] synthetic Sprint 6 Timeline fixtures removed')
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

test(`GET /student/timeline/[learnerId]: the learner's own account reaches it`, async () => {
  const res = await fetch(`${BASE_URL}/student/timeline/${coreLearnerId}`, { headers: cookie(studentSession), redirect: 'manual' })
  assert.equal(res.status, 200)
  const body = await res.text()
  assert.ok(body.includes('Timeline'))
  assert.ok(!body.includes('You do not have access to'))
})

test(`GET /student/timeline/[learnerId]: an unrelated student is denied`, async () => {
  const res = await fetch(`${BASE_URL}/student/timeline/${coreLearnerId}`, { headers: cookie(otherStudentSession), redirect: 'manual' })
  assert.equal(res.status, 200)
  const body = await res.text()
  assert.ok(body.includes('You do not have access to'))
})

test(`GET /student/timeline/[learnerId]: an unauthenticated request is redirected to login`, async () => {
  const res = await fetch(`${BASE_URL}/student/timeline/${coreLearnerId}`, { redirect: 'manual' })
  assert.equal(res.status, 307)
  assert.match(res.headers.get('location') ?? '', /\/login/)
})
