import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import type { SchoolUserRole } from '@/types/core'
import { getRoleRedirect, type UserRole } from './roleRedirect'

export type { UserRole }
export { getRoleRedirect }

export interface UserRoles {
  primary:          UserRole
  secondary:        UserRole | null
  isDualRole:       boolean
  hasTeacherRecord: boolean // a row exists in the legacy `teachers` table (setup complete)
}

/**
 * THE single canonical role lookup for the whole app. Every gate that needs
 * to know "is this user a teacher" — proxy.ts, app/dashboard/layout.tsx,
 * app/teacher/layout.tsx — must call this instead of re-deriving the rule.
 * Before this consolidation those three call sites disagreed (one trusted
 * `teachers` table existence, another trusted `profiles.role` only), which
 * produced an infinite redirect loop for any account with a `teachers` row
 * but no `profiles` row. Never re-fork this logic.
 *
 * profiles.id = auth user UUID (NOT user_id — profiles uses id as the FK).
 *
 * Accepts an optional client so hot-path callers (middleware) can reuse a
 * client they already created instead of spinning up a second one. Deliberately
 * does NOT import `@/lib/repositories` — that pulls 20+ repositories into
 * every request through proxy.ts, which runs on every navigation.
 */
export async function getUserRoles(userId: string, db?: SupabaseClient): Promise<UserRoles> {
  const client = db ?? createServiceClient()

  const [{ data: profile, error: profileError }, { data: teacher, error: teacherError }] = await Promise.all([
    client.from('profiles').select('role, secondary_role').eq('id', userId).maybeSingle(),
    client.from('teachers').select('id').eq('user_id', userId).maybeSingle(),
  ])

  // A query failure here silently falls through to the 'parent' default
  // below, which can misroute a teacher — this runs on every navigation, so
  // only log the (rare) error case, not every call.
  if (profileError || teacherError) {
    console.error('[auth/getRole] role lookup query failed', {
      userId,
      profileError: profileError?.message,
      teacherError: teacherError?.message,
    })
  }

  const hasTeacherRecord = !!teacher?.id

  const primary: UserRole =
    profile?.role === 'teacher' ? 'teacher' :
    profile?.role === 'student' ? 'student' :
    profile?.role === 'parent'  ? 'parent'  :
    hasTeacherRecord             ? 'teacher' : // fallback: has teacher row, profiles row missing/stale
                                    'parent'    // default

  const secondary = (profile?.secondary_role as UserRole | null) ?? null

  return { primary, secondary, isDualRole: secondary !== null, hasTeacherRecord }
}

/** Backward-compatible single-role getter */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const { primary } = await getUserRoles(userId)
  return primary
}

export type SchoolAdminMembership = { schoolId: string; role: SchoolUserRole }

/**
 * Sprint 10G — is this user an admin-tier member (school_admin, headteacher,
 * deputy_headteacher) of any school, and if so which one. Queries
 * `school_users` directly via the passed client rather than going through
 * `lib/core/identity.ts`/`lib/core/permissions.ts` — those pull in
 * `lib/repositories` (20+ repositories), which this file's `getUserRoles()`
 * deliberately avoids because it runs on every navigation through proxy.ts.
 * Kept in this file so both callers (proxy.ts's routing branch, the login
 * page's post-login redirect) share one implementation instead of each
 * re-deriving admin-tier status.
 */
export async function getSchoolAdminMembership(userId: string, db?: SupabaseClient): Promise<SchoolAdminMembership | null> {
  const client = db ?? createServiceClient()
  const { data, error } = await client
    .from('school_users')
    .select('school_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('role', ADMIN_TIER_ROLES)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[auth/getRole] admin membership lookup failed', { userId, error: error.message })
    return null
  }
  if (!data) return null
  return { schoolId: data.school_id, role: data.role as SchoolUserRole }
}
