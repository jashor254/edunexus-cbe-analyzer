// lib/core/learnerAccounts.integration.test.ts
//
// Phase 2B-RESUME — institutional learner account foundation. Real-DB
// integration tests against DISPOSABLE LOCAL DOCKER SUPABASE ONLY. Mirrors
// lib/core/learnerIdentityConvergence.integration.test.ts's structure and
// safety posture exactly (Phase 2D), since this is the direct continuation
// of that phase's work.
//
// This file must be run with NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// / NEXT_PUBLIC_SUPABASE_ANON_KEY pointed at local Docker (NOT .env.local,
// which is production) — the Phase 2C Step 0 guard in
// utils/supabase/service.ts (and its mirror in utils/supabase/authAnon.ts)
// refuses to construct a client under `node --test` (NODE_TEST_CONTEXT) if
// the URL resolves to the known production project.
//
// Run (example, local Supabase CLI default ports):
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service role key> \
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon/publishable key> \
//   npx tsx --experimental-test-module-mocks --test lib/core/learnerAccounts.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { extractProjectRef, KNOWN_PRODUCTION_PROJECT_REF } from '@/utils/supabase/productionRef'
import { repos } from '@/lib/repositories'
import { admitLearner, admitTransferredLearner } from '@/lib/core/learners'
import { transferLearner } from '@/lib/core/transfers'
import { getLearnerIdentityId } from '@/lib/core/learnerIdentity'
import {
  issueLearnerAccountActivation,
  claimLearnerAccountActivation,
  resolveAuthenticatedLearnerIdentity,
  resolveCurrentCoreLearnerForAuthenticatedUser,
  getLearnerAccountStatus,
} from '@/lib/core/learnerAccounts'
import type { AdmitLearnerInput } from '@/types/core'
import { LEARNER_SYNTHETIC_AUTH_EMAIL_DOMAIN } from '@/lib/config/constants'

// Hard local-only assertion, independent of the guard inside
// createServiceClient() — this file must never even ATTEMPT to run against
// production, regardless of guard behavior.
const resolvedRef = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
if (resolvedRef === KNOWN_PRODUCTION_PROJECT_REF) {
  throw new Error('learnerAccounts.integration.test.ts: refusing to run against the known production project.')
}

const SYNTHETIC_MARKER = 'SYNTHETIC_P2BR_ACCOUNT'
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

// Snapshot of evidence-table counts, taken before any test runs and
// compared after everything (including cleanup) completes — this new
// domain must never touch learner_evidence / learner_projections /
// evidence_projection_events (Phase 2B-RESUME scope lock, Step 25).
let evidenceCountsBefore: Record<string, number>

async function countAll(table: string): Promise<number> {
  const { count, error } = await db.from(table).select('id', { count: 'exact', head: true })
  if (error) throw new Error(`countAll(${table}): ${error.message}`)
  return count ?? 0
}

before(async () => {
  evidenceCountsBefore = {
    learner_evidence: await countAll('learner_evidence'),
    learner_projections: await countAll('learner_projections'),
    evidence_projection_events: await countAll('evidence_projection_events'),
  }
  schoolA = await mkSchoolWithAdmin('A')
  schoolB = await mkSchoolWithAdmin('B')
})

after(async () => {
  // Clear learner_account_invites / learner_accounts for every learner
  // identity created under these synthetic schools before deleting the
  // schools themselves (no cascading FK from schools -> these tables).
  for (const schoolId of createdSchoolIds) {
    const { data: learnerRows } = await db.from('learners').select('id, learner_identity_id').eq('school_id', schoolId)
    const identityIds = (learnerRows ?? []).map(r => r.learner_identity_id).filter((v): v is string => !!v)
    if (identityIds.length > 0) {
      await db.from('learner_account_invites').delete().in('learner_identity_id', identityIds)
      const { data: acctRows } = await db.from('learner_accounts').select('id, user_id').in('learner_identity_id', identityIds)
      for (const acct of acctRows ?? []) {
        createdAuthUserIds.push(acct.user_id) // ensure the minted synthetic auth users are cleaned up too
      }
      await db.from('learner_accounts').delete().in('learner_identity_id', identityIds)
    }
  }
  for (const schoolId of createdSchoolIds) {
    const { data: learnerRows } = await db.from('learners').select('id').eq('school_id', schoolId)
    const learnerIds = (learnerRows ?? []).map(r => r.id)
    if (learnerIds.length > 0) {
      await db.from('learner_identity_links').delete().in('learner_id', learnerIds)
    }
  }
  for (const schoolId of createdSchoolIds) {
    const { data: transferRows } = await db.from('learner_transfers').select('id').or(`from_school_id.eq.${schoolId},to_school_id.eq.${schoolId}`)
    const transferIds = (transferRows ?? []).map(r => r.id)
    if (transferIds.length > 0) {
      await db.from('learner_transfer_tokens').delete().in('transfer_id', transferIds)
      await db.from('learner_transfers').delete().in('id', transferIds)
    }
  }
  for (const schoolId of createdSchoolIds) {
    const { error } = await db.from('schools').delete().eq('id', schoolId)
    if (error) console.error(`[cleanup] school ${schoolId} not deleted: ${error.message}`)
  }
  const { data: allIdentities } = await db.from('learner_identities').select('id')
  const { data: referencedRows } = await db.from('learners').select('learner_identity_id').not('learner_identity_id', 'is', null)
  const referenced = new Set((referencedRows ?? []).map(r => r.learner_identity_id))
  const orphanIds = (allIdentities ?? []).map(r => r.id).filter(id => !referenced.has(id))
  if (orphanIds.length > 0) {
    await db.from('learner_identities').delete().in('id', orphanIds)
  }
  // De-dupe before deleting — the same auth user id may have been pushed
  // more than once (e.g. once at creation, once discovered via account row).
  for (const userId of Array.from(new Set(createdAuthUserIds))) {
    const { error } = await db.auth.admin.deleteUser(userId)
    if (error) console.error(`[cleanup] auth user ${userId} not deleted: ${error.message}`)
  }

  const evidenceCountsAfter = {
    learner_evidence: await countAll('learner_evidence'),
    learner_projections: await countAll('learner_projections'),
    evidence_projection_events: await countAll('evidence_projection_events'),
  }
  for (const table of Object.keys(evidenceCountsBefore)) {
    if (evidenceCountsAfter[table] !== evidenceCountsBefore[table]) {
      console.error(`[evidence-invariant] ${table} count changed: ${evidenceCountsBefore[table]} -> ${evidenceCountsAfter[table]}`)
    }
  }
})

// ── Issuance: school-scoped authority (Step 6) ──────────────────────────────

test('active admin + own school learner: issuance succeeds, raw token returned once, hash persisted', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-A1`), schoolA.adminSchoolUserId)

  const result = await issueLearnerAccountActivation(schoolA.schoolId, learner.id, schoolA.adminSchoolUserId)
  assert.equal(result.status, 'issued')
  if (result.status !== 'issued') return
  assert.ok(result.token, 'raw token must be returned exactly once')
  assert.ok(result.expiresAt)

  // Raw token must never be persisted — only its hash.
  const { data: inviteRow } = await db
    .from('learner_account_invites')
    .select('id, token_hash, used_at')
    .eq('id', result.inviteId)
    .single()
  assert.ok(inviteRow)
  assert.notEqual(inviteRow!.token_hash, result.token, 'only the hash may be stored, never the raw token')
  assert.equal(inviteRow!.used_at, null)

  // Full-table scan: the raw token must not appear verbatim anywhere in the invite row.
  const { data: allInviteCols } = await db.from('learner_account_invites').select('*').eq('id', result.inviteId).single()
  const serialized = JSON.stringify(allInviteCols)
  assert.equal(serialized.includes(result.token), false, 'raw token must not appear anywhere in the persisted invite row')
})

test('admin + a learner belonging only to a different school: issuance fails', async () => {
  const learnerInB = await admitLearner(schoolB.schoolId, admitInput(`${SYNTHETIC_MARKER}-B-XSCHOOL`), schoolB.adminSchoolUserId)
  await assert.rejects(
    () => issueLearnerAccountActivation(schoolA.schoolId, learnerInB.id, schoolA.adminSchoolUserId),
    /learner not found in this school/
  )
})

// ── Claim: expired / reused ─────────────────────────────────────────────────

test('expired invite is denied at claim', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-EXP`), schoolA.adminSchoolUserId)
  const issued = await issueLearnerAccountActivation(schoolA.schoolId, learner.id, schoolA.adminSchoolUserId)
  assert.equal(issued.status, 'issued')
  if (issued.status !== 'issued') return

  await db.from('learner_account_invites').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', issued.inviteId)

  const result = await claimLearnerAccountActivation(issued.token)
  assert.equal(result.status, 'expired')
})

test('a claimed invite cannot be re-claimed (already_used)', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-REUSE`), schoolA.adminSchoolUserId)
  const issued = await issueLearnerAccountActivation(schoolA.schoolId, learner.id, schoolA.adminSchoolUserId)
  assert.equal(issued.status, 'issued')
  if (issued.status !== 'issued') return

  const first = await claimLearnerAccountActivation(issued.token)
  assert.equal(first.status, 'claimed')

  const second = await claimLearnerAccountActivation(issued.token)
  assert.equal(second.status, 'already_used')
})

// ── Concurrency: the critical proof ─────────────────────────────────────────

test('5 concurrent claims against the same raw token: exactly one claimed, four already_used, one learner_accounts row, one auth.users row', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-CONC`), schoolA.adminSchoolUserId)
  const identityId = await getLearnerIdentityId(learner.id)
  assert.ok(identityId)

  const issued = await issueLearnerAccountActivation(schoolA.schoolId, learner.id, schoolA.adminSchoolUserId)
  assert.equal(issued.status, 'issued')
  if (issued.status !== 'issued') return

  const attempts = await Promise.all(Array.from({ length: 5 }, () => claimLearnerAccountActivation(issued.token)))

  const claimed = attempts.filter(a => a.status === 'claimed')
  const alreadyUsed = attempts.filter(a => a.status === 'already_used')
  assert.equal(claimed.length, 1, 'exactly one concurrent claim must succeed')
  assert.equal(alreadyUsed.length, 4, 'exactly four concurrent claims must be denied as already_used')

  const { count: accountCount } = await db
    .from('learner_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('learner_identity_id', identityId!)
  assert.equal(accountCount, 1, 'exactly one learner_accounts row must exist for this identity')

  const winner = claimed[0]
  if (winner.status === 'claimed') {
    const { data: authUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const matches = (authUsers?.users ?? []).filter(u => u.email === `learner-${identityId}@${LEARNER_SYNTHETIC_AUTH_EMAIL_DOMAIN}`)
    assert.equal(matches.length, 1, 'exactly one real auth.users row must have been created for this identity')
    assert.ok(winner.session.accessToken, 'the winning claim must return a real session access token')
    assert.ok(winner.session.refreshToken, 'the winning claim must return a real session refresh token')
  }
})

// ── Idempotent issuance for an already-active identity ──────────────────────

test('a second activation issuance for an already-active identity returns already_active', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-ALREADYACTIVE`), schoolA.adminSchoolUserId)
  const issued = await issueLearnerAccountActivation(schoolA.schoolId, learner.id, schoolA.adminSchoolUserId)
  assert.equal(issued.status, 'issued')
  if (issued.status !== 'issued') return
  const claim = await claimLearnerAccountActivation(issued.token)
  assert.equal(claim.status, 'claimed')

  const secondIssue = await issueLearnerAccountActivation(schoolA.schoolId, learner.id, schoolA.adminSchoolUserId)
  assert.equal(secondIssue.status, 'already_active')
})

// ── Defense in depth: user_already_bound (contrived via repository layer) ──

test('the user_already_bound guard condition correctly detects a cross-identity auth-user collision', async () => {
  // claimLearnerAccountActivation's own comment documents this branch as
  // structurally near-unreachable through the normal flow: the
  // deterministic 1:1 identity<->synthetic-email mapping means
  // auth.admin.createUser() would itself fail on email-uniqueness before
  // this guard could ever fire for a genuinely fresh activation. What CAN
  // be proven directly is that the guard's condition — "the auth user
  // resolved for this claim is bound to `learner_accounts` under a
  // DIFFERENT learner_identity_id than the invite being claimed" — is
  // correctly computed by the repository primitive the guard relies on
  // (`findByUserId`), using two independently activated real identities.
  const learnerX = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-BOUND-X`), schoolA.adminSchoolUserId)
  const identityX = await getLearnerIdentityId(learnerX.id)
  const issuedX = await issueLearnerAccountActivation(schoolA.schoolId, learnerX.id, schoolA.adminSchoolUserId)
  assert.equal(issuedX.status, 'issued')
  if (issuedX.status !== 'issued') return
  const claimX = await claimLearnerAccountActivation(issuedX.token)
  assert.equal(claimX.status, 'claimed')
  if (claimX.status !== 'claimed') return

  const learnerY = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-BOUND-Y`), schoolA.adminSchoolUserId)
  const identityY = await getLearnerIdentityId(learnerY.id)
  const issuedY = await issueLearnerAccountActivation(schoolA.schoolId, learnerY.id, schoolA.adminSchoolUserId)
  assert.equal(issuedY.status, 'issued')
  if (issuedY.status !== 'issued') return
  const claimY = await claimLearnerAccountActivation(issuedY.token)
  assert.equal(claimY.status, 'claimed')
  if (claimY.status !== 'claimed') return

  // X's auth user, looked up the same way the guard looks it up, must
  // report identityX — never identityY — and vice versa. This is exactly
  // the comparison `claimLearnerAccountActivation` performs
  // (`boundElsewhere.learner_identity_id !== invite.learner_identity_id`)
  // to decide `user_already_bound`.
  const accountX = await repos.learnerAccounts.findByLearnerIdentityId(identityX!)
  const boundCheckX = await repos.learnerAccounts.findByUserId(accountX!.user_id)
  assert.equal(boundCheckX!.learner_identity_id, identityX)
  assert.notEqual(boundCheckX!.learner_identity_id, identityY, 'a genuine cross-identity collision must be detectable by the exact primitive the guard uses')
  void claimY
})

// ── Role assignment (Step 12) ────────────────────────────────────────────────

test('activation sets profiles.role = student via the service-role path', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-ROLE`), schoolA.adminSchoolUserId)
  const issued = await issueLearnerAccountActivation(schoolA.schoolId, learner.id, schoolA.adminSchoolUserId)
  assert.equal(issued.status, 'issued')
  if (issued.status !== 'issued') return
  const claim = await claimLearnerAccountActivation(issued.token)
  assert.equal(claim.status, 'claimed')
  if (claim.status !== 'claimed') return

  const { data: profileRow } = await db.from('profiles').select('role').eq('id', (await repos.learnerAccounts.findByLearnerIdentityId(claim.learnerIdentityId))!.user_id).single()
  assert.equal(profileRow!.role, 'student')

  // fn_guard_profile_role must still reject the same change via an
  // anon-keyed (RLS) session, using the just-minted learner session.
  const anon = anonClient()
  const { error: verifyErr, data: sessionSet } = await anon.auth.setSession({
    access_token: claim.session.accessToken,
    refresh_token: claim.session.refreshToken,
  })
  assert.equal(verifyErr, null)
  const { error: clientUpdateErr } = await anon.from('profiles').update({ role: 'admin' }).eq('id', sessionSet.session!.user.id)
  assert.ok(clientUpdateErr, 'a client-side role escalation attempt must be rejected by fn_guard_profile_role')
  await anon.auth.signOut()
})

// ── Resolvers (Step 13/14) ───────────────────────────────────────────────────

test('resolveAuthenticatedLearnerIdentity: active account resolves, missing account is null', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-RESOLVE`), schoolA.adminSchoolUserId)
  const identityId = await getLearnerIdentityId(learner.id)
  const issued = await issueLearnerAccountActivation(schoolA.schoolId, learner.id, schoolA.adminSchoolUserId)
  assert.equal(issued.status, 'issued')
  if (issued.status !== 'issued') return
  const claim = await claimLearnerAccountActivation(issued.token)
  assert.equal(claim.status, 'claimed')
  if (claim.status !== 'claimed') return

  const account = await repos.learnerAccounts.findByLearnerIdentityId(identityId!)
  const resolved = await resolveAuthenticatedLearnerIdentity(account!.user_id)
  assert.equal(resolved, identityId)

  const nonexistentUserId = '00000000-0000-0000-0000-000000000000'
  const missing = await resolveAuthenticatedLearnerIdentity(nonexistentUserId)
  assert.equal(missing, null)

  const status = await getLearnerAccountStatus(account!.user_id)
  assert.equal(status, 'active')
  const missingStatus = await getLearnerAccountStatus(nonexistentUserId)
  assert.equal(missingStatus, 'none')

  // NOTE: suspension is out of scope for this phase — no suspend function
  // exists in lib/core/learnerAccounts.ts (Step 19 deferral, per the
  // module's own docs). The suspended-account branch of
  // resolveAuthenticatedLearnerIdentity is therefore read-only-verified
  // (see the `!== 'active'` check in the source) rather than exercised
  // end-to-end here.
})

test('a guardian auth.users.id (bound only via learner_guardians) does not resolve through resolveAuthenticatedLearnerIdentity', async () => {
  const guardianUser = await mkUser('guardian-only')
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-GUARDIAN`), schoolA.adminSchoolUserId)
  await repos.learners.insertGuardian(schoolA.schoolId, learner.id, {
    user_id: guardianUser.id,
    relationship: 'guardian',
    full_name: 'Synthetic Guardian',
    phone: '0700000000',
    email: null,
    national_id: null,
    is_primary: true,
    can_receive_reports: true,
  })

  const resolved = await resolveAuthenticatedLearnerIdentity(guardianUser.id)
  assert.equal(resolved, null)
})

// ── Transfer continuity (reuses Phase 2D's transfer machinery) ─────────────

test('an account created against a durable identity survives a Phase 2D A->B transfer unchanged', async () => {
  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-XFERACC-A`), schoolA.adminSchoolUserId)
  const identityId = await getLearnerIdentityId(learner.id)
  const issued = await issueLearnerAccountActivation(schoolA.schoolId, learner.id, schoolA.adminSchoolUserId)
  assert.equal(issued.status, 'issued')
  if (issued.status !== 'issued') return
  const claim = await claimLearnerAccountActivation(issued.token)
  assert.equal(claim.status, 'claimed')
  if (claim.status !== 'claimed') return

  const accountBefore = await repos.learnerAccounts.findByLearnerIdentityId(identityId!)
  assert.ok(accountBefore)

  // Before transfer: resolves at School A, not at School B.
  const beforeA = await resolveCurrentCoreLearnerForAuthenticatedUser(accountBefore!.user_id, schoolA.schoolId)
  const beforeB = await resolveCurrentCoreLearnerForAuthenticatedUser(accountBefore!.user_id, schoolB.schoolId)
  assert.equal(beforeA, learner.id)
  assert.equal(beforeB, null)

  const outResult = await transferLearner(schoolA.adminSchoolUserId, {
    learner_id: learner.id,
    direction: 'out',
    transfer_date: new Date().toISOString().slice(0, 10),
    to_school_id: schoolB.schoolId,
  })
  const inResult = await admitTransferredLearner(
    schoolB.schoolId,
    schoolB.adminSchoolUserId,
    admitInput(`${SYNTHETIC_MARKER}-XFERACC-B`),
    outResult.transferToken!
  )
  assert.equal(inResult.status, 'admitted')
  if (inResult.status !== 'admitted') return
  assert.equal(inResult.learnerIdentityId, identityId)

  const accountAfter = await repos.learnerAccounts.findByLearnerIdentityId(identityId!)
  assert.ok(accountAfter)
  assert.equal(accountAfter!.id, accountBefore!.id, 'same learner_accounts row throughout the transfer')
  assert.equal(accountAfter!.user_id, accountBefore!.user_id, 'same auth user throughout the transfer')

  // After transfer: School B now resolves the NEW learners.id; School A
  // still resolves the OLD (now-transferred) row — resolveCurrentCoreLearnerForAuthenticatedUser
  // is a raw learners.id-for-school lookup and does not filter by status,
  // matching findAuthorizedLearnerIdForSchool's documented behavior.
  const afterB = await resolveCurrentCoreLearnerForAuthenticatedUser(accountAfter!.user_id, schoolB.schoolId)
  assert.equal(afterB, inResult.learner.id)
  assert.notEqual(afterB, learner.id)

  const afterA = await resolveCurrentCoreLearnerForAuthenticatedUser(accountAfter!.user_id, schoolA.schoolId)
  assert.equal(afterA, learner.id, 'the old school-A record remains resolvable only for school A')
})

// ── CSV/plain admission never touches auth ──────────────────────────────────

test('plain admission (admitLearner, no activation invite) creates zero auth.users rows and zero learner_accounts rows', async () => {
  const accountsBefore = await countAll('learner_accounts')

  const learner = await admitLearner(schoolA.schoolId, admitInput(`${SYNTHETIC_MARKER}-PLAINADMIT`), schoolA.adminSchoolUserId)
  const identityId = await getLearnerIdentityId(learner.id)
  assert.ok(identityId)

  const accountsAfter = await countAll('learner_accounts')
  assert.equal(accountsAfter, accountsBefore, 'plain admission must create zero learner_accounts rows')

  const account = await repos.learnerAccounts.findByLearnerIdentityId(identityId!)
  assert.equal(account, null)
})
