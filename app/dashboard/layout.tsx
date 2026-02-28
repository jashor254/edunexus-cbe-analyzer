import { OnboardingTutorial } from '@/components/onboarding-tutorial'
import { SuccessHandler } from '@/components/dashboard/success-handler'
import { hasSeenOnboarding } from '@/lib/user-actions'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check if user has completed onboarding
  const hasCompleted = await hasSeenOnboarding(user.id)

  return (
    <div className="min-h-screen bg-white">
      {/* Success Handler for payment confirmations */}
      <Suspense fallback={null}>
        <SuccessHandler />
      </Suspense>

      {/* Onboarding tutorial for new users */}
      {!hasCompleted && (
        <OnboardingTutorial 
          userId={user.id}
          userName={user.user_metadata?.full_name || user.email?.split('@')[0] || 'there'}
        />
      )}
      
      {/* Navigation */}
      <nav className="border-b-4 border-black bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-2xl font-black uppercase">
              EduNexus
            </Link>
            
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard/assessments" 
                className="text-sm font-bold text-slate-600 hover:text-slate-900"
              >
                Assessments
              </Link>
              <Link 
                href="/chat" 
                className="text-sm font-bold text-slate-600 hover:text-slate-900"
              >
                Tutor
              </Link>
              <Link 
                href="/pricing" 
                className="text-sm font-bold text-slate-600 hover:text-slate-900"
              >
                Upgrade
              </Link>
              <form action="/auth/signout" method="post">
                <button 
                  type="submit"
                  className="text-sm font-bold text-slate-600 hover:text-slate-900"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      {children}
    </div>
  )
}