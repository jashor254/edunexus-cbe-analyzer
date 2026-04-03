'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

// ─── Inner component (needs Suspense because of useSearchParams) ──────────────
function LoginContent() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const returnTo = searchParams?.get('returnTo') || '/dashboard'
  const product  = searchParams?.get('product')

  // Redirect if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push(product ? `${returnTo}?product=${product}` : returnTo)
      }
    }
    checkUser()
  }, [supabase, router, returnTo, product])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(product ? `${returnTo}?product=${product}` : returnTo)
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')

    const redirectUrl = product
      ? `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}&product=${product}`
      : `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: redirectUrl }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="w-full max-w-md bg-white text-black rounded-2xl p-8 shadow-xl">

        <h1 className="text-2xl font-black mb-2">Welcome Back</h1>
        <p className="text-sm text-gray-500 mb-6">
          {product ? 'Login to complete payment' : 'Login to continue'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full border-2 border-slate-200 py-3 rounded-xl mb-4 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="text-center text-sm text-slate-400 mb-4">OR</div>

        {/* Email */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-black focus:outline-none transition-colors"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-black focus:outline-none transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-xl font-black hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-sm text-center text-slate-500">
          No account?{' '}
          <Link
            href={product ? `/signup?returnTo=${returnTo}&product=${product}` : '/signup'}
            className="text-black font-black hover:underline"
          >
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  )
}

// ─── Page export with Suspense ────────────────────────────────────────────────
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