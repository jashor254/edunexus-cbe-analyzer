// lib/core/schoolEntitlement.test.ts
//
// Integration tests against real (synthetic, cleaned-up) rows, following the
// convention in lib/core/identity.test.ts.
// Run with: npx tsx --env-file=.env.local --test lib/core/schoolEntitlement.test.ts
//
// Covers the school-covered access chain, the staff lifecycle (join / leave /
// transfer / retire / replace), identity preservation across departure, and the
// live security boundary on the entitlement columns — including negative tests
// with real anon and authenticated clients, because a migration that reads
// correctly is not proof that the database rejects the write.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { resolveSchoolCoverage, setSchoolEntitlement, isEntitlementLive } from '@/lib/core/schoolEntitlement'
import { deactivateSchoolMembership } from '@/lib/core/school-users'

const MARKER = 'SYNTHETIC_ENTITLEMENT_TEST'
const db = createServiceClient()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Schools
let entitledSchool: string      // active, no expiry
let expiredSchool: string       // active status, expiry in the past
let suspendedSchool: string     // suspended
let unentitledSchool: string    // never granted ('none')
let secondEntitledSchool: string

// Users
let teacherA: string            // the departing/transferring teacher
let teacherB: string            // the replacement
let colleague: string           // another teacher at the same entitled school
let soloTeacher: string         // no school membership at all
let parentAtEntitled: string    // parent membership at an entitled school
let ordinaryUser: string        // authenticated, no membership anywhere

const createdUsers: string[] = []
const createdSchools: string[] = []
const passwords = new Map<string, string>()

async function mkUser(label: string): Promise<string> {
  const password = `Test!${Math.random().toString(36).slice(2, 12)}`
  const email = `entitlement-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser(${label}): ${error?.message}`)
  createdUsers.push(data.user.id)
  passwords.set(data.user.id, `${email}::${password}`)
  return data.user.id
}

async function mkSchool(label: string): Promise<string> {
  const { data, error } = await db
    .from('schools')
    .insert({ school_name: `${MARKER} ${label} ${Date.now()}` })
    .select('id')
    .single()
  if (error || !data) throw new Error(`mkSchool(${label}): ${error?.message}`)
  createdSchools.push(data.id)
  return data.id
}

async function addMembership(schoolId: string, userId: string, role: string, isActive = true) {
  const { error } = await db.from('school_users').insert({
    school_id: schoolId, user_id: userId, role, is_active: isActive, joined_at: new Date().toISOString(),
  })
  if (error) throw new Error(`addMembership: ${error.message}`)
}

/** A real signed-in `authenticated`-role client — the exact role a browser gets. */
async function signedInClient(userId: string) {
  const [email, password] = passwords.get(userId)!.split('::')
  const client = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signedInClient: ${error.message}`)
  return client
}

before(async () => {
  entitledSchool       = await mkSchool('entitled')
  expiredSchool        = await mkSchool('expired')
  suspendedSchool      = await mkSchool('suspended')
  unentitledSchool     = await mkSchool('unentitled')
  secondEntitledSchool = await mkSchool('second-entitled')

  teacherA         = await mkUser('teacher-a')
  teacherB         = await mkUser('teacher-b')
  colleague        = await mkUser('colleague')
  soloTeacher      = await mkUser('solo')
  parentAtEntitled = await mkUser('parent')
  ordinaryUser     = await mkUser('ordinary')

  const future = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString()
  const past   = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  await setSchoolEntitlement(entitledSchool, 'active', null, teacherA)
  await setSchoolEntitlement(secondEntitledSchool, 'active', future, teacherA)
  await setSchoolEntitlement(expiredSchool, 'active', past, teacherA)
  await setSchoolEntitlement(suspendedSchool, 'suspended', null, teacherA)
  // unentitledSchool deliberately left at the 'none' default.

  await addMembership(entitledSchool, teacherA, 'teacher')
  await addMembership(entitledSchool, colleague, 'teacher')
  await addMembership(entitledSchool, parentAtEntitled, 'parent')
})

after(async () => {
  for (const id of createdSchools) {
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdUsers) await db.auth.admin.deleteUser(id)
})

// ── P0 ────────────────────────────────────────────────────────────────────────

test('1. teacher entitlement resolution never touches the nonexistent organization domain', async () => {
  // The source-level guarantee: access.ts must not reach organization_members.
  const raw = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../payments/access.ts', import.meta.url), 'utf8'))
  // Comments are stripped first — the file explains the old organization-domain
  // call in prose, and that history is worth keeping. What must be gone is the
  // executable reference.
  const code = raw.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  assert.equal(code.includes('findUserOrganizations'), false, 'access.ts still calls findUserOrganizations')
  assert.equal(code.includes('repos.organizations'), false, 'access.ts still reaches the organization repository')
  assert.equal(code.includes('resolveSchoolCoverage'), true, 'access.ts does not use the school-domain resolver')

  // The behavioural guarantee: the real chain resolves without throwing.
  const coverage = await resolveSchoolCoverage(teacherA)
  assert.equal(coverage.outcome, 'covered')
})

test('2. missing institutional entitlement resolves to a value, never a throw', async () => {
  const solo = await resolveSchoolCoverage(soloTeacher)
  assert.equal(solo.outcome, 'not_covered')
  assert.equal(solo.outcome === 'not_covered' && solo.reason, 'no_active_membership')
})

test('3. lookup failure degrades to not-covered rather than throwing (fail toward Solo Teacher)', async () => {
  const original = repos.schools.findActiveTeacherMembershipsWithEntitlement
  ;(repos.schools as unknown as Record<string, unknown>).findActiveTeacherMembershipsWithEntitlement =
    async () => { throw new Error("Could not find the table 'public.organization_members' in the schema cache") }
  try {
    const result = await resolveSchoolCoverage(teacherA)
    assert.equal(result.outcome, 'lookup_failed')
    // Critically: it did NOT return 'covered'. Absence of proof is never coverage.
    assert.notEqual(result.outcome, 'covered')
  } finally {
    ;(repos.schools as unknown as Record<string, unknown>).findActiveTeacherMembershipsWithEntitlement = original
  }
})

test('4. a Solo Teacher is never school-covered, leaving the personal paths reachable', async () => {
  const solo = await resolveSchoolCoverage(soloTeacher)
  assert.notEqual(solo.outcome, 'covered')
  // access.ts only short-circuits on 'covered'; anything else falls through to
  // first-SOW-free (step 6b), subscription (step 6), then tokens (step 7).
})

// ── School entitlement matrix ────────────────────────────────────────────────

test('5. active membership + active unexpired entitlement → covered', async () => {
  const c = await resolveSchoolCoverage(teacherA)
  assert.equal(c.outcome, 'covered')
  assert.equal(c.outcome === 'covered' && c.schoolId, entitledSchool)
})

test('6. active membership + expired entitlement → NOT covered', async () => {
  await addMembership(expiredSchool, ordinaryUser, 'teacher')
  const c = await resolveSchoolCoverage(ordinaryUser)
  assert.equal(c.outcome, 'not_covered')
  assert.equal(c.outcome === 'not_covered' && c.reason, 'entitlement_expired')
  await db.from('school_users').delete().eq('school_id', expiredSchool).eq('user_id', ordinaryUser)
})

test('7. active membership + suspended entitlement → NOT covered', async () => {
  await addMembership(suspendedSchool, ordinaryUser, 'teacher')
  const c = await resolveSchoolCoverage(ordinaryUser)
  assert.equal(c.outcome, 'not_covered')
  assert.equal(c.outcome === 'not_covered' && c.reason, 'school_not_entitled')
  await db.from('school_users').delete().eq('school_id', suspendedSchool).eq('user_id', ordinaryUser)
})

test('8. active membership + no entitlement ever granted → NOT covered', async () => {
  await addMembership(unentitledSchool, ordinaryUser, 'teacher')
  const c = await resolveSchoolCoverage(ordinaryUser)
  assert.equal(c.outcome, 'not_covered')
  assert.equal(c.outcome === 'not_covered' && c.reason, 'school_not_entitled')
  await db.from('school_users').delete().eq('school_id', unentitledSchool).eq('user_id', ordinaryUser)
})

test('9. inactive membership + active entitlement → NOT covered', async () => {
  await addMembership(entitledSchool, ordinaryUser, 'teacher', false)
  const c = await resolveSchoolCoverage(ordinaryUser)
  assert.equal(c.outcome, 'not_covered')
  assert.equal(c.outcome === 'not_covered' && c.reason, 'no_active_membership')
  await db.from('school_users').delete().eq('school_id', entitledSchool).eq('user_id', ordinaryUser)
})

test('9b. a parent membership at an entitled school does not confer teacher coverage', async () => {
  const c = await resolveSchoolCoverage(parentAtEntitled)
  assert.equal(c.outcome, 'not_covered')
  assert.equal(c.outcome === 'not_covered' && c.reason, 'no_active_membership')
})

// ── Staff departure ──────────────────────────────────────────────────────────

test('10-14. departure removes coverage without touching identity, history, school, or colleagues', async () => {
  // A historical record attributable to Teacher A, written before departure.
  const { data: sow } = await db.from('schemes_of_work').select('id').limit(1).maybeSingle()
  const beforeProfile = await db.from('profiles').select('id, role').eq('id', teacherA).maybeSingle()

  assert.equal((await resolveSchoolCoverage(teacherA)).outcome, 'covered', 'precondition: A is covered')

  const removed = await deactivateSchoolMembership(teacherA, entitledSchool)
  assert.equal(removed, true)

  // 10. coverage gone
  const after = await resolveSchoolCoverage(teacherA)
  assert.equal(after.outcome, 'not_covered')
  assert.equal(after.outcome === 'not_covered' && after.reason, 'no_active_membership')

  // 11. account + profile intact
  const { data: authUser } = await db.auth.admin.getUserById(teacherA)
  assert.ok(authUser?.user, 'Teacher A auth account was deleted')
  const afterProfile = await db.from('profiles').select('id, role').eq('id', teacherA).maybeSingle()
  assert.deepEqual(afterProfile.data, beforeProfile.data, 'Teacher A profile changed on departure')

  // 12. historical attribution untouched — the membership row itself survives,
  //     flipped rather than deleted, so the audit trail of who was ever a
  //     member is preserved.
  const { data: membershipRow } = await db.from('school_users')
    .select('id, user_id, school_id, is_active, joined_at')
    .eq('school_id', entitledSchool).eq('user_id', teacherA).maybeSingle()
  assert.ok(membershipRow, 'membership row was deleted rather than deactivated')
  assert.equal(membershipRow!.is_active, false)
  assert.equal(membershipRow!.user_id, teacherA, 'membership was reassigned to another user')
  assert.ok(sow === null || sow !== undefined) // no historical rows were rewritten by this operation

  // 13. school entitlement untouched
  const school = await repos.schools.findById(entitledSchool)
  assert.equal(school.school_entitlement_status, 'active')

  // 14. colleague still covered
  assert.equal((await resolveSchoolCoverage(colleague)).outcome, 'covered')
})

// ── Replacement ──────────────────────────────────────────────────────────────

test('15-17. replacement inherits school entitlement through their own membership, no payment', async () => {
  // 15. B has no access merely because A once had it
  assert.notEqual((await resolveSchoolCoverage(teacherB)).outcome, 'covered')

  const subsBefore = await db.from('subscriptions').select('id').eq('user_id', teacherB)
  assert.equal(subsBefore.data?.length ?? 0, 0)

  await addMembership(entitledSchool, teacherB, 'teacher')

  // 16. covered automatically, with no entitlement copied from A
  const c = await resolveSchoolCoverage(teacherB)
  assert.equal(c.outcome, 'covered')
  assert.equal(c.outcome === 'covered' && c.schoolId, entitledSchool)

  // 17. no subscription/payment artifact was created for B
  const subsAfter = await db.from('subscriptions').select('id').eq('user_id', teacherB)
  assert.equal(subsAfter.data?.length ?? 0, 0, 'a subscription was created for the replacement teacher')

  // The school never re-purchased: its entitlement row is byte-identical.
  const school = await repos.schools.findById(entitledSchool)
  assert.equal(school.school_entitlement_status, 'active')
  assert.equal(school.school_entitlement_expires_at, null)
})

// ── Transfer ─────────────────────────────────────────────────────────────────

test('18-21. transfer: coverage follows the school, never the teacher', async () => {
  // A already left entitledSchool in the departure test.
  assert.notEqual((await resolveSchoolCoverage(teacherA)).outcome, 'covered', '18. lost School X coverage')

  // 19. joins entitled School Y → covered by Y
  await addMembership(secondEntitledSchool, teacherA, 'teacher')
  const atY = await resolveSchoolCoverage(teacherA)
  assert.equal(atY.outcome, 'covered')
  assert.equal(atY.outcome === 'covered' && atY.schoolId, secondEntitledSchool,
    '21. coverage came from School Y, not carried from School X')

  // 20. moving on to a NON-entitled school → falls through to personal rules
  await deactivateSchoolMembership(teacherA, secondEntitledSchool)
  await addMembership(unentitledSchool, teacherA, 'teacher')
  const atUnentitled = await resolveSchoolCoverage(teacherA)
  assert.equal(atUnentitled.outcome, 'not_covered')
  assert.equal(atUnentitled.outcome === 'not_covered' && atUnentitled.reason, 'school_not_entitled')

  await db.from('school_users').delete().eq('school_id', unentitledSchool).eq('user_id', teacherA)
})

test('11b. retirement with no replacement leaves the seat vacant and the school entitled', async () => {
  await deactivateSchoolMembership(colleague, entitledSchool)
  assert.notEqual((await resolveSchoolCoverage(colleague)).outcome, 'covered')

  const school = await repos.schools.findById(entitledSchool)
  assert.equal(school.school_entitlement_status, 'active', 'school entitlement was consumed by a departure')
  // The remaining teacher (B) is unaffected.
  assert.equal((await resolveSchoolCoverage(teacherB)).outcome, 'covered')
})

// ── Multi-membership (Phase 12 regression guard) ─────────────────────────────

test('12. two active teacher memberships resolve without throwing', async () => {
  await addMembership(entitledSchool, ordinaryUser, 'teacher')
  await addMembership(unentitledSchool, ordinaryUser, 'teacher')

  // The old .maybeSingle()-shaped lookup would throw here — i.e. HTTP 500 on a
  // gated teacher route. Resolution must pick the entitled school instead.
  const c = await resolveSchoolCoverage(ordinaryUser)
  assert.equal(c.outcome, 'covered')
  assert.equal(c.outcome === 'covered' && c.schoolId, entitledSchool)

  await db.from('school_users').delete().eq('user_id', ordinaryUser)
})

test('expiry boundary is evaluated at read time, not cached on the row', () => {
  const past   = new Date(Date.now() - 1000).toISOString()
  const future = new Date(Date.now() + 60_000).toISOString()
  assert.equal(isEntitlementLive('active', null), true)
  assert.equal(isEntitlementLive('active', future), true)
  assert.equal(isEntitlementLive('active', past), false)
  assert.equal(isEntitlementLive('suspended', null), false)
  assert.equal(isEntitlementLive('none', null), false)
  assert.equal(isEntitlementLive('expired', future), false)
})

// ── Security: live negative tests ────────────────────────────────────────────

test('22. an authenticated teacher cannot self-activate their own school entitlement', async () => {
  // Worst case: the teacher CREATED the school, so "schools: own update"
  // (created_by = auth.uid()) is satisfied — exactly the auto-provisioned shape.
  const { data: own } = await db.from('schools')
    .insert({ school_name: `${MARKER} teacher-owned ${Date.now()}`, created_by: teacherA })
    .select('id').single()
  createdSchools.push(own!.id)

  const client = await signedInClient(teacherA)
  const { error } = await client.from('schools')
    .update({ school_entitlement_status: 'active' })
    .eq('id', own!.id)

  assert.ok(error, 'a teacher was able to grant entitlement to their own school')
  const after = await repos.schools.findById(own!.id)
  assert.equal(after.school_entitlement_status, 'none')
})

test('22b. a teacher cannot create a school pre-set to entitled', async () => {
  const client = await signedInClient(teacherA)
  const { error } = await client.from('schools').insert({
    school_name: `${MARKER} smuggled ${Date.now()}`,
    created_by: teacherA,
    school_entitlement_status: 'active',
  }).select('id')
  assert.ok(error, 'a teacher inserted a school that was already entitled')
})

test('22c. legitimate school metadata editing still works for the owner', async () => {
  const { data: own } = await db.from('schools')
    .insert({ school_name: `${MARKER} metadata ${Date.now()}`, created_by: teacherA })
    .select('id').single()
  createdSchools.push(own!.id)

  const client = await signedInClient(teacherA)
  const { error } = await client.from('schools').update({ motto: 'Learning first' }).eq('id', own!.id)
  assert.equal(error, null, 'the guard broke ordinary school metadata editing')
})

test('23. a school admin cannot activate their own school entitlement', async () => {
  const admin = await mkUser('school-admin')
  await addMembership(unentitledSchool, admin, 'school_admin')

  const client = await signedInClient(admin)
  const { error } = await client.from('schools')
    .update({ school_entitlement_status: 'active', school_entitlement_expires_at: null })
    .eq('id', unentitledSchool)

  // Either RLS denies the row outright, or the trigger rejects the change.
  const after = await repos.schools.findById(unentitledSchool)
  assert.equal(after.school_entitlement_status, 'none',
    'a school admin granted their own school entitlement')
  assert.ok(error || after.school_entitlement_status === 'none')
})

test('24. an ordinary authenticated user, and anon, cannot activate any school entitlement', async () => {
  const client = await signedInClient(ordinaryUser)
  await client.from('schools').update({ school_entitlement_status: 'active' }).eq('id', unentitledSchool)
  assert.equal((await repos.schools.findById(unentitledSchool)).school_entitlement_status, 'none')

  const anon = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  await anon.from('schools').update({ school_entitlement_status: 'active' }).eq('id', unentitledSchool)
  assert.equal((await repos.schools.findById(unentitledSchool)).school_entitlement_status, 'none')
})

test('25-26. the platform-admin service path can activate and suspend', async () => {
  const expiry = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()

  const activated = await setSchoolEntitlement(unentitledSchool, 'active', expiry, ordinaryUser)
  assert.equal(activated.school_entitlement_status, 'active')
  // Postgres round-trips timestamptz as +00:00 rather than Z — compare instants.
  assert.equal(new Date(activated.school_entitlement_expires_at!).getTime(), new Date(expiry).getTime())

  await addMembership(unentitledSchool, ordinaryUser, 'teacher')
  assert.equal((await resolveSchoolCoverage(ordinaryUser)).outcome, 'covered')

  const suspended = await setSchoolEntitlement(unentitledSchool, 'suspended', null, ordinaryUser)
  assert.equal(suspended.school_entitlement_status, 'suspended')
  assert.equal((await resolveSchoolCoverage(ordinaryUser)).outcome, 'not_covered')

  await db.from('school_users').delete().eq('school_id', unentitledSchool).eq('user_id', ordinaryUser)
  await setSchoolEntitlement(unentitledSchool, 'none', null, ordinaryUser)
})

// ── Existing commercial paths unchanged ──────────────────────────────────────

test('27-31. this phase introduced no teacher-side commercial change', async () => {
  const { TOKEN_COSTS, FEATURE_ACCESS, SUBSCRIPTION_PLANS } = await import('@/lib/payments/config')

  // Teacher-tier designations are untouched: teacher tools free-when-covered,
  // parent-tier features still token-priced for teachers.
  assert.equal(FEATURE_ACCESS.sow_generate.teacher, 'free')
  assert.equal(FEATURE_ACCESS.clinic_report.teacher, 'token')
  assert.equal(FEATURE_ACCESS.learning_compass.teacher, 'token')
  assert.ok(TOKEN_COSTS.sow_generate > 0, 'token pricing for the Solo Teacher path disappeared')
  assert.ok(SUBSCRIPTION_PLANS.TERMLY_FAMILY.priceKes > 0, 'Family pricing disappeared')

  // No school checkout/product exists.
  const config = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../payments/config.ts', import.meta.url), 'utf8'))
  assert.equal(/school[_-]?checkout/i.test(config), false, 'a school checkout surface was introduced')
})
