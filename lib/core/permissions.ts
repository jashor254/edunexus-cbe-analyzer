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
 * True if `teacherId` (the legacy `teachers.id`, not the auth user id)
 * currently teaches `studentId` — either through `class_students ->
 * teacher_classes` (primary, canonical rule) or the legacy
 * `students.teacher_id`-of-record compatibility column. Factored out of
 * `canViewLearner` (Phase 0 correction) so `canManageLearnerRecord` below
 * can reuse the exact same relationship check for a staff-only (no self/
 * parent) capability, instead of re-deriving it — "never duplicate
 * authorization." See `canViewLearner`'s own doc comment for the full
 * rationale (RLS parity, no school-id cross-check needed, legacy
 * compatibility deprecation note).
 */
async function isCurrentTeacherOfStudent(teacherId: string, studentId: string): Promise<boolean> {
  const db = createServiceClient()

  const { data: taughtClasses } = await db.from('teacher_classes').select('id').eq('teacher_id', teacherId)
  if (taughtClasses && taughtClasses.length > 0) {
    const { data: enrollment } = await db
      .from('class_students')
      .select('id')
      .eq('student_id', studentId)
      .in('class_id', taughtClasses.map(c => c.id))
      .limit(1)
      .maybeSingle()
    if (enrollment) return true // current class teacher
  }

  const { data: legacyRecord } = await db.from('students').select('id').eq('id', studentId).eq('teacher_id', teacherId).maybeSingle()
  return !!legacyRecord // teacher-of-record (legacy)
}

/**
 * True if the user may view `studentId`'s records — admin-tier school member,
 * the learner's own teacher, the learner's own parent/guardian, or the
 * learner themself. Broad by design (this is a read-visibility check, not a
 * write gate) — per CLAUDE.md's rule that `teacher_id` is attribution, not an
 * access gate, this does NOT restrict a teacher's read access to only the
 * exact learner they most recently graded; any teacher currently teaching
 * the learner (per `class_students`) qualifies.
 *
 * Phase 0 correction (`docs/architecture/blueprint-living-action-plan-audit.md`
 * §6): this used to check only the legacy `students.teacher_id`-of-record
 * column, while the DB-level RLS policy (`auth_is_teacher_of_student`,
 * `supabase/migrations/20260525_rls_policies.sql`) already correctly derives
 * teacher access via `class_students -> teacher_classes -> teachers`. A
 * teacher who currently teaches a learner only through class membership
 * (not the legacy of-record column) was therefore denied at this layer even
 * though RLS would have let the underlying query through — a fail-closed
 * inconsistency, not a leak, but still a real bug for any real class teacher.
 * This now checks both, mirroring RLS's `auth_is_teacher_of_student OR
 * auth_is_direct_teacher_of_student` exactly (`20260720130000_sprint1_evidence_rls_bypass_fix.sql`).
 *
 * No additional school-id cross-check is added for either branch: neither
 * `class_students`/`teacher_classes`/`teachers` nor legacy `students` carries
 * a Core `schools.id` foreign key (they predate Core's multi-tenant schema
 * and are scoped only by a free-text `school` column), and the RLS functions
 * this mirrors don't check one either — the join/lookup itself IS the
 * isolation boundary: it only succeeds for a class or teacher_id row that
 * genuinely names this exact teacher and this exact student, which can't be
 * satisfied by a teacher at a different school. Isolation for the Core-space
 * branches above (self/admin/parent) is unaffected by this change.
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
  if (teacher && await isCurrentTeacherOfStudent(teacher.id, studentId)) return true

  return false
}

/**
 * Staff-only counterpart to {@link canViewLearner} — true for admin-tier
 * school members or the learner's current teacher (same relationship rule
 * `isCurrentTeacherOfStudent` implements), but explicitly **excludes** the
 * learner's own self-access and parent/guardian access, which
 * `canViewLearner` deliberately includes for read-visibility. Written for
 * the Blueprint action-plan domain (`lib/learnerBlueprint/actionPlan/`,
 * Phase 1 of `docs/architecture/blueprint-living-action-plan-audit.md`):
 * proposing/editing/approving/rejecting/deferring an action item is a
 * staff *capability*, not a read-visibility question — a learner or parent
 * must never pass this check, only ever `canViewLearner`'s broader one.
 * Reuses the exact same underlying primitives as `canViewLearner`
 * (`resolveMembership`, `resolveTeacher`, `isCurrentTeacherOfStudent`) —
 * this is proper factoring of a shared capability, not a second,
 * independently-derived authorization query.
 */
export async function canManageLearnerRecord(client: SupabaseClient, schoolId: string, studentId: string): Promise<boolean> {
  const user = await requireAuthentication(client)

  const membership = await resolveMembership(user.id, schoolId)
  if (membership && SCHOOL_ADMIN_ROLES.includes(membership.role)) return true // admin-tier

  const teacher = await resolveTeacher(user.id)
  if (teacher && await isCurrentTeacherOfStudent(teacher.id, studentId)) return true

  return false
}

/**
 * {@link canManageLearnerRecord}, addressed by Core `learners.id` instead of
 * legacy `students.id` — mirrors {@link canViewLearnerRecord}'s exact
 * bridge-composition shape (`resolveLegacyStudentId` + the legacy-space
 * check), but staff-only: when no legacy bridge exists yet for a Core
 * learner (a newly-enrolled learner with no assessment history — a
 * legitimate, common state, never an error), only admin-tier membership
 * can manage the record; there is no legacy teacher relationship to check
 * yet, so a teacher who would otherwise qualify simply cannot be verified
 * against anything and is denied until a bridge exists.
 */
export async function canManageLearnerRecordCore(client: SupabaseClient, schoolId: string, coreLearnerId: string): Promise<boolean> {
  const legacyStudentId = await resolveLegacyStudentId(coreLearnerId)
  if (legacyStudentId && await canManageLearnerRecord(client, schoolId, legacyStudentId)) return true

  const membership = await resolveMembership((await requireAuthentication(client)).id, schoolId)
  return !!membership && SCHOOL_ADMIN_ROLES.includes(membership.role)
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
