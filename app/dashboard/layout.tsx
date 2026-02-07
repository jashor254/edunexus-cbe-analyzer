import { createClient } from '@/utils/supabase/server'
import { OnboardingTutorial } from '@/components/onboarding-tutorial'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1. Await createClient bila kupitisha argument yoyote
  // Hii itasoma cookies automatic ndani ya utils/supabase/server.ts
  const supabase = await createClient()

  // 2. Auth Check - Sasa .auth itatambulika vizuri
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // 3. Fetch Profile kishua
  const { data: profile } = await supabase
    .from('profiles')
    .select('has_seen_onboarding, full_name')
    .eq('id', user.id)
    .single()
    
  const hasSeenOnboarding = profile?.has_seen_onboarding ?? false

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="flex flex-col min-h-screen">
        {/* Simple Top Navbar */}
        <header className="h-16 border-b bg-white flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tighter text-purple-600">EduNexus</span>
            <span className="bg-slate-100 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Beta</span>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-sm font-bold text-slate-500 truncate max-w-[150px]">
               {profile?.full_name || user.email}
             </span>
             <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 shadow-inner" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </main>
      </div>

      {/* Onboarding Logic */}
      {user && !hasSeenOnboarding && (
        <OnboardingTutorial userId={user.id} />
      )}
    </div>
  )
}