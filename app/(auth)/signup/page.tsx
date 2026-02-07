'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Sparkles, Mail, Lock, User as UserIcon, Zap } from 'lucide-react'

function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Step 1: Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      if (authData.user) {
        // Step 2: Create user record with GUARDIAN plan alignment
        const userResponse = await fetch('/api/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            name: name || null,
            // Critical Fix: We send 'guardian' to match our new database constraint
            plan_type: 'guardian', 
          }),
        })

        const userData = await userResponse.json()

        if (!userData.success) {
          throw new Error(userData.error || 'Database sync failed')
        }

        // World-Class Success Message
        alert('Welcome to EduNexus! Your Guardian Account is ready.')
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'System synchronization error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-900 rounded-3xl mb-6 transform rotate-3 shadow-xl">
              <ShieldCheck className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Begin Your Legacy</h1>
            <p className="text-slate-500 mt-2 font-medium">Join the Solo Guardian Plan today.</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-6">
            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4" /> {error}
              </div>
            )}

            {/* Name Field */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Guardian Name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900"
                  placeholder="e.g. Dennis Kariuki"
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Secure Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900"
                  placeholder="dennis@example.com"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Access Key</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl hover:shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Secure Access'}
            </button>
          </form>

          {/* Value Reinforcement */}
          <div className="mt-10 pt-8 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-sm text-slate-600 font-semibold">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <span>Includes One Comprehensive Pathway Analysis</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 font-semibold">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <span>Unlocks 24/7 Guardian AI Tutor Access</span>
            </div>
          </div>

          <p className="text-center mt-8 text-sm font-bold text-slate-400 uppercase tracking-widest">
            Already a member?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700">Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <SignupForm />
    </Suspense>
  )
}