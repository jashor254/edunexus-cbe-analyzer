// lib/remedial/generateRoute.http.integration.test.ts
//
// Adversarial HTTP authorization closure for Forensic Audit Finding F1
// (CRITICAL): POST /api/remedial/generate accepted a `classId` without
// verifying the authenticated teacher currently owns/teaches that class,
// letting any teacher with a real `sowId` pull another class's roster and
// learner profiles into their own plan. Fixed in
// app/api/remedial/generate/route.ts with a `teacher_classes` ownership
// check before generateRemedialPlan() ever runs.
//
// Same pattern as lib/assignments/printRoutes.http.integration.test.ts:
// requires a real running Next.js server (route handlers read the session
// via next/headers cookies(), which only resolves inside an actual
// request) and a reachable Supabase project.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/remedial/generateRoute.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_REMEDIAL_IDOR_TEST'
const db = createServiceClient()

type Fixture = {
  teacherAAuthId: string
  teacherAId: string
  teacherASession: SyntheticSession
  teacherBAuthId: string
  teacherBId: string
  teacherBSession: SyntheticSession
  classAId: string
  classBId: string
  sowAId: string
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

  // checkFeatureAccess() falls through role/subscription checks to a real
  // token balance for a synthetic user with no profiles/subscription row.
  // Seeded generously on BOTH teachers so neither adversarial nor
  // legitimate request can be rejected for "insufficient_tokens" — that
  // would return the same 403 status as the ownership check and make the
  // test's central assertion ambiguous (exactly the false-positive risk
  // this test exists to rule out). The response body's error MESSAGE is
  // also asserted below, as a second, independent signal that the 403 came
  // from the ownership check specifically, not from billing.
  const { error: balAErr } = await db.from('token_balances').insert({ user_id: teacherA.authId, balance: 1000 })
  if (balAErr) throw balAErr
  const { error: balBErr } = await db.from('token_balances').insert({ user_id: teacherB.authId, balance: 1000 })
  if (balBErr) throw balBErr

  // Teacher A owns Class A and a real SOW (required so the ONLY thing that
  // can fail is the classId check under attack, never the pre-existing
  // sowId ownership check).
  const { data: classA, error: classAErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherARow.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_A_${Date.now()}` })
    .select('id').single()
  if (classAErr) throw classAErr

  const { data: sowA, error: sowAErr } = await db
    .from('schemes_of_work')
    .insert({
      teacher_id: teacherARow.id, school: SYNTHETIC_MARKER, grade: '8', learning_area: SYNTHETIC_MARKER,
      term: 1, year: 2026, curriculum_mode: 'cbc_junior', lessons_per_week: 4, lessons: [], timeline: [],
    })
    .select('id').single()
  if (sowAErr) throw sowAErr

  // Teacher B owns Class B — the class Teacher A will attempt to attack.
  const { data: classB, error: classBErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherBRow.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_B_${Date.now()}` })
    .select('id').single()
  if (classBErr) throw classBErr

  fx = {
    teacherAAuthId: teacherA.authId, teacherAId: teacherARow.id, teacherASession: teacherA.session,
    teacherBAuthId: teacherB.authId, teacherBId: teacherBRow.id, teacherBSession: teacherB.session,
    classAId: classA.id, classBId: classB.id, sowAId: sowA.id,
  }
})

after(async () => {
  if (!fx) return
  // generateRemedialPlan() never persists (confirmed by reading
  // lib/remedial/planner.ts — no insert/upsert call anywhere in it or in
  // the route); nothing plan-related to clean up beyond the fixture rows
  // below.
  await db.from('schemes_of_work').delete().eq('id', fx.sowAId)
  await db.from('teacher_classes').delete().in('id', [fx.classAId, fx.classBId])
  await db.from('teachers').delete().in('id', [fx.teacherAId, fx.teacherBId])
  await db.from('token_balances').delete().in('user_id', [fx.teacherAAuthId, fx.teacherBAuthId])
  for (const authId of [fx.teacherAAuthId, fx.teacherBAuthId]) {
    await db.auth.admin.deleteUser(authId)
  }
})

function requestBody(sowId: string, classId: string) {
  return JSON.stringify({
    sowId, classId,
    strand: 'Numbers', subStrand: 'Fractions', subject: 'Mathematics',
    term: 1, year: 2026, currentWeek: 3, weeksRemaining: 5,
  })
}

let balanceBeforeAttack: number
let balanceAfterAttack: number

// ── F1 attack: Teacher A's own real sowId + Teacher B's classId ────────────
test('POST /api/remedial/generate: a teacher who does not own classId is denied with 403 (F1)', async () => {
  const { data: before } = await db.from('token_balances').select('balance').eq('user_id', fx.teacherAAuthId).single()
  balanceBeforeAttack = before!.balance as number

  const res = await api('/api/remedial/generate', cookie(fx.teacherASession), {
    method: 'POST',
    body: requestBody(fx.sowAId, fx.classBId),
  })
  const responseBody = await res.json()

  assert.equal(res.status, 403, `expected 403, got ${res.status}: ${JSON.stringify(responseBody)}`)
  // Distinguishes an ownership rejection (apiForbidden() -> "Access denied")
  // from a billing rejection ("Insufficient tokens...") — both are 403, so
  // status alone would not prove WHICH boundary fired. Both teachers were
  // seeded with 1000 tokens specifically so this could never be the
  // billing message; asserting it anyway makes the distinction explicit
  // rather than merely implicit in the fixture.
  assert.equal(responseBody.error, 'Access denied')

  const { data: after } = await db.from('token_balances').select('balance').eq('user_id', fx.teacherAAuthId).single()
  balanceAfterAttack = after!.balance as number
})

test('F1 side-effect check: the rejected cross-class request deducted no tokens and leaked no plan data', async () => {
  assert.equal(balanceAfterAttack, balanceBeforeAttack, 'a 403 must never deduct tokens')

  // generateRemedialPlan() DOES persist, via upsertRemedialPlan() ->
  // remedial_plans (lib/repositories/learner-intelligence.repository.ts:83-107)
  // — corrected after the forensic persistence investigation; an earlier
  // pass believed there was no persistence step at all. `remedial_actions`
  // remains a DIFFERENT feature's table (lib/teachingIntelligence/
  // remedialBank.ts), not this route's. The meaningful side-effect proof
  // for a REJECTED request is: no token deducted (checked above), no plan
  // data in the response (checked in the 403 test itself via
  // responseBody.data === null), and — the strongest proof — no row
  // written to remedial_plans at all, asserted explicitly here.
  const res = await api('/api/remedial/generate', cookie(fx.teacherASession), {
    method: 'POST',
    body: requestBody(fx.sowAId, fx.classBId),
  })
  const responseBody = await res.json()
  assert.equal(responseBody.data, null, 'a rejected request must never return plan data')

  const { data: rows } = await db.from('remedial_plans').select('id').eq('sow_id', fx.sowAId)
  assert.equal((rows ?? []).length, 0, 'a rejected cross-class request must not have persisted a plan (sowAId is unique to this fixture)')
})

// ── Legitimate path: Teacher B, own classId, full success contract ─────────
//
// Previously this test could only assert "not 403" — a real, separate,
// pre-existing bug (remedial_plans had no unique index matching
// upsertRemedialPlan()'s onConflict target, so persistence threw a 500
// unconditionally, for every caller, regardless of authorization) made a
// literal 200 unreachable. Fixed by migration
// 20260903102207_remedial_plans_unique_upsert_key.sql, verified locally at
// the catalog level (CREATE UNIQUE INDEX ... ON remedial_plans (sow_id,
// teacher_id, sub_strand, term, year), confirmed via pg_index) and via a
// direct SQL ON CONFLICT reproduction before this test file was updated to
// assert the real success contract instead of merely "not blocked."
let sowBId: string
let firstSavedPlanId: string

test('POST /api/remedial/generate: the owning teacher (Teacher B) generates and persists a real plan', async () => {
  const { data: sowB, error: sowBErr } = await db
    .from('schemes_of_work')
    .insert({
      teacher_id: fx.teacherBId, school: SYNTHETIC_MARKER, grade: '8', learning_area: SYNTHETIC_MARKER,
      term: 1, year: 2026, curriculum_mode: 'cbc_junior', lessons_per_week: 4, lessons: [], timeline: [],
    })
    .select('id').single()
  if (sowBErr) throw sowBErr
  sowBId = sowB.id

  const res = await api('/api/remedial/generate', cookie(fx.teacherBSession), {
    method: 'POST',
    body: requestBody(sowBId, fx.classBId),
  })
  const responseBody = await res.json()

  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(responseBody)}`)
  assert.ok(responseBody.data.plan, 'a real plan was generated')
  assert.equal(responseBody.data.plan.class_id, fx.classBId)
  assert.ok(responseBody.data.plan.id, 'the plan carries a real persisted id (savedId), not null')
  firstSavedPlanId = responseBody.data.plan.id

  const { data: rows } = await db.from('remedial_plans').select('id').eq('sow_id', sowBId).eq('teacher_id', fx.teacherBId)
  assert.equal((rows ?? []).length, 1, 'exactly one row was persisted for this key')
  assert.equal(rows![0].id, firstSavedPlanId, 'the persisted row id matches the id the route returned')
})

// ── Regeneration / upsert semantics (mandatory per this task) ──────────────
test('POST /api/remedial/generate: regenerating for the same key updates the same row, never creates a second one', async () => {
  const res = await api('/api/remedial/generate', cookie(fx.teacherBSession), {
    method: 'POST',
    body: requestBody(sowBId, fx.classBId),
  })
  const responseBody = await res.json()

  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(responseBody)}`)
  assert.equal(responseBody.data.plan.id, firstSavedPlanId, 'regeneration returned the SAME savedId as the first generation — an update, not a new row')

  const { data: rows } = await db.from('remedial_plans').select('id').eq('sow_id', sowBId).eq('teacher_id', fx.teacherBId)
  assert.equal((rows ?? []).length, 1, 'still exactly one row for this key after a second generation — no duplicate created')
  assert.equal(rows![0].id, firstSavedPlanId)

  await db.from('remedial_plans').delete().eq('sow_id', sowBId)
  await db.from('schemes_of_work').delete().eq('id', sowBId)
})
