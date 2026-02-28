'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, Sparkles, Mail, Lock, User as UserIcon, Zap } from 'lucide-react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // 1. Google Auth Function - "Simple & Non-complicated"
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) setError(error.message)
  }

  // 2. Standard Email Signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
        },
      })
      if (authError) throw authError
      if (data.user) {
        alert('Karibu EduNexus! Check your email to verify.')
        router.push('/login')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Logo/Brand Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-xl">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">EduNexus</h1>
          <p className="text-slate-500 font-medium mt-2">Individualized Learning Pathways</p>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-10">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Get Started Free</h2>

          {/* Google Button - "The Kuul Part" */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all mb-6"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-slate-400 font-bold">Or use email</span></div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-2">
                <Zap className="w-4 h-4" /> {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 outline-none transition-all font-semibold"
                  placeholder="Musa Mbuma"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 outline-none transition-all font-semibold"
                  placeholder="name@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 outline-none transition-all font-semibold"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              disabled={loading}
              className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 mt-4 disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Create My Account'}
            </button>
          </form>

          <p className="text-center mt-8 text-sm font-bold text-slate-400">
            Already a member? <Link href="/login" className="text-blue-600 hover:underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}