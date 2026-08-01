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
  ArrowRight,
  BarChart3,
  Users,
  BookOpen,
  Target,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { FOCUS_RING, SCHOOL_DEMO_WA_LINK } from '../constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'school' | 'teacher' | 'family'

type PayProduct = {
  id:        string
  name:      string
  price:     number
  billing:   string
  tagline:   string
  badge:     string
  highlight: boolean
  features:  string[]
  cta:       string
  note:      string
}

type FAQItem = { q: string; a: string }

// ─── School plans ─────────────────────────────────────────────────────────────

const SCHOOL_PLANS = [
  {
    id:         'school_starter',
    name:       'Starter',
    learners:   'Up to 120 learners',
    price:      25000,
    perLearner: 208,
    billing:    'per term',
    tagline:    'The full EduNexus platform for a growing school.',
    badge:      '',
    highlight:  false,
    includes: [
      'School Intelligence Dashboard',
      'Teacher Pro for all teachers — automatic',
      'Learning Compass for every learner',
      'Learner Blueprint every term',
      'Career Intelligence built in',
      'Parent Pulse — weekly reports',
      'Strand Health & Intervention Tracking',
      'Guided onboarding included',
    ],
    cta:  'Book a Demo',
    note: '≈ KES 208 per learner per term.',
  },
  {
    id:         'school_growth',
    name:       'Growth',
    learners:   'Up to 350 learners',
    price:      45000,
    perLearner: 129,
    billing:    'per term',
    tagline:    'Learning intelligence across every classroom, every week.',
    badge:      'Most popular',
    highlight:  true,
    includes: [
      'Everything in Starter',
      'Priority onboarding & teacher training',
      'Data import assistance',
      'Dedicated WhatsApp support line',
      'Multi-stream cohort analytics',
      'Quarterly intelligence review',
    ],
    cta:  'Book a Demo',
    note: '≈ KES 129 per learner per term.',
  },
  {
    id:         'school_institution',
    name:       'Institution',
    learners:   '350+ learners',
    price:      0,
    perLearner: 0,
    billing:    'custom pricing',
    tagline:    'A tailored implementation for large schools and school groups.',
    badge:      '',
    highlight:  false,
    includes: [
      'Everything in Growth',
      'School group / network pricing',
      'Custom integrations',
      'Full data migration',
      'Dedicated account manager',
      'Onsite teacher training sessions',
    ],
    cta:  'Contact Us',
    note: 'Starting from KES 80,000/term. Priced on learner count.',
  },
]

// ─── Teacher products ─────────────────────────────────────────────────────────

const TEACHER_WALLET_COSTS = [
  {
    action: 'Planning Bundle',
    detail: 'SOW + Lesson Plans + Record of Work — one subject, full term',
    kes:    100,
    color:  'text-amber-400',
  },
  {
    action: 'AI Slides',
    detail: 'Full presentation deck for any lesson',
    kes:    50,
    color:  'text-violet-400',
  },
  {
    action: 'Remedial Planner',
    detail: 'Differentiated class intervention plan',
    kes:    50,
    color:  'text-teal-400',
  },
  {
    action: 'Holiday Study Plan',
    detail: 'Per-student holiday plan',
    kes:    30,
    color:  'text-green-400',
  },
]

const TEACHER_WALLET_PRODUCT: PayProduct = {
  id:        'wallet_topup',
  name:      'Wallet Top-up',
  price:     100,
  billing:   'minimum · never expires',
  tagline:   'Top up from KES 100.',
  badge:     '',
  highlight: false,
  features:  [],
  cta:       '',
  note:      '',
}

const TEACHER_PAY_PLANS: PayProduct[] = [
  {
    id:        'term_pack',
    name:      'Term Planning Pack',
    price:     1499,
    billing:   'per term · one-time',
    tagline:   'Complete planning for the full term — all your subjects.',
    badge:     '',
    highlight: false,
    features: [
      'Planning Bundle for all your subjects\n(SOW + Lesson Plans + Record of Work)',
      'CBC-aligned, TSC inspection ready',
      'PDF downloads — all documents',
      'No subscription required',
    ],
    cta:  'Get Term Pack — KES 1,499',
    note: 'One payment covers the whole term across all subjects.',
  },
  {
    id:        'teacher_pro',
    name:      'Teacher Pro',
    price:     2499,
    billing:   'per term',
    tagline:   'Unlimited planning, analytics, and teaching intelligence.',
    badge:     'Best for active teachers',
    highlight: true,
    features: [
      'Unlimited Planning Bundles — all subjects, all term',
      'Monday Panel — weekly class readiness',
      'Class Analytics & Cohort Insights',
      'AI Slides — unlimited presentations',
      'Remedial Planner — differentiated support',
      'Holiday Plans for every student',
      'Kiswahili Insha evaluation',
      'Advanced student reporting',
      'Priority support',
    ],
    cta:  'Start Teacher Pro — KES 2,499',
    note: 'If your school is on EduNexus, Teacher Pro is included automatically.',
  },
]

// ─── Family products ──────────────────────────────────────────────────────────

const FAMILY_PAY_PLANS: PayProduct[] = [
  {
    id:        'term',
    name:      'Term Plan',
    price:     2499,
    billing:   'per term',
    tagline:   'Everything your child needs this term — unlimited.',
    badge:     'Most popular',
    highlight: true,
    features: [
      'Unlimited Learning Compass sessions\n(KES 0 per session — subscribers pay nothing per use)',
      'Unlimited Learner Blueprint reports\n(career intelligence included)',
      '1 child · all subjects · CBC + IGCSE + 8-4-4',
      'Weekly parent activity summary',
      'Teacher connection + instant alerts',
      'PDF report downloads',
    ],
    cta:  'Start Term Plan — KES 2,499',
    note: 'Start with a free report — upgrade when ready.',
  },
  {
    id:        'family',
    name:      'Family Plan',
    price:     4499,
    billing:   'per term',
    tagline:   'More than one child? This is the smarter plan.',
    badge:     'Best value',
    highlight: false,
    features: [
      'Everything in Term Plan',
      'Up to 3 children — all subjects, all term',
      'Family performance overview dashboard',
      'Priority WhatsApp support',
    ],
    cta:  'Start Family Plan — KES 4,499',
    note: '3 × KES 2,499 = KES 7,497 separately. You save KES 2,998.',
  },
]

// Token count and KES/token below must match lib/payments/config.ts's
// TOKEN_PACK — that file is the canonical source (per CLAUDE.md), and the
// API route that actually charges this purchase (app/api/payments/initialize)
// reads TOKEN_PACK directly. This page previously said "5 tokens" while the
// real purchase granted 10 — found and fixed 2026-08-01.
const TOKEN_PRODUCT: PayProduct = {
  id:        'starter',
  name:      'Pay-As-You-Go',
  price:     500,
  billing:   'one-time · never expires',
  tagline:   'Not ready to commit? Start with 10 tokens.',
  badge:     '',
  highlight: false,
  features:  [],
  cta:       'Buy 10 Tokens — KES 500',
  note:      '',
}

const ALL_FAMILY_PRODUCTS = [TOKEN_PRODUCT, ...FAMILY_PAY_PLANS]

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS: FAQItem[] = [
  {
    q: 'What does a school subscription include for teachers?',
    a: 'Every teacher at a school on EduNexus receives Teacher Pro automatically — unlimited planning bundles, analytics, AI slides, remedial planning, and everything else. Teachers never pay separately when their school is subscribed.',
  },
  {
    q: 'What is the Planning Bundle exactly?',
    a: 'One Planning Bundle = one Scheme of Work + all lesson plans for the full term + the Record of Work — for one subject. When you generate it, KES 100 is deducted from your wallet. A teacher with 3 subjects uses 3 bundles (KES 300). Teacher Pro gives unlimited bundles at no extra cost per bundle.',
  },
  {
    q: 'What is the first free SOW?',
    a: 'Every teacher gets one Scheme of Work free on first use — no card, no wallet needed. This lets you see exactly what EduNexus produces before deciding to continue. After that, your wallet needs KES 100 to generate the next one.',
  },
  {
    q: 'How does the teacher wallet work?',
    a: 'Your wallet holds KES credit. When you generate a planning bundle, KES 100 is automatically deducted. If your wallet is empty, you\'re prompted to top up. You can add as little as KES 100 (just enough for one bundle) or top up more for convenience. Credit never expires.',
  },
  {
    q: 'Which curriculum does EduNexus support?',
    a: 'CBC (Grade 7–12), Cambridge IGCSE, and 8-4-4. Each learner\'s curriculum is set individually at setup.',
  },
  {
    q: 'Can parents use EduNexus even if their school hasn\'t joined?',
    a: 'Yes. Parents subscribe independently using the Family plan and access the Learning Compass, Learner Blueprint, and Career Intelligence. When a school joins later, the learner\'s profile links automatically.',
  },
  {
    q: 'What is the minimum school commitment?',
    a: 'One term. We recommend starting with a pilot term — one grade or one stream — to see the intelligence in action before scaling to the full school.',
  },
  {
    q: 'How does school onboarding work?',
    a: 'Starter schools receive guided self-serve onboarding. Growth schools receive a setup session, teacher training, and data import support. Institution plans include full implementation management.',
  },
  {
    q: 'How does payment work?',
    a: 'M-PESA via Paystack for individual teachers and families. School subscriptions are invoiced directly — contact us for a quote.',
  },
  {
    q: 'Is career guidance extra?',
    a: 'No. Career Intelligence is built into every Learner Blueprint at no extra cost — for families, for schools, and for every learner.',
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
            className={`w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/5 transition-colors ${FOCUS_RING}`}
          >
            <span className="font-bold text-white text-sm pr-6 leading-snug">{item.q}</span>
            <ChevronDown
              className={`w-4 h-4 text-white/50 shrink-0 transition-transform duration-200 ${
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

// ─── School Section ───────────────────────────────────────────────────────────

function SchoolSection() {
  return (
    <div className="pb-32">

      <div className="text-center pt-16 pb-14">
        <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-3">School Edition</p>
        <h2
          className="font-black leading-tight tracking-tight mb-5 text-white"
          style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}
        >
          Learning intelligence<br />for your entire school.
        </h2>
        <p className="text-lg text-white/50 max-w-120 mx-auto leading-relaxed">
          From KES 129 per learner per term — every teacher, every learner,
          every classroom, one platform.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto mb-16">
        {SCHOOL_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-3xl flex flex-col border-2 p-7 transition-all ${
              plan.highlight
                ? 'bg-slate-900 border-blue-500/50 md:mt-0'
                : 'bg-white/4 border-white/10 hover:border-white/20'
            }`}
          >
            {plan.highlight && (
              <div className="absolute -inset-px bg-linear-to-b from-blue-500/25 to-blue-500/5 rounded-3xl blur-sm opacity-60 pointer-events-none" />
            )}
            {plan.badge && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                <span className="px-4 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase bg-blue-500 text-white shadow-lg shadow-blue-500/30 whitespace-nowrap">
                  {plan.badge}
                </span>
              </div>
            )}

            <div className="relative flex flex-col flex-1">
              {plan.badge && <div className="h-4" />}

              <div className="mb-4 mt-0">
                <h3 className="text-2xl font-black text-white">{plan.name}</h3>
                <p className="text-xs font-bold text-blue-400 mt-1">{plan.learners}</p>
                <p className="text-sm text-white/40 mt-1 leading-snug">{plan.tagline}</p>
              </div>

              <div className="mb-6">
                {plan.price > 0 ? (
                  <>
                    <span className="text-4xl font-black text-white tracking-tight">
                      KES {plan.price.toLocaleString()}
                    </span>
                    <p className="text-xs text-white/35 mt-0.5">{plan.billing}</p>
                    <p className="text-[11px] text-blue-400/80 mt-1 font-semibold">
                      ≈ KES {plan.perLearner}/learner/term
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-black text-white">Custom pricing</span>
                    <p className="text-xs text-white/35 mt-0.5">{plan.billing}</p>
                  </>
                )}
              </div>

              <ul className="space-y-3 flex-1 mb-6">
                {plan.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/60 leading-snug">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        plan.highlight ? 'text-blue-400' : 'text-green-400'
                      }`}
                    />
                    {item}
                  </li>
                ))}
              </ul>

              <p className="text-xs text-white/50 italic mb-5">{plan.note}</p>

              <a
                href={SCHOOL_DEMO_WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className={`block text-center py-4 rounded-2xl font-black text-sm transition-all ${FOCUS_RING} ${
                  plan.highlight
                    ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-white/8 hover:bg-white/14 text-white'
                }`}
              >
                {plan.cta} →
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* What every school gets */}
      <div className="max-w-5xl mx-auto mb-16">
        <h3 className="text-xl font-black text-white text-center mb-8">What every school gets</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[
            {
              icon:  <BarChart3 className="w-5 h-5" />,
              color: 'text-blue-400',
              bg:    'bg-blue-500/10',
              title: 'School Intelligence Dashboard',
              body:  'Live view of learning across every class, every subject, every week — for the principal.',
            },
            {
              icon:  <Users className="w-5 h-5" />,
              color: 'text-amber-400',
              bg:    'bg-amber-500/10',
              title: 'Teacher Pro — all teachers',
              body:  'Every teacher gets unlimited planning, analytics, AI slides, and all tools. Automatically included.',
            },
            {
              icon:  <BookOpen className="w-5 h-5" />,
              color: 'text-teal-400',
              bg:    'bg-teal-500/10',
              title: 'Learning Compass — every learner',
              body:  'Personalised adaptive sessions for every learner, every subject, at their exact level.',
            },
            {
              icon:  <Sparkles className="w-5 h-5" />,
              color: 'text-violet-400',
              bg:    'bg-violet-500/10',
              title: 'Learner Blueprint — every term',
              body:  'Strand-by-strand intelligence profile per learner. Visible to teacher, parent, and school.',
            },
            {
              icon:  <Target className="w-5 h-5" />,
              color: 'text-pink-400',
              bg:    'bg-pink-500/10',
              title: 'Career Intelligence — from Grade 7',
              body:  'Career readiness built continuously from classroom data. No extra tool. No extra cost.',
            },
            {
              icon:  <Zap className="w-5 h-5" />,
              color: 'text-green-400',
              bg:    'bg-green-500/10',
              title: 'Parent Pulse — every family',
              body:  'Weekly intelligence reports to every parent. Automatic, personalised, zero teacher effort.',
            },
          ].map((cap) => (
            <div key={cap.title} className="bg-white/4 border border-white/8 rounded-2xl p-5">
              <div className={`${cap.bg} ${cap.color} w-9 h-9 rounded-xl flex items-center justify-center mb-4`}>
                {cap.icon}
              </div>
              <h4 className="text-sm font-black text-white mb-1.5">{cap.title}</h4>
              <p className="text-xs text-white/40 leading-relaxed">{cap.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How onboarding works */}
      <div className="max-w-2xl mx-auto bg-white/4 border border-white/8 rounded-2xl p-7 text-center">
        <p className="font-black text-white mb-2">We diagnose before we recommend.</p>
        <p className="text-sm text-white/50 leading-relaxed">
          EduNexus sells through educational consultation, not price negotiation. We understand your
          school first — learner count, curriculum, current systems, reporting needs — then recommend
          the right plan. Onboarding, teacher training, and data setup are included from Growth and above.
        </p>
        <a
          href={SCHOOL_DEMO_WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 mt-5 bg-blue-500 hover:bg-blue-400 text-white px-7 py-3 rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-500/20 ${FOCUS_RING}`}
        >
          Book a 20-minute School Demo <ArrowRight className="w-4 h-4" />
        </a>
      </div>

    </div>
  )
}

// ─── Teacher Section ──────────────────────────────────────────────────────────

function TeacherSection({
  selected,
  onSelect,
}: {
  selected:  PayProduct
  onSelect:  (p: PayProduct) => void
}) {
  return (
    <div className="pb-36">

      <div className="text-center pt-16 pb-14">
        <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest mb-3">Teacher Edition</p>
        <h2
          className="font-black leading-tight tracking-tight mb-5 text-white"
          style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}
        >
          Your first Scheme of Work<br />is on us.
        </h2>
        <p className="text-lg text-white/50 max-w-120 mx-auto leading-relaxed">
          Start planning in minutes. Experience EduNexus before deciding.
          No card. No commitment.
        </p>
        <Link
          href="/signup?role=teacher"
          className={`inline-flex items-center gap-2 mt-6 bg-amber-500 hover:bg-amber-400 text-white px-8 py-3.5 rounded-xl font-black text-sm transition-all shadow-lg shadow-amber-500/20 ${FOCUS_RING}`}
        >
          Generate My First SOW — Free <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-xs text-white/50 mt-3">After that, choose how you continue below.</p>
      </div>

      {/* Wallet model */}
      <div className="max-w-3xl mx-auto mb-14">

        {/* How the wallet works */}
        <div className="bg-amber-500/6 border border-amber-500/20 rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex-1">
              <p className="text-sm font-black text-amber-400 mb-1">How it works</p>
              <p className="text-sm text-white/60 leading-relaxed">
                Every teacher has a wallet. When you generate a planning bundle, <strong className="text-white">KES 100 is deducted</strong> automatically.
                If your wallet is at KES 0, you&apos;ll be prompted to top up — you can add exactly KES 100
                for that one scheme, or keep more for convenience.
              </p>
            </div>
            <div className="shrink-0 text-center bg-white/5 border border-white/10 rounded-xl px-5 py-4">
              <p className="text-3xl font-black text-amber-400 leading-none">KES 100</p>
              <p className="text-xs text-white/40 mt-1.5 font-semibold">per planning bundle</p>
              <p className="text-[10px] text-white/50 mt-0.5">SOW + Lesson Plans + ROW</p>
            </div>
          </div>
        </div>

        {/* What gets deducted */}
        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Wallet deductions</h3>
        <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden mb-4">
          <div className="grid grid-cols-3 px-5 py-3 border-b border-white/8 text-[10px] font-black uppercase tracking-widest text-white/50">
            <span className="col-span-2">Action</span>
            <span className="text-right">Deducted</span>
          </div>
          {TEACHER_WALLET_COSTS.map((row) => (
            <div key={row.action} className="grid grid-cols-3 px-5 py-4 border-b border-white/5 last:border-0 items-start">
              <div className="col-span-2">
                <span className={`text-sm font-bold ${row.color}`}>{row.action}</span>
                <p className="text-xs text-white/35 mt-0.5 leading-snug">{row.detail}</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-white">KES {row.kes}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Top-up selector */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { amount: 100,  label: '1 bundle',   sub: 'Just this scheme',      id: 'wallet_100'  },
            { amount: 500,  label: '5 bundles',  sub: 'Full term, 5 subjects', id: 'wallet_500'  },
            { amount: 1000, label: '10 bundles', sub: 'Comfortable balance',   id: 'wallet_1000' },
          ].map((opt) => (
            <button
              key={opt.amount}
              onClick={() => onSelect({ ...TEACHER_WALLET_PRODUCT, id: opt.id, price: opt.amount, billing: 'wallet top-up' })}
              className={`bg-white/4 border rounded-xl p-4 text-center transition-all cursor-pointer hover:border-amber-500/40 ${FOCUS_RING} ${
                selected.id === opt.id ? 'border-amber-500/60 bg-amber-500/8' : 'border-white/10'
              }`}
            >
              <p className="text-xl font-black text-white leading-none">KES {opt.amount.toLocaleString()}</p>
              <p className={`text-xs font-bold mt-1.5 ${selected.id === opt.id ? 'text-amber-400' : 'text-amber-400/60'}`}>{opt.label}</p>
              <p className="text-[10px] text-white/50 mt-0.5 leading-tight">{opt.sub}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-white/50 text-center">Wallet credit never expires · Top up any time · Pay just what you need</p>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto mb-14">
        {TEACHER_PAY_PLANS.map((plan) => (
          <div
            key={plan.id}
            onClick={() => onSelect(plan)}
            className={`relative rounded-3xl flex flex-col border-2 p-7 cursor-pointer transition-all ${
              plan.highlight
                ? 'bg-slate-900 border-amber-500/50'
                : selected.id === plan.id
                ? 'bg-white/8 border-white/25'
                : 'bg-white/4 border-white/10 hover:border-white/20'
            }`}
          >
            {plan.highlight && (
              <div className="absolute -inset-px bg-linear-to-b from-amber-500/20 to-amber-500/5 rounded-3xl blur-sm opacity-60 pointer-events-none" />
            )}

            <div className="relative flex flex-col flex-1">
              {plan.badge && (
                <span className={`self-start px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-4 ${
                  plan.highlight ? 'bg-amber-500 text-white' : 'bg-white/10 text-white/50 border border-white/10'
                }`}>
                  {plan.badge}
                </span>
              )}

              <h3 className="text-xl font-black text-white mb-1">{plan.name}</h3>
              <p className="text-sm text-white/40 mb-5 leading-snug">{plan.tagline}</p>

              <div className="mb-6">
                <span className="text-4xl font-black text-white tracking-tight">
                  KES {plan.price.toLocaleString()}
                </span>
                <p className="text-xs text-white/35 mt-0.5">{plan.billing}</p>
              </div>

              <ul className="space-y-3 flex-1 mb-5">
                {plan.features.map((feature) => {
                  const [main, sub] = feature.split('\n')
                  return (
                    <li key={main} className="flex items-start gap-2.5 text-sm leading-snug">
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-amber-400' : 'text-green-400'}`} />
                      <span>
                        <span className="text-white/75">{main}</span>
                        {sub && <span className="block text-white/35 text-xs mt-0.5">{sub}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>

              <p className="text-xs text-white/50 italic mb-5">{plan.note}</p>

              <button
                onClick={(e) => { e.stopPropagation(); onSelect(plan) }}
                className={`w-full py-4 rounded-2xl font-black text-sm transition-all ${FOCUS_RING} ${
                  selected.id === plan.id
                    ? plan.highlight
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-400'
                      : 'bg-white text-slate-900 shadow-lg hover:bg-white/90'
                    : 'bg-white/8 text-white/70 hover:bg-white/14 hover:text-white'
                }`}
              >
                {selected.id === plan.id ? '✓ Selected — enter M-PESA number below ↓' : plan.cta}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* School nudge */}
      <div className="max-w-2xl mx-auto bg-amber-500/5 border border-amber-500/15 rounded-2xl px-8 py-6 text-center">
        <p className="text-sm font-black text-amber-400 mb-1">Teaching at a school?</p>
        <p className="text-sm text-white/50 leading-relaxed">
          When your school adopts EduNexus, Teacher Pro is unlocked automatically — at no cost to you.
        </p>
        <a
          href={SCHOOL_DEMO_WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 mt-4 text-amber-400 hover:text-amber-300 font-bold text-sm transition-colors rounded ${FOCUS_RING}`}
        >
          Tell your school about EduNexus →
        </a>
      </div>

    </div>
  )
}

// ─── Family Section ───────────────────────────────────────────────────────────

function FamilySection({
  selected,
  onSelect,
}: {
  selected: PayProduct
  onSelect: (p: PayProduct) => void
}) {
  return (
    <div className="pb-36">

      <div className="text-center pt-16 pb-14">
        <p className="text-[11px] font-black text-violet-400 uppercase tracking-widest mb-3">Family Edition</p>
        <h2
          className="font-black leading-tight tracking-tight mb-5 text-white"
          style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}
        >
          Your child deserves<br />more than a mark.
        </h2>
        <p className="text-lg text-white/50 max-w-120 mx-auto leading-relaxed">
          The Learner Blueprint shows exactly which strands are holding your child back.
          The Learning Compass fills the gaps — anytime, any subject.
        </p>
      </div>

      {/* Value comparison */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14 max-w-120 mx-auto">
        <div className="w-full sm:flex-1 bg-white/4 border border-white/10 rounded-2xl px-6 py-6 text-center">
          <p className="text-[11px] font-black text-white/50 uppercase tracking-widest mb-3">5 remedial teachers</p>
          <p className="text-3xl font-black text-white/40">KES 15,000<span className="text-base font-bold text-white/20">+</span></p>
          <p className="text-xs text-white/20 mt-2 leading-relaxed">per month · one subject each<br/>different teaching styles · no shared picture</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-white/50">vs</span>
        </div>
        <div className="w-full sm:flex-1 bg-teal-500/8 border-2 border-teal-500/35 rounded-2xl px-6 py-6 text-center">
          <p className="text-[11px] font-black text-teal-400 uppercase tracking-widest mb-3">EduNexus term plan</p>
          <p className="text-3xl font-black text-teal-300">KES 2,499</p>
          <p className="text-xs text-teal-400/60 mt-2 leading-relaxed">per term · every subject<br/>works with your child's own teacher</p>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid sm:grid-cols-2 gap-5 mb-16 max-w-3xl mx-auto">
        {FAMILY_PAY_PLANS.map((product) => (
          <div
            key={product.id}
            onClick={() => onSelect(product)}
            className={`relative rounded-3xl cursor-pointer transition-all ${
              product.highlight ? 'sm:-mt-5 sm:mb-5' : ''
            }`}
          >
            {product.highlight && (
              <div className="absolute -inset-px bg-linear-to-b from-teal-500/50 to-cyan-500/20 rounded-3xl blur-sm opacity-60 pointer-events-none" />
            )}
            <div
              className={`relative flex flex-col h-full rounded-3xl border-2 p-7 transition-all ${
                product.highlight
                  ? 'bg-slate-900 border-teal-500/60'
                  : selected.id === product.id
                  ? 'bg-white/8 border-white/25'
                  : 'bg-white/4 border-white/10 hover:border-white/20'
              }`}
            >
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

              <div className="mt-4 mb-5">
                <h3 className="text-2xl font-black text-white">{product.name}</h3>
                <p className="text-sm text-white/45 mt-1 leading-snug">{product.tagline}</p>
              </div>

              <div className="mb-7">
                <span className="text-4xl font-black text-white tracking-tight">
                  KES {product.price.toLocaleString()}
                </span>
                <p className="text-sm text-white/35 mt-0.5">{product.billing}</p>
              </div>

              <ul className="space-y-3.5 flex-1 mb-6">
                {product.features.map((feature) => {
                  const [main, sub] = feature.split('\n')
                  return (
                    <li key={main} className="flex items-start gap-3">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          product.highlight ? 'text-teal-400' : 'text-green-400'
                        }`}
                      />
                      <span className="text-sm leading-snug">
                        <span className="text-white/80">{main}</span>
                        {sub && <span className="block text-white/35 text-xs mt-0.5">{sub}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>

              <p className="text-xs text-white/50 mb-5 italic">{product.note}</p>

              <button
                onClick={(e) => { e.stopPropagation(); onSelect(product) }}
                className={`w-full py-4 rounded-2xl font-black text-sm transition-all ${FOCUS_RING} ${
                  selected.id === product.id
                    ? product.highlight
                      ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20 hover:bg-teal-400'
                      : 'bg-white text-slate-900 shadow-lg hover:bg-white/90'
                    : 'bg-white/8 text-white/70 hover:bg-white/14 hover:text-white'
                }`}
              >
                {selected.id === product.id ? '✓ Selected — enter M-PESA number below ↓' : product.cta}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pay-per-use, demoted — most families now arrive through a school;
          this is the residual path for a learner with no attached school
          or parent, not the primary offer. */}
      <p className="max-w-3xl mx-auto text-center text-xs text-white/40 mb-14">
        Prefer to pay per report instead of a full term?{' '}
        <button
          onClick={() => onSelect(TOKEN_PRODUCT)}
          className={`underline decoration-white/20 hover:text-white/70 hover:decoration-white/40 transition-colors rounded ${FOCUS_RING}`}
        >
          Start with 10 tokens for KES 500
        </button>
        {' '}(1 token = KES 50, never expires).
      </p>

      {/* School nudge */}
      <div className="max-w-2xl mx-auto bg-white/3 border border-white/8 rounded-2xl px-8 py-5 text-center">
        <p className="text-sm text-white/50 leading-relaxed">
          If your child&apos;s school is on EduNexus, family access is included automatically.{' '}
          <a
            href={SCHOOL_DEMO_WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-violet-400 hover:text-violet-300 font-semibold transition-colors rounded ${FOCUS_RING}`}
          >
            Tell your school about EduNexus →
          </a>
        </p>
      </div>

    </div>
  )
}

// ─── Pricing content ──────────────────────────────────────────────────────────

function PricingContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const [activeTab,     setActiveTab]     = useState<TabId>('school')
  const [familySel,     setFamilySel]     = useState<PayProduct>(FAMILY_PAY_PLANS[0])
  const [teacherSel,    setTeacherSel]    = useState<PayProduct>(TEACHER_WALLET_PRODUCT)
  const [phone,         setPhone]         = useState('')
  const [user,          setUser]          = useState<User | null>(null)
  const [dashboardHref, setDashboardHref] = useState('/')
  const [loading,       setLoading]       = useState(false)
  const [autoTriggered, setAutoTriggered] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authUser.id)
          .single()
        setDashboardHref(profile?.role === 'teacher' ? '/teacher/dashboard' : '/dashboard')
      }

      const productId  = searchParams.get('product') ?? localStorage.getItem('pending_plan')
      const savedPhone = localStorage.getItem('pending_phone')
      const tabParam   = searchParams.get('tab') as TabId | null

      if (tabParam) setActiveTab(tabParam)
      if (savedPhone) setPhone(savedPhone)

      if (productId) {
        const teacherProduct = TEACHER_PAY_PLANS.find(p => p.id === productId)
        const familyProduct  = ALL_FAMILY_PRODUCTS.find(p => p.id === productId)

        if (teacherProduct) {
          setActiveTab('teacher')
          setTeacherSel(teacherProduct)
          if (authUser && savedPhone && !autoTriggered) {
            setAutoTriggered(true)
            void handlePay(teacherProduct, savedPhone, authUser.email ?? '')
          }
        } else if (familyProduct) {
          setActiveTab('family')
          setFamilySel(familyProduct)
          if (authUser && savedPhone && !autoTriggered) {
            setAutoTriggered(true)
            void handlePay(familyProduct, savedPhone, authUser.email ?? '')
          }
        }
      }
    }
    void init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, autoTriggered])

  const handlePay = async (product: PayProduct, phoneNum: string, email: string) => {
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

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length <= 10) setPhone(cleaned)
  }

  const handleFamilyPay = () => {
    const clean = phone.replace(/\D/g, '')
    if (clean.length !== 10 && clean.length !== 9) {
      alert('Please enter a valid M-PESA number (e.g., 0712345678)')
      return
    }
    if (!user) {
      localStorage.setItem('pending_plan',  familySel.id)
      localStorage.setItem('pending_phone', clean)
      router.push(`/login?returnTo=/pricing?tab=family&product=${familySel.id}`)
      return
    }
    void handlePay(familySel, clean, user.email ?? '')
  }

  const handleTeacherPay = () => {
    const clean = phone.replace(/\D/g, '')
    if (clean.length !== 10 && clean.length !== 9) {
      alert('Please enter a valid M-PESA number (e.g., 0712345678)')
      return
    }
    if (!user) {
      localStorage.setItem('pending_plan',  teacherSel.id)
      localStorage.setItem('pending_phone', clean)
      router.push(`/login?returnTo=/pricing?tab=teacher&product=${teacherSel.id}`)
      return
    }
    void handlePay(teacherSel, clean, user.email ?? '')
  }

  const TABS: { id: TabId; label: string; emoji: string }[] = [
    { id: 'school',  label: 'For Schools',  emoji: '🏫' },
    { id: 'teacher', label: 'For Teachers', emoji: '👨‍🏫' },
    { id: 'family',  label: 'For Families', emoji: '👨‍👩‍👧' },
  ]

  return (
    <div data-page="pricing" className="min-h-screen bg-slate-950 text-white overflow-hidden">

      {/* Ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-1/3 -left-1/4 w-175 h-175 bg-blue-600/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 -right-1/4 w-150 h-150 bg-violet-600/4 rounded-full blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className={`flex items-center gap-2.5 group rounded ${FOCUS_RING}`}>
            <div className="w-9 h-9 bg-linear-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">EduNexus</span>
          </Link>
          <Link
            href={dashboardHref}
            className={`text-sm text-white/45 hover:text-white flex items-center gap-1.5 transition-colors font-bold rounded ${FOCUS_RING}`}
          >
            <ArrowLeft className="w-4 h-4" />
            {user ? 'Dashboard' : 'Home'}
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6">

        {/* Tab switcher */}
        <div className="flex justify-center pt-12 pb-2">
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${FOCUS_RING} ${
                  activeTab === tab.id
                    ? tab.id === 'school'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                      : tab.id === 'teacher'
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                      : 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <span>{tab.emoji}</span>
                <span className="hidden sm:block">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'school'  && <SchoolSection />}
        {activeTab === 'teacher' && (
          <TeacherSection
            selected={teacherSel}
            onSelect={setTeacherSel}
          />
        )}
        {activeTab === 'family'  && (
          <FamilySection
            selected={familySel}
            onSelect={setFamilySel}
          />
        )}

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl font-black text-white text-center mb-8 tracking-tight">Questions</h2>
          <FAQAccordion />
        </div>

        {/* Trust footer */}
        <div className="text-center pb-8 space-y-1.5">
          <p className="text-white/20 text-xs">🔒 256-bit SSL · Paystack · M-PESA · Made in Kenya 🇰🇪</p>
          <p className="text-white/15 text-xs">Tokens never expire · Full refund if not satisfied</p>
        </div>

      </div>

      {/* ── FLOATING BARS ──────────────────────────────────────────────────────── */}

      {/* School */}
      {activeTab === 'school' && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/97 backdrop-blur-xl border-t border-white/8 z-50 shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 text-center sm:text-left">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">School Edition</p>
              <p className="text-sm text-white/65">
                From KES 129 per learner per term · Teacher Pro included for all teachers
              </p>
            </div>
            <a
              href={SCHOOL_DEMO_WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-8 py-3 rounded-xl font-black text-sm transition-all whitespace-nowrap shadow-lg shadow-blue-500/20 ${FOCUS_RING}`}
            >
              Book a School Demo <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Teacher */}
      {activeTab === 'teacher' && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/97 backdrop-blur-xl border-t border-white/8 z-50 shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-full sm:w-auto text-center sm:text-left sm:pr-4 sm:border-r sm:border-white/10 shrink-0">
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none mb-1">
                  {TEACHER_PAY_PLANS.some(p => p.id === teacherSel.id)
                    ? teacherSel.name
                    : 'Wallet top-up'
                  }
                </p>
                <p className="text-xl font-black text-white leading-none">
                  KES {teacherSel.price.toLocaleString()}
                  <span className="text-xs font-medium text-white/35 ml-1.5">{teacherSel.billing}</span>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
                <div className="relative flex-1">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 w-4 h-4 pointer-events-none" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="0712 345 678 (M-PESA)"
                    value={phone}
                    onChange={e => formatPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/12 pl-9 pr-4 py-3 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none font-medium text-white placeholder:text-white/20 text-sm"
                  />
                </div>
                <button
                  onClick={handleTeacherPay}
                  disabled={loading}
                  className={`bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-black transition-colors flex items-center justify-center gap-2 text-sm whitespace-nowrap shadow-lg shadow-amber-500/20 ${FOCUS_RING}`}
                >
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Smartphone className="w-4 h-4" /> Pay with M-PESA</>
                  }
                </button>
              </div>
            </div>
            <p className="text-[10px] text-white/20 text-center sm:text-left mt-1.5 sm:pl-0">
              Or generate your first SOW free — no payment needed
            </p>
          </div>
        </div>
      )}

      {/* Family */}
      {activeTab === 'family' && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/97 backdrop-blur-xl border-t border-white/8 z-50 shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-full sm:w-auto text-center sm:text-left sm:pr-4 sm:border-r sm:border-white/10 shrink-0">
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none mb-1">
                  {familySel.name}
                </p>
                <p className="text-xl font-black text-white leading-none">
                  KES {familySel.price.toLocaleString()}
                  <span className="text-xs font-medium text-white/35 ml-1.5">{familySel.billing}</span>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
                <div className="relative flex-1">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 w-4 h-4 pointer-events-none" />
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
                  onClick={handleFamilyPay}
                  disabled={loading}
                  className={`bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-black transition-colors flex items-center justify-center gap-2 text-sm whitespace-nowrap shadow-lg shadow-teal-500/20 ${FOCUS_RING}`}
                >
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Smartphone className="w-4 h-4" /> Pay with M-PESA</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
