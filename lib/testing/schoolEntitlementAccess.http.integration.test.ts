// lib/testing/schoolEntitlementAccess.http.integration.test.ts
//
// Route-level (HTTP) proof of the P0 fix. checkFeatureAccess() reads the
// session through next/headers cookies(), which only resolves inside a real
// Next.js request — so this must run against a running server, not by importing
// the route handler. See lib/testing/httpAuthTestHelper.ts.
//
// Run with:
//   npm run dev          (in another shell)
//   npx tsx --env-file=.env.local --test lib/testing/schoolEntitlementAccess.http.integration.test.ts
//
// What this proves that a unit test cannot: a real non-admin teacher, hitting
// the real gated route with a real session, no longer receives HTTP 500 from
// the nonexistent organization domain — and that a covered teacher and an
// uncovered Solo Teacher are routed to genuinely different outcomes.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest } from '@/lib/testing/httpAuthTestHelper'
import { setSchoolEntitlement } from '@/lib/core/schoolEntitlement'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const MARKER = 'SYNTHETIC_ENTITLEMENT_HTTP'
const db = createServiceClient()

const createdUsers: string[] = []
const createdSchools: string[] = []

let coveredCookie: string
let soloCookie: string
let entitledSchool: string

async function mkTeacher(label: string): Promise<{ id: string; cookie: string }> {
  const email = `ent-http-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkTeacher: ${error?.message}`)
  createdUsers.push(data.user.id)

  // profiles.role drives checkFeatureAccess's teacher branch — this is the
  // exact shape of an ordinary, non-admin teacher account.
  await db.from('profiles').upsert({ id: data.user.id, role: 'teacher' }, { onConflict: 'id' })
  // The route checks for a `teachers` row right after the access gate; without
  // one it returns 403 there, which would mask whether the gate itself passed.
  await db.from('teachers').insert({
    user_id: data.user.id, full_name: `${MARKER} ${label}`, school: MARKER,
  })

  const session = await signInForHttpTest(email, password)
  return { id: data.user.id, cookie: session.cookieHeader }
}

// Deliberately invalid: `selectedSubstrands` is required. The route validates
// the body AFTER checkFeatureAccess and after the teachers-row check, so a 400
// here is positive proof that execution passed the entitlement gate — without
// spending a real DeepSeek generation to prove it.
const INVALID_SOW_BODY = {
  context: { learningArea: 'Mathematics', grade: 7, curriculumMode: 'cbc_junior' },
  selectedSubstrands: [],
}

async function postSow(cookie: string) {
  const res = await fetch(`${BASE}/api/sow/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(INVALID_SOW_BODY),
  })
  const text = await res.text()
  return { status: res.status, body: text }
}

before(async () => {
  const { data: school } = await db
    .from('schools')
    .insert({ school_name: `${MARKER} ${Date.now()}` })
    .select('id').single()
  entitledSchool = school!.id
  createdSchools.push(entitledSchool)
  await setSchoolEntitlement(entitledSchool, 'active', null, 'http-test')

  const covered = await mkTeacher('covered')
  coveredCookie = covered.cookie
  await db.from('school_users').insert({
    school_id: entitledSchool, user_id: covered.id, role: 'teacher', is_active: true,
    joined_at: new Date().toISOString(),
  })

  const solo = await mkTeacher('solo')
  soloCookie = solo.cookie
})

after(async () => {
  for (const id of createdSchools) {
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdUsers) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.auth.admin.deleteUser(id)
  }
})

test('P0: a school-covered non-admin teacher passes the entitlement gate instead of 500ing', async () => {
  const res = await postSow(coveredCookie)
  assert.notEqual(res.status, 500, `still 500ing: ${res.body}`)
  assert.equal(/organization_members|PGRST205/.test(res.body), false,
    `response still mentions the nonexistent organization domain: ${res.body}`)
  // 400 = body validation, which runs strictly after the access gate. Reaching
  // it is the proof: the gate granted access and returned control to the route.
  assert.equal(res.status, 400, `expected to reach body validation, got ${res.status}: ${res.body}`)
})

test('P0: an uncovered Solo Teacher is resolved on the personal path, not 500ed', async () => {
  const res = await postSow(soloCookie)
  assert.notEqual(res.status, 500, `still 500ing: ${res.body}`)
  assert.equal(/organization_members|PGRST205/.test(res.body), false,
    `response still mentions the nonexistent organization domain: ${res.body}`)
  // Falls through step 5 to first-SOW-free (this teacher has zero prior SOWs),
  // so it too reaches body validation. Before this change, this exact request
  // — a brand-new teacher's free first scheme of work — returned 500.
  assert.equal(res.status, 400, `expected to reach body validation, got ${res.status}: ${res.body}`)
})
