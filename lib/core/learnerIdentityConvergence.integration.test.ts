// lib/core/learnerIdentityConvergence.integration.test.ts
//
// Phase 2D — durable learner identity + transfer continuity. Real-DB
// integration tests against DISPOSABLE LOCAL DOCKER SUPABASE ONLY (Phase
// 2D Step 23 — no production migration, no production mutation, ever).
//
// This file must be run with NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// / NEXT_PUBLIC_SUPABASE_ANON_KEY pointed at local Docker (NOT .env.local,
// which is production) — the Phase 2C Step 0 guard in
// utils/supabase/service.ts refuses to construct a service client under
// `node --test` (NODE_TEST_CONTEXT) if the URL resolves to the known
// production project, so a mistaken .env.local load fails loudly here
// rather than mutating production data.
//
// Run (example, local Supabase CLI default ports):
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service role key> \
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon/publishable key> \
//   npx tsx --experimental-test-module-mocks --test lib/core/learnerIdentityConvergence.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { extractProjectRef, KNOWN_PRODUCTION_PROJECT_REF } from '@/utils/supabase/productionRef'
import { repos } from '@/lib/repositories'
import { admitLearner, admitTransferredLearner } from '@/lib/core/learners'
import { transferLearner, consumeLearnerTransferToken } from '@/lib/core/transfers'
import { backfillLearnerIdentities, getLearnerIdentityId, getIdentityLinkHistory } from '@/lib/core/learnerIdentity'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { asLearnerId } from '@/lib/core/identityTypes'
import type { AdmitLearnerInput } from '@/types/core'

// Hard local-only assertion, independent of the guard inside
// createServiceClient() — this file must never even ATTEMPT to run
// against production, regardless of guard behavior.
const resolvedRef = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
if (resolvedRef === KNOWN_PRODUCTION_PROJECT_REF) {
  throw new Error('learnerIdentityConvergence.integration.test.ts: refusing to run against the known production project.')
}

const SYNTHETIC_MARKER = 'SYNTHETIC_P2D_IDENTITY'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function mkSchoolWithAdmin(label: string): Promise<{ schoolId: string; adminUserId: string; adminEmail: string; adminSchoolUserId: string }> {
  const admin = await mkUser(`${label}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${label}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')
  const schoolUser = await repos.teachers.findSchoolUser(admin.id, school.id)
  if (!schoolUser) throw new Error('mkSchoolWithAdmin: school_users row not found after addSchoolUser')
  return { schoolId: school.id, adminUserId: admin.id, adminEmail: admin.email, adminSchoolUserId: schoolUser.id }
}

function anonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

function admitInput(admissionNumber: string): AdmitLearnerInput {
  return {
    admission_number: admissionNumber,
    first_name: SYNTHETIC_MARKER,
    last_name: 'Learner',
  }
}

let schoolA: Awaited<ReturnType<typeof mkSchoolWithAdmin>>
let schoolB: Awaited<ReturnType<typeof mkSchoolWithAdmin>>
let schoolC: Awaited<ReturnType<typeof mkSchoolWithAdmin>>

before(async () => {
  schoolA = await mkSchoolWithAdmin('A')
  schoolB = await mkSchoolWithAdmin('B')
  schoolC = await mkSchoolWithAdmin('C')
})

after(async () => {
  // learner_identity_links.linked_by -> school_users(id) has NO ACTION on
  // delete (deliberate — provenance must never silently vanish just
  // because a staff member's membership row is later removed, matching
  // this codebase's "teacher_id means who entered it, not who owns it"
  // rule). That means a plain cascading `schools` delete is blocked until
  // this synthetic test's own link/token rows are cleared explicitly first.
  // Pass 1 (ALL schools): delete every learner_identity_links row first —
  // a transfer belonging to School A can be referenced by a link belonging
  // to School B's learner (the receiving side), so links across every
  // synthetic school must be gone before ANY of these schools' transfers
  // are deleted, not interleaved school-by-school.
  for (const schoolId of createdSchoolIds) {
    const { data: learnerRows } = await db.from('learners').select('id').eq('school_id', schoolId)
    const learnerIds = (learnerRows ?? []).map(r => r.id)
    if (learnerIds.length > 0) {
      const { error } = await db.from('learner_identity_links').delete().in('learner_id', learnerIds)
      if (error) console.error(`[cleanup] links for school ${schoolId} not deleted: ${error.message}`)
    }
  }
  // Pass 2 (ALL schools): now safe to delete transfers/tokens.
  for (const schoolId of createdSchoolIds) {
    const { data: transferRows } = await db.from('learner_transfers').select('id').or(`from_school_id.eq.${schoolId},to_school_id.eq.${schoolId}`)
    const transferIds = (transferRows ?? []).map(r => r.id)
    if (transferIds.length > 0) {
      await db.from('learner_transfer_tokens').delete().in('transfer_id', transferIds)
      const { error } = await db.from('learner_transfers').delete().in('id', transferIds)
      if (error) console.error(`[cleanup] transfers for school ${schoolId} not deleted: ${error.message}`)
    }
  }
  for (const schoolId of createdSchoolIds) {
    const { error } = await db.from('schools').delete().eq('id', schoolId)
    if (error) console.error(`[cleanup] school ${schoolId} not deleted: ${error.message}`)
  }
  // Orphaned learner_identities (no FK back to schools/learners to cascade
  // from — deliberate, per the migration's own header, since a durable
  // identity may legitimately outlive every learner row that ever pointed
  // at it during a correction). Sweep any identity no `learners` row
  // references anymore, safe on disposable local Docker only.
  const { data: allIdentities } = await db.from('learner_identities').select('id')
  const { data: referencedRows } = await db.from('learners').select('learner_identity_id').not('learner_identity_id', 'is', null)
  const referenced = new Set((referencedRows ?? []).map(r => r.learner_identity_id))
  const orphanIds = (allIdentities ?? []).map(r => r.id).filter(id => !referenced.has(id))
  if (orphanIds.length > 0) {
    await db.from('learner_identities').delete().in('id', orphanIds)
  }
  for (const userId of createdAuthUserIds) {
    const { error } = await db.auth.admin.deleteUser(userId)
    if (error) console.error(`[cleanup] auth user ${userId} not deleted: ${error.message}`)
  }
})

// ── Test 1: ordinary admission mints a fresh durable identity ──────────────

test('normal admission (no transfer token) mints a fresh durable identity, reason admission_default', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-ADM-1`), schoolA.adminSchoolUserId)
  const identityId = await getLearnerIdentityId(learner.id)
  assert.ok(identityId, 'learner_identity_id must be set after admission')

  const links = await getIdentityLinkHistory(learner.id)
  assert.equal(links.length, 1)
  assert.equal(links[0].linkage_reason, 'admission_default')
  assert.equal(links[0].learner_identity_id, identityId)
  assert.equal(links[0].superseded_at, null)
  assert.equal(links[0].linked_by, schoolA.adminSchoolUserId)
})

// ── Test 2-4: transfer-out issues token, transfer-in consumes it, same identity ─

let transferAtoB_learnerA: string
let transferAtoB_learnerB: string
let transferAtoB_identity: string
let transferAtoB_rawToken: string

test('transfer-out issues a single-use token bound to the source durable identity', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-XFER-A`), schoolA.adminSchoolUserId)
  transferAtoB_learnerA = learner.id
  transferAtoB_identity = (await getLearnerIdentityId(learner.id))!

  const result = await transferLearner(schoolA.adminSchoolUserId, {
    learner_id: learner.id,
    direction: 'out',
    transfer_date: new Date().toISOString().slice(0, 10),
    to_school_id: schoolB.schoolId,
  })

  assert.ok(result.transferToken, 'transfer-out must return a raw token exactly once')
  assert.ok(result.transferTokenExpiresAt)
  transferAtoB_rawToken = result.transferToken!

  const { data: tokenRow } = await db
    .from('learner_transfer_tokens')
    .select('token_hash, consumed_at, expires_at')
    .eq('transfer_id', result.id)
    .single()
  assert.notEqual(tokenRow!.token_hash, transferAtoB_rawToken, 'only the hash may be stored, never the raw token')
  assert.equal(tokenRow!.consumed_at, null)

  // Source-side history remains: status transferred, enrollment withdrawn — unchanged pre-existing behavior.
  const { data: sourceLearner } = await db.from('learners').select('status').eq('id', learner.id).single()
  assert.equal(sourceLearner!.status, 'transferred')
})

test('transfer-in consumption at the correct receiving school creates a NEW learners row bound to the SAME durable identity', async () => {
  const result = await admitTransferredLearner(
    schoolB.schoolId,
    schoolB.adminSchoolUserId,
    admitInput(`${SYNTHETIC_MARKER}-XFER-B`),
    transferAtoB_rawToken
  )
  assert.equal(result.status, 'admitted')
  if (result.status !== 'admitted') return
  transferAtoB_learnerB = result.learner.id

  assert.notEqual(transferAtoB_learnerB, transferAtoB_learnerA, 'transfer-in must never reuse the old learners.id')
  assert.equal(result.learnerIdentityId, transferAtoB_identity, 'the new School B row must share the SAME durable identity as School A')

  const links = await getIdentityLinkHistory(transferAtoB_learnerB)
  assert.equal(links.length, 1)
  assert.equal(links[0].linkage_reason, 'transfer_token')
  assert.equal(links[0].linked_by, schoolB.adminSchoolUserId)

  const { data: tokenRow } = await db
    .from('learner_transfer_tokens')
    .select('consumed_at, consumed_by_learner_id')
    .eq('id', (await db.from('learner_transfer_tokens').select('id').eq('consumed_by_learner_id', transferAtoB_learnerB).single()).data!.id)
    .single()
  assert.ok(tokenRow!.consumed_at)
  assert.equal(tokenRow!.consumed_by_learner_id, transferAtoB_learnerB)
})

test('the same transfer token cannot be consumed a second time', async () => {
  const result = await admitTransferredLearner(
    schoolB.schoolId,
    schoolB.adminSchoolUserId,
    admitInput(`${SYNTHETIC_MARKER}-XFER-B-RETRY`),
    transferAtoB_rawToken
  )
  assert.equal(result.status, 'already_consumed')
})

// ── Test 5: race safety — 5 concurrent claims, exactly one wins ────────────

test('5-way concurrent transfer-in consumption: exactly one succeeds, four denied, exactly one new learners row', async () => {
  // A fresh transfer from School B's just-created learner, out to School C.
  const outResult = await transferLearner(schoolB.adminSchoolUserId, {
    learner_id: transferAtoB_learnerB,
    direction: 'out',
    transfer_date: new Date().toISOString().slice(0, 10),
    to_school_id: schoolC.schoolId,
  })
  const rawToken = outResult.transferToken!

  const attempts = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      admitTransferredLearner(schoolC.schoolId, schoolC.adminSchoolUserId, admitInput(`${SYNTHETIC_MARKER}-CONC-${i}`), rawToken)
    )
  )

  const admitted = attempts.filter(a => a.status === 'admitted')
  const denied = attempts.filter(a => a.status === 'already_consumed')
  assert.equal(admitted.length, 1, 'exactly one concurrent claim must succeed')
  assert.equal(denied.length, 4, 'exactly four concurrent claims must be denied as already_consumed')

  const { count } = await db
    .from('learners')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolC.schoolId)
    .eq('learner_identity_id', transferAtoB_identity)
  assert.equal(count, 1, 'exactly one new School C learners row must exist for this identity')

  const winner = admitted[0]
  if (winner.status === 'admitted') {
    // A→B→C continuity — Step 14. Three distinct learners.id, one durable identity.
    assert.equal(winner.learnerIdentityId, transferAtoB_identity)
    const ids = new Set([transferAtoB_learnerA, transferAtoB_learnerB, winner.learner.id])
    assert.equal(ids.size, 3, 'A, B, C must be three DISTINCT learners.id rows')
  }
})

// ── Test 6: expired token denied ────────────────────────────────────────────

test('expired transfer token is denied', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-EXP-SRC`), schoolA.adminSchoolUserId)
  const outResult = await transferLearner(schoolA.adminSchoolUserId, {
    learner_id: learner.id,
    direction: 'out',
    transfer_date: new Date().toISOString().slice(0, 10),
    to_school_id: schoolB.schoolId,
  })
  // Force expiry directly — no public setter exists for this (deliberately;
  // only the DB default TTL sets expires_at in production code paths).
  await db.from('learner_transfer_tokens').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('transfer_id', outResult.id)

  const result = await admitTransferredLearner(schoolB.schoolId, schoolB.adminSchoolUserId, admitInput(`${SYNTHETIC_MARKER}-EXP-DST`), outResult.transferToken!)
  assert.equal(result.status, 'expired')
})

// ── Test 7: school authority — token alone is not sufficient ───────────────

test('the SOURCE school cannot consume its own transfer-out token', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-SELF-SRC`), schoolA.adminSchoolUserId)
  const outResult = await transferLearner(schoolA.adminSchoolUserId, {
    learner_id: learner.id,
    direction: 'out',
    transfer_date: new Date().toISOString().slice(0, 10),
    to_school_id: schoolB.schoolId,
  })
  const result = await consumeLearnerTransferToken(schoolA.schoolId, outResult.transferToken!)
  assert.equal(result.status, 'wrong_school')

  // Token must remain unconsumed after a denied wrong-school attempt.
  const { data: tokenRow } = await db.from('learner_transfer_tokens').select('consumed_at').eq('transfer_id', outResult.id).single()
  assert.equal(tokenRow!.consumed_at, null)
})

test('a school other than the designated receiving school cannot consume the token', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-WRONGDST-SRC`), schoolA.adminSchoolUserId)
  const outResult = await transferLearner(schoolA.adminSchoolUserId, {
    learner_id: learner.id,
    direction: 'out',
    transfer_date: new Date().toISOString().slice(0, 10),
    to_school_id: schoolB.schoolId, // designated receiver is School B, not C
  })
  const result = await consumeLearnerTransferToken(schoolC.schoolId, outResult.transferToken!)
  assert.equal(result.status, 'wrong_school')
})

// ── Test 8: no-token admission mints a fresh identity, no global search ────

test('no-token admission at a new school mints a fresh, unrelated identity', async () => {
  const learner = await admitLearner(schoolC.schoolId, admitInput(`${SYNTHETIC_MARKER}-NOTOKEN`), schoolC.adminSchoolUserId)
  const identityId = await getLearnerIdentityId(learner.id)
  assert.ok(identityId)
  assert.notEqual(identityId, transferAtoB_identity)
  const links = await getIdentityLinkHistory(learner.id)
  assert.equal(links[0].linkage_reason, 'admission_default')
})

// ── Test 9: deterministic backfill idempotency (unit-level, real DB) ───────

test('backfillLearnerIdentities is idempotent — a second run creates nothing', async () => {
  const first = await backfillLearnerIdentities()
  const second = await backfillLearnerIdentities()
  assert.equal(second.learnersProcessed, 0)
  assert.equal(second.identitiesCreated, 0)
  assert.equal(second.linksCreated, 0)
  void first
})

// ── Test 10: RLS — cross-school isolation on the new tables ────────────────

test('a School A staff member cannot read School B learner_identity_links via RLS', async () => {
  const sessionA = await signInAs(schoolA.adminEmail)
  try {
    const { data, error } = await sessionA
      .from('learner_identity_links')
      .select('id')
      .eq('learner_id', transferAtoB_learnerB) // a School B learner row
    // RLS denies the row (empty result), never an error that would leak existence.
    assert.equal(error, null)
    assert.equal((data ?? []).length, 0)
  } finally {
    await sessionA.auth.signOut()
  }
})

test('a School B staff member CAN read their own School B learner_identity_links', async () => {
  const sessionB = await signInAs(schoolB.adminEmail)
  try {
    const { data, error } = await sessionB
      .from('learner_identity_links')
      .select('id, linkage_reason')
      .eq('learner_id', transferAtoB_learnerB)
    assert.equal(error, null)
    assert.equal((data ?? []).length, 1)
  } finally {
    await sessionB.auth.signOut()
  }
})

test('no school-staff session can read learner_identities directly (deny-all)', async () => {
  const sessionA = await signInAs(schoolA.adminEmail)
  try {
    const { data, error } = await sessionA.from('learner_identities').select('id').limit(1)
    assert.equal(error, null)
    assert.equal((data ?? []).length, 0)
  } finally {
    await sessionA.auth.signOut()
  }
})

test('no school-staff session can read learner_transfer_tokens (token_hash never enumerable)', async () => {
  const sessionB = await signInAs(schoolB.adminEmail)
  try {
    const { data, error } = await sessionB.from('learner_transfer_tokens').select('token_hash').limit(1)
    assert.equal(error, null)
    assert.equal((data ?? []).length, 0)
  } finally {
    await sessionB.auth.signOut()
  }
})

// ── Test 11: legacy students.external_id bridge is unaffected ──────────────

test('resolveLegacyStudentId is unaffected by durable-identity introduction (Step 18 regression)', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-BRIDGE`), schoolA.adminSchoolUserId)
  // No students row bridged yet for a brand-new learner — must be null, not
  // an error, and must not be affected by the new learner_identity_id column.
  const resolved = await resolveLegacyStudentId(asLearnerId(learner.id))
  assert.equal(resolved, null)
})
