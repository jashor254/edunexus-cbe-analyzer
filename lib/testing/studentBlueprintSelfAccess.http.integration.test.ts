// lib/testing/studentBlueprintSelfAccess.http.integration.test.ts
//
// Sprint 6 (Learner Growth Experience Convergence) — proves a real,
// self-service student account can actually reach the content of their own
// canonical Blueprint page, not just a 200 status. Blocker #5's own routing
// test (studentPageRouting.http.integration.test.ts) never caught this: its
// synthetic student owns no `students` row, so `/student/blueprint` always
// short-circuits at the "no owned student" empty state before ever reaching
// `/student/blueprint/[learnerId]` — the page where the real bug lived.
//
// The bug: `/student/blueprint/[learnerId]` gated access with
// `requireSchoolStaff` (admin/headteacher/deputy/teacher only —
// `SchoolUserRole` has no `student` value, so no student ever has a
// `school_users` row). Every real student hit `PermissionDeniedError` on
// their own Blueprint. Fixed by switching to the new `requireLearnerAccess`
// (composes the existing, previously-unused `canViewLearner` with the
// existing `resolveLegacyStudentId` bridge — no new authorization pattern).
//
// This file tests both layers: the permission function directly against the
// live database (reliable, per the known Next.js notFound()/streaming quirk
// documented in parentExperienceConvergence.http.integration.test.ts), and
// the actual page body for the two distinguishable states.
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/testing/studentBlueprintSelfAccess.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { canViewLearnerRecord, requireLearnerAccess } from '@/lib/core/permissions'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_SPRINT6_BLUEPRINT_SELF_ACCESS_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 10)}`

const authUserIds: string[] = []
const schoolIds: string[] = []
const learnerIds: string[] = []
const studentIds: string[] = []
const teacherRowIds: string[] = []

let studentSession: SyntheticSession
let otherStudentSession: SyntheticSession
let studentEmail: string
let otherStudentEmail: string
let teacherRowId: string
let coreLearnerId: string
let legacyStudentId: string

async function createUser(label: string, profileRole?: 'student' | 'teacher'): Promise<{ authId: string; session: SyntheticSession; email: string }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  if (profileRole) {
    const { error: profileErr } = await db.from('profiles').upsert({ id: data.user.id, role: profileRole })
    if (profileErr) throw profileErr
  }
  const session = await signInForHttpTest(email, PASSWORD)
  return { authId: data.user.id, session, email }
}

async function signInClient(email: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

before(async () => {
  const student = await createUser('student', 'student')
  const otherStudent = await createUser('other-student', 'student')
  studentSession = student.session
  otherStudentSession = otherStudent.session
  studentEmail = student.email
  otherStudentEmail = otherStudent.email

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
  teacherRowId = teacherRow.id
  teacherRowIds.push(teacherRow.id)

  // Legacy student row, self-service bridged: user_id = the student's own auth id.
  const { data: studentRow, error: studentErr } = await db
    .from('students')
    .insert({
      teacher_id: teacherRowId, name: SYNTHETIC_MARKER, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER,
      added_by: 'teacher', external_id: coreLearnerId, user_id: student.authId,
    })
    .select('id').single()
  if (studentErr) throw studentErr
  legacyStudentId = studentRow.id
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
  console.log('[cleanup] synthetic Sprint 6 Blueprint self-access fixtures removed')
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

// ── The permission function itself, against the live database ──────────────

test('canViewLearnerRecord(coreLearnerId): the learner\'s own account is allowed', async () => {
  const client = await signInClient(studentEmail)
  const allowed = await canViewLearnerRecord(client, schoolIds[0], coreLearnerId)
  assert.equal(allowed, true)
})

test('requireLearnerAccess(coreLearnerId): the learner\'s own account does not throw', async () => {
  const client = await signInClient(studentEmail)
  const user = await requireLearnerAccess(client, schoolIds[0], coreLearnerId)
  assert.ok(user.id)
})

test('requireLearnerAccess(coreLearnerId): an unrelated student account is denied', async () => {
  const client = await signInClient(otherStudentEmail)
  await assert.rejects(() => requireLearnerAccess(client, schoolIds[0], coreLearnerId), ResourceOwnershipError)
})

// ── The actual page, over real HTTP ──────────────────────────────────────────
//
// Status alone can't distinguish these two cases in this Next.js version
// (both render as a real 200 page — no notFound() is involved in either
// branch), so this asserts on the distinguishing body text instead.

test('GET /student/blueprint/[learnerId]: the learner\'s own account sees the real Blueprint, not the denial screen', async () => {
  const res = await fetch(`${BASE_URL}/student/blueprint/${coreLearnerId}`, { headers: cookie(studentSession), redirect: 'manual' })
  assert.equal(res.status, 200)
  const body = await res.text()
  assert.ok(!body.includes('You do not have access to this Blueprint'), 'the learner\'s own Blueprint must not show the permission-denied screen')
  assert.ok(body.includes('Learner Blueprint'), 'the real Blueprint heading must render')
})

test('GET /student/blueprint/[learnerId]: an unrelated student account sees the denial screen, not the real Blueprint', async () => {
  const res = await fetch(`${BASE_URL}/student/blueprint/${coreLearnerId}`, { headers: cookie(otherStudentSession), redirect: 'manual' })
  assert.equal(res.status, 200)
  const body = await res.text()
  assert.ok(body.includes('You do not have access to this Blueprint'))
})
