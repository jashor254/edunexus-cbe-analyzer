import { createClient }        from '@/utils/supabase/server'
import { redirect }            from 'next/navigation'
import DashboardNavbar         from '@/app/dashboard/components/DashboardNavbar'
import { VideoOnboardingModal } from '@/components/video-onboarding-modal'
import { getUserRoles }        from '@/lib/auth/getRole'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Single canonical role lookup — see lib/auth/getRole.ts. Do not re-derive
  // this here; a second, disagreeing implementation (a raw profiles.role
  // query, previously right here) is exactly what caused Blocker #5 — this
  // layout could never actually be reached by a real student because
  // nothing, anywhere, treated 'student' as a real destination.
  const roles = await getUserRoles(user.id)
  if (roles.primary === 'teacher') redirect('/teacher/dashboard')
  if (roles.primary === 'parent')  redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <DashboardNavbar isStudent />
      <main>{children}</main>
      <VideoOnboardingModal userId={user.id} role="student" />
    </div>
  )
}
