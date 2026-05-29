import { createClient } from '@/utils/supabase/server'
import { getUserRoles } from '@/lib/auth/getRole'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ primary: null, secondary: null, isDualRole: false })
    }

    const roles = await getUserRoles(user.id)
    return Response.json(roles)
  } catch {
    return Response.json({ primary: null, secondary: null, isDualRole: false })
  }
}
