// lib/core/teacherOnboarding.ts
//
// Sprint 9C — closes the gap docs/architecture/sprint-9a-phase2-school-
// activation-audit.md found: "there is no app/api/core/teachers or
// app/api/core/school-users route at all... no admin-invites-a-teacher-by-
// email route in Core." Builds the reserved-but-unbuilt Teacher-domain API
// surface RAS §3 already names (`app/api/core/teachers/**`).
//
// Identity guarantee (ADR-0002, restated as this module's contract): a
// teacher who completes onboarding through acceptTeacherInvitation() ends
// with THREE separate, correctly-linked rows — `profiles` (platform
// identity), `school_users` (Permissions/membership, per RAS §3 line 73),
// and `teachers` (Teacher-domain business identity, per RAS §3 line 60 and
// ADR-0002's Decision). Nothing in this module ever stores a
// `school_users.id` where a `teachers.id` is expected, or vice versa — the
// two identities are created and returned as two distinct fields, never
// conflated.
//
// Two-phase model, zero schema change: `school_users.is_active` (already a
// column, per supabase/migrations/20260629_core_foundation.sql:224) is the
// pending/accepted state machine. inviteTeacher() creates an inactive
// (pending) row; acceptTeacherInvitation() flips it active and materializes
// `teachers`/`profiles`. This is deliberately lighter than a full
// token/email invitation system (no such system exists anywhere in this
// codebase today, and building one is a distinct, larger product feature —
// see the Sprint 9C implementation log's "Known limitations").
//
// Scope boundary, per the sprint's own Part 5 instruction: this module
// never assigns a teacher to a class (`classes.class_teacher_id`) or a
// subject. getTeacherReadiness() reports whether a teacher *could* be
// assigned/could own an assessment — it creates nothing.

import { repos } from '@/lib/repositories'
import { addSchoolUser, listSchoolUsers, updateSchoolUserRole } from '@/lib/core/school-users'
import { resolveTeacher, resolveMembership } from '@/lib/core/identity'
import type { SchoolUser } from '@/types/core'

// ── Invite ───────────────────────────────────────────────────────────────────

/**
 * The roles a school admin may hand out from the Team screen.
 *
 * A strict server-side allowlist, never a role string from the browser. This
 * is the exact vulnerability class closed by migration 20260812190000, where
 * `teachers.role='admin'` — a value the user could write about themselves —
 * was trusted as an authorization primitive. Here the role travels through a
 * trusted invitation performed by someone who already holds admin authority
 * AT THAT SCHOOL, and the invitee cannot alter it.
 *
 * 'headteacher' and 'deputy_headteacher' are equally canonical (both are in
 * permissions.ts's SCHOOL_ADMIN_ROLES and carry identical authority), and are
 * deliberately NOT offered yet — see this phase's report. Adding them later is
 * a one-line change to this array.
 *
 * 'parent' is excluded: it is a real school_users role but not a staff
 * appointment, and it grants nothing this screen is for.
 */
export const INVITABLE_SCHOOL_ROLES = ['teacher', 'school_admin'] as const
export type InvitableSchoolRole = (typeof INVITABLE_SCHOOL_ROLES)[number]

export function isInvitableSchoolRole(value: string): value is InvitableSchoolRole {
  return (INVITABLE_SCHOOL_ROLES as readonly string[]).includes(value)
}

export type InviteTeacherResult =
  | { status: 'invited'; schoolUser: SchoolUser }
  | { status: 'already_pending'; schoolUser: SchoolUser }
  | { status: 'already_member'; schoolUser: SchoolUser }
  /** An existing membership had its role changed in place (e.g. teacher → school_admin). */
  | { status: 'role_changed'; schoolUser: SchoolUser; previousRole: SchoolUser['role'] }
  | { status: 'no_account'; email: string }

/**
 * Invites an existing platform user (by email) to join `schoolId` as a
 * teacher. Idempotent: re-inviting an already-pending or already-active
 * teacher is a safe no-op that returns their current state, never a
 * duplicate `school_users` row (the live UNIQUE(school_id,user_id,role)
 * constraint would reject a duplicate insert anyway, but this checks first
 * so the caller gets a meaningful status instead of a raw DB error).
 *
 * Does not create an account for an email with none — returns
 * `{status:'no_account'}` instead. Closing that gap (inviting someone who
 * hasn't signed up yet) requires an email/token invitation system this
 * sprint does not build — see the implementation log.
 */
export async function inviteTeacher(
  schoolId: string,
  email: string,
  invitedBy: string
): Promise<InviteTeacherResult> {
  return inviteSchoolMember(schoolId, email, 'teacher', invitedBy)
}

/**
 * Invites an existing platform user (by email) to join `schoolId` under one of
 * the {@link INVITABLE_SCHOOL_ROLES}. This is how a school gets its own
 * administrator: before it existed, `school_admin` was assigned in exactly one
 * place in the codebase — `createSchool()`, to the creator — so a school the
 * founder created could never be handed to its actual principal without SQL.
 *
 * Role changes happen IN PLACE rather than by adding a row. The `school_users`
 * unique key is (school_id, user_id, role), so a second row is schema-legal —
 * but `repos.schools.findSchoolUserByUserId()` resolves membership with
 * .maybeSingle(), and a user holding two active rows at one school would make
 * that throw for every downstream caller. One person, one membership per
 * school; promotion edits the role they already hold.
 *
 * Idempotent in every direction: re-inviting at the same role is a no-op that
 * reports current state, and promoting an already-promoted member reports
 * `already_member`.
 *
 * Does not create an account for an email with none — returns
 * `{status:'no_account'}`. No email or message is sent by this function; the
 * invitee must already have signed up. That limitation is real and surfaced to
 * the UI rather than papered over.
 */
export async function inviteSchoolMember(
  schoolId: string,
  email: string,
  role: InvitableSchoolRole,
  invitedBy: string
): Promise<InviteTeacherResult> {
  const authUser = await repos.teachers.findAuthUserByEmail(email)
  if (!authUser) return { status: 'no_account', email }

  // Any membership at this school, under any role, in any state.
  const rows = await repos.teachers.listSchoolUserRowsForUser(schoolId, authUser.id)

  // Prefer an active row when (through legacy data) more than one exists, so a
  // promotion edits the membership that is actually in force.
  const existing = rows.find(r => r.is_active) ?? rows[0] ?? null

  if (existing) {
    if (existing.role === role) {
      return { status: existing.is_active ? 'already_member' : 'already_pending', schoolUser: existing }
    }
    const previousRole = existing.role
    const schoolUser = await updateSchoolUserRole(existing.id, role)
    return { status: 'role_changed', schoolUser, previousRole }
  }

  const schoolUser = await repos.teachers.insertPendingSchoolUser(schoolId, authUser.id, role, invitedBy)
  return { status: 'invited', schoolUser }
}

// ── Accept ───────────────────────────────────────────────────────────────────

export type AcceptTeacherInvitationResult = {
  /** 'accepted' — this call moved the invitation from pending to active. 'already_member' — the caller was already an active teacher at this school (self-healing ran anyway, see below). */
  status: 'accepted' | 'already_member'
  schoolUser: SchoolUser
  teacherId: string
}

/**
 * Accepts a pending invitation (or, for a school_users row that is already
 * active through some other path — historically the `ensureSchoolMembership`
 * name-matching bridge, removed in the self-join closeout, but still possible
 * for rows it created before then — self-heals it into the same canonical
 * shape). Always ensures, on
 * every call, that all three rows exist and are correctly linked:
 * `school_users` (active), `teachers`, `profiles`. Safe to call repeatedly
 * (Part 4/7: duplicate acceptance, partial onboarding) — every write is
 * existence-checked first, matching lib/core/schoolActivation.ts's idiom.
 *
 * Throws if there is no membership row at all (pending or active) for this
 * user at this school — you cannot accept an invitation that was never
 * extended (Part 7's "missing membership" failure case).
 */
export async function acceptTeacherInvitation(
  userId: string,
  schoolId: string,
  profile: { full_name: string; subject?: string; grade_levels?: number[]; phone?: string }
): Promise<AcceptTeacherInvitationResult> {
  // The invitation's own role is authoritative — it is read from the row a
  // trusted school admin created, never supplied by the accepting user. An
  // invitee cannot upgrade themselves on the way in, and cannot accept a
  // membership that was never extended to them (userId comes from
  // auth.getUser() at the route, never from the request body).
  const rows = await repos.teachers.listSchoolUserRowsForUser(schoolId, userId)
  const existingMembership = rows.find(r => r.is_active) ?? rows[0] ?? null
  if (!existingMembership) {
    throw new Error(`acceptTeacherInvitation: no invitation found for this user at school ${schoolId} — invite them first.`)
  }

  const invitedRole = existingMembership.role
  const wasAlreadyActive = existingMembership.is_active
  // addSchoolUser upserts on (school_id,user_id,role) and always sets
  // is_active:true — exactly "accept" for a pending row, and a safe no-op
  // re-affirmation for an already-active one (Part 4: repeated acceptance).
  const schoolUser = await addSchoolUser(schoolId, userId, invitedRole, existingMembership.invited_by ?? userId)

  const school = await repos.schools.findById(schoolId)

  let teacher = await repos.teachers.findTeacherByUserId(userId)
  if (!teacher) {
    teacher = await repos.teachers.insertTeacher(userId, {
      full_name:    profile.full_name,
      school:       school.school_name,
      subject:      profile.subject,
      grade_levels: profile.grade_levels,
      phone:        profile.phone,
    })
  }

  // profiles.role stays 'teacher' even for a school_admin membership, and that
  // is deliberate rather than an oversight. `profiles.role` is the PLATFORM
  // tier signal read by checkFeatureAccess() step 4/5: `isTeacherRole` is
  // true only for 'teacher'. Writing 'school_admin' here would make a
  // principal fail that check and lose school-covered teacher tools — they
  // would be asked to pay for a SOW at the school that just paid for them.
  // School authority lives in `school_users.role`, which is where every
  // permission check actually reads it from.
  await repos.teachers.upsertProfile(userId, { role: 'teacher', full_name: profile.full_name })

  return { status: wasAlreadyActive ? 'already_member' : 'accepted', schoolUser, teacherId: teacher.id }
}

// ── Membership list (Sprint 10E — Phase 2: surface the existing invite/accept workflow) ──

export type TeacherMembershipView = {
  schoolUserId: string
  userId: string
  fullName: string | null
  email: string | null
  /** The school_users role this membership carries — the Team screen needs it to distinguish staff from administrators. */
  role: SchoolUser['role']
  status: 'pending' | 'active'
  joinedAt: string | null
  invitedAt: string
}

/** Staff roles the Team screen lists. Excludes 'parent', which is not a staff appointment. */
const TEAM_ROLES: ReadonlyArray<SchoolUser['role']> =
  ['school_admin', 'headteacher', 'deputy_headteacher', 'teacher']

/**
 * Read-only roster for a "Team" screen: every school_users row with
 * role='teacher', with the display fields a list UI needs. Composed
 * entirely from existing reads (listSchoolUsers, two batched lookups) —
 * no new query strategy, no write. A pending row (invited, not yet
 * accepted) has no `profiles`/`teachers` row yet (those only materialize
 * in acceptTeacherInvitation), so `fullName` is null and `email` carries
 * the identifying detail instead.
 */
export async function listTeacherMemberships(schoolId: string): Promise<TeacherMembershipView[]> {
  // Now lists every staff role, not just 'teacher'. A Team screen that hid the
  // school's own administrators could not show whether the school has one —
  // which is precisely the question this phase exists to answer.
  const all = await listSchoolUsers(schoolId)
  const memberships = all.filter(m => TEAM_ROLES.includes(m.role))
  if (memberships.length === 0) return []

  const userIds = memberships.map(m => m.user_id)
  const [profiles, emails] = await Promise.all([
    repos.teachers.findProfilesByUserIds(userIds),
    repos.teachers.findAuthUsersByIds(userIds),
  ])

  return memberships.map(m => ({
    schoolUserId: m.id,
    userId: m.user_id,
    fullName: profiles.get(m.user_id)?.full_name ?? null,
    email: emails.get(m.user_id) ?? null,
    role: m.role,
    status: m.is_active ? 'active' : 'pending',
    joinedAt: m.joined_at,
    invitedAt: m.created_at,
  }))
}

// ── Readiness (Part 5 — report only, never assigns anything) ────────────────

export type TeacherReadiness = {
  isSchoolMember: boolean
  hasActiveMembership: boolean
  hasTeacherRecord: boolean
  teacherId: string | null
  /** True once school_users is active with role='teacher' — the RLS/permission precondition for class/subject assignment. */
  readyForClassAssignment: boolean
  /** True once a `teachers` row exists — createAssessment()'s resolveTeacher() precondition (ADR-0002 Part 7 / Sprint 9A §3.2). */
  readyForAssessmentOwnership: boolean
}

/**
 * Reports whether userId is ready to be assigned to a class/subject or to
 * own an assessment at schoolId — computed entirely from the existing
 * identity resolvers (resolveTeacher, resolveMembership), no new query.
 * Creates nothing; a caller decides what to do with an unready teacher.
 */
export async function getTeacherReadiness(userId: string, schoolId: string): Promise<TeacherReadiness> {
  const [membership, teacher] = await Promise.all([
    resolveMembership(userId, schoolId),
    resolveTeacher(userId),
  ])

  const hasActiveMembership = !!membership && membership.isActive && membership.role === 'teacher'
  const hasTeacherRecord = !!teacher

  return {
    isSchoolMember: !!membership,
    hasActiveMembership,
    hasTeacherRecord,
    teacherId: teacher?.id ?? null,
    readyForClassAssignment: hasActiveMembership,
    readyForAssessmentOwnership: hasTeacherRecord,
  }
}
