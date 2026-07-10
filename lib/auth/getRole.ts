import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'

export type UserRole = 'teacher' | 'parent' | 'student'

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

  const [{ data: profile }, { data: teacher }] = await Promise.all([
    client.from('profiles').select('role, secondary_role').eq('id', userId).maybeSingle(),
    client.from('teachers').select('id').eq('user_id', userId).maybeSingle(),
  ])

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

/** Map primary role → post-login destination */
export function getRoleRedirect(role: UserRole | null): string {
  return role === 'teacher' ? '/teacher/dashboard' : '/dashboard'
}
