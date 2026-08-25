// lib/testing/selfServeOnboardingMiddleware.http.integration.test.ts
//
// Phase 1 self-serve onboarding — proves proxy.ts's widened admin-tier
// carve-out (Task 1) against real HTTP requests. Before this fix, a
// self-created principal (school_admin, no profiles.role, no teachers row)
// could reach /teacher/core-office but was bounced straight back out of
// /teacher/core-team and /teacher/core-admissions and /teacher/core-term —
// the dashboard's own primary call-to-actions were dead links.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/testing/selfServeOnboardingMiddleware.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE1_ONBOARDING_MW_TEST'
const db = createServiceClient()

const authUserIds: string[] = []
const schoolIds: string[] = []

let adminOnlySession: SyntheticSession   // school_admin, no profiles.role, no teachers row — the self-serve principal
let plainTeacherSession: SyntheticSession // ordinary teacher, no admin-tier membership anywhere

async function mkAuthUser(label: string): Promise<{ id: string; email: string; password: string }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  return { id: data.user.id, email, password }
}

before(async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, admin.id)
  schoolIds.push(school.id)
  await db.from('school_users').insert({ school_id: school.id, user_id: admin.id, role: 'school_admin', is_active: true })
  adminOnlySession = await signInForHttpTest(admin.email, admin.password)

  const teacher = await mkAuthUser('teacher')
  await db.from('profiles').upsert({ id: teacher.id, role: 'teacher' })
  await db.from('teachers').insert({ user_id: teacher.id, full_name: 'Synthetic Teacher', school: 'n/a', subject: 'n/a' })
  plainTeacherSession = await signInForHttpTest(teacher.email, teacher.password)
})

after(async () => {
  for (const schoolId of schoolIds) {
    await db.from('school_users').delete().eq('school_id', schoolId)
    await db.from('schools').delete().eq('id', schoolId)
  }
  await db.from('teachers').delete().in('user_id', authUserIds)
  await db.from('profiles').delete().in('id', authUserIds)
  for (const id of authUserIds) await db.auth.admin.deleteUser(id)
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

const WIDENED_ADMIN_PATHS = ['/teacher/core-office', '/teacher/core-team', '/teacher/core-admissions', '/teacher/core-term']

for (const path of WIDENED_ADMIN_PATHS) {
  test(`GET ${path}: a self-created school_admin with no teacher role reaches it (200, no redirect)`, async () => {
    const res = await fetch(`${BASE_URL}${path}`, { headers: cookie(adminOnlySession), redirect: 'manual' })
    assert.equal(res.status, 200, `expected 200, got ${res.status} (location: ${res.headers.get('location')})`)
  })
}

test('GET /teacher/core-admissions/import: a self-created school_admin reaches it too (nested under the widened prefix)', async () => {
  const res = await fetch(`${BASE_URL}/teacher/core-admissions/import`, { headers: cookie(adminOnlySession), redirect: 'manual' })
  assert.equal(res.status, 200)
})

test('GET /teacher/core-team: a user with neither teacher role nor admin-tier membership is redirected to /dashboard, not shown the page', async () => {
  const outsider = await mkAuthUser('outsider')
  const outsiderSession = await signInForHttpTest(outsider.email, outsider.password)
  const res = await fetch(`${BASE_URL}/teacher/core-team`, { headers: cookie(outsiderSession), redirect: 'manual' })
  assert.equal(res.status, 307)
  assert.match(res.headers.get('location') ?? '', /\/dashboard$/)
})

test('GET /teacher/gradebook: the widened carve-out does not leak to an ordinary non-institutional teacher route for the admin-only user', async () => {
  // adminOnlySession has no teachers row and is not a teacher-role profile —
  // /teacher/gradebook is not one of the four widened prefixes, so it must
  // still fall through to the normal teacher-role gate and bounce.
  const res = await fetch(`${BASE_URL}/teacher/gradebook`, { headers: cookie(adminOnlySession), redirect: 'manual' })
  assert.equal(res.status, 307)
  assert.match(res.headers.get('location') ?? '', /\/dashboard$/)
})

test('GET /teacher/core-team: a plain teacher (no admin-tier membership) is still admitted by the unchanged teacher-role gate', async () => {
  const res = await fetch(`${BASE_URL}/teacher/core-team`, { headers: cookie(plainTeacherSession), redirect: 'manual' })
  assert.equal(res.status, 200)
})
