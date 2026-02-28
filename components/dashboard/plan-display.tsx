'use client'

interface PlanDisplayProps {
  // ✅ Ongeza 'term' kama ulitumia neno hilo kule kwenye page.tsx mapema
  planType: 'trial' | 'token' | 'single' | 'family' | 'term' 
  tokens?: number
  subscriptionEnd?: string
}

export function PlanDisplay({ planType, tokens = 0, subscriptionEnd }: PlanDisplayProps) {
  
  // 1. Fallback names to prevent build errors if planType is weird
  const planNames: Record<string, string> = {
    trial: 'Free Trial',
    single: 'Unlimited (1 Child)',
    family: 'Family Plan',
    token: 'Token Plan',
    term: 'Full Term Access' // Iendane na logic yetu ya "Muhula"
  }

  const planColors: Record<string, string> = {
    trial: 'from-slate-700 to-slate-800', // Brutalist dark look
    single: 'from-green-600 to-emerald-700',
    family: 'from-indigo-600 to-purple-700',
    token: 'from-blue-600 to-blue-700',
    term: 'from-orange-500 to-red-600'
  }

  // logic ya Pay-as-you-go
  if (planType === 'token') {
    return (
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] border-2 border-black/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black opacity-80 uppercase tracking-[0.2em] mb-1">
              {planNames[planType]}
            </p>
            <p className="text-2xl font-black italic tracking-tighter mb-1">
              PAY AS YOU GO
            </p>
            <p className="text-xs font-bold opacity-70">
              Testing the system? Perfect! 👍
            </p>
          </div>
          
          <div className="bg-white/20 p-3 rounded-xl text-right backdrop-blur-sm">
            <p className="text-4xl font-black leading-none">{tokens}</p>
            <p className="text-[10px] font-black uppercase opacity-80">Tokens</p>
          </div>
        </div>

        {tokens < 3 && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-xs font-black uppercase animate-pulse">
              ⚠️ Running low! Upgrade to Unlimited
            </p>
          </div>
        )}
      </div>
    )
  }

  // Logic ya Unlimited
  return (
    <div className={`bg-gradient-to-r ${planColors[planType] || 'from-slate-500 to-slate-600'} text-white rounded-2xl p-6 shadow-lg border-2 border-black/10`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black opacity-80 uppercase tracking-[0.2em] mb-1">
            Active Plan
          </p>
          <p className="text-2xl font-black italic tracking-tighter mb-1">
            {planNames[planType] || 'Standard Access'}
          </p>
          {subscriptionEnd && (
            <p className="text-xs font-bold opacity-80 bg-black/10 inline-block px-2 py-0.5 rounded">
              Ends: {new Date(subscriptionEnd).toLocaleDateString('en-GB', { 
                day: 'numeric', month: 'short', year: 'numeric' 
              })}
            </p>
          )}
        </div>
        
        <div className="bg-white/20 p-3 rounded-xl text-center backdrop-blur-sm">
          <p className="text-4xl font-black leading-none">∞</p>
          <p className="text-[10px] font-black uppercase opacity-80 tracking-widest">UNLIMITED</p>
        </div>
      </div>
    </div>
  )
}