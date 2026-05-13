'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Sparkles } from 'lucide-react'

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const returnTo = searchParams?.get('returnTo') || '/dashboard'
  const product  = searchParams?.get('product')

  const resolveDestination = async (base: string) => {
    if (base !== '/dashboard') return product ? `${base}?product=${product}` : base
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: teacher } = await supabase
        .from('teachers').select('id').eq('user_id', user.id).maybeSingle()
      if (teacher?.id) return '/teacher/dashboard'
    }
    return product ? `/dashboard?product=${product}` : '/dashboard'
  }

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.push(await resolveDestination(returnTo))
    }
    check()
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
