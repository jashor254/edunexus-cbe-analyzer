/**
 * Canonical identity resolution (RAS §2 Application Layer / §3 Identity domain).
 *
 * Every route currently re-derives "who is this user" inline — 162 files call
 * `auth.getUser()` independently, 82 re-query `teachers` by hand, 89 re-implement
 * student-ownership checks (Sprint 1A repository analysis, 2026-07-15). This
 * module is meant to be the only place that happens going forward.
 *
 * This module does not authorize anything — it only answers "who." Authorization
 * ("is this identity allowed to do X") lives in `lib/core/permissions.ts`, which
 * is built entirely on top of these functions. Keeping the two separate means a
 * missing authorization check is a `permissions.ts` bug, and a wrong "who is
 * this person" answer is an `identity.ts` bug — never both at once, and never
 * ambiguous which layer is responsible (this ambiguity is exactly what let the
 * two authorization gaps found in the Stage 0 census go unnoticed).
 *
 * KNOWN GAP (see Sprint 1A architectural assessment): no repository currently
 * owns `students`/`learner_guardians` reads for identity purposes. The RAS's
 * `LearnerRepository` entry describes `lib/repositories/learner.repository.ts`,
 * which queries Core's `learners` table, not the de-facto-canonical `students`
 * table (Stage 0.5). Until that repository exists, this module queries
 * `students`/`learner_guardians` directly via the service client, exactly as
 * `lib/repositories/compass.repository.ts` and others already do — this is a
 * consolidation of an existing pattern, not a new violation, and it is the one
 * place in this module where a future `LearnerRepository` should absorb this
 * logic rather than a second implementation growing elsewhere.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { getUserRoles, type UserRole } from '@/lib/auth/getRole'
import { getSchoolUser } from '@/lib/core/school-users'
import type { SchoolUserRole } from '@/types/core'
import { UnauthorizedError, IdentityResolutionError } from '@/lib/core/errors'

export type CurrentUser = {
  id: string
  email: string | null
}

export type ResolvedSchool = {
  id: string
  schoolName: string
  isActive: boolean
}

export type ResolvedTeacher = {
  id: string
  userId: string
  fullName: string
  /** The legacy free-text role column on `teachers` (e.g. 'teacher' | 'admin') — not to be confused with `SchoolUserRole`. */
  legacyRole: string
}

export type ResolvedStudent = {
  id: string
  userId: string | null
  parentUserId: string | null
  teacherId: string | null
  name: string
}

export type ResolvedParent = {
  /** Every `students.id` this user is linked to, across the legacy `parent_user_id` link and Core's `learner_guardians`, deduplicated. */
  studentIds: string[]
  /** Core `learners.id` values this user is a registered guardian for, per `learner_guardians` — kept separate since Learner/students are not yet unified (Stage 0.5). */
  coreLearnerIds: string[]
}

export type ResolvedMembership = {
  schoolId: string
  userId: string
  role: SchoolUserRole
  isActive: boolean
}

/** The platform-wide identity snapshot for a request — no school scope. Compose with `resolveMembership`/`resolveSchool` for a school-scoped view (see `lib/core/context.ts`). */
export type IdentityContext = {
  user: CurrentUser
  primaryRole: UserRole
  teacher: ResolvedTeacher | null
  student: ResolvedStudent | null
  parent: ResolvedParent
}

/**
 * Resolves the authenticated user from a request-scoped Supabase client.
 * Throws {@link UnauthorizedError} if there is no authenticated session —
 * every route should call this (directly or via `permissions.requireAuthentication`)
 * before doing anything else, per the existing `auth.getUser()` → 401 rule.
 */
export async function resolveCurrentUser(client: SupabaseClient): Promise<CurrentUser> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new UnauthorizedError()
  return { id: user.id, email: user.email ?? null }
}

/**
 * Resolves a school by id. Throws {@link IdentityResolutionError} if the school
 * does not exist — a missing school is never a silent null in a context object,
 * since every Operating-Layer service assumes its school exists once resolved.
 */
export async function resolveSchool(schoolId: string): Promise<ResolvedSchool> {
  try {
    const school = await repos.schools.findById(schoolId)
    return { id: school.id, schoolName: school.school_name, isActive: school.is_active }
  } catch {
    throw new IdentityResolutionError(`School ${schoolId} could not be resolved.`)
  }
}

/** Resolves the legacy `teachers` row for an authenticated user, or `null` if none exists (the user is not a teacher). */
export async function resolveTeacher(userId: string, client?: SupabaseClient): Promise<ResolvedTeacher | null> {
  const db = client ?? createServiceClient()
  const { data } = await db
    .from('teachers')
    .select('id, user_id, full_name, role')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  return { id: data.id, userId: data.user_id, fullName: data.full_name, legacyRole: data.role }
}

/** Resolves the `students` row this user *is* (self-service student portal), or `null`. Does not resolve parent/guardian links — see {@link resolveParent}. */
export async function resolveStudent(userId: string, client?: SupabaseClient): Promise<ResolvedStudent | null> {
  const db = client ?? createServiceClient()
  const { data } = await db
    .from('students')
    .select('id, user_id, parent_user_id, teacher_id, name')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  return { id: data.id, userId: data.user_id, parentUserId: data.parent_user_id, teacherId: data.teacher_id, name: data.name }
}

/**
 * Resolves every learner this user is a parent/guardian of, across both
 * surviving guardian systems (Stage 0.5): the legacy `students.parent_user_id`
 * link (de facto canonical, real usage) and Core's `learner_guardians` table
 * (institutionally correct, functionally isolated). Returns empty arrays,
 * never throws, if the user is not a parent of anyone — "is this user a
 * parent" is a yes/no question the caller decides from the result shape,
 * not an error condition.
 */
export async function resolveParent(userId: string, client?: SupabaseClient): Promise<ResolvedParent> {
  const db = client ?? createServiceClient()

  const [{ data: legacyStudents }, coreLearnerIds] = await Promise.all([
    db.from('students').select('id').eq('parent_user_id', userId),
    repos.schools.listGuardianLearners(userId).then(rows => rows.map(r => r.learner_id)).catch(() => []),
  ])

  return {
    studentIds: (legacyStudents ?? []).map(s => s.id),
    coreLearnerIds,
  }
}

/** Thin wrapper over the existing canonical `getSchoolUser` — kept here so every identity lookup has one entry point. */
export async function resolveMembership(userId: string, schoolId: string): Promise<ResolvedMembership | null> {
  const schoolUser = await getSchoolUser(userId, schoolId)
  if (!schoolUser) return null
  return { schoolId: schoolUser.school_id, userId: schoolUser.user_id, role: schoolUser.role, isActive: schoolUser.is_active }
}

/**
 * The platform-wide "who is this person" snapshot: their primary role
 * (via the existing canonical `getUserRoles`), their teacher/student
 * identities if any, and their parent/guardian links if any. Does not
 * resolve a school — for a school-scoped view, see `lib/core/context.ts`.
 */
export async function resolveCurrentContext(client: SupabaseClient): Promise<IdentityContext> {
  const user = await resolveCurrentUser(client)
  const [{ primary }, teacher, student, parent] = await Promise.all([
    getUserRoles(user.id),
    resolveTeacher(user.id),
    resolveStudent(user.id),
    resolveParent(user.id),
  ])
  return { user, primaryRole: primary, teacher, student, parent }
}
