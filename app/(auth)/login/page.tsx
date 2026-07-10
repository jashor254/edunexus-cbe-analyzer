'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Sparkles, Mail, Lock, Loader2, ArrowRight } from 'lucide-react'

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  'no-code':        'Google sign-in was cancelled or did not complete. Please try again.',
  'exchange-failed': 'We couldn\'t complete your sign-in. Please try again.',
}

function LoginContent() {
  const [loading, setLoading]           = useState(false)
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const returnTo    = searchParams?.get('returnTo') || '/dashboard'
  const product     = searchParams?.get('product')
  const callbackErr = searchParams?.get('error')

  const [error, setError] = useState(
    callbackErr ? (CALLBACK_ERROR_MESSAGES[callbackErr] || 'Sign-in failed. Please try again.') : ''
  )

  const resolveDestination = async (_returnTo: string | null): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return '/login'

      // Honor saved role preference first
      const savedPreference =
        typeof window !== 'undefined'
          ? localStorage.getItem('preferred_role')
          : null

      if (savedPreference === 'parent')  return '/dashboard'
      if (savedPreference === 'teacher') return '/teacher/dashboard'

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profile?.role

      if (!role) {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()
        if (teacher) return '/teacher/dashboard'
        return '/dashboard'
      }

      if (role === 'teacher') return '/teacher/dashboard'
      return '/dashboard'
    } catch {
      return '/dashboard'
    }
  }

  useEffect(() => {
    let isMounted = true
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (isMounted && user) router.push(await resolveDestination(returnTo))
      } catch (err) {
        // Supabase auth lock stolen by Strict Mode double-invoke — safe to ignore
        if (isMounted && err instanceof Error && !err.message.includes('released because another request stole it')) {
          throw err
        }
      }
    }
    check()
    return () => { isMounted = false }
  }, [])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')

    const redirectUrl = product
      ? `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}&product=${product}`
      : `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: redirectUrl },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Incorrect email or password.'
        : error.message)
      setEmailLoading(false)
      return
    }

    router.push(await resolveDestination(returnTo))
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-black text-white">EduNexus</span>
        </Link>

        {/* Card */}
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h1 className="text-2xl font-black text-white text-center mb-1">
            {product ? 'Sign in to continue' : 'Welcome back'}
          </h1>
          <p className="text-sm text-white/40 text-center mb-8">
            Kenya&apos;s AI education platform 🇰🇪
          </p>

          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-800 py-4 rounded-2xl font-black text-base hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg disabled:opacity-60"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
            <div className="relative flex justify-center text-sm"><span className="px-4 bg-slate-900 text-white/30">OR</span></div>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@school.ac.ke"
                required
                disabled={emailLoading || loading}
                className="w-full bg-black/20 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={emailLoading || loading}
                className="w-full bg-black/20 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={emailLoading || loading}
              className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white py-3 rounded-xl font-bold text-sm hover:bg-white/10 transition-all disabled:opacity-50"
            >
              {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-white/40 mt-6">
            New to EduNexus?{' '}
            <Link
              href={product ? `/signup?returnTo=${returnTo}&product=${product}` : '/signup'}
              className="text-amber-400 font-black hover:text-amber-300 transition-colors"
            >
              Create account →
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-white/20 font-bold mt-6">
          🔒 Secure · No card needed · Made in Kenya
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
