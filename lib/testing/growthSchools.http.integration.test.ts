// lib/testing/growthSchools.http.integration.test.ts
//
// Sprint C0 (docs/growth-os/) — route-level (HTTP) proof for the highest-risk
// property of the whole Growth Engine at this stage: no app/api/growth/*
// route is reachable without a real session, and a real authenticated call
// round-trips through requireGrowthUser -> self-registration -> the school
// service correctly.
//
// Same convention as lib/testing/clinicDownload.http.integration.test.ts —
// hits a real running Next.js server since utils/supabase/server.ts's
// createClient() reads the session via next/headers cookies().
//
// Run: TEST_BASE_URL=http://localhost:3100 NODE_OPTIONS=--dns-result-order=ipv4first npx tsx --test lib/testing/growthSchools.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const MARKER = 'SYNTHETIC_GROWTH_C0_HTTP_TEST'
const db = createServiceClient()

const authUserIds: string[] = []
const schoolIds: string[] = []
let founder: { authId: string; session: SyntheticSession }

before(async () => {
  const email = `${MARKER.toLowerCase()}-${Date.now()}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`setup: ${error?.message}`)
  authUserIds.push(data.user.id)
  const session = await signInForHttpTest(email, password)
  founder = { authId: data.user.id, session }

  // Sprint PR-2 (Founder Boundary Security) restricted requireGrowthUser()'s
  // self-registration to whoever GROWTH_FOUNDER_EMAIL names — a synthetic
  // test account can no longer self-register through the route. Pre-seed a
  // growth_users row directly, the same "existing row short-circuits before
  // the email check" path lib/growth/auth.test.ts proves at the unit level —
  // this file's job is the authenticated HTTP round-trip, not re-asserting
  // the founder-email policy itself.
  const { error: seedErr } = await db.from('growth_users').insert({ id: data.user.id, full_name: 'Synthetic Founder', role: 'founder' })
  if (seedErr) throw new Error(`setup: could not seed growth_users: ${seedErr.message}`)
})

after(async () => {
  for (const id of schoolIds) await db.from('growth_schools').delete().eq('id', id)
  for (const id of authUserIds) {
    await db.from('growth_users').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

test('GET /api/growth/schools with no session returns 401', async () => {
  const res = await fetch(`${BASE_URL}/api/growth/schools`)
  assert.equal(res.status, 401)
  const json = await res.json()
  assert.equal(json.success, false)
})

test('POST /api/growth/schools with no session returns 401 and creates no row', async () => {
  const res = await fetch(`${BASE_URL}/api/growth/schools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${MARKER} Should Not Exist` }),
  })
  assert.equal(res.status, 401)
  const { data } = await db.from('growth_schools').select('id').ilike('name', `${MARKER} Should Not Exist`)
  assert.equal(data?.length ?? 0, 0)
})

test('authenticated POST /api/growth/schools creates a school for the registered founder', async () => {
  const res = await fetch(`${BASE_URL}/api/growth/schools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: founder.session.cookieHeader },
    body: JSON.stringify({ name: `${MARKER} Real School`, county: 'Nairobi' }),
  })
  assert.equal(res.status, 201)
  const json = await res.json()
  assert.equal(json.success, true)
  assert.equal(json.data.school.county, 'Nairobi')
  assert.equal(json.data.school.pipeline_stage, 'research')
  schoolIds.push(json.data.school.id)

  const { data: growthUser } = await db.from('growth_users').select('id').eq('id', founder.authId).maybeSingle()
  assert.ok(growthUser, 'the pre-seeded growth_users row must still resolve through requireGrowthUser()')
})

test('authenticated GET /api/growth/schools/[id] rejects an unknown id with 404, not a 500', async () => {
  const res = await fetch(`${BASE_URL}/api/growth/schools/00000000-0000-0000-0000-000000000000`, {
    headers: { Cookie: founder.session.cookieHeader },
  })
  assert.equal(res.status, 404)
})
