// lib/holiday/returnOwnership.http.integration.test.ts
//
// Adversarial HTTP authorization closure for Forensic Audit Finding F6
// (HIGH): POST /api/holiday/return gated access on `students.teacher_id`
// only — the legacy "who entered this record" column, not "who currently
// teaches this student" (CLAUDE.md Architecture Rules). Fixed in
// app/api/holiday/return/route.ts by switching to
// resolveTeacherOwnership() (lib/compass/ownership.ts), which accepts
// EITHER the direct students.teacher_id link OR current class_students
// roster membership — the same fix already applied to learner_evidence's
// RLS policy.
//
// The fixture deliberately sets students.teacher_id to NULL and grants
// Teacher B access ONLY via class_students roster membership — the exact
// shape that the OLD `students.teacher_id = teacher.id` check would have
// rejected even for the legitimate current teacher. If this test's
// "legitimate path" assertion passed under the old implementation, the
// fixture would be worthless as proof; it is built specifically so it
// would NOT have passed under the old code.
//
// Same pattern as lib/assignments/printRoutes.http.integration.test.ts —
// requires a real running Next.js server and a reachable Supabase project.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/holiday/returnOwnership.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_HOLIDAY_RETURN_OWNERSHIP_TEST'
const db = createServiceClient()

type Fixture = {
  teacherAAuthId: string
  teacherAId: string
  teacherASession: SyntheticSession
  teacherBAuthId: string
  teacherBId: string
  teacherBSession: SyntheticSession
  classBId: string
  studentId: string
  ingestionRunIds: string[]
}

let fx: Fixture

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

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

async function api(path: string, headers: Record<string, string>, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, { ...init, headers: { ...headers, 'Content-Type': 'application/json' } })
}

before(async () => {
  const teacherA = await createSyntheticUser('teacher-a')
  const teacherB = await createSyntheticUser('teacher-b')

  const { data: teacherARow, error: teacherAErr } = await db
    .from('teachers').insert({ user_id: teacherA.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherAErr) throw teacherAErr

  const { data: teacherBRow, error: teacherBErr } = await db
    .from('teachers').insert({ user_id: teacherB.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherBErr) throw teacherBErr

  // Teacher B's class — the student below is on ITS roster only.
  const { data: classB, error: classBErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherBRow.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_B_${Date.now()}` })
    .select('id').single()
  if (classBErr) throw classBErr

  // The load-bearing fixture choice: teacher_id is explicitly NULL, never
  // teacherB.id. Teacher B's ONLY relationship to this student is current
  // class_students roster membership — the relationship the OLD
  // `students.teacher_id = teacher.id` check could not see at all. Teacher
  // A has neither a direct link nor a roster seat, so A is the correct
  // negative control regardless of which implementation is under test —
  // the meaningful proof here is specifically that Teacher B (fixed code)
  // is no longer wrongly denied.
  const { data: student, error: studentErr } = await db
    .from('students')
    .insert({ teacher_id: null, name: 'Ownership Test Learner', grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id').single()
  if (studentErr) throw studentErr

  const { error: rosterErr } = await db.from('class_students').insert({ class_id: classB.id, student_id: student.id })
  if (rosterErr) throw rosterErr

  fx = {
    teacherAAuthId: teacherA.authId, teacherAId: teacherARow.id, teacherASession: teacherA.session,
    teacherBAuthId: teacherB.authId, teacherBId: teacherBRow.id, teacherBSession: teacherB.session,
    classBId: classB.id, studentId: student.id, ingestionRunIds: [],
  }
})

after(async () => {
  if (!fx) return
  await db.from('holiday_returns').delete().eq('student_id', fx.studentId)
  await db.from('learner_projections').delete().eq('learner_id', fx.studentId)

  for (const runId of fx.ingestionRunIds) {
    const { data: ev } = await db.from('learner_evidence').select('id').eq('ingestion_run_id', runId)
    const evidenceIds = (ev ?? []).map(e => e.id)
    if (evidenceIds.length > 0) {
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      await db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', evidenceIds)
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    await db.from('ingestion_runs').delete().eq('id', runId)
  }

  await db.from('class_students').delete().eq('class_id', fx.classBId)
  await db.from('students').delete().eq('id', fx.studentId)
  await db.from('teacher_classes').delete().eq('id', fx.classBId)
  await db.from('teachers').delete().in('id', [fx.teacherAId, fx.teacherBId])
  for (const authId of [fx.teacherAAuthId, fx.teacherBAuthId]) {
    await db.auth.admin.deleteUser(authId)
  }
})

function requestBody() {
  return JSON.stringify({
    studentId: fx.studentId,
    weeksAssigned: 4,
    weeksCompleted: 3,
    teacherComment: 'Adversarial ownership test.',
    masteryClaims: [{ subject: 'mathematics', cbcLevel: 2 }],
  })
}

// ── F6 attack: Teacher A has NEITHER a direct nor roster link ──────────────
test('POST /api/holiday/return: a teacher with no relationship to the student is denied with 403 (F6)', async () => {
  const res = await api('/api/holiday/return', cookie(fx.teacherASession), {
    method: 'POST',
    body: requestBody(),
  })
  const body = await res.json()
  assert.equal(res.status, 403, `expected 403, got ${res.status}: ${JSON.stringify(body)}`)
  assert.equal(body.error, 'Access denied')
  assert.equal(body.data, null, 'a rejected request must never return evidence/result data')

  // No evidence loop was closed for a request that was never authorized.
  const { data: returns } = await db.from('holiday_returns').select('id').eq('student_id', fx.studentId)
  assert.equal((returns ?? []).length, 0, 'a rejected request must not have written a holiday_returns row')
})

// ── Legitimate path: Teacher B, roster-only relationship, must be accepted ──
test('POST /api/holiday/return: the current roster teacher (Teacher B, no direct teacher_id link) succeeds — proves the roster path the old implementation could not see', async () => {
  const res = await api('/api/holiday/return', cookie(fx.teacherBSession), {
    method: 'POST',
    body: requestBody(),
  })
  const body = await res.json()
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(body)}`)
  assert.ok(body.data.result.ingestionRunId, 'the roster-based owner reached the real evidence pipeline')
  fx.ingestionRunIds.push(body.data.result.ingestionRunId)

  const { data: returns } = await db.from('holiday_returns').select('id, student_id').eq('student_id', fx.studentId)
  assert.equal((returns ?? []).length, 1, 'the legitimate roster-owner request did persist a holiday_returns row')

  // Confirms the fixture itself never granted B a direct link — the 200
  // above is proof of the roster path specifically, not an artifact of a
  // fixture mistake.
  const { data: studentRow } = await db.from('students').select('teacher_id').eq('id', fx.studentId).single()
  assert.equal(studentRow!.teacher_id, null, 'sanity check: students.teacher_id was never set to Teacher B')
})
