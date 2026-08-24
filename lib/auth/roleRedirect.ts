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
//
// Parent Portal Phase P1 (Parent Entry Convergence, following Super Audit
// P0's CRITICAL #2): every parent used to land on the legacy `/dashboard`
// unconditionally, never the IDOR-safe, multi-school-aware, institutional-
// guardian-aware Core `/child` flow — reachable before this change only via
// a mislabeled nav item. `/child` (app/(parent)/child/page.tsx) is now the
// single canonical parent entry and does the identity-space-aware routing
// this function deliberately does NOT: it resolves `resolveParent()` and
// sends a legacy-only guardian straight on to `/dashboard` (still the
// correct home for that space, including its self-serve "Add Student" flow
// this pure/sync function has no way to reproduce), shows a Core-only or
// mixed guardian their linked children, and gives a zero-linked-children
// guardian an honest empty state with a path forward rather than a second
// dead end. See that file for the full routing contract — this function
// only has to get every parent to the ONE place that contract lives.

export type UserRole = 'teacher' | 'parent' | 'student'

export function getRoleRedirect(role: UserRole | null): string {
  if (role === 'teacher') return '/teacher/dashboard'
  if (role === 'student') return '/student'
  if (role === 'parent') return '/child'
  return '/dashboard'
}
