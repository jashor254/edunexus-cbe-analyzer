'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, PartyPopper, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import confetti from 'canvas-confetti'

// ─── Inner component (needs Suspense because of useSearchParams) ───────────────
function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [subMessage, setSubMessage] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref')
    const plan = searchParams.get('plan') || searchParams.get('product')

    // ── Set message based on plan ──────────────────────────────────────────────
    if (plan === 'starter') {
      setMessage('Tokeni zako zimeongezwa!')
      setSubMessage('Uko tayari kupata uchambuzi wa kwanza wa mtoto wako. Anza sasa hivi.')
    } else if (plan === 'term') {
      setMessage('Term Plan imewashwa!')
      setSubMessage('Access isiyo na kikomo kwa muhula mzima. Mtoto wako yuko tayari kujifunza.')
    } else if (plan === 'premium') {
      setMessage('Premium imewashwa!')
      setSubMessage('Umefungua kila kitu. Watoto wako watapata msaada bora zaidi.')
    } else {
      setMessage('Malipo yamekubaliwa!')
      setSubMessage('Akaunti yako imesasishwa. Unaweza kuanza safari ya elimu sasa.')
    }

    // ── Clean URL so refresh doesn't re-trigger ────────────────────────────────
    window.history.replaceState({}, '', '/payment/success')

    // ── Confetti 🎉 ────────────────────────────────────────────────────────────
    const duration = 4 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()
      if (timeLeft <= 0) return clearInterval(interval)
      const particleCount = 50 * (timeLeft / duration)
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
    }, 250)

    setReady(true)

    return () => clearInterval(interval)
  }, [searchParams])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 relative overflow-hidden">

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Logo top */}
      <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 group">
        <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-black text-white tracking-tight">EduNexus</span>
      </Link>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md animate-in zoom-in duration-500">

        {/* Glow border */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-3xl blur opacity-40" />

        <div className="relative bg-slate-900 border border-green-500/30 rounded-3xl p-10 text-center overflow-hidden">

          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400" />

          {/* Animated check icon */}
          <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-7 relative">
            <CheckCircle className="w-14 h-14 text-green-400 relative z-10" />
            <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping" />
          </div>

          {/* Title */}
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
            MALIPO YAMEKUBALI! 🎉
          </h1>

          {/* Plan-specific message */}
          {ready && (
            <div className="animate-in fade-in duration-700">
              <p className="text-green-400 font-black text-lg mb-3">{message}</p>
              <p className="text-white/60 text-sm leading-relaxed mb-10 px-2">
                {subMessage}
              </p>
            </div>
          )}

          {/* Primary CTA — actually navigates */}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-5 rounded-2xl font-black text-lg uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-green-500/20 mb-4"
          >
            <PartyPopper className="w-6 h-6" />
            Nenda Dashboard
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Secondary — go to clinic directly */}
          <button
            onClick={() => router.push('/dashboard/clinic')}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white py-3.5 rounded-2xl font-bold text-sm transition-all"
          >
            Anza Uchambuzi Sasa →
          </button>

          {/* Trust note */}
          <p className="text-white/25 text-xs mt-6">
            Risiti imetumwa kwa {' '}
            <span className="text-white/40 font-bold">barua pepe yako</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Page export (required Suspense wrapper for useSearchParams) ───────────────
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}