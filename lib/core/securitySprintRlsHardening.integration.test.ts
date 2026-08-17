// lib/core/securitySprintRlsHardening.integration.test.ts
//
// Security remediation sprint (2026-08-04) — proves the PostgREST/RPC-level
// fixes against real, signed-in, RLS-bound clients (not the service-role
// client every other test in this codebase uses to set up fixtures), the
// same pattern lib/intelligence/evidenceAndBalanceRls.integration.test.ts
// established for Sprint 1.
//
// What this proves, migration by migration:
//   1. 20260804120000_..._phase1_provision_teacher_school.sql —
//      provision_teacher_school(uuid, text) can no longer be called by
//      anon or authenticated (previously: any signed-in — or even
//      anonymous — caller could provision a school and grant school_admin
//      membership for an arbitrary user id, because it was SECURITY
//      DEFINER with an un-revoked PUBLIC execute grant). Also proves the
//      one real call site (lib/core/institutionOwnership.ts, via
//      createServiceClient()) still works end-to-end.
//   2. 20260804120100_..._phase2_3_scope_always_true_policies.sql — 15
//      RLS policies with USING(true)/WITH CHECK(true) and no role
//      restriction (defaulting to PUBLIC) are now scoped TO service_role.
//      This test covers the two highest-stakes ones directly reachable by
//      a signed-in but unrelated user: parent_profiles (PII) and
//      capability_history (forgeable learner evidence) — plus one
//      curriculum-reference table (sow_grades) as a representative of the
//      other 8 sow_*/kicd_curriculum_lessons policies fixed the same way.
//
// ⚠️ Creates real (throwaway) auth.users accounts and parent_profiles/
// capability_history/students rows, all deleted in `after()`, including on
// failure. Never touches sow_grades/pilot_tracking/notification_log/
// early_access_leads with real inserts (curriculum + business-ops tables) —
// those are covered by the negative RPC-permission proof only, run inside a
// transaction-scoped role simulation in Supabase during the sprint itself
// (see the sprint's own verification notes), not repeated here as a
// standing test to avoid leaving synthetic rows in shared reference data.
//
// Run: npx tsx --env-file=.env.local --test lib/core/securitySprintRlsHardening.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { resolveOwningSchool } from './institutionOwnership'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_SECURITY_SPRINT_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const authUserIds: string[] = []
const studentIds: string[] = []
const capabilityHistoryIds: string[] = []
const schoolIds: string[] = []
const schoolUserIds: string[] = []

let parentA: { id: string; email: string }
let parentB: { id: string; email: string } // unrelated — must never see/touch A's data
let studentAId: string
let provisioningUserId: string

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

function anonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

before(async () => {
  parentA = await mkAuthUser('sec-sprint-parentA')
  parentB = await mkAuthUser('sec-sprint-parentB')
  provisioningUserId = (await mkAuthUser('sec-sprint-provisioning')).id

  const { error: ppErr } = await db.from('parent_profiles').insert({ id: parentA.id, children_count: 1 })
  if (ppErr) throw ppErr

  const { data: student, error: studentErr } = await db.from('students')
    .insert({ name: `${SYNTHETIC_MARKER}_student`, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, parent_user_id: parentA.id, user_id: parentA.id, added_by: 'parent' })
    .select('id').single()
  if (studentErr) throw studentErr
  studentAId = student.id
  studentIds.push(student.id)
})

after(async () => {
  if (capabilityHistoryIds.length > 0) await db.from('capability_history').delete().in('id', capabilityHistoryIds)
  if (schoolUserIds.length > 0) await db.from('school_users').delete().in('id', schoolUserIds)
  if (schoolIds.length > 0) await db.from('schools').delete().in('id', schoolIds)
  await db.from('students').delete().in('id', studentIds)
  await db.from('parent_profiles').delete().eq('id', parentA.id)
  for (const id of authUserIds) await deleteAuthUserOrThrow(db, id)
  console.log('[cleanup] synthetic security-sprint fixtures removed')
})

// ── provision_teacher_school: PUBLIC execute revoked ────────────────────────

test('anon cannot call provision_teacher_school at all', async () => {
  const client = anonClient()
  const { error } = await client.rpc('provision_teacher_school', {
    p_user_id: provisioningUserId,
    p_school_name: `${SYNTHETIC_MARKER}_anon_attack`,
  })
  assert.ok(error, 'expected a permission error')
  assert.match(error!.message, /permission denied|not been assigned|service_role/i)
})

test('a signed-in user cannot call provision_teacher_school to provision a school for another user', async () => {
  const client = await signInAs(parentA.email)
  const { error } = await client.rpc('provision_teacher_school', {
    p_user_id: provisioningUserId, // a different real user id, not parentA
    p_school_name: `${SYNTHETIC_MARKER}_authenticated_attack`,
  })
  assert.ok(error, 'expected a permission error')
  assert.match(error!.message, /permission denied|not been assigned|service_role/i)
})

test('resolveOwningSchool (the one real call site, via service client) still works end-to-end', async () => {
  const result = await resolveOwningSchool(provisioningUserId, `${SYNTHETIC_MARKER}_legit_school`)
  assert.ok(result.schoolId)
  assert.equal(result.created, true)
  schoolIds.push(result.schoolId)

  const { data: membership, error } = await db.from('school_users')
    .select('id').eq('user_id', provisioningUserId).eq('school_id', result.schoolId).single()
  if (error) throw error
  schoolUserIds.push(membership.id)
})

// ── parent_profiles: "Service role can do everything" scoped to service_role ─

test('an unrelated signed-in user cannot read another parent\'s profile', async () => {
  const client = await signInAs(parentB.email)
  const { data } = await client.from('parent_profiles').select('id').eq('id', parentA.id)
  assert.equal(data?.length ?? 0, 0)
})

test('an unrelated signed-in user cannot update another parent\'s profile', async () => {
  const client = await signInAs(parentB.email)
  const { data: updateResult } = await client
    .from('parent_profiles')
    .update({ children_count: 999 })
    .eq('id', parentA.id)
    .select('id')
  assert.equal(updateResult?.length ?? 0, 0)

  const { data: after } = await db.from('parent_profiles').select('children_count').eq('id', parentA.id).single()
  assert.notEqual(after?.children_count, 999)
})

test('a parent can still read and update their own profile (owner policy untouched)', async () => {
  const client = await signInAs(parentA.email)
  const { data: read, error: readErr } = await client.from('parent_profiles').select('children_count').eq('id', parentA.id).single()
  assert.equal(readErr, null)
  assert.equal(read?.children_count, 1)

  const { data: updated, error: updateErr } = await client
    .from('parent_profiles')
    .update({ children_count: 2 })
    .eq('id', parentA.id)
    .select('children_count')
    .single()
  assert.equal(updateErr, null)
  assert.equal(updated?.children_count, 2)
})

// ── capability_history: INSERT WITH CHECK(true) scoped to service_role ──────

test('a signed-in user cannot forge a capability_history row for any student', async () => {
  const client = await signInAs(parentB.email)
  const { error } = await client.from('capability_history').insert({
    student_id: studentAId,
    capability_profile: { forged: true },
    assessment_count: 1,
  })
  assert.ok(error, 'expected an RLS error')
  assert.match(error!.message, /row-level security|permission denied/i)
})

test('service_role can still insert capability_history (the real evidence-ingestion path)', async () => {
  const { data, error } = await db.from('capability_history').insert({
    student_id: studentAId,
    capability_profile: { [SYNTHETIC_MARKER]: true },
    assessment_count: 1,
  }).select('id').single()
  assert.equal(error, null)
  assert.ok(data?.id)
  capabilityHistoryIds.push(data!.id)
})

test('the owning parent can read their own child\'s capability_history (read-own policy untouched)', async () => {
  const client = await signInAs(parentA.email)
  const { data, error } = await client.from('capability_history').select('id').eq('student_id', studentAId)
  assert.equal(error, null)
  assert.ok((data?.length ?? 0) >= 1)
})
