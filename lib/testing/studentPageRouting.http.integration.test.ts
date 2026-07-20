// lib/testing/studentPageRouting.http.integration.test.ts
//
// Sprint 3 (Platform Audit v1.0, Blocker #5) — proves the canonical learner
// architecture end-to-end against real, signed-in HTTP clients:
//   1. profiles.role now legally permits 'student' (migration
//      20260720_sprint3_canonical_learner_role — additive, verified below).
//   2. A real student account reaches every page in the canonical
//      app/student/* tree; parent/teacher/anonymous are correctly denied,
//      by the SAME middleware (proxy.ts) + layout (app/student/layout.tsx)
//      gate every other role tree uses — no bespoke logic.
//   3. The six old flat URLs (/blueprint, /career, /holiday, /progress,
//      /resources, /calendar — the former (student) route group, now
//      deleted) permanently redirect into their /student/* equivalents,
//      so no external link silently breaks.
//   4. A parent/teacher account is correctly denied /student/*, and a
//      student account is correctly denied /teacher/* and treated as a
//      /dashboard visitor is (i.e. gets bounced onward to /student, not
//      shown the parent dashboard) — no bounce loops.
//
// Sprint 2's version of this file proved the OPPOSITE of point 1 (that
// role='student' was rejected) — that was the bug; this is the fix,
// verified the same rigorous way: real database, real signed-in clients,
// not just reading the code.
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/testing/studentPageRouting.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_SPRINT3_LEARNER_ARCH_TEST'
const db = createServiceClient()

const authUserIds: string[] = []

let studentSession: SyntheticSession
let parentSession: SyntheticSession
let teacherSession: SyntheticSession

async function createRoleUser(label: string, role: 'student' | 'parent' | 'teacher'): Promise<SyntheticSession> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)

  const { error: profileErr } = await db.from('profiles').upsert({ id: data.user.id, role })
  if (profileErr) throw profileErr

  return signInForHttpTest(email, password)
}

before(async () => {
  studentSession = await createRoleUser('student', 'student')
  parentSession  = await createRoleUser('parent', 'parent')
  teacherSession = await createRoleUser('teacher', 'teacher')
})

after(async () => {
  for (const id of authUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
  console.log('[cleanup] synthetic Sprint 3 learner-architecture fixtures removed')
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

// ── The fix, proven directly ────────────────────────────────────────────────

test('profiles.role now legally permits student (the schema-level blocker is gone)', async () => {
  const { error } = await db.from('profiles').update({ role: 'student' }).eq('id', authUserIds[0])
  assert.equal(error, null, 'expected role=student to be accepted by the live database')
})

// ── Canonical learner tree: student reaches every page ──────────────────────

const STUDENT_PAGES = ['/student', '/student/blueprint', '/student/career', '/student/holiday', '/student/progress', '/student/resources', '/student/calendar']

for (const path of STUDENT_PAGES) {
  test(`GET ${path}: a student account reaches it (200, no redirect)`, async () => {
    const res = await fetch(`${BASE_URL}${path}`, { headers: cookie(studentSession), redirect: 'manual' })
    assert.equal(res.status, 200)
  })
}

// ── Route protection: consistent, not page-by-page ──────────────────────────

for (const path of ['/student', '/student/blueprint', '/student/resources', '/student/calendar']) {
  test(`GET ${path}: a parent account is redirected to /dashboard, not shown the page`, async () => {
    const res = await fetch(`${BASE_URL}${path}`, { headers: cookie(parentSession), redirect: 'manual' })
    assert.equal(res.status, 307)
    assert.match(res.headers.get('location') ?? '', /\/dashboard$/)
  })

  test(`GET ${path}: a teacher account is redirected to /teacher/dashboard, not shown the page`, async () => {
    const res = await fetch(`${BASE_URL}${path}`, { headers: cookie(teacherSession), redirect: 'manual' })
    assert.equal(res.status, 307)
    assert.match(res.headers.get('location') ?? '', /\/teacher\/dashboard$/)
  })

  test(`GET ${path}: an unauthenticated request is redirected to login`, async () => {
    const res = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' })
    assert.equal(res.status, 307)
    assert.match(res.headers.get('location') ?? '', /\/login\?/)
  })
}

// ── Cross-role denial, the other direction ──────────────────────────────────

test('a student account is redirected away from /teacher/dashboard', async () => {
  const res = await fetch(`${BASE_URL}/teacher/dashboard`, { headers: cookie(studentSession), redirect: 'manual' })
  assert.equal(res.status, 307)
  assert.match(res.headers.get('location') ?? '', /\/dashboard$/) // proxy.ts's /teacher branch sends non-teachers to /dashboard; app/dashboard/layout.tsx then sends the student on to /student — no loop, verified next
})

test('a student who lands on /dashboard is sent onward to /student, not shown the parent dashboard', async () => {
  const res = await fetch(`${BASE_URL}/dashboard`, { headers: cookie(studentSession), redirect: 'manual' })
  assert.equal(res.status, 307)
  assert.match(res.headers.get('location') ?? '', /\/student$/)
})

// ── Old flat URLs permanently redirect, nothing 404s ─────────────────────────

const OLD_TO_NEW: Record<string, string> = {
  '/blueprint': '/student/blueprint',
  '/career':    '/student/career',
  '/holiday':   '/student/holiday',
  '/progress':  '/student/progress',
  '/resources': '/student/resources',
  '/calendar':  '/student/calendar',
}

for (const [oldPath, newPath] of Object.entries(OLD_TO_NEW)) {
  test(`GET ${oldPath}: permanently redirects to ${newPath}`, async () => {
    const res = await fetch(`${BASE_URL}${oldPath}`, { headers: cookie(studentSession), redirect: 'manual' })
    assert.equal(res.status, 308) // Next.js permanent redirects are 308
    assert.match(res.headers.get('location') ?? '', new RegExp(`${newPath}$`))
  })
}

// ── Signup/login contract: the API layer login/signup pages actually call ──
// Rendering the real client-side login/signup React pages is out of scope
// for an HTTP integration test; what's provable and load-bearing is the API
// contract those pages depend on for the student case specifically.

test('POST /api/auth/complete-profile accepts role=student and persists it', async () => {
  const freshUser = await createRoleUser('freshsignup', 'parent') // arbitrary starting role
  const res = await fetch(`${BASE_URL}/api/auth/complete-profile`, {
    method: 'POST', headers: { ...cookie(freshUser), 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'student' }),
  })
  assert.equal(res.status, 200)

  const { data } = await db.from('profiles').select('role').eq('id', freshUser.userId).single()
  assert.equal(data?.role, 'student')
})

test('GET /api/auth/roles returns redirectTo=/student for a student profile — the exact value login/signup use to route post-auth', async () => {
  const res = await fetch(`${BASE_URL}/api/auth/roles`, { headers: cookie(studentSession) })
  const json = await res.json()
  assert.equal(json.primary, 'student')
  assert.equal(json.redirectTo, '/student')
})
