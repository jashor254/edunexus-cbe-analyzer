// lib/classes/redeemClassInvite.ts
//
// A parent opens a class invite link (/join/<code>, shared by the teacher
// with the whole class) to connect to THEIR OWN child's class record.
//
// Security audit 2026-10-30, F-12. The previous implementation set
// `class_students.parent_id = caller` on EVERY roster row in the class that
// had no parent yet, and wrote the caller's email into `students.parent_email`
// for all of them. The first person to open a class-wide link therefore
// became "the parent" of every unlinked child: their clinic reports
// (reports/clinic/[reportId]/url trusts class_students.parent_id), class
// resources (resources/[id]/file-url), parent alerts, and every future
// email/WhatsApp notification about those children (lib/notifications/
// notify.ts). Every later, genuine parent was told the class was "already
// connected".
//
// Now a redemption links ONLY roster rows whose teacher-recorded
// `students.parent_email` equals the caller's CONFIRMED account email. The
// teacher records that address when adding the learner
// (POST /api/teacher/classes/[classId]/students), so it is the one piece of
// evidence that this account belongs to this child's parent. Nothing is
// written to students.parent_email any more. A learner with no recorded
// parent email cannot be claimed through a link — the teacher adds the
// parent's email first.

import { createServiceClient } from '@/utils/supabase/service'
import { ATTEMPT_LIMITS } from '@/lib/config/abuseLimits'
import { reserveAttempt, rollingWindowStart } from '@/lib/security/attemptLimiter'
import { logger } from '@/lib/observability/logger'

export type RedeemClassInviteResult =
  | { status: 'linked'; className: string; grade: number; linked: number }
  | { status: 'no_matching_learner'; className: string; grade: number }
  | { status: 'email_unconfirmed' }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'rate_limited' }

type Deps = {
  /** Injected only by tests — production always uses the service client. */
  db?:  ReturnType<typeof createServiceClient>
  now?: Date
}

type RosterRow = { id: string; students: { parent_email: string | null } | null }

const normaliseEmail = (email: string): string => email.trim().toLowerCase()

export async function redeemClassInvite(
  input: { userId: string; inviteCode: string },
  deps: Deps = {}
): Promise<RedeemClassInviteResult> {
  const db  = deps.db ?? createServiceClient()
  const now = deps.now ?? new Date()
  const { bucket, limit, windowMs } = ATTEMPT_LIMITS.classInviteJoin

  const reservation = await reserveAttempt(
    { bucket, subject: input.userId, limit, since: rollingWindowStart(windowMs, now) },
    { db },
  )
  if (!reservation) return { status: 'rate_limited' }

  const { data: invite, error: inviteError } = await db
    .from('class_invites')
    .select('id, class_id, expires_at, used_count')
    .eq('invite_code', input.inviteCode)
    .maybeSingle()
  if (inviteError) throw new Error(`redeemClassInvite: invite lookup failed: ${inviteError.message}`)
  if (!invite) return { status: 'not_found' }
  if (new Date(invite.expires_at as string).getTime() < now.getTime()) return { status: 'expired' }

  const { data: cls, error: classError } = await db
    .from('teacher_classes')
    .select('id, name, grade')
    .eq('id', invite.class_id)
    .maybeSingle()
  if (classError) throw new Error(`redeemClassInvite: class lookup failed: ${classError.message}`)
  if (!cls) return { status: 'not_found' }

  // Only a confirmed address proves the caller controls it — an unconfirmed
  // sign-up could otherwise type in any parent's email.
  const { data: authUser, error: authError } = await db.auth.admin.getUserById(input.userId)
  if (authError) throw new Error(`redeemClassInvite: account lookup failed: ${authError.message}`)
  const email = authUser.user?.email
  if (!email || !authUser.user?.email_confirmed_at) return { status: 'email_unconfirmed' }

  const { data: roster, error: rosterError } = await db
    .from('class_students')
    .select('id, students!inner(parent_email)')
    .eq('class_id', cls.id)
    .is('parent_id', null)
  if (rosterError) throw new Error(`redeemClassInvite: roster lookup failed: ${rosterError.message}`)

  // Exact, case-insensitive comparison in code — never a SQL ILIKE, where
  // `_` and `%` in an address would act as wildcards.
  const target = normaliseEmail(email)
  const matchIds = ((roster ?? []) as unknown as RosterRow[])
    .filter(r => r.students?.parent_email && normaliseEmail(r.students.parent_email) === target)
    .map(r => r.id)

  if (matchIds.length === 0) {
    return { status: 'no_matching_learner', className: cls.name as string, grade: cls.grade as number }
  }

  const { data: updated, error: updateError } = await db
    .from('class_students')
    .update({ parent_id: input.userId })
    .in('id', matchIds)
    .is('parent_id', null) // a concurrent claim already linked it → leave it alone
    .select('id')
  if (updateError) throw new Error(`redeemClassInvite: link failed: ${updateError.message}`)
  const linked = updated?.length ?? 0
  if (linked === 0) {
    return { status: 'no_matching_learner', className: cls.name as string, grade: cls.grade as number }
  }

  // Display-only counter: a failure here must not turn a completed link into
  // an error response, so it is logged instead.
  const { error: countError } = await db
    .from('class_invites')
    .update({ used_count: (invite.used_count as number) + 1 })
    .eq('id', invite.id)
  if (countError) {
    logger.warn('redeemClassInvite: invite usage count not updated', { service: 'class-invites' }, countError)
  }

  return { status: 'linked', className: cls.name as string, grade: cls.grade as number, linked }
}
