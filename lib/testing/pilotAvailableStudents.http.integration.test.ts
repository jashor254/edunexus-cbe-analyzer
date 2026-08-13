// lib/testing/pilotAvailableStudents.http.integration.test.ts
//
// Route-level security tests for /api/admin/pilot/available-students — the
// trusted replacement for the pilot admin picker's old direct browser query.
//
// requireGrowthUser() reads the session through next/headers cookies(), which
// only resolves inside a real Next.js request, so this runs against a running
// server with real Cookie headers rather than by importing the handler.
// See lib/testing/httpAuthTestHelper.ts.
//
// Run with:
//   npm run dev          (in another shell)
//   npx tsx --env-file=.env.local --test lib/testing/pilotAvailableStudents.http.integration.test.ts
//
// No real learner PII appears in assertions or output — fixtures are synthetic
// and only counts/field names are asserted.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest } from '@/lib/testing/httpAuthTestHelper'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const MARKER = 'SYNTHETIC_PILOT_PICKER'
const db = createServiceClient()
const ENDPOINT = `${BASE}/api/admin/pilot/available-students`

const createdUsers: string[] = []
const createdSchools: string[] = []
const createdStudents: string[] = []

let ordinaryCookie: string
let teacherCookie: string
let schoolAdminCookie: string
let founderCookie: string
let founderId: string

async function mkUser(label: string): Promise<{ id: string; cookie: string }> {
  const email = `pilot-picker-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  createdUsers.push(data.user.id)
  const session = await signInForHttpTest(email, password)
  return { id: data.user.id, cookie: session.cookieHeader }
}

const get = (cookie?: string) =>
  fetch(ENDPOINT, { headers: cookie ? { Cookie: cookie } : {} })

before(async () => {
  const ordinary = await mkUser('ordinary')
  ordinaryCookie = ordinary.cookie

  const teacher = await mkUser('teacher')
  teacherCookie = teacher.cookie
  await db.from('profiles').upsert({ id: teacher.id, role: 'teacher' }, { onConflict: 'id' })
  await db.from('teachers').insert({ user_id: teacher.id, full_name: MARKER, school: MARKER })

  const { data: school } = await db.from('schools')
    .insert({ school_name: `${MARKER} ${Date.now()}` }).select('id').single()
  createdSchools.push(school!.id)

  const schoolAdmin = await mkUser('schooladmin')
  schoolAdminCookie = schoolAdmin.cookie
  await db.from('school_users').insert({
    school_id: school!.id, user_id: schoolAdmin.id, role: 'school_admin', is_active: true,
  })

  // An authorized platform admin: a real growth_users row is what
  // requireGrowthUser() accepts (the other accepted path is an email matching
  // GROWTH_FOUNDER_EMAIL, which we must not depend on in tests).
  const founder = await mkUser('founder')
  founderCookie = founder.cookie
  founderId = founder.id
  await db.from('growth_users').insert({ id: founder.id, full_name: `${MARKER} Founder` })

  // A synthetic student that no test caller owns, teaches, or shares a school
  // with — so only a platform admin could ever see it.
  const { data: student } = await db.from('students')
    .insert({ name: `${MARKER} Learner`, grade: 8 }).select('id').single()
  createdStudents.push(student!.id)
})

after(async () => {
  for (const id of createdStudents) await db.from('students').delete().eq('id', id)
  await db.from('growth_users').delete().eq('id', founderId)
  for (const id of createdSchools) {
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdUsers) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.auth.admin.deleteUser(id)
  }
})

// ── Negative ─────────────────────────────────────────────────────────────────

test('1. an anonymous caller is rejected', async () => {
  const res = await get()
  assert.equal(res.status, 401, `expected 401, got ${res.status}`)
})

test('2. an ordinary authenticated user is rejected', async () => {
  const res = await get(ordinaryCookie)
  assert.equal(res.status, 403, `expected 403, got ${res.status}`)
  const json = await res.json()
  assert.equal(json.success, false)
  assert.equal(json.data ?? null, null, 'a rejected caller received data')
})

test('3. a teacher is rejected', async () => {
  const res = await get(teacherCookie)
  assert.equal(res.status, 403, `expected 403, got ${res.status}`)
})

test('4. a school admin is rejected', async () => {
  const res = await get(schoolAdminCookie)
  assert.equal(res.status, 403, `expected 403, got ${res.status}`)
})

// ── Positive ─────────────────────────────────────────────────────────────────

test('5. an authorized platform admin succeeds and sees the cross-school set', async () => {
  const res = await get(founderCookie)
  assert.equal(res.status, 200, `expected 200, got ${res.status}`)
  const json = await res.json()
  assert.equal(json.success, true)
  assert.ok(Array.isArray(json.data.students))

  // The whole point of the repair: the platform admin sees students they have
  // no teaching, ownership, or school relationship with.
  const { count } = await db.from('students').select('id', { count: 'exact', head: true })
  assert.equal(json.data.students.length, count,
    'the platform admin did not receive the full cross-school student set')
  assert.ok(json.data.students.some((s: { id: string }) => s.id === createdStudents[0]),
    'an unrelated synthetic student was missing from the admin result')
})

test('6. the response exposes only id, name and grade', async () => {
  const res = await get(founderCookie)
  const json = await res.json()
  const sample = json.data.students[0]
  assert.ok(sample, 'no students returned')
  assert.deepEqual(Object.keys(sample).sort(), ['grade', 'id', 'name'])

  // Explicitly assert the sensitive columns that exist on `students` are absent.
  for (const leaked of ['parent_phone', 'parent_first_name', 'parent_email', 'user_id', 'school_id', 'teacher_id']) {
    assert.equal(leaked in sample, false, `response leaked ${leaked}`)
  }
})

test('7. the endpoint performs no writes', async () => {
  const before = await db.from('students').select('id', { count: 'exact', head: true })
  await get(founderCookie)
  const after = await db.from('students').select('id', { count: 'exact', head: true })
  assert.equal(after.count, before.count, 'the student count changed across a GET')

  // Only GET is exported — a write verb must not be routable.
  const post = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Cookie: founderCookie, 'Content-Type': 'application/json' },
    body: '{}',
  })
  assert.equal(post.status, 405, `expected 405 for POST, got ${post.status}`)
})

// ── The old unsafe path is gone ──────────────────────────────────────────────

test('8. the pilot page no longer queries students directly from the browser', async () => {
  const raw = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../../app/admin/pilot/page.tsx', import.meta.url), 'utf8'))
  const code = raw.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  assert.equal(/\.from\(\s*['"]students['"]\s*\)/.test(code), false,
    'the page still queries the students table directly')
  assert.equal(code.includes('/api/admin/pilot/available-students'), true,
    'the page does not use the trusted server route')
})
