// lib/testing/schoolBootstrapAdmin.http.integration.test.ts
//
// Founder bootstrap of a school's first administrator — authorization,
// policy, identity-preservation and commercial-separation matrices.
//
// Route-level, because requireGrowthUser reads the session through
// next/headers cookies(), which only resolves inside a real Next.js request.
// Run with:
//   npm run dev          (in another shell)
//   npx tsx --test lib/testing/schoolBootstrapAdmin.http.integration.test.ts
//
// Every fixture is synthetic. The Reference School is READ ONLY here: it is
// probed to prove it reports `already_administered`, and its membership is
// never modified.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest } from '@/lib/testing/httpAuthTestHelper'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3100'
const MARKER = 'SYNTHETIC_BOOTSTRAP'
const db = createServiceClient()

const REFERENCE_SCHOOL_NAME = 'Mwatate Ridge Senior School'

const createdUsers: string[] = []
const createdSchools: string[] = []

type Actor = { id: string; email: string; cookie: string }

/** Mirrors the route's ExistingAdministrator payload. */
type Administrator = { userId: string; email: string | null; fullName: string | null; role: string }

let founder: Actor
let ordinary: Actor
let outsider: Actor          // an admin of another school
let otherSchool: string
let principal: Actor         // the intended bootstrap target
let teacherPeter: Actor      // proves the school becomes self-administering

async function mkUser(label: string): Promise<Actor> {
  const email = `bootstrap-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  createdUsers.push(data.user.id)
  const session = await signInForHttpTest(email, password)
  return { id: data.user.id, email, cookie: session.cookieHeader }
}

/** A canonical school with NO members at all — the zero-admin state this path exists for. */
async function mkZeroAdminSchool(label: string): Promise<string> {
  const { data, error } = await db.from('schools')
    .insert({ school_name: `${MARKER} ${label} ${Date.now()}` }).select('id').single()
  if (error || !data) throw new Error(`mkZeroAdminSchool: ${error?.message}`)
  createdSchools.push(data.id)
  return data.id
}

const endpoint = (schoolId: string) => `${BASE}/api/admin/schools/${schoolId}/bootstrap-admin`

async function call(cookie: string | undefined, schoolId: string, body: unknown) {
  const res = await fetch(endpoint(schoolId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  let json: { data?: Record<string, unknown>; error?: string } = {}
  try { json = JSON.parse(raw) } catch { /* non-JSON */ }
  return { status: res.status, raw, json }
}

async function status(cookie: string | undefined, schoolId: string) {
  const res = await fetch(endpoint(schoolId), { headers: cookie ? { Cookie: cookie } : {} })
  const raw = await res.text()
  let json: { data?: Record<string, unknown> } = {}
  try { json = JSON.parse(raw) } catch { /* non-JSON */ }
  return { status: res.status, raw, json }
}

const bootstrap = (cookie: string | undefined, schoolId: string, email: string, role = 'school_admin') =>
  call(cookie, schoolId, { email, role })

const activeMemberships = async (schoolId: string, userId: string) => {
  const { data } = await db.from('school_users')
    .select('id, role, is_active').eq('school_id', schoolId).eq('user_id', userId)
  return data ?? []
}

before(async () => {
  founder = await mkUser('founder')
  await db.from('growth_users').insert({ id: founder.id, full_name: `${MARKER} Founder` })

  ordinary  = await mkUser('ordinary')
  principal = await mkUser('principal')
  teacherPeter = await mkUser('peter')

  outsider = await mkUser('outsider-admin')
  otherSchool = await mkZeroAdminSchool('other-school')
  await db.from('school_users').insert({ school_id: otherSchool, user_id: outsider.id, role: 'school_admin', is_active: true })
})

after(async () => {
  for (const id of createdSchools) {
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  await db.from('growth_users').delete().eq('id', founder.id)
  for (const id of createdUsers) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.auth.admin.deleteUser(id)
  }
})

// ── Authorization matrix ─────────────────────────────────────────────────────

test('1. anon cannot bootstrap', async () => {
  const school = await mkZeroAdminSchool('anon')
  assert.equal((await bootstrap(undefined, school, principal.email)).status, 401)
  assert.equal((await status(undefined, school)).status, 401)
  assert.equal((await activeMemberships(school, principal.id)).length, 0)
})

test('2. an ordinary authenticated user cannot bootstrap', async () => {
  const school = await mkZeroAdminSchool('ordinary')
  assert.equal((await bootstrap(ordinary.cookie, school, principal.email)).status, 403)
  assert.equal((await activeMemberships(school, principal.id)).length, 0)
})

test('3. a school admin cannot use the founder route, even for their own school', async () => {
  // Administering one school is not platform authority. The outsider is a
  // legitimate, active school_admin at otherSchool and is still refused.
  assert.equal((await bootstrap(outsider.cookie, otherSchool, principal.email)).status, 403)
})

test('4. a school admin cannot bootstrap a different school', async () => {
  const school = await mkZeroAdminSchool('cross-school')
  assert.equal((await bootstrap(outsider.cookie, school, principal.email)).status, 403)
  assert.equal((await activeMemberships(school, principal.id)).length, 0)
})

test('5. the target cannot bootstrap themselves', async () => {
  const school = await mkZeroAdminSchool('self')
  assert.equal((await bootstrap(principal.cookie, school, principal.email)).status, 403)
  assert.equal((await activeMemberships(school, principal.id)).length, 0)
})

test('6. a teacher cannot bootstrap the school they teach at', async () => {
  const school = await mkZeroAdminSchool('teacher-self')
  await db.from('school_users').insert({ school_id: school, user_id: teacherPeter.id, role: 'teacher', is_active: true })
  assert.equal((await bootstrap(teacherPeter.cookie, school, teacherPeter.email, 'school_admin')).status, 403)

  const rows = await activeMemberships(school, teacherPeter.id)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].role, 'teacher', 'a teacher escalated themselves to admin')
})

// ── Role allowlist ───────────────────────────────────────────────────────────

test('7. roles outside the canonical admin tier are rejected', async () => {
  const school = await mkZeroAdminSchool('roles')
  for (const role of ['admin', 'platform_admin', 'growth_admin', 'service_role', 'owner', 'teacher', 'parent', '', 'SCHOOL_ADMIN']) {
    const res = await bootstrap(founder.cookie, school, principal.email, role)
    assert.equal(res.status, 400, `role "${role}" was accepted`)
  }
  assert.equal((await activeMemberships(school, principal.id)).length, 0)
})

test('8. unknown body fields are rejected rather than ignored', async () => {
  const school = await mkZeroAdminSchool('strict')
  const res = await call(founder.cookie, school, {
    email: principal.email, role: 'school_admin',
    // None of these may be client-supplied.
    targetUserId: principal.id, performedBy: principal.id, is_active: true, invited_by: principal.id,
  })
  assert.equal(res.status, 400, 'the route accepted server-derived fields from the client')
})

test('9. all three canonical admin-tier roles are accepted', async () => {
  for (const role of ['school_admin', 'headteacher', 'deputy_headteacher']) {
    const school = await mkZeroAdminSchool(`role-${role}`)
    const res = await bootstrap(founder.cookie, school, principal.email, role)
    assert.equal(res.status, 200, res.raw)
    assert.equal((res.json.data as { status: string }).status, 'bootstrapped')
    const rows = await activeMemberships(school, principal.id)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].role, role)
    assert.equal(rows[0].is_active, true)
  }
})

// ── The positive flow ────────────────────────────────────────────────────────

test('10-12. a zero-admin school is bootstrapped, and the founder does not join it', async () => {
  const school = await mkZeroAdminSchool('positive')

  const pre = await status(founder.cookie, school)
  assert.equal(pre.status, 200)
  assert.equal((pre.json.data as { administered: boolean }).administered, false)

  const res = await bootstrap(founder.cookie, school, principal.email)
  assert.equal(res.status, 200, res.raw)
  assert.equal((res.json.data as { status: string }).status, 'bootstrapped')

  const rows = await activeMemberships(school, principal.id)
  assert.equal(rows.length, 1, 'expected exactly one membership row')
  assert.equal(rows[0].role, 'school_admin')
  assert.equal(rows[0].is_active, true, 'a pending row would leave the school unadministered')

  // Provenance is recorded, and it is the founder who asserted the handoff.
  const { data: row } = await db.from('school_users')
    .select('invited_by, joined_at').eq('id', rows[0].id).single()
  assert.equal(row!.invited_by, founder.id, 'the handoff was not attributed to the founder')
  assert.ok(row!.joined_at, 'joined_at was not set')

  // PHASE 18 — the founder gains no membership of the school they handed over.
  assert.equal((await activeMemberships(school, founder.id)).length, 0,
    'the founder became a member of the school')

  const post = await status(founder.cookie, school)
  assert.equal((post.json.data as { administered: boolean }).administered, true)
})

test('13. after bootstrap the school administers itself — the principal can add a teacher', async () => {
  const school = await mkZeroAdminSchool('self-administering')
  assert.equal((await bootstrap(founder.cookie, school, principal.email)).status, 200)

  // The whole point: requireSchoolAdmin now succeeds for the principal.
  const res = await fetch(`${BASE}/api/core/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: principal.cookie },
    body: JSON.stringify({ action: 'invite', schoolId: school, email: teacherPeter.email, role: 'teacher' }),
  })
  const raw = await res.text()
  assert.equal(res.status, 201, `the bootstrapped principal could not staff their school: ${raw}`)

  const { data: peter } = await db.from('school_users')
    .select('role, is_active').eq('school_id', school).eq('user_id', teacherPeter.id).single()
  assert.equal(peter!.role, 'teacher')
})

test('14. bootstrap is idempotent — re-running writes nothing and names the sitting admin', async () => {
  const school = await mkZeroAdminSchool('idempotent')
  assert.equal((await bootstrap(founder.cookie, school, principal.email)).status, 200)

  // The second run is refused by the same gate that protects every other
  // administered school — the target is now that school's administrator.
  const again = await bootstrap(founder.cookie, school, principal.email)
  assert.equal(again.status, 200, again.raw)
  const body = again.json.data as { status: string; administrators: Array<{ userId: string }> }
  assert.equal(body.status, 'already_administered')
  assert.equal(body.administrators[0].userId, principal.id,
    'the refusal did not name the person the founder just installed')

  assert.equal((await activeMemberships(school, principal.id)).length, 1, 'a duplicate membership row was created')
})

test('15. an existing INACTIVE membership is promoted in place, not joined by a second row', async () => {
  const school = await mkZeroAdminSchool('promote-pending')
  await db.from('school_users').insert({ school_id: school, user_id: principal.id, role: 'teacher', is_active: false })

  const res = await bootstrap(founder.cookie, school, principal.email, 'headteacher')
  assert.equal(res.status, 200, res.raw)
  const body = res.json.data as { status: string; previousRole: string; wasActive: boolean }
  assert.equal(body.status, 'promoted')
  assert.equal(body.previousRole, 'teacher')
  assert.equal(body.wasActive, false)

  const rows = await activeMemberships(school, principal.id)
  assert.equal(rows.length, 1, 'promotion created a rival membership row')
  assert.equal(rows[0].role, 'headteacher')
  assert.equal(rows[0].is_active, true)
})

test('16. an existing ACTIVE teacher is promoted in place when the school has no admin', async () => {
  const school = await mkZeroAdminSchool('promote-active')
  await db.from('school_users').insert({ school_id: school, user_id: principal.id, role: 'teacher', is_active: true })

  const res = await bootstrap(founder.cookie, school, principal.email)
  assert.equal(res.status, 200, res.raw)
  const body = res.json.data as { status: string; previousRole: string; wasActive: boolean }
  assert.equal(body.status, 'promoted')
  assert.equal(body.previousRole, 'teacher')
  assert.equal(body.wasActive, true)

  const rows = await activeMemberships(school, principal.id)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].role, 'school_admin')
})

// ── The refusal — this is the boundary, not an edge case ─────────────────────

test('17-19. a school that already has an administrator refuses founder bootstrap', async () => {
  // One case per canonical admin-tier role: all three must hold the school.
  for (const role of ['school_admin', 'headteacher', 'deputy_headteacher']) {
    const school = await mkZeroAdminSchool(`administered-${role}`)
    const sitting = await mkUser(`sitting-${role}`)
    await db.from('school_users').insert({ school_id: school, user_id: sitting.id, role, is_active: true })

    const res = await bootstrap(founder.cookie, school, principal.email)
    assert.equal(res.status, 200, res.raw)
    const body = res.json.data as { status: string; administrators: Array<{ userId: string; role: string }> }
    assert.equal(body.status, 'already_administered', `a school held by a ${role} was bootstrapped anyway`)
    assert.equal(body.administrators.length, 1)
    assert.equal(body.administrators[0].userId, sitting.id)
    assert.equal(body.administrators[0].role, role)

    // The refusal is total: no membership was created for the target.
    assert.equal((await activeMemberships(school, principal.id)).length, 0)
  }
})

test('20. an INACTIVE admin does not count as administering the school', async () => {
  // A departed administrator leaves the school unadministered — which is
  // exactly the state bootstrap is for. is_active is what the gate reads.
  const school = await mkZeroAdminSchool('departed-admin')
  const departed = await mkUser('departed')
  await db.from('school_users').insert({ school_id: school, user_id: departed.id, role: 'school_admin', is_active: false })

  const res = await bootstrap(founder.cookie, school, principal.email)
  assert.equal((res.json.data as { status: string }).status, 'bootstrapped')
})

test('21. a teacher-only school is still unadministered — teaching is not authority', async () => {
  const school = await mkZeroAdminSchool('teachers-only')
  await db.from('school_users').insert({ school_id: school, user_id: teacherPeter.id, role: 'teacher', is_active: true })

  const res = await bootstrap(founder.cookie, school, principal.email)
  assert.equal((res.json.data as { status: string }).status, 'bootstrapped')
})

// ── Target identity ──────────────────────────────────────────────────────────

test('22. an email with no EduNexus account returns no_account and creates nothing', async () => {
  const school = await mkZeroAdminSchool('no-account')
  const res = await bootstrap(founder.cookie, school, `nobody-${Date.now()}@example.com`)
  assert.equal(res.status, 200, res.raw)
  assert.equal((res.json.data as { status: string }).status, 'no_account')

  const { count } = await db.from('school_users')
    .select('id', { count: 'exact', head: true }).eq('school_id', school)
  assert.equal(count ?? 0, 0, 'a placeholder membership was created')
})

test('23. the target keeps their platform identity — profile role is never rewritten', async () => {
  const school = await mkZeroAdminSchool('identity')

  // The principal is also a Solo Teacher with a personal profile role.
  await db.from('profiles').upsert({ id: principal.id, role: 'teacher', full_name: `${MARKER} Principal` })
  const { data: before } = await db.from('profiles').select('role').eq('id', principal.id).single()

  assert.equal((await bootstrap(founder.cookie, school, principal.email)).status, 200)

  const { data: after } = await db.from('profiles').select('role').eq('id', principal.id).single()
  assert.equal(after!.role, before!.role, 'school authority overwrote the platform profile role')

  // School authority lives in school_users.role, not profiles.role.
  const rows = await activeMemberships(school, principal.id)
  assert.equal(rows[0].role, 'school_admin')
})

// ── Commercial separation ────────────────────────────────────────────────────

test('24-25. bootstrap changes no entitlement and records no payment', async () => {
  const school = await mkZeroAdminSchool('commercial')

  const { data: before } = await db.from('schools')
    .select('school_entitlement_status, school_entitlement_expires_at').eq('id', school).single()
  const { count: paymentsBefore } = await db.from('school_payments')
    .select('id', { count: 'exact', head: true }).eq('school_id', school)

  assert.equal((await bootstrap(founder.cookie, school, principal.email)).status, 200)

  const { data: after } = await db.from('schools')
    .select('school_entitlement_status, school_entitlement_expires_at').eq('id', school).single()
  const { count: paymentsAfter } = await db.from('school_payments')
    .select('id', { count: 'exact', head: true }).eq('school_id', school)

  assert.equal(after!.school_entitlement_status, before!.school_entitlement_status,
    'bootstrap changed entitlement status')
  assert.equal(after!.school_entitlement_expires_at, before!.school_entitlement_expires_at,
    'bootstrap changed entitlement expiry')
  assert.equal(paymentsAfter ?? 0, paymentsBefore ?? 0, 'bootstrap recorded a payment')

  // And no personal commercial state was created for the new administrator.
  const { count: subs } = await db.from('subscriptions')
    .select('id', { count: 'exact', head: true }).eq('user_id', principal.id)
  assert.equal(subs ?? 0, 0, 'bootstrap created a subscription')
})

// ── The Reference School — READ ONLY ─────────────────────────────────────────

test('26-28. the Reference School reports already_administered and is left untouched', async () => {
  const { data: ref } = await db.from('schools')
    .select('id, school_entitlement_status, school_entitlement_expires_at')
    .eq('school_name', REFERENCE_SCHOOL_NAME).maybeSingle()
  if (!ref) {
    console.log('      [skip] Reference School not seeded in this environment')
    return
  }

  const { count: membersBefore } = await db.from('school_users')
    .select('id', { count: 'exact', head: true }).eq('school_id', ref.id)

  const st = await status(founder.cookie, ref.id)
  assert.equal(st.status, 200, st.raw)
  const stBody = st.json.data as { administered: boolean; administrators: Administrator[] }
  assert.equal(stBody.administered, true, 'the Reference School reported as unadministered')
  assert.ok(stBody.administrators.some(a => a.role === 'headteacher'),
    'the seeded headteacher was not recognised as an administrator')

  // Regression: auth.admin.listUsers() is paginated (50/page). Unpaginated,
  // this long-standing school listed NO emails at all, because none of its
  // staff were among the newest 50 accounts on the platform — and the same
  // lookup decides whether a principal "has an account" during a handoff.
  assert.ok(stBody.administrators.every(a => a.email !== null),
    'administrator emails came back null — the auth lookup is not paginating')

  // The refusal, through the real write path.
  const res = await bootstrap(founder.cookie, ref.id, principal.email)
  assert.equal(res.status, 200, res.raw)
  assert.equal((res.json.data as { status: string }).status, 'already_administered')

  // Nothing about the fixture moved.
  const { count: membersAfter } = await db.from('school_users')
    .select('id', { count: 'exact', head: true }).eq('school_id', ref.id)
  assert.equal(membersAfter, membersBefore, 'the Reference School membership was mutated')
  assert.equal((await activeMemberships(ref.id, principal.id)).length, 0)
  assert.equal((await activeMemberships(ref.id, founder.id)).length, 0, 'the founder joined the Reference School')

  const { data: refAfter } = await db.from('schools')
    .select('school_entitlement_status, school_entitlement_expires_at').eq('id', ref.id).single()
  assert.equal(refAfter!.school_entitlement_status, ref.school_entitlement_status)
  assert.equal(refAfter!.school_entitlement_expires_at, ref.school_entitlement_expires_at)
})
