// lib/core/learnerAccounts.ts
//
// Phase 2B-RESUME — institutional learner account foundation. Builds on
// Phase 2D's durable identity (lib/core/learnerIdentity.ts): the canonical
// chain is `auth.users.id -> learner_accounts -> learner_identities.id ->
// current authorized learners.id -> learner_enrollments`, never
// `auth.users -> learners.id` directly (Phase 2A's original, corrected,
// binding — a learner's `learners.id` does not survive inter-school
// transfer, their `learner_identity_id` does).
//
// AUTH BOOTSTRAP (Step 7/8, verified against local Supabase before this
// module was written — see the phase closeout report): Core learners carry
// no email or phone. This module mints a real `auth.users` identity with a
// deterministic, PII-free SYNTHETIC email
// (`learner-<learner_identity_id>@LEARNER_SYNTHETIC_AUTH_EMAIL_DOMAIN`,
// `.invalid` TLD, RFC 2606 — guaranteed never to resolve, never emailed
// to), created with NO password. A real Supabase session is established by
// calling `auth.admin.generateLink({type:'magiclink'})` (server-side,
// sends no email) and immediately redeeming its `hashed_token` via
// `auth.verifyOtp` on an anon-keyed client (utils/supabase/authAnon.ts).
// Supabase owns the credential/session lifecycle end to end; this codebase
// never stores or handles a learner password. The activation TOKEN
// (learner_account_invites) and the SUPABASE OTP token_hash are two
// different, independently single-use secrets — the invite gates WHO may
// bootstrap WHICH identity; the OTP token_hash is Supabase's own
// session-minting primitive, generated fresh at claim time and never
// persisted by us.
import { repos } from '@/lib/repositories'
import { createServiceClient } from '@/utils/supabase/service'
import { createAnonAuthClient } from '@/utils/supabase/authAnon'
import { generateTransferToken, hashTransferToken } from '@/lib/core/transferTokens'
import { LEARNER_ACCOUNT_INVITE_TTL_DAYS, LEARNER_SYNTHETIC_AUTH_EMAIL_DOMAIN } from '@/lib/config/constants'
import type {
  IssueLearnerAccountActivationResult,
  ClaimLearnerAccountActivationResult,
  LearnerAccountInvitePurpose,
} from '@/types/core'

/** Deterministic, PII-free synthetic email for a durable identity's auth bootstrap. Never displayed to the learner, never used to send mail. */
function syntheticLearnerEmail(learnerIdentityId: string): string {
  return `learner-${learnerIdentityId}@${LEARNER_SYNTHETIC_AUTH_EMAIL_DOMAIN}`
}

function inviteExpiryFromNow(): string {
  return new Date(Date.now() + LEARNER_ACCOUNT_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

/** Resolves the `school_users.id` (not the auth user id) for an already-authenticated (userId, schoolId) pair — used to populate `learner_account_invites.issued_by`. Returns null if no active membership (caller should already have verified admin authority before reaching this — see `requireSchoolAdmin`). */
export async function resolveIssuingSchoolUserId(userId: string, schoolId: string): Promise<string | null> {
  return repos.learnerAccounts.findActiveSchoolUserId(userId, schoolId)
}

// ── Step 6: school-scoped issuance authority ────────────────────────────────

/**
 * Issues (or idempotently re-returns) a one-time activation code for a
 * learner currently under `schoolId`'s legitimate authority.
 *
 * Authority chain (Step 6): the caller supplies `learnerId` — a
 * `learners.id` — NOT a `learner_identity_id`. The durable identity is
 * derived server-side from the school-scoped lookup
 * (`findLearnerIdentityIdForSchoolLearner`, which filters on both
 * `id` AND `school_id`), so a school can never supply an arbitrary durable
 * identity it does not currently hold a `learners` row for. Route-level
 * callers must additionally have already verified the actor is an active
 * admin of `schoolId` (lib/core/permissions.ts::requireSchoolAdmin) before
 * calling this — that check is NOT repeated here because it depends on the
 * request's Supabase client/session, which this service-role-only module
 * deliberately does not take as a parameter.
 */
export async function issueLearnerAccountActivation(
  schoolId: string,
  learnerId: string,
  issuedBySchoolUserId: string | null
): Promise<IssueLearnerAccountActivationResult> {
  const learnerIdentityId = await repos.learnerAccounts.findLearnerIdentityIdForSchoolLearner(learnerId, schoolId)
  if (!learnerIdentityId) {
    throw new Error('issueLearnerAccountActivation: learner not found in this school, or has no durable identity yet.')
  }

  // Step 16 — a school may only issue a FIRST activation. Once an account
  // exists (anywhere, for any school), a second school must never be able
  // to create a second auth identity for the same durable identity.
  const existingAccount = await repos.learnerAccounts.findByLearnerIdentityId(learnerIdentityId)
  if (existingAccount) {
    return { status: 'already_active' }
  }

  // Idempotent re-issuance (Step 5, mirrors createGuardianInvite's
  // established "check before create" idiom): a still-valid pending
  // invite is returned again rather than creating a second live one — a
  // second invite would be a second valid claim path for the same
  // identity, which Step 3's cardinality intent forbids in spirit even
  // though the DB constraint alone would still only allow one to succeed.
  const existingInvite = await repos.learnerAccounts.findActivePendingInvite(learnerIdentityId, 'activation')
  if (existingInvite) {
    throw new Error('issueLearnerAccountActivation: a pending activation invite already exists for this learner — re-issuance of the raw token is not possible once returned (only its hash is stored). Wait for it to expire, or add an explicit revoke path before reissuing.')
  }

  const rawToken = generateTransferToken() // generic 32-byte random token primitive — reused, not duplicated (Step 24)
  const tokenHash = await hashTransferToken(rawToken)
  const expiresAt = inviteExpiryFromNow()

  const invite = await repos.learnerAccounts.insertInvite({
    learner_identity_id: learnerIdentityId,
    school_id: schoolId,
    token_hash: tokenHash,
    purpose: 'activation',
    expires_at: expiresAt,
    issued_by: issuedBySchoolUserId,
  })

  return { status: 'issued', inviteId: invite.id, token: rawToken, expiresAt }
}

// ── Step 10/11: activation claim ────────────────────────────────────────────

/**
 * Redeems a one-time activation (or recovery) code and returns a real
 * Supabase session. Never accepts a `learnerIdentityId` from the caller —
 * it is derived exclusively from the stored invite record, which itself
 * was only ever created by `issueLearnerAccountActivation`'s school-scoped
 * lookup above.
 *
 * Race safety (Step 11): the invite reservation is a single conditional
 * UPDATE (`reserveInvite`, `used_at IS NULL`) whose returned row count is
 * the sole source of truth for who won — under N concurrent claims of the
 * same raw token, exactly one reaches the auth-bootstrap step; every other
 * one returns `already_used` before ever touching `auth.admin.createUser`.
 */
export async function claimLearnerAccountActivation(rawToken: string): Promise<ClaimLearnerAccountActivationResult> {
  const db = createServiceClient()
  const tokenHash = await hashTransferToken(rawToken)

  const invite = await repos.learnerAccounts.findInviteByHash(tokenHash)
  if (!invite) return { status: 'invalid' }
  if (invite.used_at) return { status: 'already_used' }
  if (new Date(invite.expires_at) < new Date()) return { status: 'expired' }

  const existingAccount = await repos.learnerAccounts.findByLearnerIdentityId(invite.learner_identity_id)

  if (invite.purpose === 'activation' && existingAccount) {
    // Step 16 — someone else already activated this identity between
    // issuance and this claim. Reserve (consume) the invite anyway so it
    // cannot be replayed, but create nothing.
    await repos.learnerAccounts.reserveInvite(invite.id)
    return { status: 'already_active' }
  }
  if (invite.purpose === 'recovery' && !existingAccount) {
    return { status: 'invalid' } // nothing to recover
  }

  const won = await repos.learnerAccounts.reserveInvite(invite.id)
  if (!won) return { status: 'already_used' } // lost the race

  const email = syntheticLearnerEmail(invite.learner_identity_id)
  let userId: string

  if (invite.purpose === 'activation') {
    // Fresh synthetic auth.users identity — no password, ever (Step 8).
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (createErr || !created?.user) {
      throw new Error(`claimLearnerAccountActivation: auth bootstrap createUser failed: ${createErr?.message ?? 'no user returned'}`)
    }
    userId = created.user.id
  } else {
    // Recovery — reuse the EXISTING auth.users.id bound to this identity's
    // account; never create a second auth identity for the same learner.
    userId = existingAccount!.user_id
  }

  // Defense in depth (Step 8's "auth user already bound elsewhere" case).
  // Structurally near-unreachable given the deterministic 1:1
  // identity<->email mapping above (a second `createUser` call for the
  // same email would itself fail on auth's own email-uniqueness
  // constraint before reaching here) — kept explicit rather than relying
  // solely on that indirect guarantee, and backed independently by the
  // `uq_learner_accounts_user_id` DB constraint on the insert below.
  const boundElsewhere = await repos.learnerAccounts.findByUserId(userId)
  if (boundElsewhere && boundElsewhere.learner_identity_id !== invite.learner_identity_id) {
    return { status: 'user_already_bound' }
  }

  // Mint the real session — server-side, no email ever sent (Step 7/8).
  const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`claimLearnerAccountActivation: generateLink failed: ${linkErr?.message ?? 'no hashed_token returned'}`)
  }

  const anon = createAnonAuthClient()
  const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyErr || !verifyData?.session || verifyData.user?.id !== userId) {
    throw new Error(`claimLearnerAccountActivation: session bootstrap (verifyOtp) failed: ${verifyErr?.message ?? 'session/user mismatch'}`)
  }

  let learnerAccountId: string
  if (invite.purpose === 'activation') {
    const account = await repos.learnerAccounts.insertAccount({
      learner_identity_id: invite.learner_identity_id,
      user_id: userId,
    })
    learnerAccountId = account.id

    // Step 12 — role assignment via the service-role client, which
    // fn_guard_profile_role (migration 20260812190000) exempts from the
    // client-write freeze. A client-side UPDATE attempting the same change
    // is still rejected by that trigger — this is the ONLY server path
    // that may set a learner's role.
    //
    // UPSERT, not UPDATE — deliberate, matching app/auth/callback/route.ts's
    // established post-auth role-assignment pattern exactly. There is no
    // reliable DB trigger that materializes a `profiles` row the instant an
    // `auth.users` row is created (confirmed empirically against local
    // Docker Supabase while completing this phase — the ordinary human
    // signup flow ALWAYS lands on that callback route, which itself upserts
    // rather than trusting a row already exists; the synthetic learner
    // bootstrap here never goes through that route, so it must do the same
    // upsert itself or the role assignment silently touches zero rows).
    const { error: roleErr } = await db
      .from('profiles')
      .upsert({ id: userId, role: 'student', updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (roleErr) throw new Error(`claimLearnerAccountActivation: role assignment failed: ${roleErr.message}`)
  } else {
    learnerAccountId = existingAccount!.id
  }

  return {
    status: 'claimed',
    learnerAccountId,
    learnerIdentityId: invite.learner_identity_id,
    session: { accessToken: verifyData.session.access_token, refreshToken: verifyData.session.refresh_token },
  }
}

/**
 * Issues a recovery code for an ALREADY-active learner account — reuses
 * the exact same generateLink/verifyOtp bootstrap primitive as first
 * activation (Step 20), gated behind a fresh, separately-purposed
 * `learner_account_invites` row (`purpose: 'recovery'`) rather than any
 * new mechanism. Authorization policy for WHO may call this (which school,
 * which guardian) is deliberately left to the caller — see Step 20's
 * named limitation in the phase closeout report.
 */
export async function issueLearnerAccountRecovery(
  schoolId: string,
  learnerId: string,
  issuedBySchoolUserId: string | null
): Promise<IssueLearnerAccountActivationResult> {
  const learnerIdentityId = await repos.learnerAccounts.findLearnerIdentityIdForSchoolLearner(learnerId, schoolId)
  if (!learnerIdentityId) {
    throw new Error('issueLearnerAccountRecovery: learner not found in this school, or has no durable identity yet.')
  }
  const existingAccount = await repos.learnerAccounts.findByLearnerIdentityId(learnerIdentityId)
  if (!existingAccount) {
    throw new Error('issueLearnerAccountRecovery: no active account exists for this learner — use issueLearnerAccountActivation instead.')
  }

  const existingInvite = await repos.learnerAccounts.findActivePendingInvite(learnerIdentityId, 'recovery')
  if (existingInvite) {
    throw new Error('issueLearnerAccountRecovery: a pending recovery invite already exists for this learner.')
  }

  const rawToken = generateTransferToken()
  const tokenHash = await hashTransferToken(rawToken)
  const expiresAt = inviteExpiryFromNow()

  const invite = await repos.learnerAccounts.insertInvite({
    learner_identity_id: learnerIdentityId,
    school_id: schoolId,
    token_hash: tokenHash,
    purpose: 'recovery' as LearnerAccountInvitePurpose,
    expires_at: expiresAt,
    issued_by: issuedBySchoolUserId,
  })

  return { status: 'issued', inviteId: invite.id, token: rawToken, expiresAt }
}

// ── Step 13/14: canonical resolvers ─────────────────────────────────────────

/**
 * The ONLY unambiguous resolver: `auth.users.id -> learner_accounts ->
 * status active -> learner_identity_id`. Never resolves further into a
 * school-local `learners.id` — that step is genuinely ambiguous under
 * dual-active enrollment (Step 14) and must never be silently collapsed
 * here.
 */
export async function resolveAuthenticatedLearnerIdentity(userId: string): Promise<string | null> {
  const account = await repos.learnerAccounts.findByUserId(userId)
  if (!account || account.status !== 'active') return null
  return account.learner_identity_id
}

/**
 * School-scoped resolution of the CURRENT school-local `learners.id` for
 * an authenticated learner, given explicit `schoolId` context (e.g. the
 * school the learner is currently navigating within). Returns null if this
 * identity has no learner record at that school — never guesses.
 */
export async function resolveCurrentCoreLearnerForAuthenticatedUser(userId: string, schoolId: string): Promise<string | null> {
  const learnerIdentityId = await resolveAuthenticatedLearnerIdentity(userId)
  if (!learnerIdentityId) return null
  return repos.learnerAccounts.findAuthorizedLearnerIdForSchool(learnerIdentityId, schoolId)
}

/**
 * Every school-local `learners` row this authenticated identity currently
 * has, across every school (Step 14) — for the (rare, but real per Phase
 * 2C) dual-active-enrollment case, or for a school-picker UI. Deliberately
 * does not pick one on the caller's behalf.
 */
export async function resolveAllCoreLearnersForAuthenticatedUser(userId: string): Promise<Array<{ id: string; school_id: string; status: string }>> {
  const learnerIdentityId = await resolveAuthenticatedLearnerIdentity(userId)
  if (!learnerIdentityId) return []
  return repos.learnerAccounts.findSchoolLocalLearnersForIdentity(learnerIdentityId)
}

export async function getLearnerAccountStatus(userId: string): Promise<'active' | 'suspended' | 'none'> {
  const account = await repos.learnerAccounts.findByUserId(userId)
  if (!account) return 'none'
  return account.status
}
