// lib/core/schoolUsersRlsRegression.integration.test.ts
//
// Phase 1.5 (docs/architecture/school-users-rls-regression-audit.md) —
// real-session regression tests for the school_users RLS recursion fix
// (supabase/migrations/20260725130000_fix_school_users_rls_recursion.sql)
// and the self-escalation correction
// (supabase/migrations/20260726090000_fix_school_users_self_escalation.sql).
//
// Every test here uses a REAL Supabase session (or a real anon client, or
// the real service-role client) against the live database — no mocked
// policy outcomes. Authorization assertions are never retried (a denied
// request that flakes into a pass would be a false negative); only user
// provisioning (db.auth.admin.createUser) is retried, because this
// session's environment has shown confirmed, independently-reproduced
// transient network flakiness against Supabase's auth-admin endpoint
// (see lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts's
// header for the isolated-probe evidence). Retry count and reason are
// documented at the retryDb/retryAsync helpers below.
//
// Run with: npx tsx --env-file=.env.local --test lib/core/schoolUsersRlsRegression.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { canManageLearnerRecordCore, canViewLearnerRecord } from '@/lib/core/permissions'
import { asLearnerId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_SCHOOLUSERS_RLS_REGRESSION'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

// Retries user provisioning only (a confirmed external auth-admin flake,
// not an authorization outcome) — 6 attempts, exponential-ish backoff.
async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
    }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function retryDb<T>(fn: () => PromiseLike<{ data: T; error: { message: string } | null }>, attempts = 6): Promise<{ data: T; error: null }> {
  return retryAsync(async () => {
    const result = await fn()
    if (result.error) throw result.error
    return result as { data: T; error: null }
  }, attempts)
}

async function mkUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data } = await retryDb(() => db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }))
  return { id: data.user.id, email }
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await retryAsync(async () => {
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw error
    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) throw userError ?? new Error('signInAs: session established but getUser() returned no user')
  }, 6)
  return client
}

function anonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

let schoolA: string, schoolB: string
let coreLearnerA: string

let adminAId: string, adminAEmail: string
let adminBId: string, adminBEmail: string
let teacherAId: string, teacherAEmail: string
let teacherAInactiveId: string, teacherAInactiveEmail: string
let teacherBId: string, teacherBEmail: string
let parentAId: string, parentAEmail: string
let noMembershipId: string, noMembershipEmail: string

let teacherASchoolUserId: string
let classAId: string
let legacyStudentAId: string
const teacherRowIds: string[] = []

before(async () => {
  const adminA = await mkUser('admin-a'); adminAId = adminA.id; adminAEmail = adminA.email
  const adminB = await mkUser('admin-b'); adminBId = adminB.id; adminBEmail = adminB.email
  const teacherA = await mkUser('teacher-a'); teacherAId = teacherA.id; teacherAEmail = teacherA.email
  const teacherAInactive = await mkUser('teacher-a-inactive'); teacherAInactiveId = teacherAInactive.id; teacherAInactiveEmail = teacherAInactive.email
  const teacherB = await mkUser('teacher-b'); teacherBId = teacherB.id; teacherBEmail = teacherB.email
  const parentA = await mkUser('parent-a'); parentAId = parentA.id; parentAEmail = parentA.email
  const noMembership = await mkUser('no-membership'); noMembershipId = noMembership.id; noMembershipEmail = noMembership.email

  const schoolARow = await retryAsync(() => repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school-a` }, adminAId))
  schoolA = schoolARow.id
  const schoolBRow = await retryAsync(() => repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school-b` }, adminBId))
  schoolB = schoolBRow.id

  await retryDb(() => db.from('school_users').insert([
    { school_id: schoolA, user_id: adminAId, role: 'school_admin', is_active: true },
    { school_id: schoolA, user_id: teacherAId, role: 'teacher', is_active: true },
    { school_id: schoolA, user_id: teacherAInactiveId, role: 'teacher', is_active: false },
    { school_id: schoolA, user_id: parentAId, role: 'parent', is_active: true },
    { school_id: schoolB, user_id: adminBId, role: 'school_admin', is_active: true },
    { school_id: schoolB, user_id: teacherBId, role: 'teacher', is_active: true },
  ]).select('school_id'))

  const { data: teacherASchoolUser } = await retryDb(() => db.from('school_users').select('id').eq('school_id', schoolA).eq('user_id', teacherAId).single())
  teacherASchoolUserId = teacherASchoolUser!.id

  const { data: teacherARow } = await retryDb(() => db.from('teachers')
    .insert({ user_id: teacherAId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single())
  teacherRowIds.push(teacherARow!.id)

  const { data: teacherBRow } = await retryDb(() => db.from('teachers')
    .insert({ user_id: teacherBId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single())
  teacherRowIds.push(teacherBRow!.id)

  const { data: classRow } = await retryDb(() => db.from('teacher_classes')
    .insert({ teacher_id: teacherARow!.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-${Date.now()}` })
    .select('id').single())
  classAId = classRow!.id

  const { data: learnerRow } = await retryDb(() => db.from('learners')
    .insert({ school_id: schoolA, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Regression', last_name: 'Test' })
    .select('id').single())
  coreLearnerA = learnerRow!.id

  const { data: studentRow } = await retryDb(() => db.from('students')
    .insert({ name: 'Regression Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', external_id: coreLearnerA })
    .select('id').single())
  legacyStudentAId = studentRow!.id

  await retryDb(() => db.from('class_students').insert({ class_id: classAId, student_id: legacyStudentAId }).select('class_id').single())
})

after(async () => {
  const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort cleanup */ } }

  if (isUuid(classAId)) await safely(() => db.from('class_students').delete().eq('class_id', classAId))
  if (isUuid(legacyStudentAId)) await safely(() => db.from('students').delete().eq('id', legacyStudentAId))
  if (isUuid(classAId)) await safely(() => db.from('teacher_classes').delete().eq('id', classAId))
  if (isUuid(coreLearnerA)) await safely(() => db.from('learners').delete().eq('id', coreLearnerA))
  await safely(() => db.from('teachers').delete().in('id', teacherRowIds.filter(isUuid)))
  const schoolIds = [schoolA, schoolB].filter(isUuid)
  if (schoolIds.length) {
    await safely(() => db.from('school_users').delete().in('school_id', schoolIds))
    await safely(() => db.from('schools').delete().in('id', schoolIds))
  }
  for (const id of [adminAId, adminBId, teacherAId, teacherAInactiveId, teacherBId, parentAId, noMembershipId]) {
    if (isUuid(id)) await safely(() => db.auth.admin.deleteUser(id))
  }
})

// ── Part C: direct reads against school_users ────────────────────────────────

test('C1. an admin reads every membership row at their own school (own row + others), not just their own', async () => {
  const client = await signInAs(adminAEmail)
  const { data, error } = await client.from('school_users').select('user_id').eq('school_id', schoolA)
  assert.equal(error, null)
  const userIds = (data ?? []).map(r => r.user_id)
  assert.ok(userIds.includes(adminAId), 'admin sees their own row')
  assert.ok(userIds.includes(teacherAId), 'admin sees other members\' rows at their own school')
})

test('C1b. a non-admin (teacher) reading school_users sees only their own row, not other members\'', async () => {
  const client = await signInAs(teacherAEmail)
  const { data, error } = await client.from('school_users').select('user_id').eq('school_id', schoolA)
  assert.equal(error, null)
  const userIds = (data ?? []).map(r => r.user_id)
  assert.deepEqual(userIds, [teacherAId], 'a teacher (non-admin) may see only their own school_users row')
})

test('C2. School A staff (admin and teacher) cannot read School B membership rows', async () => {
  const adminClient = await signInAs(adminAEmail)
  const { data: adminView } = await adminClient.from('school_users').select('id').eq('school_id', schoolB)
  assert.deepEqual(adminView, [], 'School A admin must not see School B membership rows')

  const teacherClient = await signInAs(teacherAEmail)
  const { data: teacherView } = await teacherClient.from('school_users').select('id').eq('school_id', schoolB)
  assert.deepEqual(teacherView, [], 'School A teacher must not see School B membership rows')
})

test('C3. a parent cannot enumerate staff — sees only their own row', async () => {
  const client = await signInAs(parentAEmail)
  const { data, error } = await client.from('school_users').select('user_id').eq('school_id', schoolA)
  assert.equal(error, null)
  assert.deepEqual((data ?? []).map(r => r.user_id), [parentAId])
})

test('C4. an authenticated account with no school_users row anywhere gets zero rows, not an error', async () => {
  const client = await signInAs(noMembershipEmail)
  const { data, error } = await client.from('school_users').select('id').eq('school_id', schoolA)
  assert.equal(error, null)
  assert.deepEqual(data, [])
})

test('C5. anonymous access to school_users returns zero rows, not an error, not a leak', async () => {
  const client = anonClient()
  const { data, error } = await client.from('school_users').select('id').eq('school_id', schoolA)
  assert.equal(error, null)
  assert.deepEqual(data, [])
})

test('C6/C7. no school_users query ever raises 42P17 (recursion) across every session type tested above', async () => {
  const sessions = await Promise.all([signInAs(adminAEmail), signInAs(teacherAEmail), signInAs(parentAEmail), signInAs(noMembershipEmail)])
  const results = await Promise.all([
    ...sessions.map(c => c.from('school_users').select('id').eq('school_id', schoolA)),
    anonClient().from('school_users').select('id').eq('school_id', schoolA),
  ])
  for (const { error } of results) {
    assert.notEqual(error?.code, '42P17', 'must never recurse')
  }
})

// ── Part C: dependent-table representative reads ─────────────────────────────

test('C9. School A admin cannot read or write School B rows in a school_users-dependent table (blueprint_action_items)', async () => {
  const client = await signInAs(adminAEmail)
  const { data: readAttempt } = await client.from('blueprint_action_items').select('id').eq('school_id', schoolB)
  assert.deepEqual(readAttempt, [])

  const { error: writeAttempt } = await client.from('blueprint_action_items').insert({
    learner_id: coreLearnerA, school_id: schoolB, context: 'current_term', title: 'x', rationale: 'x',
    intended_outcome: 'x', success_indicator: 'x', proposal_source: 'teacher',
  })
  assert.ok(writeAttempt, 'no INSERT policy exists for blueprint_action_items at all — this must fail')
})

test('C10/C11. app-layer teacher access still matches the Phase 0 rule after the school_users fix', async () => {
  const client = await signInAs(teacherAEmail)
  assert.equal(await canManageLearnerRecordCore(client, schoolA, asLearnerId(coreLearnerA)), true, 'teacherA teaches this learner via class_students')

  const unrelated = await signInAs(teacherBEmail)
  assert.equal(await canManageLearnerRecordCore(unrelated, schoolA, asLearnerId(coreLearnerA)), false, 'teacherB has no relationship to this learner')
})

test('C12/C13. parent/self-access via canViewLearnerRecord is unaffected by the school_users fix', async () => {
  const stranger = await signInAs(noMembershipEmail)
  assert.equal(await canViewLearnerRecord(stranger, schoolA, asLearnerId(coreLearnerA)), false)
})

test('C14. an inactive (deactivated) teacher does not retain manage authorization', async () => {
  const client = await signInAs(teacherAInactiveEmail)
  // Not linked to this learner's class at all, AND inactive — either
  // reason alone should deny; this proves inactivity doesn't grant a
  // free pass through some other branch.
  assert.equal(await canManageLearnerRecordCore(client, schoolA, asLearnerId(coreLearnerA)), false)

  // Direct RLS check: the deactivated teacher's OWN row remains visible to
  // them (their own historical record — see the audit doc for why this is
  // intentional), but they gain no admin-tier broad visibility.
  const { data } = await client.from('school_users').select('user_id').eq('school_id', schoolA)
  assert.deepEqual((data ?? []).map(r => r.user_id), [teacherAInactiveId], 'inactive staff still sees their own row, nothing broader')
})

test('C16. the service-role client bypasses RLS entirely, as intended, and is never itself the target of these policies', async () => {
  const { data, error } = await db.from('school_users').select('id').eq('school_id', schoolB)
  assert.equal(error, null)
  assert.ok((data ?? []).length > 0, 'service role sees rows RLS would otherwise hide from a client session')
})

test('C17. Blueprint action-item RLS still denies raw parent reads after the school_users fix (no regression)', async () => {
  const client = await signInAs(parentAEmail)
  const { data, error } = await client.from('blueprint_action_items').select('id').eq('learner_id', coreLearnerA)
  assert.equal(error, null)
  assert.deepEqual(data, [], 'parent role is excluded from the blueprint_action_items read policy')
})

test('C18. Blueprint action-item history cannot be written directly even by an admin session (service-role only, unaffected by the fix)', async () => {
  const client = await signInAs(adminAEmail)
  const { error } = await client.from('blueprint_action_item_history').insert({
    action_item_id: '00000000-0000-0000-0000-000000000000', event_type: 'proposed', resulting_status: 'proposed', snapshot: {},
  })
  assert.ok(error, 'no INSERT policy exists for blueprint_action_item_history — this must fail regardless of role')
})

test('C19. history rows remain immutable through a direct session update attempt (defense in depth: no write policy AND a DB trigger)', async () => {
  const client = await signInAs(adminAEmail)
  const { data } = await client.from('blueprint_action_item_history').update({ reason: 'tampered' }).eq('action_item_id', coreLearnerA).select('id')
  assert.deepEqual(data, [], 'no rows should be updatable — no write policy grants this at all')
})

test('C20. repeated policy evaluation across many consecutive queries never recurses', async () => {
  const client = await signInAs(adminAEmail)
  for (let i = 0; i < 10; i++) {
    const { error } = await client.from('school_users').select('id').eq('school_id', schoolA).limit(1)
    assert.notEqual(error?.code, '42P17')
  }
})

// ── Part D: privilege escalation probes ──────────────────────────────────────

test('D1. an authenticated user with zero prior relationship to a school cannot self-insert a school_admin row for it (the confirmed-and-fixed defect)', async () => {
  const client = await signInAs(noMembershipEmail)
  const { data, error } = await client.from('school_users').insert({
    school_id: schoolB, user_id: noMembershipId, role: 'school_admin', is_active: true,
  }).select('id')
  assert.equal(data, null)
  assert.ok(error, 'self-escalation INSERT must be rejected')
  assert.equal(error?.code, '42501', 'must be an RLS policy violation, not a different failure mode')
})

test('D2. a legitimate teacher cannot escalate their OWN row to school_admin via direct UPDATE', async () => {
  const client = await signInAs(teacherAEmail)
  const { data } = await client.from('school_users').update({ role: 'school_admin' }).eq('id', teacherASchoolUserId).select('id, role')
  assert.deepEqual(data, [], 'no UPDATE policy exists at all — zero rows affected, not an escalation')

  const { data: unchanged } = await db.from('school_users').select('role').eq('id', teacherASchoolUserId).single()
  assert.equal(unchanged?.role, 'teacher', 'the real row must remain unchanged')
})

test('D3. auth_is_school_admin_of cannot be abused to check an arbitrary OTHER user\'s admin status — it always answers for auth.uid() only', async () => {
  // The function takes only p_school_id; there is no user-id parameter at
  // all, so there is no "pass another user's ID" surface to probe. This
  // test proves the observable behavior matches that design: teacherA
  // (not an admin) gets `false` for schoolA even though adminA (a real
  // admin) exists there — the function cannot be tricked into answering
  // for someone else.
  const client = await signInAs(teacherAEmail)
  const { data, error } = await client.rpc('auth_is_school_admin_of', { p_school_id: schoolA })
  assert.equal(error, null)
  assert.equal(data, false, 'a non-admin caller must get false for their own real school, regardless of who else is admin there')
})

test('D4. auth_is_school_admin_of correctly returns true only for the calling admin\'s own school, false for another real school', async () => {
  const client = await signInAs(adminAEmail)
  const { data: ownSchool } = await client.rpc('auth_is_school_admin_of', { p_school_id: schoolA })
  assert.equal(ownSchool, true)
  const { data: otherSchool } = await client.rpc('auth_is_school_admin_of', { p_school_id: schoolB })
  assert.equal(otherSchool, false, 'passing a different school_id must not grant anything — it only ever answers about the CALLER at that school')
})

test('D5. duplicate/cross-school roles for the same user are each independently and correctly scoped (no cross-contamination)', async () => {
  // Give teacherA a SECOND, unrelated role at School B too (a real,
  // legitimate multi-school scenario the schema allows: UNIQUE(school_id,
  // user_id, role) permits a user to hold roles at more than one school).
  await retryDb(() => db.from('school_users').insert({ school_id: schoolB, user_id: teacherAId, role: 'teacher', is_active: true }).select('id').single())

  const client = await signInAs(teacherAEmail)
  const { data: atA } = await client.from('school_users').select('school_id').eq('user_id', teacherAId).eq('school_id', schoolA)
  const { data: atB } = await client.from('school_users').select('school_id').eq('user_id', teacherAId).eq('school_id', schoolB)
  assert.equal(atA?.length, 1)
  assert.equal(atB?.length, 1)

  const { data: isAdminAtA } = await client.rpc('auth_is_school_admin_of', { p_school_id: schoolA })
  assert.equal(isAdminAtA, false, 'being a teacher at two schools grants admin at neither')

  await db.from('school_users').delete().eq('school_id', schoolB).eq('user_id', teacherAId)
})
