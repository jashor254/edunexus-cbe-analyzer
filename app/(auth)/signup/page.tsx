'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Sparkles } from 'lucide-react'
import Link from 'next/link'

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

function SignupForm() {
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [wantsSecondary, setWantsSecondary] = useState(false)

  const searchParams = useSearchParams()
  const supabase     = createClient()

  const productId = searchParams.get('product')
  const returnTo  = searchParams.get('returnTo') || '/dashboard'
  const role      = searchParams.get('role')          // 'teacher' | 'parent' | null

  // What secondary role the checkbox would grant
  const secondaryRole  = role === 'teacher' ? 'parent' : role === 'parent' ? 'teacher' : null
  const secondaryLabel =
    role === 'teacher' ? 'I also have a child on EduNexus (add parent access)' :
    role === 'parent'  ? "I'm also a teacher on EduNexus (add teacher access)"  : null

  const handleGoogleSignup = async () => {
    setLoading(true)
    setError(null)

    const cbUrl = new URL(`${window.location.origin}/auth/callback`)
    cbUrl.searchParams.set('returnTo', returnTo)
    if (role)                            cbUrl.searchParams.set('role',           role)
    if (productId)                       cbUrl.searchParams.set('product',        productId)
    if (wantsSecondary && secondaryRole) cbUrl.searchParams.set('secondary_role', secondaryRole)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: cbUrl.toString() },
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
            Create your account
          </h1>
          <p className="text-sm text-white/40 text-center mb-8">
            {role === 'teacher' ? 'Join as a teacher 🏫' : 'First Compass session on us 🎁'}
          </p>

          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-800 py-4 rounded-2xl font-black text-base hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg disabled:opacity-60"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {loading ? 'Redirecting…' : 'Sign up with Google'}
          </button>

          {/* Optional dual-role checkbox — only shown when role param is set */}
          {secondaryLabel && (
            <label className="flex items-start gap-3 mt-5 cursor-pointer group">
              <div className="relative shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={wantsSecondary}
                  onChange={e => setWantsSecondary(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  wantsSecondary
                    ? 'bg-amber-500 border-amber-500'
                    : 'bg-white/5 border-white/20 group-hover:border-white/40'
                }`}>
                  {wantsSecondary && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-xs text-white/50 group-hover:text-white/70 leading-relaxed transition-colors">
                {secondaryLabel}
              </span>
            </label>
          )}

          <p className="text-center text-[11px] text-white/30 mt-5 leading-relaxed">
            By continuing you agree to our{' '}
            <Link href="/legal/terms" className="hover:text-white/60 underline transition-colors">Terms</Link>
            {' '}and{' '}
            <Link href="/legal/privacy" className="hover:text-white/60 underline transition-colors">Privacy Policy</Link>
          </p>

          <p className="text-center text-sm text-white/40 mt-5">
            Already have an account?{' '}
            <Link
              href={productId ? `/login?product=${productId}` : '/login'}
              className="text-violet-400 font-black hover:text-violet-300 transition-colors"
            >
              Sign in →
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-white/20 font-bold mt-6">
          🔒 Secure · No card needed · Made in Kenya 🇰🇪
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
