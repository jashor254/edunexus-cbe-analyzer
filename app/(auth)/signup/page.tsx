'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Sparkles, CheckCircle2, Mail, Lock, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import {
  AcademicClinicMockup,
  LearningCompassMockup,
  TeacherDashboardMockup,
  CareerExplorerMockup,
} from '@/app/(marketing)/components/ProductMockups'

// ─── Testimonials ──────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: 'Learning Compass explained simultaneous equations using unga prices at 11pm. My son finally got it.',
    name: 'Grace M.',
    location: 'Nairobi',
  },
  {
    quote: 'The Academic Clinic told us exactly which topics were dragging the grade down. No more guessing.',
    name: 'Peter O.',
    location: 'Kisumu',
  },
  {
    quote: 'As a teacher, I can see every student\'s gaps in one view. Incredible tool for CBC.',
    name: 'Mwalimu Kamau',
    location: 'Mombasa',
  },
]

// ─── Mockup carousel ──────────────────────────────────────────────────────────
const MOCKUPS = [
  AcademicClinicMockup,
  LearningCompassMockup,
  TeacherDashboardMockup,
  CareerExplorerMockup,
]

const MOCKUP_COLORS = [
  'from-violet-500/20 to-purple-500/20',
  'from-amber-500/20 to-orange-500/20',
  'from-teal-500/20 to-cyan-500/20',
  'from-cyan-500/20 to-blue-500/20',
]

const MOCKUP_DOTS = [
  'bg-violet-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-cyan-500',
]

const WHAT_YOU_GET = [
  { text: 'First Learning Compass session on us', highlight: true },
  { text: 'One Academic Clinic report — yours to keep', highlight: true },
  { text: 'Career intelligence for your child' },
  { text: 'CBC Grade 7–12 & Cambridge IGCSE' },
  { text: 'No credit card needed', highlight: true },
]

// ─── Left panel ───────────────────────────────────────────────────────────────
function LeftPanel() {
  const [mockupIdx, setMockupIdx] = useState(0)
  const [testimonialIdx, setTestimonialIdx] = useState(0)
  const [mockupVisible, setMockupVisible] = useState(true)
  const [testimonialVisible, setTestimonialVisible] = useState(true)

  // Mockup rotation every 4s
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

  // Testimonial rotation every 6s
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

  return (
    <div className="relative flex flex-col h-full px-8 py-10 overflow-hidden">
      {/* Ambient glow — violet theme for signup */}
      <div className="absolute -top-1/2 -left-1/2 w-150 h-150 bg-violet-500/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-1/4 -right-1/4 w-100 h-100 bg-purple-500/8 rounded-full blur-[80px] pointer-events-none" />

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-8 relative z-10">
        <div className="w-9 h-9 bg-linear-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Sparkles className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <span className="text-lg font-black text-white">EduNexus</span>
          <p className="text-[10px] text-white/40 font-bold leading-none">Kenya&apos;s AI Education Platform</p>
        </div>
      </Link>

      {/* Heading */}
      <div className="mb-5 relative z-10">
        <h2 className="text-2xl font-black text-white mb-1">Join EduNexus today</h2>
        <p className="text-sm text-white/50">Your first Compass session is on us — no card needed</p>
      </div>

      {/* What you get */}
      <div className="mb-5 relative z-10 bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-xs font-black text-white/60 uppercase tracking-wider mb-3">What you get free</p>
        <div className="space-y-2">
          {WHAT_YOU_GET.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${item.highlight ? 'text-violet-400' : 'text-white/30'}`} />
              <span className={`text-sm ${item.highlight ? 'text-white/80 font-bold' : 'text-white/50'}`}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mockup preview */}
      <div className="flex-1 min-h-0 relative z-10 mb-4 overflow-hidden">
        <div className={`absolute -inset-4 bg-linear-to-br ${MOCKUP_COLORS[mockupIdx]} rounded-3xl blur-2xl pointer-events-none transition-all duration-500`} />
        <div
          className={`transition-opacity duration-300 ${mockupVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ transform: 'scale(0.82)', transformOrigin: 'top center', willChange: 'opacity' }}
        >
          <MockupComponent />
        </div>
        <div className="flex justify-center gap-1.5 mt-3">
          {MOCKUPS.map((_, i) => (
            <button
              key={i}
              onClick={() => { setMockupVisible(false); setTimeout(() => { setMockupIdx(i); setMockupVisible(true) }, 300) }}
              className={`rounded-full transition-all duration-300 ${i === mockupIdx ? `w-4 h-2 ${MOCKUP_DOTS[i]}` : 'w-2 h-2 bg-white/20 hover:bg-white/40'}`}
            />
          ))}
        </div>
      </div>

      {/* Testimonial */}
      <div
        className={`relative z-10 bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 transition-opacity duration-300 ${testimonialVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ willChange: 'opacity' }}
      >
        <p className="text-sm text-white/80 leading-relaxed mb-2 italic">&ldquo;{t.quote}&rdquo;</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white/60">— {t.name}, {t.location}</span>
          <span className="text-violet-400 text-xs">⭐⭐⭐⭐⭐</span>
        </div>
      </div>

      {/* Bottom badges */}
      <div className="relative z-10 flex gap-2 flex-wrap">
        <span className="text-[10px] bg-white/5 border border-white/10 text-white/40 px-3 py-1.5 rounded-full font-black">1,000+ Kenyan families</span>
        <span className="text-[10px] bg-white/5 border border-white/10 text-white/40 px-3 py-1.5 rounded-full font-black">CBC Grade 7–12</span>
        <span className="text-[10px] bg-white/5 border border-white/10 text-white/40 px-3 py-1.5 rounded-full font-black">Cambridge IGCSE</span>
      </div>
    </div>
  )
}

// ─── Signup form ──────────────────────────────────────────────────────────────
function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const productId = searchParams.get('product')
  const returnTo  = searchParams.get('returnTo') || '/dashboard'

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      if (productId) setTimeout(() => router.push(`/pricing?product=${productId}`), 2000)
    }
  }

  const handleGoogleSignup = async () => {
    setLoading(true)
    setError(null)

    const redirectUrl = productId
      ? `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}&product=${productId}`
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

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-12 text-center">
          <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-400 w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2">Check your email!</h2>
          <p className="text-white/50 font-bold mb-2">Tumevuma link ya kuthibitisha akaunti yako.</p>
          <p className="text-white/40 text-sm">Karibu EduNexus — first Compass session is on us 🎁</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-white">

      {/* ── LEFT PANEL (desktop only) ── */}
      <div className="hidden md:flex w-1/2 h-screen overflow-hidden flex-col bg-slate-950 border-r border-white/10">
        <LeftPanel />
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div className="w-full md:w-1/2 h-screen overflow-y-auto flex flex-col justify-center bg-slate-900 px-5 sm:px-8 py-10 sm:py-12">

        {/* Mobile logo */}
        <Link href="/" className="flex items-center gap-2 mb-8 md:hidden">
          <div className="w-9 h-9 bg-linear-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-lg font-black text-white">EduNexus</span>
        </Link>

        {/* Mobile: single mockup preview */}
        <div className="md:hidden w-full max-w-sm mb-6 opacity-80" style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}>
          <AcademicClinicMockup />
        </div>

        <div className="w-full max-w-sm mx-auto">
          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-3xl font-black text-white mb-1">Create your account</h1>
            <p className="text-white/50 text-sm flex items-center gap-1.5">
              <span>First Compass session on us</span>
              <span className="text-lg">🎁</span>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl">
              {error}
            </div>
          )}

          {/* Google */}
          <button
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white py-3.5 rounded-2xl font-bold transition-all disabled:opacity-50 mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30 font-bold">OR</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-3 mb-5">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="email"
                placeholder="Email address"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 pl-11 pr-4 py-3.5 rounded-2xl focus:border-violet-500/50 focus:bg-white/8 focus:outline-none transition-all"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="password"
                placeholder="Create a password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 pl-11 pr-4 py-3.5 rounded-2xl focus:border-violet-500/50 focus:bg-white/8 focus:outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-linear-to-r from-violet-500 to-purple-500 text-white rounded-2xl font-black text-base hover:scale-[1.02] transition-all shadow-xl shadow-violet-500/25 disabled:opacity-60 disabled:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : 'Create account — first session on us'}
            </button>
          </form>

          {/* Terms */}
          <p className="text-center text-[11px] text-white/30 mb-5 leading-relaxed">
            By signing up you agree to our{' '}
            <Link href="/legal/terms" className="hover:text-white/60 transition-colors underline">Terms</Link>
            {' '}and{' '}
            <Link href="/legal/privacy" className="hover:text-white/60 transition-colors underline">Privacy Policy</Link>
          </p>

          {/* Switch to login */}
          <p className="text-center text-sm text-white/50 mb-4">
            Already have an account?{' '}
            <Link
              href={productId ? `/login?product=${productId}` : '/login'}
              className="text-violet-400 font-black hover:text-violet-300 transition-colors"
            >
              Sign in →
            </Link>
          </p>

          {/* Security note */}
          <p className="text-center text-[11px] text-white/25 font-bold">
            🔒 Secure · No card needed · Made in Kenya 🇰🇪
          </p>
        </div>
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
