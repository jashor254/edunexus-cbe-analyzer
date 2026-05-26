'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  CheckCircle2,
  Smartphone,
  Loader2,
  Sparkles,
  Crown,
  Gift,
  ArrowLeft,
  Star,
  Calendar,
  FileText,
  BarChart3,
  ClipboardList,
  Shield,
  Compass,
} from 'lucide-react'

import Link from 'next/link'

const AcademicClinicDemo = dynamic(
  () => import('@/components/demo/AcademicClinicDemo'),
  { ssr: false }
)
const KcseClinicDemo = dynamic(
  () => import('@/components/demo/kcse/KcseClinicDemo'),
  { ssr: false }
)

// ─── Products ─────────────────────────────────────────────────────────────────
// DO NOT modify — Paystack integration depends on these exact values

const PRODUCTS = [
  {
    id: 'starter',
    name: 'Try It',
    price: 500,
    billing: 'one-time',
    tagline: 'See what EduNexus can do',
    badge: null,
    highlight: false,
    color: 'from-blue-500 to-cyan-500',
    icon: Gift,
    features: [
      '15 sessions (tokens)',
      'Academic Clinic reports',
      'Learning Compass sessions',
      'PDF report downloads',
      'Tokens never expire',
      'Supports CBC & Cambridge IGCSE',
    ],
    cta: 'Get Started',
    note: 'No subscription. Pay once, use anytime.',
  },
  {
    id: 'term',
    name: 'Term Plan',
    price: 3200,
    billing: 'per term',
    tagline: 'Everything your child needs this term',
    badge: 'MOST POPULAR',
    highlight: true,
    color: 'from-violet-500 to-purple-500',
    icon: Star,
    features: [
      'Unlimited Academic Clinic reports',
      'Unlimited Learning Compass sessions',
      '🤖 AI tutoring that adapts in real time',
      'Track 1 student — all subjects',
      'Holiday learning plan included',
      'PDF downloads',
      'Email support',
      'Supports CBC & Cambridge IGCSE',
    ],
    cta: 'Book This Plan',
    note: 'Less than one private tuition session per month.',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 7000,
    billing: 'per term',
    tagline: 'For parents who want the full picture',
    badge: 'BEST VALUE',
    highlight: false,
    color: 'from-amber-500 to-orange-500',
    icon: Crown,
    features: [
      'Everything in Term Plan',
      'Track up to 3 students',
      'Family performance dashboard',
      'Priority support via WhatsApp',
      'Early access to new features',
      'Supports CBC & Cambridge IGCSE',
    ],
    cta: 'Go Premium',
    note: 'For families with more than one child in school.',
  },
]

// ─── Teacher plan features ─────────────────────────────────────────────────────

const TEACHER_FREE_FEATURES = [
  { icon: ClipboardList, text: 'SOW Generator (unlimited)' },
  { icon: Calendar,      text: 'Lesson Plans (auto-weekly)' },
  { icon: FileText,      text: 'Record of Work' },
  { icon: BarChart3,     text: 'Class Dashboard' },
  { icon: Shield,        text: 'TSC Inspection ready' },
  { icon: CheckCircle2,  text: 'CBC + 8-4-4 + IGCSE' },
]

// ─── Pricing content ──────────────────────────────────────────────────────────

function PricingContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  // audienceTab fixed to 'parents' — floating bar depends on this
  const audienceTab = 'parents' as const

  const [selected,      setSelected]      = useState<any>(PRODUCTS[1])
  const [phone,         setPhone]         = useState('')
  const [user,          setUser]          = useState<any>(null)
  const [loading,       setLoading]       = useState(false)
  const [autoTriggered, setAutoTriggered] = useState(false)
  const [demoOpen,      setDemoOpen]      = useState(false)
  const [kcseDemoOpen,  setKcseDemoOpen]  = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const productId  = searchParams.get('product') || localStorage.getItem('pending_plan')
      const savedPhone = localStorage.getItem('pending_phone')

      if (savedPhone) setPhone(savedPhone)

      if (productId) {
        const found = PRODUCTS.find(p => p.id === productId)
        if (found) {
          setSelected(found)
          if (user && savedPhone && !autoTriggered) {
            setAutoTriggered(true)
            handlePay(found, savedPhone, user.email!)
          }
        }
      }
    }
    init()
  }, [searchParams, autoTriggered])

  const handlePay = async (product: any, phoneNum: string, email: string) => {
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
      const data = await res.json()
      if (data.authorization_url) {
        localStorage.removeItem('pending_plan')
        localStorage.removeItem('pending_phone')
        window.location.href = data.authorization_url
      } else {
        alert(data.error || 'Payment failed. Please try again.')
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
    if (!selected) return
    if (!user) {
      localStorage.setItem('pending_plan', selected.id)
      localStorage.setItem('pending_phone', cleanPhone)
      router.push(`/login?returnTo=/pricing&product=${selected.id}`)
      return
    }
    handlePay(selected, cleanPhone, user.email!)
  }

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length <= 10) setPhone(cleaned)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden pb-40">

      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] bg-violet-600/8 rounded-full blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[800px] h-[800px] bg-amber-600/6 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/3 w-[600px] h-[600px] bg-teal-600/5 rounded-full blur-[100px]" />
      </div>

      {/* M-PESA early access banner */}
      <div className="bg-linear-to-r from-green-700 to-emerald-700 py-3 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-center gap-2 flex-wrap">
          <span className="text-sm font-black tracking-wide text-center">
            💚 Pay via M-PESA today →{' '}
            <Link href="/early-access" className="underline underline-offset-2 hover:text-green-200 transition-colors">
              Join Early Access
            </Link>
            {' '}· Full payments launching soon
          </span>
        </div>
      </div>

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav className="border-b border-white/5 bg-slate-950/70 backdrop-blur-xl sticky top-10 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-linear-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">EduNexus</span>
          </Link>
          <Link
            href="/teacher/dashboard"
            className="text-sm text-teal-400/70 hover:text-teal-400 font-bold transition-colors flex items-center gap-1.5"
          >
            For Teachers →
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-white/50 hover:text-white flex items-center gap-1.5 transition font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Simple, Honest Pricing
          </div>

          <p className="text-white/35 text-base leading-relaxed mb-4 max-w-lg mx-auto italic">
            In a class of 45, your child is just another student.
            <span className="text-white/20"> Not here.</span>
          </p>

          <h1 className="text-6xl md:text-8xl font-black leading-[0.88] tracking-tight mb-6">
            Simple pricing.
          </h1>
          <p className="text-xl md:text-2xl text-white/50 leading-relaxed font-medium max-w-lg mx-auto mb-10">
            Less than one tuition session.<br />
            For an entire term.
          </p>

          {/* Value comparison */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-2xl mx-auto">
            <p className="text-white/60 text-sm leading-relaxed">
              💡 <strong className="text-white/80">Quick comparison:</strong> A private tutor
              in Nairobi costs KES 500–1,500 <em>per session.</em> The Term Plan gives your
              child unlimited personal tutoring across every subject for an entire term —
              for less than 3 tuition sessions.
            </p>
          </div>
        </div>

        {/* ── LEARNING COMPASS ─────────────────────────────────────────────── */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-2 rounded-full text-xs font-black mb-4 uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              Learning Compass
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              A tutor that actually knows your child.
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Not the class average. Your child&apos;s exact level —
              every single session.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              {
                icon: '🎯',
                title: 'Adapts in real time',
                desc: 'Level 1 learner gets broken-down steps. Level 4 gets challenge questions. Never one-size-fits-all.',
              },
              {
                icon: '🧠',
                title: 'Knows your child first',
                desc: 'Compass reads their assessment before session 1. It already knows where they struggle.',
              },
              {
                icon: '❓',
                title: 'Never gives answers',
                desc: 'Asks questions until your child figures it out themselves. That\'s how real learning works.',
              },
              {
                icon: '📚',
                title: 'Every subject',
                desc: 'Mathematics, English, Sciences, Kiswahili — CBC, KCSE, and Cambridge IGCSE.',
              },
              {
                icon: '🌙',
                title: 'Available 24/7',
                desc: 'During term, holidays, weekends. Boarding students use it every evening.',
              },
              {
                icon: '📱',
                title: 'Parent insights',
                desc: 'After every session, you see what was covered and where your child improved.',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-white/5 border border-amber-500/10 rounded-2xl p-5 hover:bg-white/8 transition-all"
              >
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="text-sm font-black text-white mb-1.5">{item.title}</h3>
                <p className="text-xs text-white/45 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACADEMIC CLINIC ──────────────────────────────────────────────── */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 px-4 py-2 rounded-full text-xs font-black mb-4 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              Academic Clinic
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              A diagnosis. Not a grade.
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              7 pages. Every subject. Clinical language.
              A 3-week plan built for your child&apos;s specific gaps.
            </p>
          </div>

          {/* Two columns — pathway + career */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10">

            {/* CBC Junior School */}
            <div className="bg-teal-950/30 border border-teal-500/20 rounded-2xl p-7">
              <div className="text-xs font-black text-teal-400 uppercase tracking-wider mb-4">
                CBC · Grade 7–9 · Junior School
              </div>
              <h3 className="text-xl font-black text-white mb-3">
                Senior School Pathway Selection
              </h3>
              <p className="text-sm text-white/50 leading-relaxed mb-5">
                Which pathway fits your child — STEM, Social Sciences,
                or Arts &amp; Sports Science? Based on actual CBC levels,
                not guesswork. Know before Grade 10 selection.
              </p>
              <ul className="space-y-2">
                {[
                  'STEM pathway fit score',
                  'Social Sciences pathway fit score',
                  'Arts & Sports Science fit score',
                  'Recommended pathway with confidence level',
                  'What to strengthen before Grade 10',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-white/60">
                    <span className="text-teal-400/70 font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* KCSE Senior School */}
            <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-7">
              <div className="text-xs font-black text-amber-400 uppercase tracking-wider mb-4">
                8-4-4 · Form 3–4 · Senior School
              </div>
              <h3 className="text-xl font-black text-white mb-3">
                KCSE Career Intelligence
              </h3>
              <p className="text-sm text-white/50 leading-relaxed mb-5">
                What does your child&apos;s current mean grade open up?
                Honest university entry projections. Which subjects
                to fix to reach their target grade.
              </p>
              <ul className="space-y-2">
                {[
                  'Projected KCSE mean grade',
                  'University entry requirements per course',
                  'Which subject gap to close first',
                  '6-week intensive plan to target grade',
                  'Career paths — Kenya market reality',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-white/60">
                    <span className="text-amber-400/70 font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sample report demo buttons */}
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-black text-white/30 uppercase tracking-widest mb-4 text-center">
              See a real sample report
            </p>
            <div className="grid sm:grid-cols-2 gap-4">

              {/* Brian — CBC */}
              <button onClick={() => setDemoOpen(true)} className="group relative text-left">
                <div className="absolute -inset-0.5 bg-linear-to-br from-violet-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition" />
                <div className="relative bg-white/5 border border-violet-500/20 rounded-2xl p-5 hover:bg-white/8 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-500/15 border border-violet-500/25 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black text-violet-300 uppercase tracking-wider mb-0.5">CBC · Grade 8</div>
                      <div className="text-base font-black text-white">Brian Otieno</div>
                      <div className="text-xs text-white/40 mt-0.5">Academic Clinic report →</div>
                    </div>
                  </div>
                </div>
              </button>

              {/* James — KCSE */}
              <button onClick={() => setKcseDemoOpen(true)} className="group relative text-left">
                <div className="absolute -inset-0.5 bg-linear-to-br from-amber-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition" />
                <div className="relative bg-white/5 border border-amber-500/20 rounded-2xl p-5 hover:bg-white/8 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/25 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black text-amber-300 uppercase tracking-wider mb-0.5">8-4-4 · Form 3</div>
                      <div className="text-base font-black text-white">James Kamau</div>
                      <div className="text-xs text-white/40 mt-0.5">KCSE Clinic report →</div>
                    </div>
                  </div>
                </div>
              </button>

            </div>
          </div>
        </div>

        {/* ── PLAN CARDS ───────────────────────────────────────────────────── */}
        <div className="mb-16">
          {/* What you get free */}
          <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm text-white/50">
            {[
              '1 free Learning Compass session on signup',
              '1 free Academic Clinic report on signup',
              'No card needed to start',
            ].map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                {item}
              </span>
            ))}
          </div>

          {/* Early access notice */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-3 bg-violet-500/10 border border-violet-500/20 rounded-2xl px-6 py-4">
              <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse shrink-0" />
              <p className="text-sm text-violet-300 font-bold text-left">
                Early access members lock in launch pricing.
                Price increases once we go fully live.
              </p>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {PRODUCTS.map(product => {
              const Icon       = product.icon
              const isSelected = selected?.id === product.id

              return (
                <div
                  key={product.id}
                  onClick={() => setSelected(product)}
                  className={`relative rounded-3xl cursor-pointer transition-all duration-300 group ${
                    product.highlight ? 'md:-mt-4 md:mb-4' : ''
                  }`}
                >
                  {/* Glow */}
                  <div className={`absolute -inset-0.5 bg-linear-to-br ${product.color} rounded-3xl blur transition-opacity duration-300 ${
                    isSelected ? 'opacity-40' : 'opacity-0 group-hover:opacity-20'
                  }`} />

                  <div className={`relative rounded-3xl p-7 border-2 transition-all duration-300 h-full flex flex-col ${
                    isSelected
                      ? 'bg-white/10 border-white/30'
                      : product.highlight
                      ? 'bg-white/8 border-violet-500/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8'
                  }`}>

                    {/* Badge */}
                    {product.badge && (
                      <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 bg-linear-to-r ${product.color} text-white px-4 py-1 rounded-full text-[11px] font-black tracking-wider shadow-lg whitespace-nowrap`}>
                        {product.badge === 'MOST POPULAR' ? '⭐ ' : '👑 '}{product.badge}
                      </div>
                    )}

                    {/* Icon */}
                    <div className={`w-12 h-12 bg-linear-to-br ${product.color} rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    {/* Name */}
                    <div className="mb-5">
                      <h3 className="text-2xl font-black text-white mb-1">{product.name}</h3>
                      <p className="text-sm text-white/50 leading-snug">{product.tagline}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-white">
                          KES {product.price.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-sm text-white/40">{product.billing}</span>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2.5 mb-6 flex-1">
                      {product.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* Note */}
                    <p className="text-xs text-white/30 mb-5 italic leading-relaxed">
                      {product.note}
                    </p>

                    {/* Select button */}
                    <button
                      onClick={e => { e.stopPropagation(); setSelected(product) }}
                      className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all ${
                        isSelected
                          ? `bg-linear-to-r ${product.color} text-white shadow-xl hover:scale-105`
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {isSelected ? '✓ Selected' : product.cta}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── TEACHER BANNER ───────────────────────────────────────────────── */}
        <div className="bg-linear-to-r from-teal-900/30 to-blue-900/30 border border-teal-500/20 rounded-3xl p-8 mb-12 max-w-2xl mx-auto">
          <div className="text-center mb-5">
            <div className="text-4xl mb-3">👨‍🏫</div>
            <h3 className="text-xl font-black text-white mb-2">Teachers — Always Free</h3>
            <p className="text-white/60 text-sm mb-5 leading-relaxed">
              SOW Generator · Lesson Plans auto-generated every Friday ·
              Record of Work auto-fills · Class Dashboard ·
              TSC Inspection ready · KICD Aligned ·
              CBC, 8-4-4 and Cambridge IGCSE supported
            </p>
          </div>
          <ul className="space-y-2.5 mb-6 max-w-xs mx-auto">
            {TEACHER_FREE_FEATURES.map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-teal-500/10 border border-teal-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <span className="text-white/70 text-sm">{f.text}</span>
              </li>
            ))}
          </ul>
          <div className="text-center">
            <Link
              href="/teacher/dashboard"
              className="inline-flex items-center gap-2 bg-linear-to-r from-teal-500 to-cyan-500 text-white px-6 py-3 rounded-xl font-black hover:scale-105 transition-all text-sm"
            >
              Get Teacher Access →
            </Link>
          </div>
        </div>

        {/* ── TRUST FOOTER ─────────────────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <p className="text-white/30 text-xs font-medium tracking-wide">
            🔒 256-bit SSL • Paystack Gateway • M-PESA supported
          </p>
          <p className="text-white/20 text-xs">
            Tokens never expire • Full refund if not satisfied • Made in Kenya 🇰🇪
          </p>
          <p className="text-white/20 text-xs">
            🚀 Going fully live soon — early members get the best rate
          </p>
          <div className="flex justify-center pt-1">
            <span className="inline-flex items-center gap-1.5 text-white/20 text-xs">
              <Sparkles className="w-4 h-4 text-violet-400" />
              AI-powered learning
            </span>
          </div>
        </div>
      </div>

      {/* ── FLOATING CHECKOUT BAR ────────────────────────────────────────────── */}
      {selected && audienceTab === 'parents' && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 z-[100] animate-in slide-in-from-bottom duration-300 shadow-2xl">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">

              {/* Plan info */}
              <div className="text-center md:text-left">
                <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-0.5">
                  Selected Plan
                </p>
                <div className="flex items-baseline gap-2 justify-center md:justify-start">
                  <h4 className="text-xl font-black text-white">{selected.name}</h4>
                  <span className="text-xl font-black text-violet-400">
                    — KES {selected.price.toLocaleString()}
                  </span>
                  <span className="text-xs text-white/40">{selected.billing}</span>
                </div>
              </div>

              {/* Phone + CTA */}
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                  <input
                    type="tel"
                    placeholder="0712 345 678 (M-PESA)"
                    value={phone}
                    onChange={e => formatPhone(e.target.value)}
                    className="w-full sm:w-64 bg-white/5 border border-white/15 pl-9 pr-4 py-3 rounded-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none font-medium text-white placeholder:text-white/25 text-sm"
                    autoFocus={!!user}
                  />
                </div>
                <button
                  onClick={handleAction}
                  disabled={loading}
                  className="bg-linear-to-r from-violet-500 to-purple-500 text-white px-8 py-3 rounded-xl font-black hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-violet-500/20 text-sm whitespace-nowrap"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4" />
                      {user
                        ? `Book Spot — KES ${selected.price.toLocaleString()}`
                        : 'Login to Book'}
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-center text-white/25 mt-2">
              🔒 Your spot is secured at launch pricing. M-PESA activates on full launch.
            </p>
          </div>
        </div>
      )}

      {/* ── DEMO MODALS ──────────────────────────────────────────────────────── */}
      <AcademicClinicDemo isOpen={demoOpen}     onClose={() => setDemoOpen(false)}     />
      <KcseClinicDemo     isOpen={kcseDemoOpen} onClose={() => setKcseDemoOpen(false)} />
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    }>
      <PricingContent />
    </Suspense>
  )
}
