import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import TeacherSidebar from '@/components/teacher/TeacherSidebar'
import { TeacherOnboardingTutorial } from '@/components/teacher/TeacherOnboardingTutorial'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()

  const { data: teacher } = await db
    .from('teachers')
    .select('full_name, school, subject')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!teacher) {
    // No teacher record — check if they are a parent/student without teacher access
    const { data: profile } = await db
      .from('profiles')
      .select('role, secondary_role')
      .eq('id', user.id)   // profiles.id = auth user UUID
      .maybeSingle()

    const isParentOrStudent = profile?.role === 'parent' || profile?.role === 'student'
    const hasTeacherAccess  = profile?.secondary_role === 'teacher'

    if (isParentOrStudent && !hasTeacherAccess) {
      redirect('/dashboard')
    }

    // No teacher row + no blocking role → allow through (teacher setup flow)
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <TeacherSidebar
        teacherName={teacher.full_name || 'Mwalimu'}
        school={teacher.school || ''}
        subject={teacher.subject}
      />
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <main className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>
      <TeacherOnboardingTutorial userId={user.id} />
    </div>
  )
}
