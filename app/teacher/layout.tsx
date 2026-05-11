import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import TeacherSidebar from '@/components/teacher/TeacherSidebar'
import { TeacherOnboardingTutorial } from '@/app/components/onboarding-tutorial'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('full_name, school, subject')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return <>{children}</>

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
