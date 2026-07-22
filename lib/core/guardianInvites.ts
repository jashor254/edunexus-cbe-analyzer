// lib/core/guardianInvites.ts
//
// Sprint 12 Wave 3 (Critical 1, Release Blocker Remediation) — closes the
// Release Candidate audit's Critical finding: a guardian created via Core
// Admissions (lib/core/learnerOnboarding.ts) gets learner_guardians.user_id
// hardcoded null with no invite/claim mechanism pointing at it — that
// guardian can never become an authenticated parent.
//
// This module mirrors the ALREADY-LIVE legacy student_invites/
// app/api/parent/link-student flow's shape (token generation, expiry,
// used-once validation) but targets Core's learner_guardians instead of
// legacy students — see supabase/migrations/20260722_core_guardian_invites.sql's
// header comment for why that flow could not be extended in place (its FK
// targets students(id), not learner_guardians(id)).
//
// Delivery reuses lib/whatsapp/sender.ts's sendWhatsApp() (the generic
// freeform-message primitive already used elsewhere in this codebase) —
// NOT sendWelcomeMessage(), whose hardcoded body cannot carry a link at
// all (confirmed by reading its implementation: it takes no message
// parameter). No new delivery channel is introduced.
import { repos } from '@/lib/repositories'
import { createServiceClient } from '@/utils/supabase/service'
import { sendWhatsApp } from '@/lib/whatsapp/sender'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://edunexus.co.ke'

export type CreateGuardianInviteResult = {
  status: 'invited' | 'already_pending' | 'already_linked'
  inviteId?: string
  token?: string
}

/**
 * Idempotent: re-inviting a guardian who already has an unclaimed, unexpired
 * invite returns the SAME invite (same token) rather than creating a second
 * row — mirrors onboardLearner/teacherOnboarding's established "check
 * before create" idiom in this codebase, and directly closes the "double
 * invitation" attack named in this blocker's required security review (a
 * second invite would otherwise be a second valid claim path for the same
 * guardian).
 */
export async function createGuardianInvite(
  schoolId: string,
  learnerGuardianId: string
): Promise<CreateGuardianInviteResult> {
  const guardian = await repos.learners.findGuardianById(learnerGuardianId)
  if (!guardian || guardian.school_id !== schoolId) {
    throw new Error('createGuardianInvite: guardian not found in this school.')
  }
  if (guardian.user_id) {
    return { status: 'already_linked' }
  }

  const db = createServiceClient()

  const { data: existing } = await db
    .from('core_guardian_invites')
    .select('id, token, used_at, expires_at')
    .eq('learner_guardian_id', learnerGuardianId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { status: 'already_pending', inviteId: existing.id, token: existing.token }
  }

  const { data: invite, error } = await db
    .from('core_guardian_invites')
    .insert({ school_id: schoolId, learner_guardian_id: learnerGuardianId })
    .select('id, token')
    .single()
  if (error) throw new Error(`createGuardianInvite: ${error.message}`)

  if (guardian.phone) {
    const inviteLink = `${APP_URL}/parent-join?guardian=${learnerGuardianId}&token=${invite.token}`
    const firstName = guardian.full_name?.split(' ')[0] ?? 'Parent'
    const message =
      `Habari ${firstName}! 👋\n\n` +
      `You've been added as a guardian on EduNexus — a platform that helps track your child's learning.\n\n` +
      `Tap here to create your parent account:\n${inviteLink}\n\n` +
      `Free to use. — EduNexus 🇰🇪`
    // Non-blocking, same posture as every other WhatsApp send in this
    // codebase — a delivery failure never blocks the invite record itself
    // (the school admin can still see/resend it; the guardian can also be
    // reached by other means with the same link).
    sendWhatsApp(guardian.phone, message).catch(err => console.error('[guardianInvites] sendWhatsApp failed:', err instanceof Error ? err.message : String(err)))
  }

  return { status: 'invited', inviteId: invite.id, token: invite.token }
}

export type ClaimGuardianInviteResult =
  | { status: 'claimed'; learnerId: string; schoolId: string; learnerName: string }
  | { status: 'already_claimed_by_you'; learnerId: string; schoolId: string; learnerName: string }
  | { status: 'invalid' | 'expired' | 'already_used' | 'linked_to_another_account' }

/**
 * Validates and claims a guardian invite for the authenticated user
 * (`userId` — never trust a client-supplied identity here, matching
 * CLAUDE.md's rule; the caller must have already resolved this from
 * auth.getUser()).
 *
 * Race-safety: the "mark used" update is conditional
 * (`.is('used_at', null)`) and its returned row count is checked — if a
 * concurrent claim already consumed the token between this function's read
 * and write, zero rows are updated and this returns 'already_used', not a
 * successful double-claim. This is deliberately stricter than the legacy
 * student_invites flow (app/api/parent/link-student/route.ts), whose
 * equivalent update has no such guard — not fixed here (out of this
 * blocker's scope), but not copied into the new Core path either.
 */
export async function claimGuardianInvite(userId: string, token: string): Promise<ClaimGuardianInviteResult> {
  const db = createServiceClient()

  const { data: invite } = await db
    .from('core_guardian_invites')
    .select('id, learner_guardian_id, school_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()
  if (!invite) return { status: 'invalid' }

  const guardian = await repos.learners.findGuardianById(invite.learner_guardian_id)
  if (!guardian) return { status: 'invalid' }

  const learner = await repos.learners.findById(guardian.learner_id, guardian.school_id)
  const learnerName = [learner.first_name, learner.last_name].filter(Boolean).join(' ')

  // Idempotent re-claim by the SAME user (e.g. a double-tapped link) is a
  // safe no-op, not an error — matches the legacy flow's own "already
  // linked to this user? fine" posture.
  if (guardian.user_id === userId) {
    return { status: 'already_claimed_by_you', learnerId: guardian.learner_id, schoolId: guardian.school_id, learnerName }
  }
  if (guardian.user_id && guardian.user_id !== userId) {
    return { status: 'linked_to_another_account' }
  }
  if (invite.used_at) return { status: 'already_used' }
  if (new Date(invite.expires_at) < new Date()) return { status: 'expired' }

  const { data: claimedRows, error: claimError } = await db
    .from('core_guardian_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)
    .is('used_at', null) // conditional write — loses the race cleanly if another request claimed it first
    .select('id')
  if (claimError) throw new Error(`claimGuardianInvite: ${claimError.message}`)
  if (!claimedRows || claimedRows.length === 0) {
    return { status: 'already_used' } // lost the race — someone else claimed it a moment earlier
  }

  await repos.learners.updateGuardianUserId(invite.learner_guardian_id, userId)

  return { status: 'claimed', learnerId: guardian.learner_id, schoolId: guardian.school_id, learnerName }
}
