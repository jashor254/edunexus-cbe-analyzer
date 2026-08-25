// app/api/students/create/route.http.integration.test.ts
//
// Error-Handling Trust Fix — proves app/api/students/create/route.ts no
// longer returns raw Postgres/Supabase error text to the client on an
// insert failure.
//
// Learner Pathway Contract Fix — the "bad-pathway forces a DB error" test
// that used to live here (`current_pathway: 'Arts & Sports Science'`
// violating the live CHECK constraint) is now obsolete: that constraint was
// the bug, and it's fixed (`supabase/migrations/20260803160000_fix_students_
// pathway_constraint.sql`). Replaced with a test proving every canonical
// `SENIOR_PATHWAYS` value — including that exact value — now succeeds
// end-to-end, plus a genuinely-unknown pathway still fails safe validation.
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939).
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test app/api/students/create/route.http.integration.test.ts
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'
import { SENIOR_PATHWAYS } from '@/lib/curriculum/subjects'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_STUDENTS_CREATE_ROUTE_TEST'
const db = createServiceClient()

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

const createdUserIds: string[] = []
const createdStudentIds: string[] = []

after(async () => {
  if (createdStudentIds.length) await db.from('students').delete().in('id', createdStudentIds)
  for (const id of createdUserIds) await db.auth.admin.deleteUser(id)
})

test('an unknown pathway value fails safe Zod validation, not a raw DB error', async () => {
  const { authId, session } = await createSyntheticUser('unknown-pathway')
  createdUserIds.push(authId)

  const res = await fetch(`${BASE_URL}/api/students/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify({
      name: `${SYNTHETIC_MARKER} Learner`,
      grade: 11,
      current_pathway: 'Not A Real Pathway',
    }),
  })

  assert.equal(res.status, 400, 'an unknown pathway must fail application validation, not reach the DB')
  const body = await res.json()
  assert.notEqual(body.success, true)

  const raw = JSON.stringify(body).toLowerCase()
  for (const leak of ['constraint', 'violates', 'check_', 'postgres', 'sql', '23514']) {
    assert.ok(!raw.includes(leak), `response must not contain raw DB error text ("${leak}" found in ${raw})`)
  }

  const { data: row } = await db.from('students').select('id').eq('user_id', authId).maybeSingle()
  assert.equal(row, null, 'no student row should have been persisted for the rejected input')
})

test('Learner Pathway Contract Fix: every canonical pathway succeeds end-to-end, including the previously-broken "Arts & Sports Science"', async () => {
  for (const pathway of SENIOR_PATHWAYS) {
    const { authId, session } = await createSyntheticUser(`pathway-${pathway.replace(/\W+/g, '-')}`)
    createdUserIds.push(authId)

    const res = await fetch(`${BASE_URL}/api/students/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
      body: JSON.stringify({ name: `${SYNTHETIC_MARKER} Learner`, grade: 11, current_pathway: pathway }),
    })
    assert.equal(res.status, 201, `pathway "${pathway}" (accepted by application validation) must also be accepted end-to-end by the route+DB`)
    const body = await res.json()
    assert.equal(body.data.student.current_pathway, pathway)
    createdStudentIds.push(body.data.student.id)
  }
})

test('a valid creation still succeeds end-to-end (regression guard)', async () => {
  const { authId, session } = await createSyntheticUser('valid')
  createdUserIds.push(authId)

  const res = await fetch(`${BASE_URL}/api/students/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify({ name: `${SYNTHETIC_MARKER} Learner`, grade: 9 }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.success, true)
  createdStudentIds.push(body.data.student.id)
})
