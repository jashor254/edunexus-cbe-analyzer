// app/dashboard/layout.tsx
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardNavbar from './components/DashboardNavbar'
import { VideoOnboardingModal } from '@/components/video-onboarding-modal'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()

  // profiles.id = auth user UUID (the column is `id`, not `user_id`)
  const { data: profile } = await db
    .from('profiles')
    .select('role, secondary_role')
    .eq('id', user.id)
    .maybeSingle()

  const isTeacher        = profile?.role === 'teacher'
  const isDualRoleTeacher = isTeacher && profile?.secondary_role === 'parent'

  if (isTeacher && !isDualRoleTeacher) redirect('/teacher/dashboard')
  if (profile?.role === 'student')     redirect('/student')

  // Legacy: profile row missing but has a teachers record
  if (!profile?.role) {
    const { data: teacherRow } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (teacherRow?.id) redirect('/teacher/dashboard')
  }

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
      <VideoOnboardingModal userId={user.id} role={profile?.role as 'parent' | 'teacher' | 'student' | 'school_admin' | 'admin' ?? 'parent'} secondaryRole={profile?.secondary_role} />
    </div>
  )
}
