import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import TeacherSidebar from '@/components/teacher/TeacherSidebar'
import { VideoOnboardingModal } from '@/components/video-onboarding-modal'
import { getUserRoles, getSchoolAdminMembership } from '@/lib/auth/getRole'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Single canonical role lookup — see lib/auth/getRole.ts. proxy.ts has
  // already gated this route with the same function; this second check is
  // defense in depth, not a second source of truth.
  const roles = await getUserRoles(user.id)
  const canAccessTeacher = roles.primary === 'teacher' || roles.secondary === 'teacher'

  // Sprint 10G: an admin-tier school_users member (school_admin,
  // headteacher, deputy_headteacher) may reach /teacher/core-office even
  // without a teacher-role profile — proxy.ts already admits them for that
  // one path; mirrored here so this defense-in-depth check doesn't bounce
  // them right back out.
  const adminMembership = await getSchoolAdminMembership(user.id)

  // Phase 2: /teacher/activate is open to any authenticated user (proxy.ts
  // sets x-teacher-activate-viewer for exactly this route) — a brand-new
  // teacher invitee has neither a teacher-role profile nor a teachers row
  // nor an ACTIVE admin-tier membership (theirs is still pending), so
  // without this they would be bounced right back out by the check below.
  const isActivateViewer = (await headers()).get('x-teacher-activate-viewer') === '1'

  if (!canAccessTeacher && !adminMembership && !isActivateViewer) redirect('/dashboard')

  const db = createServiceClient()

  const { data: teacher } = await db
    .from('teachers')
    .select('full_name, school, subject')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!teacher) {
    if (adminMembership) {
      // Admin-tier user with no teacher record — still render the sidebar
      // so School Office navigation is reachable.
      return (
        <div className="min-h-screen bg-slate-50">
          <TeacherSidebar teacherName={user.email ?? 'Admin'} school="" subject={null} isAdminTier />
          <div className="lg:ml-64 flex flex-col min-h-screen pt-14 lg:pt-0">
            <main className="flex-1 pb-24 lg:pb-0">
              {children}
            </main>
          </div>
        </div>
      )
    }
    // Role granted but the teachers row (setup) doesn't exist yet — allow
    // through for the /teacher/setup flow.
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TeacherSidebar
        teacherName={teacher.full_name || 'Mwalimu'}
        school={teacher.school || ''}
        subject={teacher.subject}
        isAdminTier={!!adminMembership}
      />
      <div className="lg:ml-64 flex flex-col min-h-screen pt-14 lg:pt-0">
        <main className="flex-1 pb-24 lg:pb-0">
          {children}
        </main>
      </div>
      <VideoOnboardingModal userId={user.id} role="teacher" />
    </div>
  )
}
