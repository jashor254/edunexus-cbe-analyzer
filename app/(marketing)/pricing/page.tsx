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
import { SUBSCRIPTION_PLANS, TEACHER_PLANNING_BUNDLE } from '@/lib/payments/config'

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

// Schools are not sold a shelf price. Every school is quoted after a
// conversation about learner count, curriculum, current systems and reporting
// needs — so these describe what a school receives at each size, and the CTA
// starts that conversation. No school id here is ever passed to a payment
// endpoint; they exist only as React keys.
const SCHOOL_PLANS = [
  {
    id:        'school_starter',
    name:      'Starter',
    learners:  'Up to 120 learners',
    billing:   'quoted per term',
    tagline:   'The full EduNexus platform for a growing school.',
    badge:     '',
    highlight: false,
    includes: [
      'School Intelligence Dashboard',
      'Teacher tools for every teacher — automatic',
      'Learning Compass for every learner',
      'Learner Blueprint every term',
      'Career Intelligence built in',
      'Parent Pulse — weekly reports',
      'Strand Health & Intervention Tracking',
      'Guided onboarding included',
    ],
    cta:  'Book a Demo',
    note: 'Quoted on your learner count after a short consultation.',
  },
  {
    id:        'school_growth',
    name:      'Growth',
    learners:  'Up to 350 learners',
    billing:   'quoted per term',
    tagline:   'Learning intelligence across every classroom, every week.',
    badge:     'Most popular',
    highlight: true,
    includes: [
      'Everything in Starter',
      'Priority onboarding & teacher training',
      'Data import assistance',
      'Dedicated WhatsApp support line',
      'Multi-stream cohort analytics',
      'Quarterly intelligence review',
    ],
    cta:  'Book a Demo',
    note: 'Quoted on your learner count after a short consultation.',
  },
  {
    id:        'school_institution',
    name:      'Institution',
    learners:  '350+ learners',
    billing:   'quoted per term',
    tagline:   'A tailored implementation for large schools and school groups.',
    badge:     '',
    highlight: false,
    includes: [
      'Everything in Growth',
      'School group / network pricing',
      'Custom integrations',
      'Full data migration',
      'Dedicated account manager',
      'Onsite teacher training sessions',
    ],
    cta:  'Contact Us',
    note: 'Scoped and quoted with you — school groups and networks included.',
  },
]

// ─── Teacher products ─────────────────────────────────────────────────────────

// The single teacher product. Its price and id come from lib/payments/config.ts
// so this card cannot drift from what the server will actually charge.
const TEACHER_PLANNING_PRODUCT: PayProduct = {
  id:        TEACHER_PLANNING_BUNDLE.id,
  name:      TEACHER_PLANNING_BUNDLE.name,
  price:     TEACHER_PLANNING_BUNDLE.priceKes,
  billing:   'one subject · one term',
  tagline:   'Everything you need to teach one subject for a whole term.',
  badge:     '',
  highlight: true,
  features: [
    'Scheme of Work for the full term',
    'Every lesson plan in that scheme\n(generated week by week, as you teach)',
    'Record of Work — kept up to date for you',
    'CBC-aligned, TSC inspection ready',
    'PDF downloads for all three',
  ],
  cta:  `Get the Planning Bundle — KES ${TEACHER_PLANNING_BUNDLE.priceKes}`,
  note: 'One subject, one term. Teaching three subjects? That is three bundles.',
}

const TEACHER_PAY_PLANS: PayProduct[] = [TEACHER_PLANNING_PRODUCT]

// ─── Family products ──────────────────────────────────────────────────────────

const FAMILY_PAY_PLANS: PayProduct[] = [
  {
    id:        SUBSCRIPTION_PLANS.TERMLY_SINGLE.id,
    name:      SUBSCRIPTION_PLANS.TERMLY_SINGLE.name,
    price:     SUBSCRIPTION_PLANS.TERMLY_SINGLE.priceKes,
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
    cta:  `Start Term Plan — KES ${SUBSCRIPTION_PLANS.TERMLY_SINGLE.priceKes.toLocaleString()}`,
    note: 'Start with a free report — upgrade when ready.',
  },
  {
    id:        SUBSCRIPTION_PLANS.TERMLY_FAMILY.id,
    name:      SUBSCRIPTION_PLANS.TERMLY_FAMILY.name,
    price:     SUBSCRIPTION_PLANS.TERMLY_FAMILY.priceKes,
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
    cta:  `Start Family Plan — KES ${SUBSCRIPTION_PLANS.TERMLY_FAMILY.priceKes.toLocaleString()}`,
    note: `3 × KES ${SUBSCRIPTION_PLANS.TERMLY_SINGLE.priceKes.toLocaleString()} = KES ${(SUBSCRIPTION_PLANS.TERMLY_SINGLE.priceKes * 3).toLocaleString()} separately. You save KES ${(SUBSCRIPTION_PLANS.TERMLY_SINGLE.priceKes * 3 - SUBSCRIPTION_PLANS.TERMLY_FAMILY.priceKes).toLocaleString()}.`,
  },
]

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS: FAQItem[] = [
  {
    q: 'What do teachers at an EduNexus school get?',
    a: 'Every teacher at a school on EduNexus gets the full teacher workspace automatically — planning, analytics, slides, remedial planning, and the rest. Teachers never pay separately when their school is on EduNexus.',
  },
  {
    q: 'What is the Term Planning Bundle exactly?',
    a: 'One bundle covers one subject for one term: the Scheme of Work, every lesson plan in that scheme, and the Record of Work. You pay KES 100 once, at the start — the lesson plans and the Record of Work that follow cost nothing extra. A teacher who teaches three subjects buys three bundles.',
  },
  {
    q: 'What is the first free Scheme of Work?',
    a: 'Your genuinely first Scheme of Work is free — no card, no payment. It lets you see exactly what EduNexus produces before deciding to continue. After that, each subject you plan for the term is one KES 100 bundle.',
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
          Every teacher, every learner, every classroom, one platform —
          priced for your school after a short consultation.
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
                <span className="text-3xl font-black text-white">Quoted for your school</span>
                <p className="text-xs text-white/35 mt-0.5">{plan.billing}</p>
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
              title: 'Full workspace — all teachers',
              body:  'Every teacher gets planning, analytics, AI slides, and all tools. Automatically included.',
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

      {/* How the bundle works */}
      <div className="max-w-3xl mx-auto mb-14">
        <div className="bg-amber-500/6 border border-amber-500/20 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex-1">
              <p className="text-sm font-black text-amber-400 mb-1">How it works</p>
              <p className="text-sm text-white/60 leading-relaxed">
                You buy one subject&apos;s planning for one term. The Scheme of Work comes first,
                then its lesson plans week by week as you teach, and the Record of Work keeps
                itself up to date behind you. <strong className="text-white">One payment, at the start —
                nothing more for that subject, that term.</strong>
              </p>
            </div>
            <div className="shrink-0 text-center bg-white/5 border border-white/10 rounded-xl px-5 py-4">
              <p className="text-3xl font-black text-amber-400 leading-none">
                KES {TEACHER_PLANNING_BUNDLE.priceKes}
              </p>
              <p className="text-xs text-white/40 mt-1.5 font-semibold">per subject, per term</p>
              <p className="text-[10px] text-white/50 mt-0.5">Scheme + Lessons + Record</p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan card */}
      <div className="max-w-md mx-auto mb-14">
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
          When your school adopts EduNexus, your whole teacher workspace is unlocked automatically —
          at no cost to you. No bundles to buy.
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
  const [teacherSel,    setTeacherSel]    = useState<PayProduct>(TEACHER_PLANNING_PRODUCT)
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
        const familyProduct  = FAMILY_PAY_PLANS.find(p => p.id === productId)

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
          <p className="text-white/15 text-xs">Full refund if not satisfied</p>
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
                Quoted for your school · Full teacher workspace included for every teacher
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
                  {teacherSel.name}
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
