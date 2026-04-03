'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  CheckCircle2,
  MessageCircle,
  Zap,
  Crown,
  Gift,
  Star,
  ArrowLeft,
  Users,
  Clock,
  Shield,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const WA_NUMBER = '254710798030'
const SPOTS_REMAINING = 17
const TOTAL_SPOTS = 20

// ─── WhatsApp messages per plan ───────────────────────────────────────────────

const WA_MESSAGES = {
  starter: `Habari EduNexus! 👋
Nataka kujiunga Early Access.
Plan: Starter — KES 500
Jina: [jina lako]
Namba: [namba yako]
Grade ya mtoto: [grade]
Niambie hatua za kulipa. Asante!`,

  term: `Habari EduNexus! 👋
Nataka kujiunga Early Access.
Plan: Term Plan — KES 3,200
Jina: [jina lako]
Namba: [namba yako]
Grade ya mtoto: [grade]
Niambie hatua za kulipa. Asante!`,

  premium: `Habari EduNexus! 👋
Nataka kujiunga Early Access.
Plan: Premium — KES 7,000
Jina: [jina lako]
Namba: [namba yako]
Watoto: [majina na grades]
Niambie hatua za kulipa. Asante!`,
}

type PlanId = 'starter' | 'term' | 'premium'

// ─── Plans ────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'starter' as PlanId,
    name: 'Starter',
    price: 500,
    billing: 'one-time',
    badge: null,
    highlight: false,
    color: 'from-blue-500 to-cyan-500',
    icon: Gift,
    features: [
      '15 AI tutoring sessions',
      'Academic Clinic report',
      'Career guidance',
      'Tokens never expire',
    ],
  },
  {
    id: 'term' as PlanId,
    name: 'Term Plan',
    price: 3200,
    originalPrice: 4500,
    savings: 1300,
    billing: 'per term',
    badge: 'MOST POPULAR',
    highlight: true,
    color: 'from-violet-500 to-purple-500',
    icon: Star,
    features: [
      'Unlimited tutoring sessions',
      "🤖 AI tutoring that learns your child's pace",
      'All CBC subjects',
      'Academic Clinic reports',
      'Holiday learning plan',
      'Share with teacher',
      'Track 1 student',
      'AI-powered · parents in control',
    ],
  },
  {
    id: 'premium' as PlanId,
    name: 'Premium',
    price: 7000,
    originalPrice: 9500,
    savings: 2500,
    billing: 'per term',
    badge: 'BEST VALUE',
    highlight: false,
    color: 'from-amber-500 to-orange-500',
    icon: Crown,
    features: [
      'Everything in Term Plan',
      'Track 3 students',
      'Family dashboard',
      'Priority WhatsApp support',
    ],
  },
]

// ─── Helper ───────────────────────────────────────────────────────────────────

function waLink(plan: PlanId) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_MESSAGES[plan])}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EarlyAccessPage() {
  const [hovered, setHovered] = useState<PlanId | null>(null)

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden pb-20">

      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] bg-violet-600/8 rounded-full blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[800px] h-[800px] bg-amber-600/6 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/2 w-[600px] h-[600px] bg-green-600/4 rounded-full blur-[100px]" />
      </div>

      {/* Sticky top banner */}
      <div className="bg-gradient-to-r from-green-700 to-emerald-700 py-3 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-center gap-2">
          <Zap className="w-4 h-4 animate-pulse flex-shrink-0" />
          <span className="text-sm font-black tracking-wide text-center">
            ⚡ {SPOTS_REMAINING} of {TOTAL_SPOTS} founding spots remaining — Pay via M-PESA today
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="border-b border-white/5 bg-slate-950/70 backdrop-blur-xl sticky top-10 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">EduNexus</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-white/50 hover:text-white flex items-center gap-1.5 transition font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div className="text-center mb-16">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-300 px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider mb-6">
            <Zap className="w-3.5 h-3.5 animate-pulse" />
            🚀 Founding Members Only
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-[0.95] mb-6">
            <span className="text-white/90">Be First.</span>
            <span className="block bg-gradient-to-r from-green-400 via-emerald-400 to-amber-400 bg-clip-text text-transparent mt-1">
              Pay Less. Forever.
            </span>
          </h1>

          <p className="text-lg text-white/60 max-w-xl mx-auto leading-relaxed mb-5">
            First {TOTAL_SPOTS} families lock in founding pricing before full launch.
            Your rate is locked — it never goes up.
          </p>

          {/* Curriculum support */}
          <p className="text-sm text-white/40 font-bold mb-3">
            Supporting CBC Kenya and Cambridge IGCSE
          </p>
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-500/15 border border-green-500/30 text-green-300 rounded-full text-sm font-black">
              🇰🇪 CBC Kenya
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 rounded-full text-sm font-black">
              🌍 Cambridge IGCSE
            </span>
          </div>

          {/* Spots counter */}
          <div className="inline-flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-6 py-4">
            <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
            <p className="text-base text-amber-300 font-black">
              ⚡ {SPOTS_REMAINING} of {TOTAL_SPOTS} spots remaining
            </p>
          </div>
        </div>

        {/* ── PLAN CARDS ───────────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {PLANS.map(plan => {
            const Icon = plan.icon
            const isHovered = hovered === plan.id

            return (
              <div
                key={plan.id}
                onMouseEnter={() => setHovered(plan.id)}
                onMouseLeave={() => setHovered(null)}
                className={`relative rounded-3xl transition-all duration-300 group ${
                  plan.highlight ? 'md:-mt-4 md:mb-4' : ''
                }`}
              >
                {/* Glow */}
                <div className={`absolute -inset-0.5 bg-gradient-to-br ${plan.color} rounded-3xl blur transition-opacity duration-300 ${
                  plan.highlight || isHovered ? 'opacity-30' : 'opacity-0 group-hover:opacity-15'
                }`} />

                <div className={`relative rounded-3xl p-7 border-2 transition-all duration-300 h-full flex flex-col ${
                  plan.highlight
                    ? 'bg-white/10 border-violet-500/40'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8'
                }`}>

                  {/* Badge */}
                  {plan.badge && (
                    <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r ${plan.color} text-white px-4 py-1 rounded-full text-[11px] font-black tracking-wider shadow-lg whitespace-nowrap`}>
                      {plan.badge === 'MOST POPULAR' ? '⭐ ' : '👑 '}{plan.badge}
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`w-12 h-12 bg-gradient-to-br ${plan.color} rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Name */}
                  <div className="mb-4">
                    <h3 className="text-2xl font-black text-white mb-1">{plan.name}</h3>
                    <p className="text-xs text-white/40 uppercase tracking-wider font-bold">{plan.billing}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-5">
                    {'originalPrice' in plan && plan.originalPrice && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-white/30 line-through">
                          KES {plan.originalPrice.toLocaleString()}
                        </span>
                        <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-black">
                          Save KES {plan.savings?.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white">
                        KES {plan.price.toLocaleString()}
                      </span>
                    </div>
                    {'savings' in plan && plan.savings && (
                      <p className="text-xs text-green-400 font-bold mt-1">
                        Save KES {plan.savings.toLocaleString()} as founding member
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* WhatsApp CTA */}
                  <a
                    href={waLink(plan.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105 bg-gradient-to-r ${plan.color} text-white`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Join via WhatsApp
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-12">
          <h2 className="text-2xl font-black text-white text-center mb-8">
            How It Works
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { step: '1', icon: MessageCircle, color: 'from-green-500 to-emerald-500', text: 'Click your plan' },
              { step: '2', icon: Zap, color: 'from-blue-500 to-cyan-500', text: 'WhatsApp opens — send message' },
              { step: '3', icon: Shield, color: 'from-violet-500 to-purple-500', text: 'We send M-PESA payment request' },
              { step: '4', icon: CheckCircle2, color: 'from-amber-500 to-orange-500', text: 'Account activated within 2 hours ✅' },
            ].map(({ step, icon: Icon, color, text }) => (
              <div key={step} className="text-center">
                <div className={`w-12 h-12 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-xs font-black text-white/30 uppercase tracking-wider mb-1">Step {step}</div>
                <p className="text-sm text-white/70 font-medium leading-snug">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOUNDER NOTE ─────────────────────────────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden mb-12">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 to-slate-900/60" />
          <div className="absolute -inset-0.5 bg-gradient-to-br from-violet-500/20 to-amber-500/10 rounded-3xl blur" />
          <div className="relative p-8 border border-white/10 rounded-3xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/80 leading-relaxed text-base mb-4">
                  "We're a small Kenyan team.{' '}
                  Every founding member matters to us.{' '}
                  We personally ensure your child's best experience."
                </p>
                <p className="text-white/50 text-sm font-bold">
                  — EduNexus Team, Nairobi 🇰🇪
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER NOTE ──────────────────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-3 mb-4">
            <Clock className="w-4 h-4 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-300 font-bold">
              Founding pricing locked for life.
            </p>
          </div>
          <p className="text-white/30 text-xs">
            Full M-PESA + card payments launching soon.
          </p>
          <p className="text-white/20 text-xs">
            🔒 Safe &amp; secure · Made in Kenya 🇰🇪
          </p>
        </div>

      </div>
    </div>
  )
}
