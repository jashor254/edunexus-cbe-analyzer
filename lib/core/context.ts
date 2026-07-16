/**
 * The reusable request context (RAS §2 — "every service should receive
 * Context instead of rebuilding it"). This is the composition layer: it
 * assembles `identity.ts` (who) and `permissions.ts` (what they can do) into
 * one object, in the order the RAS's layer diagram specifies —
 * Current User → School → Membership → Role → Permissions → Context.
 *
 * A Domain Service (`lib/core/*.ts`) should take a `SchoolRequestContext` as
 * a parameter instead of a raw `userId`/`schoolId` pair and re-deriving
 * membership itself — this is what makes services composable and testable
 * without a live request (build a context once, pass it to several service
 * calls, mock it entirely in tests).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SchoolUserRole } from '@/types/core'
import {
  resolveCurrentUser,
  resolveSchool,
  resolveMembership,
  resolveTeacher,
  resolveCurrentContext,
  type CurrentUser,
  type ResolvedSchool,
  type ResolvedMembership,
  type ResolvedTeacher,
  type IdentityContext,
} from '@/lib/core/identity'
import { MembershipRequiredError } from '@/lib/core/errors'

const SCHOOL_ADMIN_ROLES: readonly SchoolUserRole[] = ['school_admin', 'headteacher', 'deputy_headteacher']

/** A role-derived snapshot of coarse-grained capabilities, so a service doesn't need to re-check `membership.role` itself for common cases. Fine-grained/ownership-aware checks still go through `lib/core/permissions.ts`'s `can*` functions. */
export type PermissionSet = {
  isSchoolAdmin: boolean
  isTeacher: boolean
  isParentRole: boolean
}

function derivePermissions(role: SchoolUserRole): PermissionSet {
  return {
    isSchoolAdmin: (SCHOOL_ADMIN_ROLES as string[]).includes(role),
    isTeacher: role === 'teacher',
    isParentRole: role === 'parent',
  }
}

/** The context every School-scoped Domain Service (Assessment, Class, Report Card, etc.) should receive. */
export type SchoolRequestContext = {
  user: CurrentUser
  school: ResolvedSchool
  membership: ResolvedMembership
  permissions: PermissionSet
  /** Present only if this user also has a legacy `teachers` row — a school-tier admin need not be a teacher. */
  teacher: ResolvedTeacher | null
}

/**
 * Builds a School-scoped context. Throws {@link MembershipRequiredError} if
 * the user has no active membership — a Domain Service should never receive
 * a context for a school the user doesn't belong to, so there is no "null
 * membership" case to handle downstream.
 */
export async function buildSchoolContext(client: SupabaseClient, schoolId: string): Promise<SchoolRequestContext> {
  const user = await resolveCurrentUser(client)
  const [school, membership, teacher] = await Promise.all([
    resolveSchool(schoolId),
    resolveMembership(user.id, schoolId),
    resolveTeacher(user.id),
  ])
  if (!membership) throw new MembershipRequiredError()

  return { user, school, membership, permissions: derivePermissions(membership.role), teacher }
}

/**
 * The platform-wide context for routes that aren't school-scoped (student
 * portal, parent portal, legacy teacher gradebook routes operating on
 * `teacher_classes` rather than a Core school). Thin re-export of
 * `identity.resolveCurrentContext` — kept here so a route only ever needs
 * to import from `lib/core/context.ts` for "give me my context," regardless
 * of which shape it turns out to be.
 */
export async function buildPlatformContext(client: SupabaseClient): Promise<IdentityContext> {
  return resolveCurrentContext(client)
}
