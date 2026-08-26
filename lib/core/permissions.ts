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
import { repos } from '@/lib/repositories'
import type { SchoolUserRole } from '@/types/core'
import {
  resolveCurrentUser,
  resolveMembership,
  resolveTeacher,
  resolveStudent,
  resolveParent,
  resolveLegacyStudentId,
  resolveCoreLearnerIdForStudentId,
  resolveTeachingTenure,
  resolveCurrentTenureForCompatibilityClass,
  resolveOwnedLegacyStudentIds,
  type CurrentUser,
  type ResolvedMembership,
} from '@/lib/core/identity'
import { identityIsIn, asStudentId, type LearnerId, type StudentId, type AnyLearnerIdentity } from '@/lib/core/identityTypes'
import {
  UnauthorizedError,
  MembershipRequiredError,
  PermissionDeniedError,
  ResourceOwnershipError,
  isEduNexusError,
} from '@/lib/core/errors'

/**
 * The roles that carry school-administrator authority. All three are equally
 * canonical and equally authoritative — `requireSchoolAdmin` makes no
 * distinction between them.
 *
 * Exported so that anything deciding "does this school have an administrator"
 * asks the same question `requireSchoolAdmin` answers, rather than keeping its
 * own list that could drift out of agreement with the gate it is meant to
 * describe.
 */
export const SCHOOL_ADMIN_ROLES: readonly SchoolUserRole[] = ['school_admin', 'headteacher', 'deputy_headteacher']
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

/**
 * The authoritative context an institutional (school-assigned) assignment is
 * created under — everything downstream (compatibility class/roster
 * resolution, subject text, event payload) derives from this, never from
 * client-supplied school/class/subject data (RAS §8, CLAUDE.md "never trust
 * userId from a request body" generalized to every identity in this chain).
 */
export type InstitutionalAssignmentAuthority = {
  schoolId: string
  /** `school_users.id` — the membership `class_subjects.teacher_id` points to. */
  schoolUserId: string
  classSubjectId: string
  /** `classes.id` — the Core class this tenure teaches. */
  coreClassId: string
  subjectId: string
  /** Canonical Core subject name — the only subject text an institutional assignment may carry (Step 7). */
  subjectName: string
  /** The auth user id holding this tenure — always equal to the authenticated caller by the time this returns. */
  teacherUserId: string
}

/**
 * Throws unless `classSubjectId` is a CURRENT teaching tenure
 * (`class_subjects` row) held by the authenticated user, through an active
 * school membership whose role permits teaching. This is institutional
 * assignment authority's one gate (Phase 1D Step 3) — the compatibility
 * bridge (`ensureAssignmentCompatibilityClass`/`syncAssignmentCompatibilityRoster`,
 * `lib/core/assignmentCompatibilityBridge.ts` / `assignmentLearnerBridge.ts`)
 * is storage machinery a caller resolves AFTER this succeeds, never a
 * substitute for it — legacy `teacher_classes.teacher_id` ownership of the
 * eventual compatibility class is never consulted here and never grants
 * authority (Step 4/6: "institutional authority -> compatibility
 * resolution", never the reverse).
 *
 * Throws:
 *  - `UnauthorizedError` — no authenticated session.
 *  - `ResourceOwnershipError` — `classSubjectId` does not exist, is not held
 *    by the authenticated user, or is not current (`ended_at` non-null — a
 *    departed/replaced tenure, Step 10/11's departed-teacher proof).
 *  - `MembershipRequiredError` — the owning school membership is inactive
 *    (Step 10's "membership deactivated" branch, and Step 12's reinstatement
 *    case: reinstated membership with no new current tenure still has no
 *    tenure to pass the previous check with).
 *  - `PermissionDeniedError` — the membership is active but its role does
 *    not permit teaching (not `SCHOOL_STAFF_ROLES`).
 *
 * Never trusts a caller-supplied `schoolId`/`coreClassId`/`subjectId` — every
 * field on the returned value is derived from `classSubjectId` alone via
 * `resolveTeachingTenure`, then cross-checked against the authenticated
 * user (Step 13/14: wrong class/subject/school and multi-school proofs all
 * reduce to "does `classSubjectId` name a tenure this exact user holds").
 */
export async function requireInstitutionalAssignmentAuthority(
  client: SupabaseClient,
  classSubjectId: string,
): Promise<InstitutionalAssignmentAuthority> {
  const user = await requireAuthentication(client)
  return resolveInstitutionalAssignmentAuthority(user.id, classSubjectId)
}

/**
 * Phase 3A — the same tenure/membership/role checks
 * {@link requireInstitutionalAssignmentAuthority} performs, factored out to
 * take an already-authenticated `userId` directly rather than a
 * `SupabaseClient` to re-authenticate from. Extracted for
 * `lib/core/academicBridge.ts::createBridgedAssessment`, which already holds
 * a server-verified `actingUserId` by the time it needs this check and has
 * no client of its own to pass — re-deriving the same tenure/ended_at/role
 * logic there instead of calling this would be exactly the copy-pasted
 * authorization this module's header warns against.
 *
 * `requireInstitutionalAssignmentAuthority` is the one and only public
 * entry point for a route holding a `SupabaseClient`; this is the shared
 * primitive both it and `academicBridge.ts` build on.
 */
export async function resolveInstitutionalAssignmentAuthority(
  userId: string,
  classSubjectId: string,
): Promise<InstitutionalAssignmentAuthority> {
  const tenure = await resolveTeachingTenure(classSubjectId)
  if (!tenure || tenure.membershipUserId !== userId) {
    // Deliberately indistinguishable from "no such tenure" (matches
    // `requireClassTeacher`'s existing not-found/not-yours conflation) —
    // never confirms to a caller that a `classSubjectId` they don't hold
    // exists at all.
    throw new ResourceOwnershipError('You do not hold this teaching assignment.')
  }
  if (tenure.endedAt !== null) {
    throw new ResourceOwnershipError('This teaching assignment has ended and no longer grants assignment-creation authority.')
  }
  if (!tenure.membershipIsActive) {
    throw new MembershipRequiredError('Your school membership is not active.')
  }

  const membership = await resolveMembership(userId, tenure.schoolId)
  if (!membership || !membership.isActive) {
    throw new MembershipRequiredError()
  }
  if (!SCHOOL_STAFF_ROLES.includes(membership.role)) {
    throw new PermissionDeniedError('Your role does not permit creating assignments.')
  }

  return {
    schoolId: tenure.schoolId,
    schoolUserId: tenure.schoolUserId,
    classSubjectId: tenure.classSubjectId,
    coreClassId: tenure.coreClassId,
    subjectId: tenure.subjectId,
    subjectName: tenure.subjectName,
    teacherUserId: userId,
  }
}

/** Throws {@link ResourceOwnershipError} unless the authenticated user is a parent/guardian of `studentId` (legacy `students.parent_user_id` or Core `learner_guardians`, per {@link resolveParent}). */
export async function requireParent(client: SupabaseClient, studentId: AnyLearnerIdentity): Promise<CurrentUser> {
  const user = await requireAuthentication(client)
  const parent = await resolveParent(user.id)
  // Deliberately checks BOTH spaces: this is called with a LearnerId from the
  // Core guardian-invite flow and with a StudentId from the legacy parent flow.
  const isLinked = identityIsIn(parent.studentIds, studentId) || identityIsIn(parent.coreLearnerIds, studentId)
  if (!isLinked) throw new ResourceOwnershipError('You are not a registered guardian of this learner.')
  return user
}

/**
 * {@link requireParent} variant for a caller holding a legacy `students.id`
 * that may be a Phase 1C compatibility row for a Core learner the guardian
 * links ONLY via `learner_guardians` — never via `students.parent_user_id`
 * (Parent Portal Phase P1, following up P0 §26/§36's flagged-but-unverified
 * suspicion about `/child/[learnerId]/assignments` and `/gradebook`).
 *
 * `requireParent`'s own check can't see this case: `resolveParent`'s
 * `studentIds` is populated ONLY from `parent_user_id`, and a bridged
 * compatibility id is a different UUID entirely from any `coreLearnerIds`
 * entry (`students.id` vs. `learners.id`, never equal even though one
 * bridges to the other via `students.external_id`) — `identityIsIn`'s plain
 * string-membership test can never match it directly. Confirmed live: the
 * `/child/[learnerId]/assignments` and `/gradebook` pages pass this exact
 * bridged id to `/api/student/assignments` and `/api/parent/gradebook`
 * respectively, after the PAGE's own `requireParent(learnerId)` already
 * succeeded — an institutional-only guardian would pass the page and then
 * get a 403 from the API underneath it.
 *
 * Tries the direct check first (unchanged for every legacy-linked caller,
 * zero extra cost), and only on failure resolves the reverse bridge
 * ({@link resolveCoreLearnerIdForStudentId}) and re-checks against that
 * Core learner id. Additive only: a legacy-only guardian's access is
 * exactly what {@link requireParent} already granted; this only adds a
 * second, independent path to an ALLOW, never a new path to a DENY.
 */
export async function requireParentOfLegacyStudent(client: SupabaseClient, studentId: StudentId): Promise<CurrentUser> {
  try {
    return await requireParent(client, studentId)
  } catch (err) {
    if (!(err instanceof ResourceOwnershipError)) throw err
    const coreLearnerId = await resolveCoreLearnerIdForStudentId(studentId)
    if (!coreLearnerId) throw err
    return await requireParent(client, coreLearnerId)
  }
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

/**
 * Phase 3A — Part A. READ-only authorization for an EXISTING assignment's
 * detail (`app/api/teacher/assignments/[id]` GET) — distinct in kind from
 * {@link requireInstitutionalAssignmentAuthority}, which is CREATE-time
 * authority keyed on a `classSubjectId` the caller must currently hold
 * exactly. An assignment's authorized readers are broader than that: the
 * caller's own separate `assignments.teacher_id === teacher.id` check
 * (the historical creator, unchanged forever) already grants read access
 * and is NOT reproduced here — this function answers only the second,
 * previously-missing half: does the CALLER currently hold the teaching
 * tenure for the same Core class+subject the assignment's compatibility
 * class was created under, even if they did not create it themselves
 * (a replacement teacher's legitimate read access to a departed
 * predecessor's assignment).
 *
 * Never grants or implies MARK authority — the mark route's own
 * creator-only check (`assignments.teacher_id`) is untouched by this
 * function and by every caller of it (Step 6).
 *
 * Composes {@link resolveCurrentTenureForCompatibilityClass} (the "who"
 * resolution) with the one authorization decision this function adds:
 * does that current tenure's membership belong to `userId`, is it active,
 * and is it genuinely current (`endedAt === null`) — the same shape of
 * check {@link requireInstitutionalAssignmentAuthority} performs, but as a
 * boolean over a tenure this caller may not hold at all, never a throw.
 *
 * Returns `false` — never throws — for: no compatibility bridge (a genuine
 * Solo/private teacher class, or a pre-Phase-1B institutional assignment —
 * the creator check is the only applicable path for those, by design); a
 * vacant class/subject post; an inactive membership; or a current tenure
 * held by a different user. A departed teacher who is neither the creator
 * nor the current tenure holder is correctly denied here (Step 5).
 */
export async function isCurrentTenureHolderForAssignmentClass(userId: string, assignmentClassId: string): Promise<boolean> {
  const currentTenure = await resolveCurrentTenureForCompatibilityClass(assignmentClassId)
  if (!currentTenure) return false
  if (currentTenure.endedAt !== null || !currentTenure.membershipIsActive) return false
  return currentTenure.membershipUserId === userId
}

/**
 * Throws {@link ResourceOwnershipError} unless `studentId` is a current
 * `class_students` member of `classId`. This is the canonical "is this
 * learner eligible to act on something owned by this class" gate — used by
 * every assignment-submission entry point (typed, file, quiz) to prove a
 * learner is enrolled in the class that owns the target assignment, not
 * merely that they are who they claim to be.
 *
 * Deliberately takes a server-resolved `classId` (e.g. `assignments.class_id`,
 * loaded from the DB by the caller immediately beforehand), never a
 * client-supplied one — the assignment row itself is the only authority for
 * which class owns it (Phase 0 containment,
 * docs/architecture — legacy assignment domain audit). Already the exact
 * check `app/api/student/assignments/[id]/questions/route.ts` re-implements
 * inline; this is the single canonical version other call sites should share
 * rather than re-deriving (Engineering Rule 4 — "never duplicate
 * authorization").
 *
 * Deliberately legacy-space only: `students.id` / `class_students`, never
 * Core `learners.id` / `learner_enrollments`. Do not widen this to accept a
 * Core learner id — the assignment domain's identity space is `students.id`
 * throughout, a documented deliberate pilot-era deferral, not a bug.
 */
export async function requireClassMembership(studentId: string, classId: string, dbOverride?: SupabaseClient): Promise<void> {
  const db = dbOverride ?? createServiceClient()
  const { data: membership } = await db
    .from('class_students')
    .select('id')
    .eq('class_id', classId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (!membership) throw new ResourceOwnershipError('This learner is not enrolled in the class this assignment belongs to.')
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
  } catch (err) {
    // requireClassTeacher only ever throws UnauthorizedError/ResourceOwnershipError
    // (both EduNexusError, both genuine denials) for its own business logic —
    // any other error (DB outage, programming error) must propagate, not be
    // read by a caller as an ordinary "you may not do this."
    if (isEduNexusError(err)) return false
    throw err
  }
}

/**
 * Phase 3C — marks-entry authority for a CANONICAL (`class_subject_id`-
 * bearing) assessment. Deliberately answers a different question from
 * {@link canManageAssessment} ("do you currently manage this class at
 * all"): "does the CURRENT teaching tenure for this exact class+subject
 * belong to you" — the assessment's own, possibly long-ended
 * `class_subject_id` is never itself the check (Phase 3A Step 33's teacher-
 * replacement history preservation means an assessment's stored tenure id
 * can outlive the person who created it). Authority instead follows
 * whoever CURRENTLY teaches this class+subject, mirroring how
 * `class_subjects` itself models continuity — a departed teacher's replacement
 * inherits write access to existing assessments for that subject, exactly
 * as `class_subjects_current_assignment_uniq` intends for teaching itself.
 *
 * Admin-tier school membership bypasses the tenure check entirely (same
 * shape as `canManageAssessment`). A non-admin caller is authorized only if
 * {@link resolveInstitutionalAssignmentAuthority} succeeds against the
 * class+subject's CURRENT `class_subjects` row — throws `ResourceOwnershipError`
 * if no current tenure exists at all for this class+subject (the subject
 * assignment was fully removed, not merely reassigned), and otherwise
 * propagates that function's own ended_at/membership/role errors unchanged.
 */
export async function requireCurrentSubjectTeachingAuthority(
  client: SupabaseClient,
  schoolId: string,
  coreClassId: string,
  subjectId: string,
): Promise<void> {
  const user = await requireAuthentication(client)
  return resolveCurrentSubjectTeachingAuthority(user.id, schoolId, coreClassId, subjectId)
}

/**
 * {@link requireCurrentSubjectTeachingAuthority} variant taking an
 * already-authenticated `userId` directly — for
 * `lib/core/academicBridge.ts::recordCanonicalAssessmentMarks`, which holds
 * a server-verified `actingUserId` and no `SupabaseClient` of its own, same
 * shape as {@link resolveInstitutionalAssignmentAuthority}.
 */
export async function resolveCurrentSubjectTeachingAuthority(
  userId: string,
  schoolId: string,
  coreClassId: string,
  subjectId: string,
): Promise<void> {
  const membership = await resolveMembership(userId, schoolId)
  if (membership && SCHOOL_ADMIN_ROLES.includes(membership.role)) return

  const currentClassSubjectId = await repos.teachers.findCurrentTenureIdForClassSubject(coreClassId, subjectId)
  if (!currentClassSubjectId) {
    throw new ResourceOwnershipError('No teacher currently holds this class and subject — an administrator must reassign it before marks can be entered.')
  }

  await resolveInstitutionalAssignmentAuthority(userId, currentClassSubjectId)
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
/**
 * Authorizes `userId` against a legacy-keyed `students.id` for a
 * learner-portal feature that operates entirely in that identity space —
 * Compass and Career Intelligence, per the Phase 0 audit's finding that
 * both key exclusively on `students.id` and neither consults Core
 * `learners`/`learner_accounts` at all. Built on
 * {@link resolveOwnedLegacyStudentIds} (identity.ts) — this function makes
 * no table query of its own (Engineering Rule 4): every Compass/Career route
 * that used to re-derive `student.user_id === userId` (and sometimes
 * `parent_user_id`) inline now calls this one function instead, so the two
 * identity spaces (legacy self/parent link, institutional Phase 1C
 * compatibility bridge) are checked identically everywhere, not
 * independently per route.
 *
 * `includeParent` defaults to `false` — most of these routes only ever
 * authorized the learner themselves; pass `true` only where the existing
 * route already extended that to the parent (`career/capability`), to keep
 * this a pure widening of identity SPACE, not of WHO within it.
 */
export async function canAccessLegacyStudent(
  userId: string,
  studentId: string,
  opts: { includeParent?: boolean } = {}
): Promise<boolean> {
  const owned = await resolveOwnedLegacyStudentIds(userId, undefined, opts)
  return identityIsIn(owned, asStudentId(studentId))
}

export async function canViewLearner(client: SupabaseClient, schoolId: string, studentId: StudentId): Promise<boolean> {
  const user = await requireAuthentication(client)

  const student = await resolveStudent(user.id)
  if (student && student.id === studentId) return true // self

  const membership = await resolveMembership(user.id, schoolId)
  if (membership && SCHOOL_ADMIN_ROLES.includes(membership.role)) return true // admin-tier

  const parent = await resolveParent(user.id)
  if (identityIsIn(parent.studentIds, studentId) || identityIsIn(parent.coreLearnerIds, studentId)) return true // guardian

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
export async function canManageLearnerRecord(client: SupabaseClient, schoolId: string, studentId: StudentId): Promise<boolean> {
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
export async function canManageLearnerRecordCore(client: SupabaseClient, schoolId: string, coreLearnerId: LearnerId): Promise<boolean> {
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
export async function canViewLearnerRecord(client: SupabaseClient, schoolId: string, coreLearnerId: LearnerId): Promise<boolean> {
  const legacyStudentId = await resolveLegacyStudentId(coreLearnerId)
  if (legacyStudentId && await canViewLearner(client, schoolId, legacyStudentId)) return true

  const user = await requireAuthentication(client)
  const parent = await resolveParent(user.id)
  if (parent.coreLearnerIds.includes(coreLearnerId)) return true

  const membership = await resolveMembership(user.id, schoolId)
  return !!membership && SCHOOL_ADMIN_ROLES.includes(membership.role)
}

/** Throws {@link ResourceOwnershipError} unless {@link canViewLearnerRecord} is true — the throwing counterpart for pages that need a hard gate, not a boolean. */
export async function requireLearnerAccess(client: SupabaseClient, schoolId: string, coreLearnerId: LearnerId): Promise<CurrentUser> {
  const user = await requireAuthentication(client)
  if (!(await canViewLearnerRecord(client, schoolId, coreLearnerId))) {
    throw new ResourceOwnershipError('You do not have access to this learner\'s record.')
  }
  return user
}
