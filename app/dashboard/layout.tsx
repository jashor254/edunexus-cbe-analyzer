// app/dashboard/layout.tsx

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardNavbar from './components/DashboardNavbar'
import { OnboardingTutorial } from '@/components/onboarding-tutorial'

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-white">
      <DashboardNavbar />
      {/* pb-16 on mobile reserves space above the bottom nav bar */}
      <main className="pb-16 md:pb-0">
        {children}
      </main>
      <OnboardingTutorial userId={user.id} />
    </div>
  )
}
