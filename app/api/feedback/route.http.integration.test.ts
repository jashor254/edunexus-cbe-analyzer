// app/api/feedback/route.http.integration.test.ts
//
// Error-Handling Trust Fix — proves app/api/feedback/route.ts no longer
// reports `success: true` when the `user_feedback` insert fails, and that
// the failure response never leaks the raw Postgres/Supabase error text.
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939).
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test app/api/feedback/route.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_FEEDBACK_ROUTE_TEST'
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

after(async () => {
  if (createdUserIds.length) await db.from('user_feedback').delete().in('user_id', createdUserIds)
  for (const id of createdUserIds) await db.auth.admin.deleteUser(id)
})

test('a valid feedback submission returns success and is actually persisted', async () => {
  const { authId, session } = await createSyntheticUser('valid')
  createdUserIds.push(authId)

  const res = await fetch(`${BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify({ trigger: 'after_report', rating: 'helpful', npsScore: 8 }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)

  const { data: row } = await db.from('user_feedback').select('id').eq('user_id', authId).maybeSingle()
  assert.ok(row, 'the feedback row must actually be persisted, not just reported as saved')
})

test('a feedback submission that fails the rating CHECK constraint does not report success', async () => {
  const { authId, session } = await createSyntheticUser('failed-insert')
  createdUserIds.push(authId)

  // `rating` accepts any string at the Zod layer, but the DB CHECK constraint
  // only allows 'helpful'/'not_helpful' — this deterministically forces a
  // real Postgres insert failure without touching auth or route internals.
  const res = await fetch(`${BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify({ trigger: 'after_report', rating: 'not-a-real-rating', npsScore: 5 }),
  })

  assert.notEqual(res.status, 200, 'a failed insert must not return a 2xx status')
  const body = await res.json()
  assert.notEqual(body.success, true, 'a failed insert must never report success: true')

  const { data: row } = await db.from('user_feedback').select('id').eq('user_id', authId).maybeSingle()
  assert.equal(row, null, 'no row should have been persisted for the rejected insert')
})

test('the failed-insert response does not leak raw Postgres/Supabase error text', async () => {
  const { authId, session } = await createSyntheticUser('no-leak')
  createdUserIds.push(authId)

  const res = await fetch(`${BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify({ trigger: 'after_report', rating: 'still-not-real', npsScore: 5 }),
  })
  const body = await res.json()
  const raw = JSON.stringify(body).toLowerCase()

  for (const leak of ['constraint', 'violates', 'check_', 'postgres', 'column', 'sql', '23514']) {
    assert.ok(!raw.includes(leak), `response must not contain raw DB error text ("${leak}" found in ${raw})`)
  }
})
