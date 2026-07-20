// lib/testing/studentPageRouting.http.integration.test.ts
//
// Sprint 2 (Platform Audit v1.0, Blocker #4) — proves /resources and
// /calendar (moved from app/dashboard/resources|calendar) are gated by
// app/(student)/layout.tsx exactly like their siblings (/blueprint,
// /progress, /holiday, /career) — unchanged behavior, verified rather than
// assumed.
//
// ⚠️ MAJOR FINDING, discovered while writing this test, not introduced by
// this sprint: there is currently no way to construct a real "self-login
// student" fixture at all. `profiles.role`'s CHECK constraint only allows
// ('parent','school_admin','teacher','admin') — 'student' has never been a
// legal value (confirmed directly against the live database, not just
// schema.sql). lib/auth/getRole.ts's getUserRoles() — documented as "THE
// single canonical role lookup for the whole app" — checks
// `profile?.role === 'student'`, which can therefore never be true; every
// real `students` row in production today belongs to a profile with
// role='parent' or role='teacher' (confirmed by querying production data),
// never anything that resolves to primary:'student'. Consequently:
//   - app/dashboard/layout.tsx's `if (roles.primary === 'student') redirect
//     ('/student')` can never fire.
//   - proxy.ts's /dashboard handling never checks for a student at all.
//   - app/(student)/layout.tsx's gate (`if (roles.primary === 'parent')
//     redirect('/dashboard')`) fires for EVERY real account that would
//     conceptually be "a student," bouncing them straight back to
//     /dashboard.
// This means the entire (student) route group — /blueprint, /career,
// /holiday, /progress, and now /resources, /calendar — is unreachable via
// any real navigational path for any account in production today, not just
// the two pages this sprint moved. This is a platform-wide, pre-existing
// role-resolution defect, far larger than Blocker #4, and is NOT fixed here
// — flagged per "if new work is discovered outside the audit, stop and
// document it, don't implement it." The test below proves the constraint
// directly (reproducible evidence for whoever picks this up), and separately
// proves the one thing Sprint 2 actually changed: parent/teacher/anonymous
// gating on the two moved pages still works correctly, unregressed by the
// move.
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/testing/studentPageRouting.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_STUDENT_ROUTING_TEST'
const db = createServiceClient()

const authUserIds: string[] = []

let parentSession: SyntheticSession
let teacherSession: SyntheticSession

async function createRoleUser(label: string, role: 'parent' | 'teacher'): Promise<SyntheticSession> {
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
  parentSession = await createRoleUser('parent', 'parent')
  teacherSession = await createRoleUser('teacher', 'teacher')
})

after(async () => {
  for (const id of authUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
  console.log('[cleanup] synthetic student-routing fixtures removed')
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

// ── The major finding, proven directly and reproducibly ────────────────────

test('MAJOR FINDING: profiles.role has no legal value that resolves to a "student" primary role', async () => {
  const { error } = await db.from('profiles').upsert({ id: authUserIds[0], role: 'student' })
  assert.ok(error, 'expected the DB to reject role=student — if this ever starts succeeding, the finding above needs re-verification, not silent deletion')
  assert.equal(error?.code, '23514') // check_violation
  assert.match(error?.message ?? '', /profiles_role_check/)
})

// ── What Sprint 2 actually changed: gating on the two moved pages ──────────

for (const path of ['/resources', '/calendar']) {
  test(`GET ${path}: a parent account is redirected away, not shown the page — same gate as its siblings`, async () => {
    const res = await fetch(`${BASE_URL}${path}`, { headers: cookie(parentSession), redirect: 'manual' })
    assert.equal(res.status, 307)
    assert.match(res.headers.get('location') ?? '', /\/dashboard$/)
  })

  test(`GET ${path}: a teacher account is redirected away, not shown the page — same gate as its siblings`, async () => {
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
