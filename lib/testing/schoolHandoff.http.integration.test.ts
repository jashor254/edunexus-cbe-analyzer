// lib/testing/schoolHandoff.http.integration.test.ts
//
// School admin handoff + canonical school finder.
//
// Two things are under test:
//   PART A — an existing school admin can hand a school to its real principal
//            by inviting them as school_admin, without SQL.
//   PART B — the founder can find that school by name through a trusted
//            platform-admin server path, without knowing a UUID.
//
// Route-level, because requireSchoolAdmin/requireGrowthUser read the session
// through next/headers cookies(), which only resolves inside a real request.
// Run with:
//   npm run dev          (in another shell)
//   npx tsx --env-file=.env.local --test lib/testing/schoolHandoff.http.integration.test.ts
//
// The security question this phase must answer honestly: does adding a `role`
// parameter to an invitation reintroduce the "user-controlled role →
// privilege escalation" class we closed in migration 20260812190000? Tests
// 1, 2, 5, 6 and 7 exist to prove it does not.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest } from '@/lib/testing/httpAuthTestHelper'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const MARKER = 'SYNTHETIC_HANDOFF'
const db = createServiceClient()

const createdUsers: string[] = []
const createdSchools: string[] = []

let schoolA: string
let schoolB: string
type Actor = { id: string; cookie: string; email: string }

let adminA: Actor          // school_admin at A
let adminB: Actor          // school_admin at B
let teacherA: Actor        // plain teacher at A
let principal: Actor
let outsider: Actor
let founderId: string
let founderCookie: string

async function mkUser(label: string) {
  const email = `handoff-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  createdUsers.push(data.user.id)
  const session = await signInForHttpTest(email, password)
  return { id: data.user.id, cookie: session.cookieHeader, email }
}

async function mkSchool(label: string) {
  const { data, error } = await db.from('schools')
    .insert({ school_name: `${MARKER} ${label} ${Date.now()}` }).select('id').single()
  if (error || !data) throw new Error(`mkSchool: ${error?.message}`)
  createdSchools.push(data.id)
  return data.id
}

const addMember = (schoolId: string, userId: string, role: string, isActive = true) =>
  db.from('school_users').insert({ school_id: schoolId, user_id: userId, role, is_active: isActive })

const invite = (cookie: string | undefined, schoolId: string, email: string, role?: string) =>
  fetch(`${BASE}/api/core/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ action: 'invite', schoolId, email, ...(role ? { role } : {}) }),
  })

const accept = (cookie: string, schoolId: string, fullName: string) =>
  fetch(`${BASE}/api/core/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'accept', schoolId, full_name: fullName }),
  })

const listSchools = (cookie?: string, search?: string) =>
  fetch(`${BASE}/api/admin/schools${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    { headers: cookie ? { Cookie: cookie } : {} })

/**
 * Reads a Response body exactly once.
 *
 * `assert.equal(res.status, 201, await res.text())` looks harmless but the
 * message argument is evaluated eagerly, consuming the stream before any later
 * res.json() can read it — the failure then reports "Body is unusable" instead
 * of the real assertion. Read once, assert against the text you already have.
 */
type InviteEnvelope = {
  data: {
    status: string
    previousRole?: string
    schoolUser?: { role: string; is_active: boolean }
  }
}

async function readJson<T = InviteEnvelope>(res: Response): Promise<{ status: number; raw: string; json: T }> {
  const raw = await res.text()
  let json = null as unknown as T
  try { json = JSON.parse(raw) as T } catch { /* non-JSON error page */ }
  return { status: res.status, raw, json }
}

async function roleOf(schoolId: string, userId: string): Promise<string | null> {
  const { data } = await db.from('school_users')
    .select('role, is_active').eq('school_id', schoolId).eq('user_id', userId)
  return data?.[0]?.role ?? null
}

before(async () => {
  schoolA = await mkSchool('school-a')
  schoolB = await mkSchool('school-b')

  adminA = await mkUser('admin-a')
  await addMember(schoolA, adminA.id, 'school_admin')

  adminB = await mkUser('admin-b')
  await addMember(schoolB, adminB.id, 'school_admin')

  teacherA = await mkUser('teacher-a')
  await addMember(schoolA, teacherA.id, 'teacher')

  principal = await mkUser('principal')
  outsider  = await mkUser('outsider')

  const founder = await mkUser('founder')
  founderId = founder.id
  founderCookie = founder.cookie
  await db.from('growth_users').insert({ id: founder.id, full_name: `${MARKER} Founder` })
})

after(async () => {
  for (const id of createdSchools) {
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  await db.from('growth_users').delete().eq('id', founderId)
  for (const id of createdUsers) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.auth.admin.deleteUser(id)
  }
})

// ── PART A: authorization ────────────────────────────────────────────────────

test('1. an ordinary teacher cannot invite a school admin', async () => {
  const res = await invite(teacherA.cookie, schoolA, principal.email, 'school_admin')
  assert.equal(res.status, 403, `expected 403, got ${res.status}`)
  assert.equal(await roleOf(schoolA, principal.id), null, 'a membership was created')
})

test('2. a school admin cannot assign roles in another school', async () => {
  const res = await invite(adminB.cookie, schoolA, principal.email, 'school_admin')
  assert.equal(res.status, 403, 'cross-school role assignment was permitted')
  assert.equal(await roleOf(schoolA, principal.id), null)
})

test('2b. anon cannot invite at all', async () => {
  const res = await invite(undefined, schoolA, principal.email, 'school_admin')
  assert.equal(res.status, 401)
})

test('2c. a role outside the server allowlist is rejected', async () => {
  for (const role of ['admin', 'platform_admin', 'service_role', 'parent', 'headteacher', 'owner']) {
    const res = await invite(adminA.cookie, schoolA, principal.email, role)
    assert.equal(res.status, 422, `role "${role}" was not rejected (got ${res.status})`)
  }
  assert.equal(await roleOf(schoolA, principal.id), null, 'a rejected role still created a membership')
})

// ── PART A: the handoff itself ───────────────────────────────────────────────

test('3. a valid school admin can invite a registered user as a teacher', async () => {
  const { status, raw, json } = await readJson(await invite(adminA.cookie, schoolA, outsider.email)) // role omitted → teacher
  assert.equal(status, 201, raw)
  assert.equal(json.data.status, 'invited')
  assert.equal(await roleOf(schoolA, outsider.id), 'teacher')
})

test('4. a valid school admin can invite a registered user as school_admin', async () => {
  const { status, raw, json } = await readJson(await invite(adminA.cookie, schoolA, principal.email, 'school_admin'))
  assert.equal(status, 201, raw)
  assert.equal(json.data.status, 'invited')
  assert.equal(json.data.schoolUser.role, 'school_admin')
  assert.equal(json.data.schoolUser.is_active, false, 'the invitation should start pending')
})

test('5-6. the invitee cannot alter the invited role or the school', async () => {
  // The accept payload carries no role and no alternate school — school_id
  // comes from the request, role is read from the invitation row the admin
  // created. Sending extra fields must not change either.
  const res = await fetch(`${BASE}/api/core/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: principal.cookie },
    body: JSON.stringify({
      action: 'accept', schoolId: schoolA, full_name: `${MARKER} Principal`,
      role: 'admin', school_id: schoolB, userId: adminA.id,     // all ignored
    }),
  })
  const { status, raw } = await readJson(res)
  assert.equal(status, 200, raw)

  assert.equal(await roleOf(schoolA, principal.id), 'school_admin', 'the invited role was altered')
  assert.equal(await roleOf(schoolB, principal.id), null, 'the invitee joined a school they were not invited to')
})

test('7. a user cannot accept a membership that was never extended to them', async () => {
  const res = await accept(outsider.cookie, schoolB, `${MARKER} Outsider`)
  assert.equal(res.status, 404, `expected 404, got ${res.status}`)
  assert.equal(await roleOf(schoolB, outsider.id), null)
})

test('8-9. accepted roles are exactly what was invited', async () => {
  await accept(outsider.cookie, schoolA, `${MARKER} Teacher`)
  assert.equal(await roleOf(schoolA, outsider.id), 'teacher')

  const { data: principalRow } = await db.from('school_users')
    .select('role, is_active').eq('school_id', schoolA).eq('user_id', principal.id).single()
  assert.equal(principalRow!.role, 'school_admin')
  assert.equal(principalRow!.is_active, true, 'the principal is not active after accepting')
})

test('9b. the accepted principal can now operate the school independently', async () => {
  // The point of the whole phase: they can now invite staff themselves.
  const newTeacher = await mkUser('hired-by-principal')
  const res = await invite(principal.cookie, schoolA, newTeacher.email)
  assert.equal(res.status, 201, 'the new principal cannot run their own school')
  assert.equal(await roleOf(schoolA, newTeacher.id), 'teacher')
})

test('10. the original admin remains active — this adds an admin, it does not transfer', async () => {
  const { data } = await db.from('school_users')
    .select('role, is_active').eq('school_id', schoolA).eq('user_id', adminA.id).single()
  assert.equal(data!.role, 'school_admin')
  assert.equal(data!.is_active, true, 'the inviting admin was demoted or deactivated')

  const { count } = await db.from('school_users')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolA).eq('role', 'school_admin').eq('is_active', true)
  assert.ok((count ?? 0) >= 2, 'the school should now have at least two active admins')
})

test('10b. promotion changes role in place rather than creating a second membership', async () => {
  // teacherA is an active teacher at A. Promote them.
  const teacherEmail = (await db.auth.admin.getUserById(teacherA.id)).data!.user!.email!
  const { status, raw, json } = await readJson(await invite(adminA.cookie, schoolA, teacherEmail, 'school_admin'))
  assert.equal(status, 200, raw)
  assert.equal(json.data.status, 'role_changed')
  assert.equal(json.data.previousRole, 'teacher')

  const { data: rows } = await db.from('school_users')
    .select('id, role, is_active').eq('school_id', schoolA).eq('user_id', teacherA.id)
  assert.equal(rows?.length, 1, 'promotion created a duplicate membership row')
  assert.equal(rows![0].role, 'school_admin')
  assert.equal(rows![0].is_active, true, 'promotion should not knock an active member back to pending')
})

test('11-12. membership changes touched neither entitlement nor payments', async () => {
  const { data: school } = await db.from('schools')
    .select('school_entitlement_status, school_entitlement_expires_at').eq('id', schoolA).single()
  assert.equal(school!.school_entitlement_status, 'none', 'entitlement changed during a membership change')
  assert.equal(school!.school_entitlement_expires_at, null)

  const { count } = await db.from('school_payments')
    .select('id', { count: 'exact', head: true }).eq('school_id', schoolA)
  assert.equal(count, 0, 'a payment record was created by a membership change')
})

// ── PART B: canonical school finder ──────────────────────────────────────────

test('B1-B4. anon, ordinary user, teacher and school admin are all rejected', async () => {
  assert.equal((await listSchools()).status, 401, 'anon was allowed')
  assert.equal((await listSchools(outsider.cookie)).status, 403, 'an ordinary user was allowed')
  assert.equal((await listSchools(teacherA.cookie)).status, 403, 'a teacher was allowed')
  // The important one: school-level authority must not grant platform-wide sight.
  assert.equal((await listSchools(adminA.cookie)).status, 403, 'a school admin read the platform-wide list')
})

test('B5-B6. the platform admin succeeds, with only approved fields', async () => {
  const res = await listSchools(founderCookie)
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.ok(Array.isArray(json.data.schools))

  const sample = json.data.schools[0]
  assert.ok(sample, 'no schools returned')
  assert.deepEqual(Object.keys(sample).sort(), [
    'activeMemberCount', 'activeTeacherCount', 'autoProvisioned', 'county', 'createdAt',
    'entitlementExpiresAt', 'entitlementStatus', 'id', 'likelyTestFixture', 'schoolName',
  ])
  for (const leaked of ['nemis_code', 'contact_phone', 'contact_email', 'created_by', 'learners', 'payments']) {
    assert.equal(leaked in sample, false, `response leaked ${leaked}`)
  }
})

test('B7-B8. search is name-scoped and links to the correct canonical UUID', async () => {
  const res = await listSchools(founderCookie, `${MARKER} school-a`)
  const json = await res.json()
  const ids = json.data.schools.map((s: { id: string }) => s.id)

  assert.ok(ids.includes(schoolA), 'the searched school was not found')
  assert.equal(ids.includes(schoolB), false, 'search returned a school that does not match the term')

  const row = json.data.schools.find((s: { id: string }) => s.id === schoolA)
  assert.equal(row.activeTeacherCount, 1, 'teacher count wrong (outsider is the only plain teacher after promotion)')
  assert.ok(row.activeMemberCount >= 3, 'member count should include admins')
})

test('B9. deterministic test-fixture markers are surfaced, and real names are not flagged', async () => {
  const { isLikelyTestFixture } = await import('@/lib/core/schoolDirectory')

  for (const name of ['SYNTHETIC_MARY_FULL_CIRCUIT_TEST-school', 'DEBUG12B_1784267287218', 'debugredir-school-1785049254873']) {
    assert.equal(isLikelyTestFixture(name), true, `${name} should be flagged`)
  }
  // Conservative by design: a real school must never be branded fake.
  for (const name of ['Mwatate Ridge Senior School', 'Testimony Academy', 'Kangai School', 'Protest Hill High']) {
    assert.equal(isLikelyTestFixture(name), false, `${name} must NOT be flagged`)
  }

  const res = await listSchools(founderCookie, MARKER)
  const json = await res.json()
  assert.ok(json.data.schools.every((s: { likelyTestFixture: boolean }) => s.likelyTestFixture),
    'synthetic fixtures were not flagged in the live response')
})

test('B10-B11. the endpoint writes nothing, and no browser queries schools directly', async () => {
  const before = await db.from('schools').select('id', { count: 'exact', head: true })
  await listSchools(founderCookie)
  await listSchools(founderCookie, 'anything')
  const after = await db.from('schools').select('id', { count: 'exact', head: true })
  assert.equal(after.count, before.count, 'the school count changed across GETs')

  const post = await fetch(`${BASE}/api/admin/schools`, {
    method: 'POST', headers: { Cookie: founderCookie, 'Content-Type': 'application/json' }, body: '{}',
  })
  assert.equal(post.status, 405, `expected 405 for POST, got ${post.status}`)

  const raw = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../../app/admin/schools/page.tsx', import.meta.url), 'utf8'))
  const code = raw.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  assert.equal(/\.from\(\s*['"]schools['"]\s*\)/.test(code), false, 'the page queries schools directly')
  assert.equal(code.includes('/api/admin/schools'), true, 'the page does not use the trusted route')
})
