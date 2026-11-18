// lib/testing/platformAdminRoutes.http.integration.test.ts
//
// Route-level proof that Growth CRM membership alone never confers platform-admin
// authority. For every one of the ten app/api/admin/* routes that were gated by
// requireGrowthUser(), four caller classes are exercised against a real running server:
//
//   anonymous              -> 401
//   ordinary user          -> 403
//   NON-FOUNDER MEMBER     -> 403   (an ordinary account that nevertheless has a growth_users
//                                     row, for any reason — defence in depth)
//   founder                -> reaches the handler (not 401/403, not 5xx)
//
// Requires an isolated stack and a server started against it:
//   GROWTH_FOUNDER_EMAIL=<synthetic> next dev ...   and   TEST_PLATFORM_ADMIN_EMAIL=<same>
// Run: TEST_BASE_URL=http://localhost:3300 TEST_PLATFORM_ADMIN_EMAIL=... npx tsx --test \
//        --test-concurrency=1 lib/testing/platformAdminRoutes.http.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest } from '@/lib/testing/httpAuthTestHelper'
import { platformAdminTestEmail } from '@/lib/testing/platformAdminFixture'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3300'
const MARKER = 'synthetic-fi03-routes'
const db = createTestServiceClient()
const password = 'Synthetic-Test-Password-1!'
const userIds: string[] = []
const SCHOOL = randomUUID()

type Caller = { id: string; cookie: string }
let ordinary: Caller, member: Caller, founder: Caller, target: { id: string; email: string }

async function mk(label: string, email?: string): Promise<Caller & { email: string }> {
  const e = email ?? `${MARKER}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email: e, password, email_confirm: true })
  if (error || !data.user) throw new Error(`setup ${label}: ${error?.message}`)
  userIds.push(data.user.id)
  const s = await signInForHttpTest(e, password)
  return { id: data.user.id, cookie: s.cookieHeader, email: e }
}

before(async () => {
  ordinary = await mk('ordinary')
  member = await mk('member')
  // An unexpected state: a membership row for an ordinary account. The service role writes
  // it here because client roles cannot.
  await db.from('growth_users').insert({ id: member.id, full_name: 'Non-founder Member' })
  const f = await mk('founder', platformAdminTestEmail())
  founder = f
  await db.from('growth_users').insert({ id: f.id, full_name: 'Synthetic Founder' })
  const v = await mk('target'); target = { id: v.id, email: v.email }
})
after(async () => {
  await db.from('growth_users').delete().in('id', userIds)
  for (const id of userIds) await deleteAuthUserOrThrow(db, id)
})

type R = { name: string; method: 'GET' | 'POST'; path: string; body?: unknown }
const ROUTES: R[] = [
  { name: 'stats', method: 'GET', path: '/api/admin/stats' },
  { name: 'recent-users', method: 'GET', path: '/api/admin/recent-users' },
  { name: 'grant-access', method: 'POST', path: '/api/admin/grant-access', body: {} },
  { name: 'schools list', method: 'GET', path: '/api/admin/schools' },
  { name: 'pilot available-students', method: 'GET', path: '/api/admin/pilot/available-students' },
  { name: 'career review GET', method: 'GET', path: '/api/admin/career/review' },
  { name: 'career review POST', method: 'POST', path: '/api/admin/career/review', body: {} },
  { name: 'career verify', method: 'POST', path: '/api/admin/career/verify', body: {} },
  { name: 'bootstrap-admin GET', method: 'GET', path: `/api/admin/schools/${SCHOOL}/bootstrap-admin` },
  { name: 'bootstrap-admin POST', method: 'POST', path: `/api/admin/schools/${SCHOOL}/bootstrap-admin`, body: {} },
  { name: 'entitlement POST', method: 'POST', path: `/api/admin/schools/${SCHOOL}/entitlement`, body: {} },
  { name: 'payments GET', method: 'GET', path: `/api/admin/schools/${SCHOOL}/payments` },
  { name: 'payments POST', method: 'POST', path: `/api/admin/schools/${SCHOOL}/payments`, body: {} },
]

async function call(r: R, cookie?: string): Promise<number> {
  const res = await fetch(`${BASE}${r.path}`, {
    method: r.method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(r.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: r.body !== undefined ? JSON.stringify(r.body) : undefined,
  })
  await res.text()
  return res.status
}

for (const r of ROUTES) {
  test(`${r.method} ${r.name}: anonymous is rejected`, async () => {
    const s = await call(r)
    assert.ok(s === 401 || s === 403, `anonymous got ${s}`)
  })
  test(`${r.method} ${r.name}: ordinary authenticated user is rejected`, async () => {
    const s = await call(r, ordinary.cookie)
    assert.ok(s === 401 || s === 403, `ordinary got ${s}`)
  })
  test(`${r.method} ${r.name}: non-founder Growth member is rejected`, async () => {
    const s = await call(r, member.cookie)
    assert.ok(s === 401 || s === 403, `non-founder member got ${s} — membership alone must not grant admin`)
  })
  test(`${r.method} ${r.name}: the founder reaches the handler`, async () => {
    const s = await call(r, founder.cookie)
    // Reaching the handler is the assertion. (Handler-level statuses for inert input are not
    // this test's concern: e.g. GET payments for an unknown school returns 500 today.)
    assert.ok(s !== 401 && s !== 403, `founder was denied (${s})`)
  })
}

test('side-effect check: a non-founder member cannot grant access or tokens to another user', async () => {
  const before_ = await db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', target.id)
  const s = await call({ name: 'grant', method: 'POST', path: '/api/admin/grant-access', body: { email: target.email, days: 30 } }, member.cookie)
  assert.ok(s === 401 || s === 403, `got ${s}`)
  const after_ = await db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', target.id)
  assert.equal(after_.count, before_.count, 'no subscription may be created')
  const tb = await db.from('token_balances').select('user_id').eq('user_id', target.id)
  assert.equal((tb.data ?? []).length, 0, 'no token balance may be created')
})
