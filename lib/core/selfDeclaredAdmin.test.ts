// lib/core/selfDeclaredAdmin.test.ts
//
// Live RLS regression tests for the self-declared-admin cross-tenant privilege
// escalation closed by
// supabase/migrations/20260812190000_close_self_declared_admin_escalation.sql.
//
// Every negative test below SUCCEEDED against production before that migration.
// They run against the real database with real anon/authenticated clients,
// because the thing under test IS the database's authorization behaviour.
//
// Run with: npx tsx --env-file=.env.local --test lib/core/selfDeclaredAdmin.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_ADMIN_ESCALATION'
const db = createServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const createdUsers: string[] = []
const createdSchools: string[] = []
const createdStudents: string[] = []

/** The ordinary authenticated attacker. */
let attacker: string
let attackerClient: Awaited<ReturnType<typeof signIn>>
/** An unrelated user whose data must stay private. */
let victim: string
let victimCreds: { email: string; password: string }
let victimStudentId: string
let victimSchool: string

async function mkUser(label: string) {
  const email = `admesc-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  createdUsers.push(data.user.id)
  return { id: data.user.id, email, password }
}

async function signIn(email: string, password: string) {
  const client = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn: ${error.message}`)
  return client
}

before(async () => {
  const a = await mkUser('attacker')
  attacker = a.id
  attackerClient = await signIn(a.email, a.password)
  await db.from('profiles').upsert({ id: attacker, role: 'teacher' }, { onConflict: 'id' })

  const v = await mkUser('victim')
  victim = v.id
  victimCreds = { email: v.email, password: v.password }

  const { data: school } = await db.from('schools')
    .insert({ school_name: `${MARKER} ${Date.now()}` }).select('id').single()
  victimSchool = school!.id
  createdSchools.push(victimSchool)

  const { data: student } = await db.from('students')
    .insert({ name: `${MARKER} Learner`, grade: 7, user_id: victim, school_id: victimSchool })
    .select('id').single()
  victimStudentId = student!.id
  createdStudents.push(victimStudentId)

  await db.from('token_balances').upsert(
    { user_id: victim, balance: 42, total_ever: 42 }, { onConflict: 'user_id' })
})

after(async () => {
  for (const id of createdStudents) await db.from('students').delete().eq('id', id)
  for (const id of createdSchools) {
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdUsers) {
    await db.from('token_balances').delete().eq('user_id', id)
    await db.from('teachers').delete().eq('user_id', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

// ── Root cause: privileged role is not self-assignable ───────────────────────

test('1. a user cannot insert their own teachers row with role=admin', async () => {
  const { error } = await attackerClient.from('teachers').insert({
    user_id: attacker, full_name: MARKER, school: MARKER, role: 'admin',
  })
  assert.ok(error, 'self-insert of an admin teacher row succeeded')
  const { data } = await db.from('teachers').select('role').eq('user_id', attacker).maybeSingle()
  assert.equal(data ?? null, null)
})

test('2. a user cannot update their own teachers row to admin', async () => {
  const { error: legit } = await attackerClient.from('teachers').insert({
    user_id: attacker, full_name: MARKER, school: MARKER, role: 'teacher',
  })
  assert.equal(legit, null, 'a legitimate teacher profile could not be created')

  await attackerClient.from('teachers').update({ role: 'admin' }).eq('user_id', attacker)
  const { data } = await db.from('teachers').select('role').eq('user_id', attacker).single()
  assert.equal(data!.role, 'teacher', 'self-promotion to admin succeeded')
})

test('3-4. ordinary teacher profile creation and non-privileged edits still work', async () => {
  // Creation proved in test 2. Editing a non-privileged field must still work —
  // the guard must not have frozen the whole row.
  const { error } = await attackerClient.from('teachers')
    .update({ full_name: `${MARKER} Renamed`, phone: '+254700000000' })
    .eq('user_id', attacker)
  assert.equal(error, null, 'ordinary teacher profile editing was broken by the guard')

  const { data } = await db.from('teachers').select('full_name, role').eq('user_id', attacker).single()
  assert.equal(data!.full_name, `${MARKER} Renamed`)
  assert.equal(data!.role, 'teacher')
})

test('5. a user cannot promote their own profiles.role to admin', async () => {
  await attackerClient.from('profiles').update({ role: 'admin' }).eq('id', attacker)
  const { data } = await db.from('profiles').select('role').eq('id', attacker).single()
  assert.equal(data!.role, 'teacher', 'profiles.role self-promotion succeeded')
})

test('5b. non-privileged profile fields remain client-editable', async () => {
  const { error } = await attackerClient.from('profiles')
    .update({ full_name: `${MARKER} Person` }).eq('id', attacker)
  assert.equal(error, null, 'ordinary profile editing was broken by the guard')
})

// ── The value is no longer trusted, even when it exists ──────────────────────

test('6-10. an EXISTING admin row grants no cross-tenant access (historical rows are inert)', async () => {
  // Planted with the service role — the one way an admin row can still appear.
  // This is the important half of the fix: even a genuine admin row must confer
  // nothing at the RLS boundary, so a bad row that predates this migration (or
  // any future write path we miss) is harmless.
  await db.from('teachers').update({ role: 'admin' }).eq('user_id', attacker)
  await db.from('profiles').update({ role: 'admin' }).eq('id', attacker)

  const students = await attackerClient.from('students').select('id').eq('id', victimStudentId)
  assert.equal(students.data?.length ?? 0, 0, 'read an unrelated student')

  const balances = await attackerClient.from('token_balances').select('user_id').eq('user_id', victim)
  assert.equal(balances.data?.length ?? 0, 0, "read an unrelated user's token balance")

  const sows = await attackerClient.from('schemes_of_work').select('id', { count: 'exact', head: true })
  assert.equal(sows.count ?? 0, 0, 'read unrelated schemes of work')

  const plans = await attackerClient.from('lesson_plans').select('id', { count: 'exact', head: true })
  assert.equal(plans.count ?? 0, 0, 'read unrelated lesson plans')

  const cfgRead = await attackerClient.from('app_config').select('*', { count: 'exact', head: true })
  assert.equal(cfgRead.count ?? 0, 0, 'read app_config')

  const alerts = await attackerClient.from('student_alerts').select('id', { count: 'exact', head: true })
  assert.equal(alerts.count ?? 0, 0, 'read unrelated student alerts')

  const classes = await attackerClient.from('teacher_classes').select('id', { count: 'exact', head: true })
  assert.equal(classes.count ?? 0, 0, 'read unrelated teacher classes')

  // Restore so later tests see an ordinary user.
  await db.from('teachers').update({ role: 'teacher' }).eq('user_id', attacker)
  await db.from('profiles').update({ role: 'teacher' }).eq('id', attacker)
})

test('11. an admin row grants no cross-tenant WRITE either', async () => {
  await db.from('teachers').update({ role: 'admin' }).eq('user_id', attacker)

  await attackerClient.from('students').update({ name: 'HACKED' }).eq('id', victimStudentId)
  const { data: student } = await db.from('students').select('name').eq('id', victimStudentId).single()
  assert.ok(student!.name.startsWith(MARKER), "an unrelated student record was modified")

  await attackerClient.from('token_balances').update({ balance: 999999 }).eq('user_id', victim)
  const { data: bal } = await db.from('token_balances').select('balance').eq('user_id', victim).single()
  assert.equal(bal!.balance, 42, "an unrelated user's token balance was modified")

  await attackerClient.from('students').delete().eq('id', victimStudentId)
  const { data: still } = await db.from('students').select('id').eq('id', victimStudentId).maybeSingle()
  assert.ok(still, 'an unrelated student record was deleted')

  await db.from('teachers').update({ role: 'teacher' }).eq('user_id', attacker)
})

// ── token_balances, specifically (financially sensitive) ─────────────────────

test('12. token balances cannot be read, forged, or altered by any client', async () => {
  const forge = await attackerClient.from('token_balances')
    .insert({ user_id: attacker, balance: 999999, total_ever: 999999 })
  assert.ok(forge.error, 'a client forged their own token balance')

  const own = await attackerClient.from('token_balances').select('balance').eq('user_id', attacker)
  assert.equal(own.error, null, 'own-balance read was broken')

  const cross = await attackerClient.from('token_balances').select('balance').eq('user_id', victim)
  assert.equal(cross.data?.length ?? 0, 0, "read another user's balance")

  const del = await attackerClient.from('token_balances').delete().eq('user_id', victim)
  assert.ok(del.error, 'a client deleted a token balance')

  // Legitimate server-side crediting is unaffected.
  await db.from('token_balances').upsert(
    { user_id: attacker, balance: 5, total_ever: 5 }, { onConflict: 'user_id' })
  const { data: credited } = await db.from('token_balances').select('balance').eq('user_id', attacker).single()
  assert.equal(credited!.balance, 5, 'service-role token crediting broke')
})

// ── Learner data privacy ─────────────────────────────────────────────────────

test('13. anon cannot read learner data', async () => {
  const anon = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { data } = await anon.from('students').select('id').eq('id', victimStudentId)
  assert.equal(data?.length ?? 0, 0, 'anonymous client read learner data')
})

test('14. an unrelated teacher cannot reach an unrelated learner', async () => {
  const { data } = await attackerClient.from('students').select('id').eq('id', victimStudentId)
  assert.equal(data?.length ?? 0, 0)
})

test('15. an unrelated school admin cannot reach another school\'s learner', async () => {
  const other = await mkUser('other-schooladmin')
  const { data: otherSchool } = await db.from('schools')
    .insert({ school_name: `${MARKER} other ${Date.now()}` }).select('id').single()
  createdSchools.push(otherSchool!.id)
  await db.from('school_users').insert({
    school_id: otherSchool!.id, user_id: other.id, role: 'school_admin', is_active: true,
  })

  const client = await signIn(other.email, other.password)
  const { data } = await client.from('students').select('id').eq('id', victimStudentId)
  assert.equal(data?.length ?? 0, 0, "a school admin read another school's learner")
})

test('16. legitimate school-scoped staff access is PRESERVED', async () => {
  // The isolation above must come from scoping, not from breaking the feature.
  const staff = await mkUser('victim-schooladmin')
  await db.from('school_users').insert({
    school_id: victimSchool, user_id: staff.id, role: 'school_admin', is_active: true,
  })

  const client = await signIn(staff.email, staff.password)
  const { data, error } = await client.from('students').select('id, name').eq('id', victimStudentId)
  assert.equal(error, null)
  assert.equal(data?.length, 1, 'school staff lost legitimate access to their own school\'s learner')
})

test('17. legitimate own-record access is PRESERVED', async () => {
  // The learner themselves still reads their own row via "students: own read".
  const client = await signIn(victimCreds.email, victimCreds.password)
  const { data, error } = await client.from('students').select('id, name').eq('id', victimStudentId)
  assert.equal(error, null)
  assert.equal(data?.length, 1, 'a learner lost access to their own record')
})
