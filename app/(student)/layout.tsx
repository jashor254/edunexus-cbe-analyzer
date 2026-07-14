import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardNavbar from '@/app/dashboard/components/DashboardNavbar'
import { getUserRoles } from '@/lib/auth/getRole'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Only student accounts render here — anyone else goes to their proper
  // home. Single canonical role lookup (see lib/auth/getRole.ts) — do not
  // re-derive this check locally; a second, disagreeing implementation is
  // exactly what previously caused a redirect loop elsewhere in this app.
  const roles = await getUserRoles(user.id)
  if (roles.primary === 'teacher') redirect('/teacher/dashboard')
  if (roles.primary === 'parent')  redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      <DashboardNavbar isStudent />
      <main>{children}</main>
    </div>
  )
}
