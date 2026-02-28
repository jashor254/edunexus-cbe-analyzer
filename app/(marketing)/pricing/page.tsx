import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { CheckCircle, Zap, Users, Sparkles } from 'lucide-react'

// Server-side Supabase client
async function getSupabaseServer() {
  const cookieStore = await cookies()
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
      },
    }
  )
}

export default async function PricingPage() {
  const supabase = await getSupabaseServer()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get user's token balance if logged in
  let userTokens = 0
  let userPlan = 'none'
  
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tokens, plan_type')
      .eq('id', user.id)
      .single()
    
    userTokens = profile?.tokens || 0
    userPlan = profile?.plan_type || 'token'
  }

  return (
    <div className="min-h-screen bg-white py-20 px-4">
      
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h1 className="text-5xl font-black text-slate-900 mb-4">
          Simple, Honest Pricing
        </h1>
        <p className="text-xl text-slate-600 font-semibold">
          Try with tokens or commit to a term. Your choice.
        </p>
        
        {/* Current Status (if logged in) */}
        {user && (
          <div className="mt-8 inline-block bg-blue-50 border-2 border-blue-200 rounded-2xl px-6 py-4">
            <p className="text-sm font-black text-blue-900 mb-1">Your Current Balance</p>
            <p className="text-3xl font-black text-blue-600">{userTokens} tokens</p>
            <p className="text-xs text-blue-700 font-bold mt-1">
              Plan: {userPlan === 'termly' ? 'Termly (Unlimited)' : userPlan === 'lifetime' ? 'Lifetime' : 'Pay-as-you-go'}
            </p>
          </div>
        )}
      </div>

      {/* Pricing Grid */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 mb-16">

        {/* PAY-AS-YOU-GO (Left) */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 hover:border-blue-300 hover:shadow-xl transition-all">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full mb-4">
              <Zap className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-black text-slate-600 uppercase tracking-wider">Try First</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Pay-As-You-Go</h2>
            <p className="text-slate-600 font-semibold">Perfect for trying EduNexus</p>
          </div>

          {/* Token Packages */}
          <div className="space-y-3 mb-8">
            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-black text-slate-900">10 tokens</span>
                <span className="text-2xl font-black text-blue-600">KES 100</span>
              </div>
              <p className="text-sm text-slate-600 font-semibold">~2 pathway analyses</p>
            </div>

            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-black text-slate-900">35 tokens</span>
                <span className="text-2xl font-black text-blue-600">KES 300</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-600 font-semibold">~8 analyses</p>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">Save KES 50</span>
              </div>
            </div>

            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-black text-blue-900">60 tokens</span>
                <span className="text-2xl font-black text-blue-600">KES 500</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-blue-700 font-semibold">~15 analyses</p>
                <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full font-bold">Save KES 100</span>
              </div>
            </div>
          </div>

          {/* Token Costs */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Token Costs:</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-700 font-semibold">Pathway Analysis</span>
                <span className="font-black text-slate-900">4 tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700 font-semibold">Career Search</span>
                <span className="font-black text-slate-900">2 tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700 font-semibold">Guardian Tutor</span>
                <span className="font-black text-slate-900">1 token/question</span>
              </div>
            </div>
          </div>

          <Link
            href="/signup"
            className="block w-full text-center py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl transition-all shadow-lg"
          >
            Buy Tokens
          </Link>
        </div>

        {/* TERMLY PLAN (Right) */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-3xl p-8 relative overflow-hidden shadow-2xl">
          
          {/* Badge */}
          <div className="absolute top-6 right-6">
            <div className="bg-green-400 text-green-900 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider shadow-lg">
              Best Value
            </div>
          </div>

          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />

          <div className="relative">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full mb-4">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-black uppercase tracking-wider">Most Popular</span>
              </div>
              <h2 className="text-2xl font-black mb-2">Termly Plan</h2>
              <p className="text-blue-100 font-semibold">For serious CBC parents</p>
            </div>

            {/* Price */}
            <div className="text-center mb-8">
              <div className="flex items-baseline justify-center gap-2 mb-2">
                <span className="text-6xl font-black">1,500</span>
                <span className="text-2xl font-bold text-blue-200">KES</span>
              </div>
              <p className="text-blue-200 text-lg font-bold">per term (3 months)</p>
              <p className="text-sm text-blue-100 mt-2 font-semibold">That's KES 500/month</p>
            </div>

            {/* Features */}
            <div className="space-y-4 mb-8">
              {[
                'Unlimited pathway analyses',
                'Unlimited Guardian Tutor',
                'Unlimited career searches',
                'Track up to 3 children',
                'PDF reports for school',
                '90-day action plans',
                'WhatsApp support',
                'No token limits!'
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                  <span className="font-semibold">{feature}</span>
                </div>
              ))}
            </div>

            <Link
              href="/signup"
              className="block w-full text-center py-4 bg-white text-blue-600 font-black rounded-xl hover:bg-blue-50 transition-all shadow-xl"
            >
              Start 3-Month Plan
            </Link>

            <p className="text-center text-blue-200 text-sm mt-4 font-semibold">
              Cancel anytime • M-Pesa payment
            </p>
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div className="max-w-4xl mx-auto mb-16">
        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-8">
          <h3 className="text-2xl font-black text-slate-900 text-center mb-8">
            Which Should You Choose?
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border-2 border-slate-200 rounded-xl p-6">
              <p className="font-black text-slate-900 mb-3">Choose Tokens If:</p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span className="font-semibold">You're not sure if EduNexus is for you</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span className="font-semibold">You only need 1-2 analyses</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span className="font-semibold">You want to try before committing</span>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
              <p className="font-black text-blue-900 mb-3">Choose Termly If:</p>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span className="font-semibold">You have 2-3 children in CBC</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span className="font-semibold">You want ongoing guidance all term</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span className="font-semibold">You want unlimited access to AI Tutor</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto">
        <h3 className="text-2xl font-black text-slate-900 text-center mb-8">
          Common Questions
        </h3>
        
        <div className="space-y-4">
          {[
            {
              q: 'Do tokens expire?',
              a: 'No! Your tokens never expire. Use them whenever you need.',
            },
            {
              q: 'Can I upgrade from tokens to termly?',
              a: 'Yes! Upgrade anytime. Your unused tokens remain in your account.',
            },
            {
              q: 'What payment methods do you accept?',
              a: 'M-Pesa, Visa, and Mastercard via Paystack.',
            },
            {
              q: 'Can I get a refund?',
              a: 'Unused tokens can be refunded within 7 days of purchase.',
            },
          ].map((item, i) => (
            <details key={i} className="bg-white border-2 border-slate-200 rounded-xl p-6 hover:border-blue-300 transition-colors">
              <summary className="font-black text-slate-900 cursor-pointer">
                {item.q}
              </summary>
              <p className="mt-3 text-slate-700 font-semibold">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

    </div>
  )
}