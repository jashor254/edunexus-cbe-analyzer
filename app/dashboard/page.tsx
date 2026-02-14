// app/dashboard/page.tsx

import { OnboardingTutorial } from '@/components/onboarding-tutorial'
import { hasSeenOnboarding } from '@/lib/user-actions'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'  // ✅ ADD THIS LINE

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if user has seen onboarding (optional - localStorage will also handle this)
  const hasCompleted = await hasSeenOnboarding(user.id)

  return (
    <div>
      {/* Show tutorial to new users */}
      {!hasCompleted && (
        <OnboardingTutorial 
          userId={user.id}
          userName={user.user_metadata?.name || user.email?.split('@')[0]}
        />
      )}
      
      {children}
    </div>
  )
}