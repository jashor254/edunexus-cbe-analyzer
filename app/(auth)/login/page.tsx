'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Sparkles, Lock, Mail } from 'lucide-react'
import {
  LearningCompassMockup,
  AcademicClinicMockup,
  TeacherDashboardMockup,
  CareerExplorerMockup,
} from '@/app/(marketing)/components/ProductMockups'

// ─── Data ─────────────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: 'Learning Compass explained maths using unga prices at 11pm. My son finally got it.',
    name: 'Grace M.',
    location: 'Nairobi',
  },
  {
    quote: 'The Academic Clinic showed us exactly which topics to fix.',
    name: 'Peter O.',
    location: 'Kisumu',
  },
  {
    quote: 'As a teacher I see all student gaps in one view. Incredible.',
    name: 'Mwalimu Kamau',
    location: 'Mombasa',
  },
]

const MOCKUPS = [
  LearningCompassMockup,
  AcademicClinicMockup,
  TeacherDashboardMockup,
  CareerExplorerMockup,
]

const MOCKUP_GLOWS = [
  'from-amber-500/20 to-orange-500/20',
  'from-violet-500/20 to-purple-500/20',
  'from-teal-500/20 to-cyan-500/20',
  'from-cyan-500/20 to-blue-500/20',
]

const MOCKUP_DOT_COLORS = [
  'bg-amber-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-cyan-500',
]

// Google SVG icon
const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

// ─── Left panel ───────────────────────────────────────────────────────────────
function LeftPanel() {
  const [mockupIdx,        setMockupIdx]        = useState(0)
  const [testimonialIdx,   setTestimonialIdx]   = useState(0)
  const [mockupVisible,    setMockupVisible]    = useState(true)
  const [testimonialVisible, setTestimonialVisible] = useState(true)

  // Mockup auto-rotation — every 4s
  useEffect(() => {
    const id = setInterval(() => {
      setMockupVisible(false)
      setTimeout(() => {
        setMockupIdx((p) => (p + 1) % MOCKUPS.length)
        setMockupVisible(true)
      }, 300)
    }, 4000)
    return () => clearInterval(id)
  }, [])

  // Testimonial auto-rotation — every 6s
  useEffect(() => {
    const id = setInterval(() => {
      setTestimonialVisible(false)
      setTimeout(() => {
        setTestimonialIdx((p) => (p + 1) % TESTIMONIALS.length)
        setTestimonialVisible(true)
      }, 300)
    }, 6000)
    return () => clearInterval(id)
  }, [])

  const MockupComponent = MOCKUPS[mockupIdx]
  const t = TESTIMONIALS[testimonialIdx]

  const switchTo = (i: number) => {
    setMockupVisible(false)
    setTimeout(() => { setMockupIdx(i); setMockupVisible(true) }, 300)
  }

  return (
    <div className="relative flex flex-col h-full px-8 py-10 overflow-hidden bg-slate-950">
      {/* Amber ambient glow */}
      <div className="absolute -top-40 -left-40 w-150 h-150 bg-amber-500/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-100 h-100 bg-orange-500/8 rounded-full blur-[80px] pointer-events-none" />

      {/* Logo */}
      <Link href="/" className="relative z-10 flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 bg-linear-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-lg font-black text-white leading-none">EduNexus</span>
          <p className="text-[10px] text-white/40 font-bold leading-none mt-0.5">Kenya&apos;s AI Education Platform</p>
        </div>
      </Link>

      {/* Heading */}
      <div className="relative z-10 mb-5">
        <h2 className="text-2xl font-black text-white leading-tight">See what awaits</h2>
        <p className="text-sm text-white/50 mt-0.5">Kenya&apos;s AI education platform</p>
      </div>

      {/* Mockup carousel */}
      <div className="relative z-10 flex-1 min-h-0 mb-4 overflow-hidden">
        {/* Per-slide glow */}
        <div
          className={`absolute -inset-4 bg-linear-to-br ${MOCKUP_GLOWS[mockupIdx]} rounded-3xl blur-2xl pointer-events-none transition-all duration-500`}
        />

        {/* Mockup — opacity-only fade, scale fixed via inline style */}
        <div
          className={`transition-opacity duration-300 ${mockupVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ transform: 'scale(0.8)', transformOrigin: 'top center', willChange: 'opacity' }}
        >
          <MockupComponent />
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {MOCKUPS.map((_, i) => (
            <button
              key={i}
              onClick={() => switchTo(i)}
              aria-label={`Show mockup ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === mockupIdx
                  ? `w-4 h-2 ${MOCKUP_DOT_COLORS[i]}`
                  : 'w-2 h-2 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Testimonial */}
      <div
        className={`relative z-10 bg-white/5 border border-white/10 rounded-2xl p-4 mb-5 transition-opacity duration-300 ${
          testimonialVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ willChange: 'opacity' }}
      >
        <p className="text-sm text-white/80 leading-relaxed mb-2 italic">&ldquo;{t.quote}&rdquo;</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white/60">— {t.name} · {t.location}</span>
          <span className="text-amber-400 text-xs">⭐⭐⭐⭐⭐</span>
        </div>
      </div>

      {/* Bottom badges */}
      <div className="relative z-10 flex gap-2 flex-wrap">
        <span className="text-[10px] bg-white/5 border border-white/10 text-white/40 px-3 py-1.5 rounded-full font-black">🇰🇪 CBC Kenya</span>
        <span className="text-[10px] bg-white/5 border border-white/10 text-white/40 px-3 py-1.5 rounded-full font-black">🌍 Cambridge IGCSE</span>
      </div>
    </div>
  )
}

// ─── Login form (inner — needs Suspense for useSearchParams) ──────────────────
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
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.push(product ? `${returnTo}?product=${product}` : returnTo)
    }
    check()
  }, [supabase, router, returnTo, product])

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
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
      options:  { redirectTo: redirectUrl },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-white">

      {/* ── LEFT PANEL — desktop only (md+) ── */}
      <div className="hidden md:flex w-1/2 h-screen overflow-hidden flex-col border-r border-white/10">
        <LeftPanel />
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div className="w-full md:w-1/2 h-screen overflow-y-auto flex flex-col justify-center bg-slate-900 px-8 py-12">
        <div className="w-full max-w-sm mx-auto">

          {/* Mobile logo (hidden on md+) */}
          <Link href="/" className="flex items-center justify-center gap-2 mb-8 md:hidden">
            <div className="w-9 h-9 bg-linear-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black text-white">EduNexus</span>
          </Link>

          {/* Mobile mockup preview */}
          <div className="md:hidden w-full mb-8 max-h-48 overflow-hidden rounded-2xl opacity-80">
            <div style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}>
              <LearningCompassMockup />
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-white mb-1">
              {product ? 'Sign in to continue' : 'Welcome back'}
            </h1>
            <p className="text-sm text-white/50">Sign in to your EduNexus account</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl">
              {error}
            </div>
          )}

          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 mb-4"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30 font-bold">or continue with</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email + password form */}
          <form onSubmit={handleEmailLogin} className="space-y-3 mb-5">
            <div>
              <label className="block text-xs font-bold text-white/50 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/25 pl-11 pr-4 py-3.5 rounded-xl focus:border-amber-500/60 focus:outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/25 pl-11 pr-4 py-3.5 rounded-xl focus:border-amber-500/60 focus:outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-white/40 hover:text-white/60 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-linear-to-r from-amber-500 to-orange-500 text-white rounded-xl font-black text-base hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Switch to signup */}
          <p className="text-center text-sm text-white/50 mb-5">
            New to EduNexus?{' '}
            <Link
              href={product ? `/signup?returnTo=${returnTo}&product=${product}` : '/signup'}
              className="text-amber-400 font-black hover:text-amber-300 transition-colors"
            >
              Your first Compass session is on us →
            </Link>
          </p>

          {/* Security note */}
          <p className="text-center text-[11px] text-white/25 font-bold">
            🔒 Secure · Made in Kenya 🇰🇪
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
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
