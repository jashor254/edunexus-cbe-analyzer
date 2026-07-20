// lib/auth/roleRedirect.ts
//
// THE single canonical primary-role → destination mapping. Pure and
// dependency-free on purpose — lib/auth/getRole.ts's getUserRoles() needs
// server-only imports (a service-role Supabase client), but this mapping
// alone doesn't, and needs to be callable from client components too (e.g.
// the signup page, which already knows the role a user is signing up as and
// shouldn't need a network round-trip just to map it to a destination).
// Server code should still prefer importing this from '@/lib/auth/getRole'
// (re-exported there) unless it's specifically a client component.
//
// Before this was consolidated, five call sites each re-derived this mapping
// independently and disagreed on the student case (none of them ever sent a
// student to /student) — the root cause of Platform Audit v1.0 Blocker #5.

export type UserRole = 'teacher' | 'parent' | 'student'

export function getRoleRedirect(role: UserRole | null): string {
  if (role === 'teacher') return '/teacher/dashboard'
  if (role === 'student') return '/student'
  return '/dashboard'
}
