import { createClient } from '@/utils/supabase/server'
import { getUserRoles, getRoleRedirect } from '@/lib/auth/getRole'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ primary: null, secondary: null, isDualRole: false, redirectTo: '/login' })
    }

    const roles = await getUserRoles(user.id)
    // redirectTo reuses the same canonical mapping app/dashboard/layout.tsx
    // and app/teacher/layout.tsx redirect against — client components (e.g.
    // the login page) that need "where does this account belong" call this
    // endpoint instead of re-deriving the mapping themselves.
    return Response.json({ ...roles, redirectTo: getRoleRedirect(roles.primary) })
  } catch {
    return Response.json({ primary: null, secondary: null, isDualRole: false, redirectTo: '/dashboard' })
  }
}
