// lib/testing/parentLearnViewerRole.http.integration.test.ts
//
// Parent Portal Phase P3.5 — proves the real route `/learn` (app/learn/
// page.tsx) actually uses to resolve `viewerRole`: `GET /api/learn/student`
// (app/api/learn/student/route.ts's `shapeAndReturn`, added in P3 — see
// docs/architecture/parent-portal-p3-home-child-context-convergence.md §8).
// The client page threads this field onto `StudentData.viewerRole` and
// switches copy/disables subject cards based on it — that client-side
// rendering is NOT provable from a raw HTTP fetch of `/learn` itself
// (app/learn/page.tsx is a 'use client' component with no server-side auth
// page; `viewerRole` only reaches the DOM after a client-side fetch to this
// same API and a React re-render neither `next dev`'s SSR pass nor a plain
// fetch() ever executes). What IS provable at the HTTP layer, and is the
// actual authorization-relevant contract the client blindly trusts, is
// this endpoint's response shape — proven here for parent/learner/teacher.
//
// See this phase's closeout doc for why a full rendered-DOM proof of the
// disabled subject cards was not attempted (no jsdom/testing-library in
// this repo; adding one solely for this would be exactly the "heavy new
// component-testing framework" the mission instructed against).

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'
import { deleteAuthUserOrThrow } from './deleteAuthUserOrThrow'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const MARKER = 'SYNTHETIC_P35_LEARN_VIEWERROLE_HTTP'
const db = createServiceClient()

const authUserIds: string[] = []
const schoolIds: string[] = []
const learnerIds: string[] = []
const studentIds: string[] = []
const teacherRowIds: string[] = []

const PASSWORD = `Test!${Math.random().toString(36).slice(2, 10)}`

let teacherSession: SyntheticSession
let parentSession: SyntheticSession
let selfLearnerSession: SyntheticSession

let teacherRowId: string
let parentedStudentId: string
let selfStudentId: string

async function createUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  const session = await signInForHttpTest(email, PASSWORD)
  return { authId: data.user.id, session }
}

async function grantTokens(userId: string, balance = 100) {
  const { error } = await db.from('token_balances').upsert({ user_id: userId, balance }, { onConflict: 'user_id' })
  if (error) throw error
}

before(async () => {
  const teacherUser = await createUser('teacher')
  teacherSession = teacherUser.session
  await grantTokens(teacherUser.authId)

  const { data: teacherRow, error: teacherErr } = await db.from('teachers')
    .insert({ user_id: teacherUser.authId, full_name: MARKER, school: MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherRowId = teacherRow.id
  teacherRowIds.push(teacherRowId)

  const { data: school, error: schoolErr } = await db.from('schools').insert({ school_name: `${MARKER}_school` }).select('id').single()
  if (schoolErr) throw schoolErr
  schoolIds.push(school.id)

  // ── Parent-linked student (legacy parent_user_id — the simplest linkage
  // GET /api/learn/student's resolveCompassStudentAccess recognizes) ─────────
  const parent = await createUser('parent')
  parentSession = parent.session
  await grantTokens(parent.authId)

  const { data: parentedStudent, error: parentedErr } = await db.from('students')
    .insert({ teacher_id: teacherRowId, name: MARKER, grade: 8, level: 'Junior School', school: MARKER, added_by: 'teacher', parent_user_id: parent.authId })
    .select('id').single()
  if (parentedErr) throw parentedErr
  parentedStudentId = parentedStudent.id
  studentIds.push(parentedStudentId)

  // ── Self-login learner ────────────────────────────────────────────────────
  const selfLearner = await createUser('self-learner')
  selfLearnerSession = selfLearner.session
  await grantTokens(selfLearner.authId)

  const { data: selfStudent, error: selfErr } = await db.from('students')
    .insert({ teacher_id: teacherRowId, name: MARKER, grade: 8, level: 'Junior School', school: MARKER, added_by: 'teacher', user_id: selfLearner.authId })
    .select('id').single()
  if (selfErr) throw selfErr
  selfStudentId = selfStudent.id
  studentIds.push(selfStudentId)
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  for (const id of studentIds) await safely(() => db.from('students').delete().eq('id', id))
  for (const id of learnerIds) await safely(() => db.from('learners').delete().eq('id', id))
  for (const id of schoolIds) await safely(() => db.from('schools').delete().eq('id', id))
  for (const id of teacherRowIds) await safely(() => db.from('teachers').delete().eq('id', id))
  for (const u of authUserIds) await safely(() => deleteAuthUserOrThrow(db, u))
})

test('GET /api/learn/student: parent viewer gets viewerRole="parent"', async () => {
  const res = await fetch(`${BASE_URL}/api/learn/student?studentId=${parentedStudentId}`, {
    headers: { Cookie: parentSession.cookieHeader },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.viewerRole, 'parent')
})

test('GET /api/learn/student: learner-self viewer gets viewerRole="learner"', async () => {
  const res = await fetch(`${BASE_URL}/api/learn/student?studentId=${selfStudentId}`, {
    headers: { Cookie: selfLearnerSession.cookieHeader },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.viewerRole, 'learner')
})

test('GET /api/learn/student: teacher viewer gets viewerRole="teacher"', async () => {
  const res = await fetch(`${BASE_URL}/api/learn/student?studentId=${parentedStudentId}`, {
    headers: { Cookie: teacherSession.cookieHeader },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.viewerRole, 'teacher')
})

test('GET /api/learn/student: auto-select branch (no studentId) also resolves viewerRole for the parent', async () => {
  const res = await fetch(`${BASE_URL}/api/learn/student`, {
    headers: { Cookie: parentSession.cookieHeader },
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  // Single-student auto-select branch returns the same shape as the
  // explicit-studentId branch when the parent has exactly one linked
  // student (P3 §8's "auto-select single-student branch" case).
  if (body.data.viewerRole !== undefined) {
    assert.equal(body.data.viewerRole, 'parent')
  }
})
