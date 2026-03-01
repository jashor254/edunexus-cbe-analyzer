import { createClient } from '@/utils/supabase/server'
import { GuardianTutorUI } from '@/components/dashboard/guardian-tutor-ui'
import { PlanDisplay } from '@/components/dashboard/plan-display'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile with subscription info
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Determine access based on plan type
  const planType = profile?.plan_type || 'trial'
  const tokens = profile?.tokens || 0
  const subscriptionEnd = profile?.subscription_end

  // Access logic for different plan types
  let canAccessTutor = false
  let canAccessAnalysis = false
  let accessMessage = ''

  if (planType === 'trial') {
    // Trial users: can do 1 analysis, no tutor
    canAccessAnalysis = tokens >= 1
    canAccessTutor = false
    accessMessage = tokens > 0 
      ? 'You have 1 free analysis remaining!' 
      : 'Trial used! Upgrade to continue.'
  } else if (planType === 'token') {
    // Token users: pay per use
    canAccessAnalysis = tokens >= 2 // 2 tokens per analysis
    canAccessTutor = tokens >= 2 // 2 tokens per tutor session
    accessMessage = tokens < 2 
      ? 'Not enough tokens. Buy more or upgrade to unlimited!' 
      : `${tokens} tokens remaining`
  } else if (planType === 'single' || planType === 'family') {
    // Unlimited users: check if not expired
    const now = new Date()
    const endDate = subscriptionEnd ? new Date(subscriptionEnd) : null
    const isActive = endDate ? endDate > now : false

    canAccessAnalysis = isActive
    canAccessTutor = isActive
    accessMessage = isActive 
      ? 'Unlimited access active!' 
      : 'Subscription expired! Renew to continue.'
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-4 border-black bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter">Dashboard</h1>
              <p className="text-slate-500 font-bold">CBC Pathway Analysis</p>
            </div>
            
            <PlanDisplay 
              planType={planType}
              tokens={tokens}
              subscriptionEnd={subscriptionEnd}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        
        {/* Status Message */}
        {accessMessage && (
          <div className={`p-4 rounded-2xl border-2 font-bold text-center ${
            canAccessAnalysis 
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            {accessMessage}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Pathway Analysis */}
          <div className="relative">
            {!canAccessAnalysis && (
              <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center text-center p-6">
                <div className="text-5xl mb-3">🔒</div>
                <h3 className="text-xl font-black text-slate-900 mb-2">Locked</h3>
                <p className="text-slate-600 text-sm font-semibold mb-4">
                  {planType === 'trial' 
                    ? 'Upgrade to continue analyzing' 
                    : planType === 'token'
                    ? 'Buy more tokens or upgrade'
                    : 'Renew your subscription'}
                </p>
                <Link 
                  href="/pricing" 
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all"
                >
                  {planType === 'token' ? 'Buy Tokens' : 'Upgrade Now'}
                </Link>
              </div>
            )}
            
            <div className={`bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl p-8 border-2 border-blue-200 ${!canAccessAnalysis ? 'opacity-30' : ''}`}>
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-3xl">📊</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-3">
                Pathway Analysis
              </h2>
              <p className="text-slate-600 mb-6 leading-relaxed font-medium">
                Add your child's grades to get pathway recommendations and career guidance.
              </p>
              <Link
                href="/dashboard/assessments/add"
                className="inline-block w-full bg-blue-600 text-white py-4 rounded-xl font-black text-center hover:bg-blue-700 transition-all"
              >
                Add New Assessment →
              </Link>
              {planType === 'token' && canAccessAnalysis && (
                <p className="text-xs text-slate-500 mt-3 text-center font-semibold">
                  Costs 2 tokens per analysis
                </p>
              )}
            </div>
          </div>

          {/* Guardian Tutor */}
          <div className="relative">
            {!canAccessTutor && (
              <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center text-center p-6">
                <div className="text-5xl mb-3">🔒</div>
                <h3 className="text-xl font-black text-slate-900 mb-2">Locked</h3>
                <p className="text-slate-600 text-sm font-semibold mb-4">
                  {planType === 'trial' 
                    ? 'Upgrade to access 24/7 tutoring' 
                    : planType === 'token'
                    ? 'Buy more tokens or upgrade to unlimited'
                    : 'Renew your subscription'}
                </p>
                <Link 
                  href="/pricing" 
                  className="px-6 py-3 bg-yellow-400 text-yellow-900 rounded-xl font-black text-sm hover:bg-yellow-500 transition-all"
                >
                  {planType === 'token' ? 'Buy Tokens' : 'Upgrade Now'}
                </Link>
              </div>
            )}
            
            <GuardianTutorUI 
              userName={profile?.full_name || user.email?.split('@')[0] || 'there'}
              hasActiveSubscription={canAccessTutor}
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-50 rounded-3xl p-8 border-2 border-slate-200">
          <h2 className="text-2xl font-black mb-6">Recent Assessments</h2>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-slate-600 font-semibold mb-6">
              No assessments yet. Add your first one to get started!
            </p>
            <Link
              href="/dashboard/assessments/add"
              className="inline-block bg-slate-900 text-white px-8 py-3 rounded-xl font-black hover:bg-slate-800 transition-all"            >
              Add Assessment
            </Link>
          </div>
        </div>

        {/* Upgrade Prompt for Token Users */}
        {planType === 'token' && (
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-3xl p-8">
            <div className="flex items-start gap-6">
              <div className="text-5xl">🚀</div>
              <div className="flex-1">
                <h3 className="text-2xl font-black mb-2">
                  Ready to Go Unlimited?
                </h3>
                <p className="mb-6 opacity-90 leading-relaxed font-medium">
                  Tired of buying tokens? Get unlimited access to everything for just KES 1,500/term!
                </p>
                <Link
                  href="/pricing"
                  className="inline-block bg-white text-purple-600 px-8 py-3 rounded-xl font-black hover:bg-yellow-400 hover:text-purple-900 transition-all"
                >
                  Upgrade to Unlimited
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}