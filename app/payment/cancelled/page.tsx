'use client'

import { useRouter } from 'next/navigation'
import { Ban, ArrowLeft, ShoppingCart, MessageCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'

const WA_NUMBER = '254710798030' // ✅ Your real WhatsApp number

export default function PaymentCancelledPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 relative overflow-hidden">

      {/* Ambient amber glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/8 rounded-full blur-[120px]" />
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
        <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-3xl blur opacity-25" />
        <div className="relative bg-slate-900 border border-amber-500/20 rounded-3xl p-10 text-center overflow-hidden">

          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-400" />

          {/* Icon */}
          <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-7">
            <Ban className="w-14 h-14 text-amber-400" />
          </div>

          <h1 className="text-3xl font-black text-white mb-3 tracking-tight">
            Ulifuta Malipo
          </h1>
          <p className="text-white/50 text-sm mb-8 leading-relaxed px-2">
            Hakuna shida — hakuna pesa iliyokatwa. Unaweza kuendelea ukiwa tayari.
          </p>

          {/* Pro tip — updated to new pricing */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5 mb-8 text-left">
            <p className="text-xs font-black text-purple-300 uppercase tracking-wider mb-2">
              💡 Pro Tip
            </p>
            <p className="text-sm text-white/60 leading-relaxed">
              Wazazi wengi wanaanza na{' '}
              <strong className="text-white/90">Try It (KES 500)</strong>{' '}
              — ripoti moja kamili ya mtoto wako, bila commitment. Unaona thamani kwanza.
            </p>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/pricing')}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-purple-500/20"
            >
              <ShoppingCart className="w-5 h-5" />
              Angalia Bei Tena
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Rudi Dashboard
            </button>
          </div>

          {/* WhatsApp */}
          <button
            onClick={() => window.open(`https://wa.me/${WA_NUMBER}?text=Habari%2C%20ningependa%20kujua%20zaidi%20kuhusu%20EduNexus`, '_blank')}
            className="mt-6 flex items-center justify-center gap-2 text-green-400 hover:text-green-300 text-sm font-bold mx-auto transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Zungumza nasi WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}