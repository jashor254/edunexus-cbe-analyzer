import { repos } from '@/lib/repositories'

export type UserRole = 'teacher' | 'parent' | 'student'

export interface UserRoles {
  primary:    UserRole
  secondary:  UserRole | null
  isDualRole: boolean
}

/**
 * Full role info for a user.
 * profiles.id = auth user UUID (NOT user_id — profiles uses id as the FK).
 */
export async function getUserRoles(userId: string): Promise<UserRoles> {
  const [profile, teacher] = await Promise.all([
    repos.teachers.findProfileWithSecondaryRole(userId),
    repos.teachers.findTeacherByUserId(userId),
  ])

  const primary: UserRole =
    profile?.role === 'teacher' ? 'teacher' :
    profile?.role === 'student' ? 'student' :
    profile?.role === 'parent'  ? 'parent'  :
    teacher?.id                 ? 'teacher' : // fallback: has teacher row
                                  'parent'    // default

  const secondary = (profile?.secondary_role as UserRole | null) ?? null

  return { primary, secondary, isDualRole: secondary !== null }
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
