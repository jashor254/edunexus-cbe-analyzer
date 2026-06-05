'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, ArrowRight, Loader2, Chrome, ArrowLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Logo } from '@/components/ui/Logo'

export default function SignupContent() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const returnTo = searchParams.get('returnTo') || '/pricing'
  const product = searchParams.get('product')

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const redirectUrl = product ? `${returnTo}?product=${product}` : returnTo
        router.push(redirectUrl)
      }
    }
    checkUser()
  }, [router, returnTo, product])

  const handleGoogleSignup = async () => {
    try {
      setGoogleLoading(true)
      setError(null)
      
      const redirectUrl = product 
        ? `${window.location.origin}/auth/callback?returnTo=/pricing&product=${product}`
        : `${window.location.origin}/auth/callback?returnTo=/pricing`
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl },
      })

      if (error) throw error
      if (data?.url) window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up with Google')
      setGoogleLoading(false)
    }
  }

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })

      if (error) throw error

      if (data.user) {
        await supabase.from('user_tokens').insert([{ user_id: data.user.id, balance: 1 }])
        const redirectUrl = product ? `${returnTo}?product=${product}` : returnTo
        router.push(redirectUrl)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  const loginUrl = product ? `/login?returnTo=/pricing&product=${product}` : '/login'

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <nav className="p-6 border-b border-white/5 flex justify-between items-center">
        <Link href="/"><Logo variant="dark" size="sm" /></Link>
        <Link href="/pricing" className="text-sm font-bold text-slate-400 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Pricing
        </Link>
      </nav>

      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black mb-2">Create Account</h1>
            <p className="text-slate-400 text-sm">
              {product ? 'Complete your purchase' : 'Join EduNexus today'}
            </p>
            {product && (
              <div className="mt-3 inline-flex items-center gap-2 bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs font-bold border border-purple-500/30">
                <span>You'll return to complete payment</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button onClick={handleGoogleSignup} disabled={googleLoading || loading} className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-white text-black rounded-xl font-bold hover:bg-slate-100 transition-all disabled:opacity-50 mb-4">
            {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Chrome className="w-5 h-5" />}
            <span>Sign up with Google</span>
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-4 bg-[#020617] text-slate-500">OR</span></div>
          </div>

          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500" placeholder="John Doe" required disabled={loading || googleLoading} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500" placeholder="you@example.com" required disabled={loading || googleLoading} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500" placeholder="••••••••" required minLength={6} disabled={loading || googleLoading} />
              </div>
              <p className="mt-1 text-xs text-slate-500">Minimum 6 characters</p>
            </div>

            <button type="submit" disabled={loading || googleLoading} className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account? <Link href={loginUrl} className="text-purple-400 hover:text-purple-300 font-bold">Sign in</Link>
          </p>
        </div>
        <p className="text-center text-xs text-slate-600 mt-8">© {new Date().getFullYear()} EduNexus. All rights reserved.</p>
      </div>
    </div>
  )
}