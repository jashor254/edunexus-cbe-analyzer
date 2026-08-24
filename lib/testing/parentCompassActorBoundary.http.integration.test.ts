// lib/testing/parentCompassActorBoundary.http.integration.test.ts
//
// Parent Portal Phase P3.5 — closes P2's own named limitation: "the actual
// HTTP routes were not exercised end-to-end with a live `next dev` server
// in this pass" (docs/architecture/parent-portal-p2-compass-actor-boundary.md
// §23/§26). P2 proved the authorization boundary at the function level
// (lib/compass/compassActorBoundary.integration.test.ts, resolveCompassMutationAccess
// / resolveCompassStudentAccess called directly) — this file proves the SAME
// boundary at the HTTP layer, through the real routes a browser actually hits:
//
//   POST /api/learn        — parent MUST be denied (403), learner-self allowed
//   POST /api/learn/end    — parent MUST be denied (403), learner-self allowed (200)
//   GET  /api/learn/progress — parent MUST be allowed (200) for their own child
//   GET  /api/holiday/mine   — parent MUST be allowed (200) for their own child
//
// Both an institutional-only guardian (learner_guardians only, no
// students.parent_user_id) and a legacy guardian (parent_user_id only) are
// proven to get the SAME read behavior — the P2 fix's whole point. An
// unrelated parent is proven blocked everywhere. Run through
// scripts/parent-http/run-parent-http-harness.mjs, not manually.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'
import { deleteAuthUserOrThrow } from './deleteAuthUserOrThrow'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const MARKER = 'SYNTHETIC_P35_COMPASS_ACTOR_HTTP'
const db = createServiceClient()

const authUserIds: string[] = []
const schoolIds: string[] = []
const learnerIds: string[] = []
const studentIds: string[] = []
const teacherRowIds: string[] = []
const sessionIds: string[] = []

const PASSWORD = `Test!${Math.random().toString(36).slice(2, 10)}`

let teacherRowId: string

let institutionalParentSession: SyntheticSession
let legacyParentSession: SyntheticSession
let selfLearnerSession: SyntheticSession
let unrelatedParentSession: SyntheticSession

let institutionalStudentId: string // Phase 1C compatibility row, guardian only via learner_guardians
let legacyStudentId: string        // guardian only via students.parent_user_id
let selfStudentId: string          // self-login learner
let unrelatedStudentId: string     // belongs to nobody in this fixture (institutional, for the read-block proof)

let selfActiveSessionId: string    // real compass_sessions row for the learner-self mutation proof

async function createUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  const session = await signInForHttpTest(email, PASSWORD)
  return { authId: data.user.id, session }
}

// checkFeatureAccess falls through to token pricing for a plain 'parent'/
// default-role user with no subscription — every actor that calls a Compass
// route in this file needs a real token_balances row, or a 403
// ('insufficient_tokens') would be indistinguishable from the ownership 403
// this file is actually testing.
async function grantTokens(userId: string, balance = 100) {
  const { error } = await db.from('token_balances').upsert({ user_id: userId, balance }, { onConflict: 'user_id' })
  if (error) throw error
}

before(async () => {
  const teacherUser = await createUser('teacher')
  const { data: teacherRow, error: teacherErr } = await db.from('teachers')
    .insert({ user_id: teacherUser.authId, full_name: MARKER, school: MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherRowId = teacherRow.id
  teacherRowIds.push(teacherRowId)

  const { data: school, error: schoolErr } = await db.from('schools').insert({ school_name: `${MARKER}_school` }).select('id').single()
  if (schoolErr) throw schoolErr
  schoolIds.push(school.id)

  // ── Institutional family: guardian ONLY via learner_guardians ──────────────
  const instParent = await createUser('inst-parent')
  institutionalParentSession = instParent.session
  await grantTokens(instParent.authId)

  const { data: instLearner, error: instLearnerErr } = await db.from('learners')
    .insert({ school_id: school.id, admission_number: `${MARKER}-inst-001`, first_name: 'Institutional', last_name: 'Child' })
    .select('id').single()
  if (instLearnerErr) throw instLearnerErr
  learnerIds.push(instLearner.id)

  const { error: guardianErr } = await db.from('learner_guardians')
    .insert({ learner_id: instLearner.id, school_id: school.id, user_id: instParent.authId, relationship: 'mother', full_name: MARKER, phone: '0700000001' })
  if (guardianErr) throw guardianErr

  const { data: instStudent, error: instStudentErr } = await db.from('students')
    .insert({ teacher_id: teacherRowId, name: MARKER, grade: 8, level: 'Junior School', school: MARKER, added_by: 'teacher', external_id: instLearner.id, school_id: school.id })
    .select('id').single()
  if (instStudentErr) throw instStudentErr
  institutionalStudentId = instStudent.id
  studentIds.push(institutionalStudentId)

  // ── Legacy family: guardian ONLY via students.parent_user_id ────────────────
  const legacyParent = await createUser('legacy-parent')
  legacyParentSession = legacyParent.session
  await grantTokens(legacyParent.authId)

  const { data: legacyStudent, error: legacyErr } = await db.from('students')
    .insert({ teacher_id: teacherRowId, name: MARKER, grade: 8, level: 'Junior School', school: MARKER, added_by: 'teacher', parent_user_id: legacyParent.authId })
    .select('id').single()
  if (legacyErr) throw legacyErr
  legacyStudentId = legacyStudent.id
  studentIds.push(legacyStudentId)

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

  const { data: activeSession, error: sessErr } = await db.from('compass_sessions')
    .insert({ learner_id: selfStudentId, subject: 'mathematics', mode: 'school', status: 'active', exchange_count: 2, session_state: {} })
    .select('id').single()
  if (sessErr) throw sessErr
  selfActiveSessionId = activeSession.id
  sessionIds.push(selfActiveSessionId)

  // ── Unrelated parent + unrelated (institutional) child ──────────────────────
  const unrelatedParent = await createUser('unrelated-parent')
  unrelatedParentSession = unrelatedParent.session
  await grantTokens(unrelatedParent.authId)

  const { data: unrelatedLearner, error: unrelatedLearnerErr } = await db.from('learners')
    .insert({ school_id: school.id, admission_number: `${MARKER}-unrel-001`, first_name: 'Unrelated', last_name: 'Child' })
    .select('id').single()
  if (unrelatedLearnerErr) throw unrelatedLearnerErr
  learnerIds.push(unrelatedLearner.id)

  const { data: unrelatedStudent, error: unrelatedStudentErr } = await db.from('students')
    .insert({ teacher_id: teacherRowId, name: MARKER, grade: 8, level: 'Junior School', school: MARKER, added_by: 'teacher', external_id: unrelatedLearner.id, school_id: school.id })
    .select('id').single()
  if (unrelatedStudentErr) throw unrelatedStudentErr
  unrelatedStudentId = unrelatedStudent.id
  studentIds.push(unrelatedStudentId)
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort — see P3.5 closeout §21 named limitation */ } }
  // Compass-derived side effects (evidence rows fired via a background
  // .then() chain in /api/learn/end) are cleaned up best-effort by studentId
  // before the students/learners rows they FK to are removed, per this
  // phase's own fixture-teardown audit (mission Step 21).
  for (const id of studentIds) {
    await safely(() => db.from('learner_evidence').delete().eq('learner_id', id))
    await safely(() => db.from('compass_sessions').delete().eq('learner_id', id))
    await safely(() => db.from('student_learning_context').delete().eq('student_id', id))
  }
  for (const id of sessionIds) await safely(() => db.from('compass_sessions').delete().eq('id', id))
  for (const id of studentIds) await safely(() => db.from('students').delete().eq('id', id))
  for (const id of learnerIds) {
    await safely(() => db.from('learner_guardians').delete().eq('learner_id', id))
    await safely(() => db.from('learners').delete().eq('id', id))
  }
  for (const id of schoolIds) await safely(() => db.from('schools').delete().eq('id', id))
  for (const id of teacherRowIds) await safely(() => db.from('teachers').delete().eq('id', id))
  for (const u of authUserIds) await safely(() => deleteAuthUserOrThrow(db, u))
})

// ── POST /api/learn (mutation) ─────────────────────────────────────────────

test('POST /api/learn: institutional-only guardian is denied (403), not a silent stream', async () => {
  const res = await fetch(`${BASE_URL}/api/learn`, {
    method: 'POST',
    headers: { Cookie: institutionalParentSession.cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello', learnerId: institutionalStudentId }),
  })
  assert.equal(res.status, 403)
})

test('POST /api/learn: legacy guardian (parent_user_id) is denied (403)', async () => {
  const res = await fetch(`${BASE_URL}/api/learn`, {
    method: 'POST',
    headers: { Cookie: legacyParentSession.cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello', learnerId: legacyStudentId }),
  })
  assert.equal(res.status, 403)
})

test('POST /api/learn: an unrelated parent is denied (403)', async () => {
  const res = await fetch(`${BASE_URL}/api/learn`, {
    method: 'POST',
    headers: { Cookie: unrelatedParentSession.cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello', learnerId: institutionalStudentId }),
  })
  assert.equal(res.status, 403)
})

// ── POST /api/learn/end (mutation) ──────────────────────────────────────────

test('POST /api/learn/end: institutional-only guardian is denied (403), not permitted to close the session', async () => {
  const res = await fetch(`${BASE_URL}/api/learn/end`, {
    method: 'POST',
    headers: { Cookie: institutionalParentSession.cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: crypto.randomUUID(), studentId: institutionalStudentId, status: 'abandoned', durationSeconds: 30 }),
  })
  assert.equal(res.status, 403)
})

test('POST /api/learn/end: legacy guardian is denied (403)', async () => {
  const res = await fetch(`${BASE_URL}/api/learn/end`, {
    method: 'POST',
    headers: { Cookie: legacyParentSession.cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: crypto.randomUUID(), studentId: legacyStudentId, status: 'abandoned', durationSeconds: 30 }),
  })
  assert.equal(res.status, 403)
})

test('POST /api/learn/end: learner-self mutation is still allowed (200, not 403) — the whole point of Compass', async () => {
  const res = await fetch(`${BASE_URL}/api/learn/end`, {
    method: 'POST',
    headers: { Cookie: selfLearnerSession.cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: selfActiveSessionId, studentId: selfStudentId, status: 'abandoned', durationSeconds: 45 }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.ended, true)
})

// ── GET /api/learn/progress (read) — the P2 fix's whole point ──────────────

test('GET /api/learn/progress: institutional-only guardian sees their own child (200) — was 403 before the P2 fix', async () => {
  const res = await fetch(`${BASE_URL}/api/learn/progress?studentId=${institutionalStudentId}`, {
    headers: { Cookie: institutionalParentSession.cookieHeader },
  })
  assert.equal(res.status, 200)
})

test('GET /api/learn/progress: legacy guardian sees their own child (200) — same read behavior as institutional', async () => {
  const res = await fetch(`${BASE_URL}/api/learn/progress?studentId=${legacyStudentId}`, {
    headers: { Cookie: legacyParentSession.cookieHeader },
  })
  assert.equal(res.status, 200)
})

test('GET /api/learn/progress: an unrelated parent is denied (403)', async () => {
  const res = await fetch(`${BASE_URL}/api/learn/progress?studentId=${institutionalStudentId}`, {
    headers: { Cookie: unrelatedParentSession.cookieHeader },
  })
  assert.equal(res.status, 403)
})

// ── GET /api/holiday/mine (read) ────────────────────────────────────────────

test('GET /api/holiday/mine: institutional-only guardian sees their own child (200)', async () => {
  const res = await fetch(`${BASE_URL}/api/holiday/mine?studentId=${institutionalStudentId}`, {
    headers: { Cookie: institutionalParentSession.cookieHeader },
  })
  assert.equal(res.status, 200)
})

test('GET /api/holiday/mine: legacy guardian sees their own child (200) — same read behavior as institutional', async () => {
  const res = await fetch(`${BASE_URL}/api/holiday/mine?studentId=${legacyStudentId}`, {
    headers: { Cookie: legacyParentSession.cookieHeader },
  })
  assert.equal(res.status, 200)
})

test('GET /api/holiday/mine: an unrelated parent is denied (403), not silently empty', async () => {
  const res = await fetch(`${BASE_URL}/api/holiday/mine?studentId=${institutionalStudentId}`, {
    headers: { Cookie: unrelatedParentSession.cookieHeader },
  })
  assert.equal(res.status, 403)
})

test('GET /api/holiday/mine: unauthenticated request is not a silent 200', async () => {
  const res = await fetch(`${BASE_URL}/api/holiday/mine?studentId=${unrelatedStudentId}`)
  assert.equal(res.status, 401)
})
