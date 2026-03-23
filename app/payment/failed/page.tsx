'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { XCircle, ArrowLeft, RefreshCw, MessageSquare, Sparkles } from 'lucide-react'
import Link from 'next/link'

const WA_NUMBER = '254710798030' // ✅ Your real WhatsApp number

function FailedContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reference = searchParams.get('reference') || searchParams.get('transactionId')

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 relative overflow-hidden">

      {/* Ambient red glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/8 rounded-full blur-[120px]" />
      </div>

      {/* Logo */}
      <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 group">
        <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-black text-white tracking-tight">EduNexus</span>
      </Link>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md animate-in zoom-in duration-500">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-3xl blur opacity-30" />
        <div className="relative bg-slate-900 border border-red-500/20 rounded-3xl p-10 text-center overflow-hidden">

          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-orange-500" />

          {/* Icon */}
          <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-7 relative">
            <XCircle className="w-14 h-14 text-red-400 relative z-10" />
            <div className="absolute inset-0 bg-red-400/10 rounded-full animate-pulse" />
          </div>

          <h1 className="text-3xl font-black text-white mb-3 tracking-tight">
            Malipo Hayakufanikiwa
          </h1>
          <p className="text-white/50 text-sm mb-8 leading-relaxed">
            Usijali — pesa yako iko salama. Hakuna kiasi kilichokatwa.
          </p>

          {/* Reasons */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left mb-8">
            <p className="text-xs font-black text-white/50 uppercase tracking-wider mb-3">
              Sababu za kawaida
            </p>
            <ul className="space-y-2 text-sm text-white/70">
              {[
                '📵 Salio la M-PESA haitoshi',
                '🔑 PIN mbaya au prompt ilifutwa',
                '🌐 Mtandao polepole au kukatika',
                '🏦 Downtime ya mtoa huduma',
              ].map((r, i) => (
                <li key={i} className="flex items-center gap-2">{r}</li>
              ))}
            </ul>
          </div>

          {/* Reference */}
          {reference && (
            <p className="text-[10px] uppercase tracking-widest text-white/25 mb-6 bg-white/5 py-2 px-3 rounded-xl">
              Ref: {reference}
            </p>
          )}

          {/* CTAs */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/pricing')}
              className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-red-500/20"
            >
              <RefreshCw className="w-5 h-5" />
              Jaribu Tena
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Rudi Dashboard
            </button>
          </div>

          {/* WhatsApp support */}
          <button
            onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=Habari%2C%20malipo%20yangu%20hayakufanikiwa.%20Ref%3A%20${reference || 'N/A'}`, '_blank')}
            className="mt-6 flex items-center justify-center gap-2 text-green-400 hover:text-green-300 text-sm font-bold mx-auto transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Pata msaada WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <FailedContent />
    </Suspense>
  )
}