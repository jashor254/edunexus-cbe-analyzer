import { createClient }        from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect }            from 'next/navigation'
import DashboardNavbar         from '@/app/dashboard/components/DashboardNavbar'
import { VideoOnboardingModal } from '@/components/video-onboarding-modal'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Only student accounts live here — anyone else goes to their proper home
  const db = createServiceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role as string | null
  if (role === 'teacher') redirect('/teacher/dashboard')
  if (role === 'parent')  redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <DashboardNavbar />
      <main>{children}</main>
      <VideoOnboardingModal userId={user.id} role="student" />
    </div>
  )
}
