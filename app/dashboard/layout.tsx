// app/dashboard/layout.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardNavbar from './components/DashboardNavbar'
import { VideoOnboardingModal } from '@/components/video-onboarding-modal'
import { getUserRoles } from '@/lib/auth/getRole'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Single canonical role lookup — see lib/auth/getRole.ts. Do not re-derive
  // this here; a second, disagreeing implementation is what caused the
  // /dashboard <-> /teacher/dashboard infinite redirect loop.
  const roles = await getUserRoles(user.id)

  const isTeacher         = roles.primary === 'teacher'
  const isDualRoleTeacher = isTeacher && roles.secondary === 'parent'

  if (isTeacher && !isDualRoleTeacher) redirect('/teacher/dashboard')
  if (roles.primary === 'student')     redirect('/student')

  return (
    <div className="min-h-screen bg-white">
      <DashboardNavbar />

      {/* Amber banner: teacher using parent view */}
      {isDualRoleTeacher && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-amber-800 font-medium">👨‍👩‍👧 Viewing as Parent</span>
          <Link
            href="/teacher/dashboard"
            className="text-amber-600 hover:text-amber-800 font-bold text-xs underline"
          >
            Back to Teacher Dashboard ↗
          </Link>
        </div>
      )}

      {/* pb-16 on mobile reserves space above the bottom nav bar */}
      <main className="pb-16 md:pb-0">
        {children}
      </main>
      <VideoOnboardingModal userId={user.id} role={roles.primary} secondaryRole={roles.secondary} />
    </div>
  )
}
