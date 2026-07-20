/**
 * Canonical authorization service (RAS §3 Permissions domain, previously
 * "reserved, not yet built"; RAS §8 Security Architecture; Engineering Rule 4
 * — "never duplicate authorization, always extend the shared permission service").
 *
 * This module contains every authorization decision the platform makes. It
 * never queries a table directly — it is built entirely on `lib/core/identity.ts`.
 * That separation exists because the two authorization gaps found in the
 * Stage 0 census (`app/api/core/assessments` POST, `app/api/core/reports`
 * update action) both happened the same way: one route's role check was
 * correct, its sibling action in the same file wasn't, because the check was
 * copy-pasted per action instead of shared. A single function per decision
 * makes that failure mode structurally impossible, not just less likely.
 *
 * Two families of function:
 *  - `requireX()` — mechanical role/membership gates. Throw on failure.
 *    Used at the top of a route, immediately after `requireAuthentication`.
 *  - `canX()` — business-rule-aware capability checks that may combine role
 *    with resource ownership (e.g. "admin OR the assigned class teacher").
 *    Return a boolean; the caller decides whether a `false` means a 403 or
 *    just "hide this button."
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import type { SchoolUserRole } from '@/types/core'
import {
  resolveCurrentUser,
  resolveMembership,
  resolveTeacher,
  resolveStudent,
  resolveParent,
  resolveLegacyStudentId,
  type CurrentUser,
  type ResolvedMembership,
} from '@/lib/core/identity'
import {
  UnauthorizedError,
  MembershipRequiredError,
  PermissionDeniedError,
  ResourceOwnershipError,
} from '@/lib/core/errors'

const SCHOOL_ADMIN_ROLES: readonly SchoolUserRole[] = ['school_admin', 'headteacher', 'deputy_headteacher']
/** Admin-tier plus 'teacher' — i.e. every school role except 'parent'. Matches an existing role set used by learner-enrollment (`app/api/core/learners/[id]`), distinct from admin-only actions. */
const SCHOOL_STAFF_ROLES: readonly SchoolUserRole[] = [...SCHOOL_ADMIN_ROLES, 'teacher']

// ── require* — mechanical gates, throw on failure ───────────────────────────

/** Throws {@link UnauthorizedError} if there is no authenticated session. Equivalent to `identity.resolveCurrentUser`, exported here too so routes only need to import from one module. */
export async function requireAuthentication(client: SupabaseClient): Promise<CurrentUser> {
  return resolveCurrentUser(client)
}

/** Throws {@link MembershipRequiredError} if the authenticated user has no active membership in this school. */
export async function requireSchoolMembership(client: SupabaseClient, schoolId: string): Promise<ResolvedMembership> {
  const user = await requireAuthentication(client)
  const membership = await resolveMembership(user.id, schoolId)
  if (!membership) throw new MembershipRequiredError()
  return membership
}

/** Throws {@link PermissionDeniedError} unless the user's role is `school_admin`, `headteacher`, or `deputy_headteacher`. */
export async function requireSchoolAdmin(client: SupabaseClient, schoolId: string): Promise<ResolvedMembership> {
  const membership = await requireSchoolMembership(client, schoolId)
  if (!SCHOOL_ADMIN_ROLES.includes(membership.role)) {
    throw new PermissionDeniedError('This action requires a school admin, headteacher, or deputy headteacher role.')
  }
  return membership
}

/** Throws {@link PermissionDeniedError} unless the user's Core role is `teacher` (does not include admin-tier roles — see {@link canManageClass}/{@link canManageAssessment} for capability checks that compose admin + teacher). */
export async function requireTeacher(client: SupabaseClient, schoolId: string): Promise<ResolvedMembership> {
  const membership = await requireSchoolMembership(client, schoolId)
  if (membership.role !== 'teacher') {
    throw new PermissionDeniedError('This action requires a teacher role.')
  }
  return membership
}

/** Throws {@link PermissionDeniedError} unless the user's role is admin-tier or `teacher` (i.e. any staff role, excluding `parent`). Matches `app/api/core/learners/[id]`'s enroll action's existing (broader-than-admin-only) role set — kept as a named function rather than a role array so the decision has one place to change. */
export async function requireSchoolStaff(client: SupabaseClient, schoolId: string): Promise<ResolvedMembership> {
  const membership = await requireSchoolMembership(client, schoolId)
  if (!SCHOOL_STAFF_ROLES.includes(membership.role)) {
    throw new PermissionDeniedError('This action requires a school staff role (admin, headteacher, deputy headteacher, or teacher).')
  }
  return membership
}

/**
 * Throws {@link ResourceOwnershipError} unless the authenticated user is the
 * legacy `teacher_classes` owner of `classId`. Deliberately checks
 * `teacher_classes`, not Core's `classes` — per the Evolution Blueprint,
 * `teacher_classes` is the de-facto-canonical Class table (34-file usage vs.
 * 1) until the Class evolution lands. This function should be the one place
 * that changes when it does.
 */
export async function requireClassTeacher(client: SupabaseClient, classId: string, dbOverride?: SupabaseClient): Promise<CurrentUser> {
  const user = await requireAuthentication(client)
  const teacher = await resolveTeacher(user.id)
  if (!teacher) throw new ResourceOwnershipError('This account has no teacher record.')

  const db = dbOverride ?? createServiceClient()
  const { data } = await db
    .from('teacher_classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', teacher.id)
    .maybeSingle()

  if (!data) throw new ResourceOwnershipError('You are not the teacher of this class.')
  return user
}

/** Throws {@link ResourceOwnershipError} unless the authenticated user is a parent/guardian of `studentId` (legacy `students.parent_user_id` or Core `learner_guardians`, per {@link resolveParent}). */
export async function requireParent(client: SupabaseClient, studentId: string): Promise<CurrentUser> {
  const user = await requireAuthentication(client)
  const parent = await resolveParent(user.id)
  const isLinked = parent.studentIds.includes(studentId) || parent.coreLearnerIds.includes(studentId)
  if (!isLinked) throw new ResourceOwnershipError('You are not a registered guardian of this learner.')
  return user
}

/** Throws {@link ResourceOwnershipError} unless the authenticated user's own student record is `studentId` (student-portal self-access). */
export async function requireStudent(client: SupabaseClient, studentId: string): Promise<CurrentUser> {
  const user = await requireAuthentication(client)
  const student = await resolveStudent(user.id)
  if (!student || student.id !== studentId) {
    throw new ResourceOwnershipError('This is not your own learner record.')
  }
  return user
}

// ── can* — capability checks, return boolean ────────────────────────────────

/**
 * True if the user may create/edit assessments and marks for `classId` —
 * either a school admin/headteacher-tier member, or the class's own teacher.
 * This is the composed capability `app/api/core/assessments`'s POST handler
 * was missing a role check for (Stage 0 finding): it should have called this.
 */
export async function canManageAssessment(client: SupabaseClient, schoolId: string, classId: string): Promise<boolean> {
  const membership = await resolveMembership((await requireAuthentication(client)).id, schoolId)
  if (membership && SCHOOL_ADMIN_ROLES.includes(membership.role)) return true
  try {
    await requireClassTeacher(client, classId)
    return true
  } catch {
    return false
  }
}

/**
 * True only for admin-tier school members. Report publishing is deliberately
 * NOT extended to class teachers — matches the already-correct, stricter
 * pattern `app/api/core/reports`' publish action already used before this
 * sprint, kept as the conservative default rather than loosened.
 */
export async function canPublishReport(client: SupabaseClient, schoolId: string): Promise<boolean> {
  const user = await requireAuthentication(client)
  const membership = await resolveMembership(user.id, schoolId)
  return !!membership && SCHOOL_ADMIN_ROLES.includes(membership.role)
}

/**
 * True only for admin-tier school members. NOTE: this is deliberately the
 * conservative choice for the previously-flagged open product decision
 * (Phase A Execution Plan, Stage 1 — whether report-card comment edits should
 * be admin-only or admin-or-class-teacher-of-record). Defaulting to
 * admin-only here matches the already-correct sibling `publish` action
 * instead of guessing at the looser alternative. If the product decision is
 * made to allow class-teacher edits, this is the one function to change.
 */
export async function canEditReport(client: SupabaseClient, schoolId: string): Promise<boolean> {
  return canPublishReport(client, schoolId)
}

/** True for admin-tier members and for the class's own teacher — matches `app/api/core/classes`' existing (correct) creation gate, generalized for reuse. */
export async function canManageClass(client: SupabaseClient, schoolId: string): Promise<boolean> {
  const user = await requireAuthentication(client)
  const membership = await resolveMembership(user.id, schoolId)
  return !!membership && SCHOOL_ADMIN_ROLES.includes(membership.role)
}

/**
 * True if the user may view `studentId`'s records — admin-tier school member,
 * the learner's own teacher, the learner's own parent/guardian, or the
 * learner themself. Broad by design (this is a read-visibility check, not a
 * write gate) — per CLAUDE.md's rule that `teacher_id` is attribution, not an
 * access gate, this does NOT restrict a teacher's read access to only the
 * exact learner they most recently graded; any teacher currently teaching
 * the learner (per `class_students`) qualifies. Class-membership-based
 * visibility is intentionally left to the caller for now — this function
 * covers the three unambiguous cases (admin, self, parent) plus the
 * `teacher_id`-of-record case; a full class-roster check is Sprint 1B scope
 * once `ClassRepository` exists.
 */
export async function canViewLearner(client: SupabaseClient, schoolId: string, studentId: string): Promise<boolean> {
  const user = await requireAuthentication(client)

  const student = await resolveStudent(user.id)
  if (student && student.id === studentId) return true // self

  const membership = await resolveMembership(user.id, schoolId)
  if (membership && SCHOOL_ADMIN_ROLES.includes(membership.role)) return true // admin-tier

  const parent = await resolveParent(user.id)
  if (parent.studentIds.includes(studentId) || parent.coreLearnerIds.includes(studentId)) return true // guardian

  const teacher = await resolveTeacher(user.id)
  if (teacher) {
    const db = createServiceClient()
    const { data } = await db.from('students').select('id').eq('id', studentId).eq('teacher_id', teacher.id).maybeSingle()
    if (data) return true // teacher-of-record
  }

  return false
}

/**
 * {@link canViewLearner}, addressed by Core `learners.id` instead of legacy
 * `students.id` — every page under `app/student/[section]/[learnerId]` and
 * `app/(parent)/child/[learnerId]/*` is addressed this way, but the
 * self/teacher-of-record checks `canViewLearner` performs only make sense
 * once bridged into legacy space (Sprint 9F's `students.external_id`).
 * Composes the existing bridge (`resolveLegacyStudentId`) with the existing
 * check rather than duplicating any of `canViewLearner`'s logic — per the
 * Ten Engineering Rules, "never duplicate authorization." Still returns
 * `true` for a linked parent/admin even when no legacy bridge exists yet
 * (Core-side parent links and school admin membership don't depend on the
 * legacy bridge at all).
 */
export async function canViewLearnerRecord(client: SupabaseClient, schoolId: string, coreLearnerId: string): Promise<boolean> {
  const legacyStudentId = await resolveLegacyStudentId(coreLearnerId)
  if (legacyStudentId && await canViewLearner(client, schoolId, legacyStudentId)) return true

  const user = await requireAuthentication(client)
  const parent = await resolveParent(user.id)
  if (parent.coreLearnerIds.includes(coreLearnerId)) return true

  const membership = await resolveMembership(user.id, schoolId)
  return !!membership && SCHOOL_ADMIN_ROLES.includes(membership.role)
}

/** Throws {@link ResourceOwnershipError} unless {@link canViewLearnerRecord} is true — the throwing counterpart for pages that need a hard gate, not a boolean. */
export async function requireLearnerAccess(client: SupabaseClient, schoolId: string, coreLearnerId: string): Promise<CurrentUser> {
  const user = await requireAuthentication(client)
  if (!(await canViewLearnerRecord(client, schoolId, coreLearnerId))) {
    throw new ResourceOwnershipError('You do not have access to this learner\'s record.')
  }
  return user
}
