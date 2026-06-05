'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  CheckCircle2,
  Smartphone,
  Loader2,
  Sparkles,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string
  name: string
  price: number
  billing: string
  tagline: string
  badge: string
  highlight: boolean
  features: string[]
  cta: string
  note: string
}

type FAQItem = { q: string; a: string }

// ─── Products ─────────────────────────────────────────────────────────────────
// Paystack integration depends on these exact id values.

const TOKEN_PRODUCT: Product = {
  id:        'starter',
  name:      'Token Pack',
  price:     500,
  billing:   'one-time',
  tagline:   'Try before committing',
  badge:     '',
  highlight: false,
  features:  [],
  cta:       'Buy Tokens — KES 500',
  note:      '',
}

const PLAN_PRODUCTS: Product[] = [
  {
    id:        'term',
    name:      'Term Plan',
    price:     3200,
    billing:   'per term',
    tagline:   'Everything your child needs this term.',
    badge:     'Most popular',
    highlight: true,
    features: [
      'Unlimited Learning Compass sessions\n(Personalised tutoring, adapts to your child\'s level)',
      'Unlimited Academic Clinic reports\n(7-page clinical PDF, any time)',
      'Covers 1 child, all subjects',
      'CBC + Cambridge IGCSE',
      'PDF report downloads',
      'Parent notification when teacher marks work',
      'Pathway + career guidance included',
    ],
    cta:  'Start Term Plan — KES 3,200',
    note: 'No card commitment to try — start free, upgrade when ready.',
  },
  {
    id:        'family',
    name:      'Family Plan',
    price:     5500,
    billing:   'per term',
    tagline:   'For families with more than one child.',
    badge:     'Best value',
    highlight: false,
    features: [
      'Everything in Term Plan',
      'Up to 3 children tracked',
      'Family performance overview',
      'Priority WhatsApp support',
    ],
    cta:  'Start Family Plan — KES 5,500',
    note: 'Save KES 1,100 vs two separate Term Plans.',
  },
]

const ALL_PRODUCTS = [TOKEN_PRODUCT, ...PLAN_PRODUCTS]

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQ_ITEMS: FAQItem[] = [
  {
    q: 'What is a "term" exactly?',
    a: 'One Kenyan school term (approximately 3 months). Your plan covers Term 1 (Jan–Apr), Term 2 (May–Aug), or Term 3 (Sep–Nov). You choose when to start.',
  },
  {
    q: 'Which curriculum does EduNexus support?',
    a: 'CBC (Grade 7–12), Cambridge IGCSE, and 8-4-4. Select your child\'s curriculum when you sign up.',
  },
  {
    q: 'Can I track more than one child?',
    a: 'Yes — the Family Plan covers up to 3 children at KES 5,500 per term.',
  },
  {
    q: 'What if I want to try before committing?',
    a: 'Sign up free — you get 1 Academic Clinic report and 1 Learning Compass session, no card needed. Or buy tokens (KES 500) to explore further.',
  },
  {
    q: 'How does payment work?',
    a: 'M-PESA via Paystack. You\'ll receive a payment prompt on your phone. Simple.',
  },
]

// ─── FAQ Accordion ────────────────────────────────────────────────────────────

function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="divide-y divide-white/8 border border-white/10 rounded-2xl overflow-hidden">
      {FAQ_ITEMS.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/5 transition-colors"
          >
            <span className="font-bold text-white text-sm pr-6 leading-snug">{item.q}</span>
            <ChevronDown
              className={`w-4 h-4 text-white/30 shrink-0 transition-transform duration-200 ${
                open === i ? 'rotate-180' : ''
              }`}
            />
          </button>
          {open === i && (
            <div className="px-6 pb-5 border-t border-white/5">
              <p className="text-sm text-white/55 leading-relaxed pt-4">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  product,
  isSelected,
  onSelect,
}: {
  product: Product
  isSelected: boolean
  onSelect: (p: Product) => void
}) {
  return (
    <div
      onClick={() => onSelect(product)}
      className={`relative rounded-3xl cursor-pointer group transition-all duration-300 ${
        product.highlight ? 'sm:-mt-5 sm:mb-5' : ''
      }`}
    >
      {/* Highlight glow */}
      {product.highlight && (
        <div className="absolute -inset-px bg-linear-to-b from-teal-500/50 to-cyan-500/20 rounded-3xl blur-sm opacity-60" />
      )}

      <div
        className={`relative flex flex-col h-full rounded-3xl border-2 p-7 transition-all duration-300 ${
          product.highlight
            ? 'bg-slate-900 border-teal-500/60'
            : isSelected
            ? 'bg-white/8 border-white/25'
            : 'bg-white/4 border-white/10 hover:border-white/20 hover:bg-white/6'
        }`}
      >
        {/* Badge */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span
            className={`px-4 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase whitespace-nowrap shadow-lg ${
              product.highlight
                ? 'bg-teal-500 text-white shadow-teal-500/30'
                : 'bg-white/10 text-white/50 border border-white/10'
            }`}
          >
            {product.badge}
          </span>
        </div>

        {/* Name + tagline */}
        <div className="mt-4 mb-5">
          <h3 className="text-2xl font-black text-white">{product.name}</h3>
          <p className="text-sm text-white/45 mt-1 leading-snug">{product.tagline}</p>
        </div>

        {/* Price */}
        <div className="mb-7">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white tracking-tight">
              KES {product.price.toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-white/35 mt-0.5">{product.billing}</p>
        </div>

        {/* Features */}
        <ul className="space-y-3.5 flex-1 mb-6">
          {product.features.map((feature, i) => {
            const [main, sub] = feature.split('\n')
            return (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    product.highlight ? 'text-teal-400' : 'text-green-400'
                  }`}
                />
                <span className="text-sm leading-snug">
                  <span className="text-white/80">{main}</span>
                  {sub && (
                    <span className="block text-white/35 text-xs mt-0.5">{sub}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>

        {/* Note */}
        <p className="text-xs text-white/25 mb-5 italic leading-relaxed">{product.note}</p>

        {/* CTA button */}
        <button
          onClick={e => { e.stopPropagation(); onSelect(product) }}
          className={`w-full py-4 rounded-2xl font-black text-sm transition-all duration-200 ${
            isSelected
              ? product.highlight
                ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20 hover:bg-teal-400'
                : 'bg-white text-slate-900 shadow-lg hover:bg-white/90'
              : 'bg-white/8 text-white/70 hover:bg-white/14 hover:text-white'
          }`}
        >
          {isSelected ? '✓ Selected — scroll down to pay' : product.cta}
        </button>
      </div>
    </div>
  )
}

// ─── Pricing page ─────────────────────────────────────────────────────────────

function PricingContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const [selected,      setSelected]      = useState<Product>(PLAN_PRODUCTS[0])
  const [phone,         setPhone]         = useState('')
  const [user,          setUser]          = useState<User | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [autoTriggered, setAutoTriggered] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      const productId  = searchParams.get('product') ?? localStorage.getItem('pending_plan')
      const savedPhone = localStorage.getItem('pending_phone')

      if (savedPhone) setPhone(savedPhone)

      if (productId) {
        const found = ALL_PRODUCTS.find(p => p.id === productId)
        if (found) {
          setSelected(found)
          if (authUser && savedPhone && !autoTriggered) {
            setAutoTriggered(true)
            void handlePay(found, savedPhone, authUser.email ?? '')
          }
        }
      }
    }
    void init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, autoTriggered])

  const handlePay = async (product: Product, phoneNum: string, email: string) => {
    setLoading(true)
    try {
      const res  = await fetch('/api/payments/initialize', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId:   product.id,
          phoneNumber: phoneNum,
          amount:      product.price,
          email,
        }),
      })
      const data = await res.json() as { authorization_url?: string; error?: string }
      if (data.authorization_url) {
        localStorage.removeItem('pending_plan')
        localStorage.removeItem('pending_phone')
        window.location.href = data.authorization_url
      } else {
        alert(data.error ?? 'Payment failed. Please try again.')
        setLoading(false)
      }
    } catch {
      alert('Network error. Please try again.')
      setLoading(false)
    }
  }

  const handleAction = () => {
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length !== 10 && cleanPhone.length !== 9) {
      alert('Please enter a valid M-PESA number (e.g., 0712345678)')
      return
    }
    if (!user) {
      localStorage.setItem('pending_plan', selected.id)
      localStorage.setItem('pending_phone', cleanPhone)
      router.push(`/login?returnTo=/pricing&product=${selected.id}`)
      return
    }
    void handlePay(selected, cleanPhone, user.email ?? '')
  }

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length <= 10) setPhone(cleaned)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden pb-36">

      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-1/3 -left-1/4 w-175 h-175 bg-teal-600/6 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 -right-1/4 w-150 h-150 bg-violet-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-linear-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">EduNexus</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-white/45 hover:text-white flex items-center gap-1.5 transition-colors font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6">

        {/* ── SECTION 1: HEADER ─────────────────────────────────────────────── */}
        <div className="text-center pt-20 pb-16">
          <h1 className="text-6xl md:text-8xl font-black leading-[0.88] tracking-tight mb-6">
            Simple pricing.
          </h1>
          <p className="text-xl md:text-2xl text-white/50 leading-relaxed font-medium max-w-lg mx-auto">
            Less than one tuition session.<br />
            For an entire term.
          </p>

          {/* Value comparison */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-12 max-w-md mx-auto">
            {/* Tutor cost */}
            <div className="w-full sm:flex-1 bg-white/4 border border-white/10 rounded-2xl px-6 py-5 text-center">
              <p className="text-[11px] font-black text-white/25 uppercase tracking-widest mb-2">
                1 tuition session
              </p>
              <p className="text-3xl font-black text-white/40">KES 1,500</p>
              <p className="text-xs text-white/20 mt-1.5">one subject · one hour</p>
            </div>

            {/* vs chip */}
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-black text-white/30">vs</span>
            </div>

            {/* EduNexus */}
            <div className="w-full sm:flex-1 bg-teal-500/8 border-2 border-teal-500/35 rounded-2xl px-6 py-5 text-center">
              <p className="text-[11px] font-black text-teal-400 uppercase tracking-widest mb-2">
                Full term — unlimited
              </p>
              <p className="text-3xl font-black text-teal-300">KES 3,200</p>
              <p className="text-xs text-teal-400/50 mt-1.5">every subject · every day</p>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: PLAN CARDS ─────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-5 mb-20 max-w-3xl mx-auto">
          {PLAN_PRODUCTS.map(product => (
            <PlanCard
              key={product.id}
              product={product}
              isSelected={selected.id === product.id}
              onSelect={setSelected}
            />
          ))}
        </div>

        {/* ── SECTION 3: WHAT'S INCLUDED ────────────────────────────────────── */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-white text-center mb-10 tracking-tight">
            What's included
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">

            {/* Learning Compass */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6">
              <h3 className="text-sm font-black text-teal-400 uppercase tracking-wider mb-5">
                Learning Compass
              </h3>
              <ul className="space-y-3.5">
                {[
                  'Adapts to Level 1–4 (CBC) or A*–G (IGCSE)',
                  'Every subject — Math, English, Sciences, Kiswahili',
                  'Visual diagrams for Sciences and Geography',
                  'Never gives direct answers — builds real understanding',
                  'Available 24/7 including school holidays',
                  'Parent receives session summary',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-white/55 leading-snug">
                    <span className="text-teal-500/70 shrink-0 mt-0.5 font-bold">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Academic Clinic */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6">
              <h3 className="text-sm font-black text-violet-400 uppercase tracking-wider mb-5">
                Academic Clinic
              </h3>
              <ul className="space-y-3.5">
                {[
                  'Clinical assessment per subject (not just a grade)',
                  '7-page professional PDF — printable',
                  '3-week holiday study plan built for your child\'s gaps',
                  'Pathway guidance: STEM vs Social Sciences vs Arts',
                  'Career intelligence — Kenya market reality',
                  'Teacher collaboration page included',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-white/55 leading-snug">
                    <span className="text-violet-500/70 shrink-0 mt-0.5 font-bold">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Teacher Connection */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-6">
              <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider mb-5">
                Teacher Connection
              </h3>
              <ul className="space-y-3.5">
                {[
                  'Teacher marks work → you\'re notified by email',
                  'Teacher raises alert → you receive it immediately',
                  'See the same data about your child as the teacher',
                  'Share a join link with teacher for instant connection',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-white/55 leading-snug">
                    <span className="text-amber-500/70 shrink-0 mt-0.5 font-bold">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* ── SECTION 4: TOKENS FOOTNOTE ────────────────────────────────────── */}
        <div className="max-w-xl mx-auto bg-white/4 border border-white/10 rounded-2xl p-7 mb-20">
          <p className="font-black text-white mb-0.5">
            Not ready to commit to a full term?
          </p>
          <p className="text-sm text-white/50 mb-6">Start with tokens.</p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'KES 500',          sub: '10 tokens'          },
              { label: '5 tokens',         sub: 'Academic Clinic'     },
              { label: '1 token',          sub: 'Learning Compass'    },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-3.5 text-center">
                <p className="text-lg font-black text-white leading-none">{item.label}</p>
                <p className="text-[11px] text-white/35 mt-1.5 leading-tight">{item.sub}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-white/25 text-center mb-5">Tokens never expire.</p>

          <button
            onClick={() => setSelected(TOKEN_PRODUCT)}
            className="block w-full text-center bg-white/8 hover:bg-white/12 text-white/65 hover:text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            Start with tokens →
          </button>
        </div>

        {/* ── SECTION 5: TEACHER BANNER ─────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto bg-linear-to-r from-teal-950/60 to-slate-900/60 border border-teal-500/20 rounded-3xl px-8 py-10 mb-20 text-center">
          <h3 className="text-xl font-black text-white mb-2">
            Are you a teacher? Everything is free.
          </h3>
          <p className="text-white/45 text-sm mb-6 leading-relaxed">
            SOW · Lesson Plans · Record of Work · Class Dashboard
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-linear-to-r from-teal-500 to-cyan-500 text-white px-7 py-3 rounded-xl font-black hover:scale-105 transition-transform text-sm shadow-xl shadow-teal-500/15"
          >
            Get Teacher Access →
          </Link>
        </div>

        {/* ── SECTION 6: FAQ ────────────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl font-black text-white text-center mb-8 tracking-tight">
            Questions
          </h2>
          <FAQAccordion />
        </div>

        {/* Trust footer */}
        <div className="text-center pb-4 space-y-1.5">
          <p className="text-white/20 text-xs">
            🔒 256-bit SSL · Paystack · M-PESA · Made in Kenya 🇰🇪
          </p>
          <p className="text-white/15 text-xs">
            Tokens never expire · Full refund if not satisfied
          </p>
        </div>

      </div>

      {/* ── FLOATING CHECKOUT BAR ─────────────────────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 bg-slate-900/97 backdrop-blur-xl border-t border-white/8 z-50 shadow-2xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">

            {/* Selected plan info */}
            <div className="w-full sm:w-auto text-center sm:text-left sm:pr-4 sm:border-r sm:border-white/10 shrink-0">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none mb-1">
                {selected.name}
              </p>
              <p className="text-xl font-black text-white leading-none">
                KES {selected.price.toLocaleString()}
                <span className="text-xs font-medium text-white/35 ml-1.5">{selected.billing}</span>
              </p>
            </div>

            {/* Phone + Pay */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
              <div className="relative flex-1">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 w-4 h-4 pointer-events-none" />
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="0712 345 678 (M-PESA)"
                  value={phone}
                  onChange={e => formatPhone(e.target.value)}
                  className="w-full bg-white/5 border border-white/12 pl-9 pr-4 py-3 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none font-medium text-white placeholder:text-white/20 text-sm"
                />
              </div>
              <button
                onClick={handleAction}
                disabled={loading}
                className="bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-black transition-colors flex items-center justify-center gap-2 text-sm whitespace-nowrap shadow-lg shadow-teal-500/20"
              >

                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    Pay with M-PESA
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>

    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  )
}
