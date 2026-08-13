// lib/core/schoolBootstrap.ts
//
// Founder bootstrap of a school's FIRST administrator — the narrow exception
// path that exists because of a real deadlock, not for convenience.
//
// THE DEADLOCK
// Normal school staffing runs through inviteSchoolMember(), gated by
// requireSchoolAdmin(schoolId) — which resolves the CALLER's own membership at
// that school. That is correct: a school's staff are the school's business.
// But it cannot provision the FIRST administrator of a school that has none.
// A canonical school can reach that state legitimately (seeded, imported, or
// created by a script rather than through /admin/core-schools/new, which makes
// its creator school_admin), and a founder holding platform authority has no
// membership there — so the handoff returns 403 and the school is stranded
// with no way in that is not raw SQL. Proven live against the Reference School
// during the 2026-08-13 institutional dress rehearsal (STALL-1).
//
// THE BOUNDARY, AND WHY IT IS NARROW
// This is a bootstrap, not cross-school staff management. It acts ONLY on a
// school with zero active admin-tier members, and refuses the moment one
// exists. That refusal is the whole design: without it, platform authority
// would quietly become a permanent bypass around school autonomy, able to
// install administrators at any school at any time. A school that already has
// an administrator is that administrator's to staff.
//
// It also does not make the founder a member of anything. The founder's
// authority is platform-level and stays there; the school ends up
// self-administering, with the founder outside it.
//
// WHAT IT DELIBERATELY DOES NOT TOUCH
// Entitlement, payments, pricing, subscriptions, tokens, teacher assignments,
// learner data, and the school's own `created_by`. Who administers a school
// and who has paid for it are separate facts, and this function only ever
// establishes the first.

import { repos } from '@/lib/repositories'
import { addSchoolUser, updateSchoolUserRole } from '@/lib/core/school-users'
import { SCHOOL_ADMIN_ROLES } from '@/lib/core/permissions'
import type { SchoolUser, SchoolUserRole } from '@/types/core'

/**
 * The roles a founder may bootstrap into. Exactly {@link SCHOOL_ADMIN_ROLES} —
 * a bootstrap that produced anything less than admin authority would not solve
 * the deadlock it exists for.
 *
 * Unlike INVITABLE_SCHOOL_ROLES (which offers only teacher/school_admin),
 * `headteacher` and `deputy_headteacher` ARE offered here: the person a school
 * is handed to is usually its principal, and recording them as a `teacher` or
 * a generic `school_admin` when the school calls them the headteacher would
 * make the record less true for no gain. All three are identical to
 * requireSchoolAdmin, so nothing is escalated by the choice.
 *
 * 'teacher' and 'parent' are absent by design — neither can administer a
 * school, so neither can end the zero-admin state.
 */
export const BOOTSTRAPPABLE_SCHOOL_ROLES = SCHOOL_ADMIN_ROLES

export function isBootstrappableRole(value: string): value is SchoolUserRole {
  return (BOOTSTRAPPABLE_SCHOOL_ROLES as readonly string[]).includes(value)
}

/** A current administrator, named just enough for the founder to see who already holds the school. */
export type ExistingAdministrator = {
  userId: string
  email: string | null
  fullName: string | null
  role: SchoolUserRole
}

export type BootstrapResult =
  /** A new active admin membership was created — the school now administers itself. */
  | { status: 'bootstrapped'; schoolUser: SchoolUser }
  /** An existing membership (e.g. an inactive invite, or a teacher) was promoted in place. */
  | { status: 'promoted'; schoolUser: SchoolUser; previousRole: SchoolUserRole; wasActive: boolean }
  /**
   * REFUSED: the school has at least one active admin-tier member and must use
   * its own staff management.
   *
   * This is also what a REPEATED bootstrap of the same person returns, and it
   * is the honest answer rather than a special "already admin" case: once the
   * first call succeeds the target IS the sitting administrator, so the school
   * is administered and the founder's exception no longer applies. The
   * `administrators` list names them, so the founder can see the repeat landed
   * on exactly the person they intended. Idempotent by construction — the
   * gate is checked before any write, so re-running creates nothing.
   */
  | { status: 'already_administered'; administrators: ExistingAdministrator[] }
  /** REFUSED: no EduNexus account exists for this email. No account is created here. */
  | { status: 'no_account'; email: string }

/**
 * Reports the school's administrators, so both the service and the founder UI
 * decide "is this school administered" by the same rule the authorization gate
 * uses: an ACTIVE membership in an admin-tier role.
 *
 * A `teachers` row is deliberately not part of this test. A headteacher who
 * never teaches has no `teachers` row and still administers the school —
 * conflating the two would report a properly-run school as unadministered.
 */
export async function listActiveAdministrators(schoolId: string): Promise<ExistingAdministrator[]> {
  const members = await repos.teachers.listSchoolUsers(schoolId)
  const admins = members.filter(m => m.is_active && SCHOOL_ADMIN_ROLES.includes(m.role))
  if (admins.length === 0) return []

  const userIds = admins.map(a => a.user_id)
  const [profiles, emails] = await Promise.all([
    repos.teachers.findProfilesByUserIds(userIds),
    repos.teachers.findAuthUsersByIds(userIds),
  ])

  return admins.map(a => ({
    userId:   a.user_id,
    email:    emails.get(a.user_id) ?? null,
    fullName: profiles.get(a.user_id)?.full_name ?? null,
    role:     a.role,
  }))
}

/**
 * Installs the first administrator of a school that has none.
 *
 * Authorization is the caller's job — the route gates on requireGrowthUser().
 * Deliberately NOT requireSchoolAdmin: the absence of a school admin is the
 * condition this function exists to resolve, so requiring one would be
 * circular.
 *
 * `targetEmail` must already belong to an EduNexus account. No account is
 * created, no password is set, no invitation email is sent — a founder cannot
 * conjure an identity for someone who has not signed up, and pretending
 * otherwise would put a fabricated user in a position of authority.
 *
 * The membership is created ACTIVE rather than pending. A pending row would
 * leave the school in exactly the unadministered state being fixed, waiting on
 * an acceptance the principal cannot be prompted for from here. The founder is
 * asserting a handoff they have already agreed out of band, and the audit
 * trail records who asserted it (`invited_by`).
 *
 * Membership uniqueness is preserved: an existing row is promoted IN PLACE
 * rather than joined by a second one. `school_users`' unique key is
 * (school_id, user_id, role), so a second active row is schema-legal but would
 * make `findSchoolUserByUserId().maybeSingle()` throw for every downstream
 * caller. One person, one membership per school.
 */
export async function bootstrapSchoolAdministrator(input: {
  schoolId: string
  targetEmail: string
  role: SchoolUserRole
  performedBy: string
}): Promise<BootstrapResult> {
  const { schoolId, targetEmail, role, performedBy } = input

  if (!isBootstrappableRole(role)) {
    // Defence in depth — the route validates too. A non-admin role here would
    // silently "succeed" while leaving the school just as unadministered.
    throw new Error(`bootstrapSchoolAdministrator: ${role} is not an administrator role`)
  }

  // Throws if the school does not exist, before anything is inspected.
  await repos.schools.findById(schoolId)

  // THE GATE. Checked before the target is even resolved, so an already-run
  // school reveals nothing about whether an email has an account.
  const administrators = await listActiveAdministrators(schoolId)
  if (administrators.length > 0) {
    return { status: 'already_administered', administrators }
  }

  const authUser = await repos.teachers.findAuthUserByEmail(targetEmail)
  if (!authUser) return { status: 'no_account', email: targetEmail }

  // Any membership this person holds here, in any role, in any state.
  const rows = await repos.teachers.listSchoolUserRowsForUser(schoolId, authUser.id)
  const existing = rows.find(r => r.is_active) ?? rows[0] ?? null

  if (existing) {
    // No "already holds this exact admin role" case is needed here: such a row
    // would be an ACTIVE admin-tier membership, which the gate above already
    // refused. Anything reaching this point is an inactive row, or a role that
    // does not administer the school.
    const previousRole = existing.role
    const wasActive    = existing.is_active

    // Promote in place, then ensure the row is active. addSchoolUser upserts
    // on (school_id, user_id, role) with is_active:true, so after the role
    // change it re-affirms the same row rather than creating a rival one.
    if (previousRole !== role) await updateSchoolUserRole(existing.id, role)
    const schoolUser = await addSchoolUser(schoolId, authUser.id, role, performedBy)

    return { status: 'promoted', schoolUser, previousRole, wasActive }
  }

  const schoolUser = await addSchoolUser(schoolId, authUser.id, role, performedBy)
  return { status: 'bootstrapped', schoolUser }
}
