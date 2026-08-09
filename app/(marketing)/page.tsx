'use client'

import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Search,
  School,
  GraduationCap,
  Users,
  Compass,
  Briefcase,
} from 'lucide-react'
import { FOCUS_RING, SCHOOL_DEMO_WA_LINK } from './constants'
import { BlueprintCardMockup } from './components/BlueprintCard'
import { montserrat } from './layout'

const OVERVIEW_CARDS = [
  {
    icon: School,
    title: 'Every classroom, one picture.',
    body: "Not just end-of-term averages — what's happening in every class, every week.",
    href: '/schools',
    label: 'For school leaders',
    tag: 'Schools',
    tagClass: 'text-trustblue-300 bg-trustblue-500/10',
    iconClass: 'text-trustblue-400',
  },
  {
    icon: Compass,
    title: "Knowing isn't enough.",
    body: 'Targeted practice at exactly the gap that\'s holding a learner back.',
    href: '/compass',
    label: 'Learning Compass',
    tag: 'Families',
    tagClass: 'text-teal-300 bg-teal-500/10',
    iconClass: 'text-teal-400',
  },
  {
    icon: GraduationCap,
    title: 'Every lesson becomes evidence.',
    body: 'CBC-aligned planning, TSC-ready — done for you.',
    href: '/teachers',
    label: 'For teachers',
    tag: 'Teachers',
    tagClass: 'text-amber-300 bg-amber-500/10',
    iconClass: 'text-amber-400',
  },
  {
    icon: Briefcase,
    title: 'Prepares learners for life, not just exams.',
    body: 'Career readiness built in from Grade 7, no extra subscription.',
    href: '/career-pathways',
    label: 'Career Intelligence',
    tag: 'Families',
    tagClass: 'text-teal-300 bg-teal-500/10',
    iconClass: 'text-teal-400',
  },
] as const

const AcademicClinicDemo = dynamic(
  () => import('@/components/demo/AcademicClinicDemo'),
  { ssr: false }
)
const KcseClinicDemo = dynamic(
  () => import('@/components/demo/kcse/KcseClinicDemo'),
  { ssr: false }
)

type SelectedRole = 'school' | 'teacher' | 'family' | null

const ROLES: { id: Exclude<SelectedRole, null>; label: string; icon: typeof School }[] = [
  { id: 'school',  label: 'For Schools',  icon: School },
  { id: 'teacher', label: 'For Teachers', icon: GraduationCap },
  { id: 'family',  label: 'For Families', icon: Users },
]

export default function LandingPage() {
  const [demoOpen,     setDemoOpen]     = useState(false)
  const [kcseDemoOpen, setKcseDemoOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null)

  type HeroVariant = {
    badgeIcon:     typeof Search
    badge:         string
    badgeClass:    string
    line1:         string
    line2:         string
    gradientLine:  string
    lineClass:     string
    subtitle:      string
    ctaHref:       string
    ctaLabel:      string
    trust:         string
    secondary:     { label: string; action: 'demo' | 'link'; href?: string } | null
    roleColor:     string
  }

  const hero: HeroVariant =
    selectedRole === 'teacher' ? {
      badgeIcon:     GraduationCap,
      badge:         'For Teachers',
      badgeClass:    'bg-amber-500/10 border-amber-500/20 text-amber-300',
      line1:         'Plan your full term.',
      line2:         'Before the bell rings Monday.',
      gradientLine:  'EduNexus handles the paperwork.',
      lineClass:     'text-amber-400',
      subtitle:      'Schemes of work, lesson plans, and class insights — ready when you need them, formatted the way TSC expects.',
      ctaHref:       '/signup?role=teacher',
      ctaLabel:      'Start Planning for Free',
      trust:         '✓ TSC-ready formats  ·  ✓ CBC-aligned  ·  ✓ Auto lesson plans',
      secondary:     null,
      roleColor:     'amber',
    }
    : selectedRole === 'family' ? {
      badgeIcon:     Users,
      badge:         'For Families',
      badgeClass:    'bg-teal-500/10 border-teal-500/20 text-teal-300',
      line1:         'Finally know',
      line2:         'where your child truly stands.',
      gradientLine:  'Not just their marks. Their potential.',
      lineClass:     'text-teal-400',
      subtitle:      "The Learner Blueprint shows you exactly which strands are holding your child back — and a precise plan to close the gap before next term.",
      ctaHref:       '/signup?role=parent',
      ctaLabel:      'Get Your Child\'s Free Report',
      trust:         '✓ Free first report  ·  ✓ M-PESA accepted  ·  ✓ Works on any phone',
      secondary:     { label: 'Try a real sample report →', action: 'demo' },
      roleColor:     'teal',
    }
    : {
      badgeIcon:     Search,
      badge:         'Catch it early. Change the outcome.',
      badgeClass:    'bg-trustblue-500/10 border-trustblue-500/20 text-trustblue-300',
      line1:         'Schools should never',
      line2:         'discover a problem too late.',
      gradientLine:  'EduNexus shortens that gap.',
      lineClass:     'text-nexusteal-400',
      subtitle:      'EduNexus shortens the distance between when a learning problem begins and when someone notices — while there is still time to act on it.',
      ctaHref:       '/signup?role=school',
      ctaLabel:      'Create Your School Account',
      trust:         '✓ CBC · Cambridge IGCSE · 8-4-4  ·  ✓ Grades 7–12  ·  ✓ Works with your existing school system',
      secondary:     { label: 'Try a real sample report →', action: 'demo' },
      roleColor:     'trustblue',
    }

  type ClosingCta = {
    kicker:      string
    heading:     ReactNode
    subtitle:    string
    label:       string
    href:        string
    external:    boolean
    altLabel?:   string
    altHref?:    string
  }

  const closing: ClosingCta =
    selectedRole === 'teacher' ? {
      kicker:   'We are not building more paperwork. We are building your term plan.',
      heading:  <>Ready to plan your term<br />the easy way?</>,
      subtitle: 'Schemes of work, lesson plans, and class insights — ready when you need them.',
      label:    hero.ctaLabel,
      href:     hero.ctaHref,
      external: false,
    }
    : selectedRole === 'family' ? {
      kicker:   'Not just their marks. Their potential.',
      heading:  <>Ready to see what&apos;s really<br />holding your child back?</>,
      subtitle: 'Get a free first Learner Blueprint report — no card needed.',
      label:    hero.ctaLabel,
      href:     hero.ctaHref,
      external: false,
    }
    : {
      kicker:   'We are not building a smarter exam. We are building a smarter school.',
      heading:  <>Ready to see what your school&apos;s<br />learning intelligence looks like?</>,
      subtitle: 'Create your school\'s account and you\'re straight into your dashboard — no forms, no waiting.',
      label:    'Create Your School Account',
      href:     '/signup?role=school',
      external: false,
      altLabel: 'Prefer to talk first? Book a 20-min call →',
      altHref:  SCHOOL_DEMO_WA_LINK,
    }

  return (
    <>
      {/* ── TRANSFORMATION (HERO) ─────────────────────────────────────────────── */}
      <section className="pt-16 md:pt-24 pb-16 md:pb-24 bg-white/3">
        <div className="max-w-[820px] mx-auto px-6 text-center">

          <p className="text-white/40 text-sm font-semibold tracking-wide mb-8">
            Every learner has potential that marks alone cannot measure.
          </p>

          {/* Role selector */}
          <div
            className="flex justify-center gap-2 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRole(selectedRole === r.id ? null : r.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all whitespace-nowrap ${FOCUS_RING} ${
                  selectedRole === r.id
                    ? r.id === 'school'
                      ? 'bg-trustblue-500/15 border-trustblue-500/35 text-trustblue-300'
                      : r.id === 'teacher'
                      ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                      : 'bg-teal-500/15 border-teal-500/35 text-teal-300'
                    : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                }`}
              >
                <r.icon className="w-3.5 h-3.5" />
                {r.label}
              </button>
            ))}
          </div>

          <div className={`inline-flex items-center gap-2 ${hero.badgeClass} border px-4 py-1.5 rounded-full text-sm font-semibold mb-8 transition-all`}>
            <hero.badgeIcon className="w-3.5 h-3.5" />
            {hero.badge}
          </div>

          <h1
            className={`${montserrat.className} font-extrabold leading-[1.05] tracking-[-0.02em] mb-6`}
            style={{ fontSize: 'clamp(44px, 7vw, 72px)' }}
          >
            <span className="block text-white">{hero.line1}</span>
            <span className="block text-white">{hero.line2}</span>
            <span className={`block ${hero.lineClass} mt-1 transition-all`}>
              {hero.gradientLine}
            </span>
          </h1>

          <p className="text-[18px] md:text-[20px] text-white/60 max-w-140 mx-auto mb-8 leading-relaxed">
            {hero.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 mt-2">
            <Link
              href={hero.ctaHref}
              className={`inline-flex items-center gap-2 bg-nexusteal-600 text-white px-8 py-4 rounded-full font-bold hover:bg-nexusteal-500 hover:scale-105 transition-all shadow-2xl shadow-nexusteal-600/30 ${FOCUS_RING}`}
            >
              {hero.ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
            {hero.secondary && (
              hero.secondary.action === 'demo' ? (
                <button
                  onClick={() => setDemoOpen(true)}
                  className={`text-trustblue-300 hover:text-trustblue-400 font-semibold transition-colors rounded ${FOCUS_RING}`}
                >
                  {hero.secondary.label}
                </button>
              ) : (
                <a
                  href={hero.secondary.href}
                  className={`text-trustblue-300 hover:text-trustblue-400 font-semibold transition-colors rounded ${FOCUS_RING}`}
                >
                  {hero.secondary.label}
                </a>
              )
            )}
          </div>

          <p className="text-sm text-white/40">{hero.trust}</p>

          {/* Audience benefit cards — each is the direct entry point for that audience */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14 max-w-190 mx-auto text-left">
            {[
              {
                icon: School,
                who: 'For Schools',
                body: 'One platform showing every learner\'s progress, every teacher\'s planning, every classroom\'s performance.',
                href: '/signup?role=school',
                external: false,
                cta: 'Get started',
                iconClass: 'text-trustblue-400',
              },
              {
                icon: GraduationCap,
                who: 'For Teachers',
                body: 'Plan your full term before Monday. Teach knowing exactly where every learner is.',
                href: '/signup?role=teacher',
                external: false,
                cta: 'Get started',
                iconClass: 'text-amber-400',
              },
              {
                icon: Users,
                who: 'For Families',
                body: 'Stop guessing. Know exactly which strand is holding your child back — and what to do about it.',
                href: '/signup?role=parent',
                external: false,
                cta: 'Get started',
                iconClass: 'text-teal-400',
              },
            ].map((card) => {
              const cardClass = `group bg-white/4 border border-white/10 hover:border-white/25 hover:bg-white/6 rounded-2xl px-5 py-4 transition-all block ${FOCUS_RING}`
              const inner = (
                <>
                  <card.icon className={`w-6 h-6 ${card.iconClass} mb-2`} />
                  <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">{card.who}</div>
                  <p className="text-sm text-white/65 leading-relaxed mb-2">{card.body}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/50 group-hover:text-white/80">
                    {card.cta}
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </>
              )
              return card.external ? (
                <a key={card.who} href={card.href} target="_blank" rel="noopener noreferrer" className={cardClass}>
                  {inner}
                </a>
              ) : (
                <Link key={card.who} href={card.href} className={cardClass}>
                  {inner}
                </Link>
              )
            })}
          </div>

        </div>
      </section>

      {/* ── CURRICULUM BAR ────────────────────────────────────────────────────
          States what EduNexus covers, not who uses it. This slot previously
          carried a trust claim, a pioneer-teacher headcount and a list of
          cities — none of it supported: the headcount is unverified (the
          allowlist in lib/config/features.ts is empty) and no evidence of
          presence in any named city exists. Curriculum and grade coverage is
          a fact about the product, and is what belongs here. Do not
          reintroduce an adoption or geographic claim without evidence. */}
      <section className="py-10 md:py-12">
        <div className="max-w-275 mx-auto px-6">
          <p className="text-center text-sm font-semibold text-white/40 uppercase tracking-widest mb-1">
            Built for the Kenyan curriculum
          </p>
          <p className="text-center text-xs text-white/50">
            CBC Junior (Grade 7–9) &nbsp;·&nbsp; CBC Senior (Grade 10–12) &nbsp;·&nbsp; 8-4-4 &nbsp;·&nbsp; Cambridge IGCSE
          </p>
        </div>
      </section>

      {/* ── EVIDENCE HIGHLIGHT + COMPACT OVERVIEW GRID ─────────────────────────── */}
      <section id="evidence" className="bg-white/5 py-20 md:py-28">
        <div className="max-w-275 mx-auto px-6">

          <div className="grid md:grid-cols-2 gap-16 items-center mb-20 md:mb-24">
            <div className="order-2 md:order-1 flex justify-center">
              <BlueprintCardMockup />
            </div>
            <div className="order-1 md:order-2">
              <span className="text-xs font-bold text-nexusteal-400 uppercase tracking-widest mb-3 block">
                The Evidence — Schools, Teachers &amp; Families
              </span>
              <h2 className={`${montserrat.className} text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5`}>
                Discovered while there<br />was still time to fix it.
              </h2>
              <p className="text-white/60 leading-relaxed mb-8">
                A strand-by-strand intelligence profile every term — teacher, parent, and school
                leadership all reading the same evidence.
              </p>
              <Link
                href="/learner-blueprint"
                className={`inline-flex items-center gap-2 bg-white/8 border border-nexusteal-500/25 hover:bg-white/14 hover:border-nexusteal-400/40 text-white px-7 py-3.5 rounded-full font-bold transition-all ${FOCUS_RING}`}
              >
                Explore the Learner Blueprint
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {OVERVIEW_CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`group bg-white/4 border border-white/10 hover:border-white/25 hover:bg-white/6 rounded-2xl p-6 transition-all ${FOCUS_RING}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <card.icon className={`w-6 h-6 ${card.iconClass}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${card.tagClass}`}>
                    {card.tag}
                  </span>
                </div>
                <h3 className="text-white font-bold leading-snug mb-2">{card.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed mb-4">{card.body}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 group-hover:text-white">
                  {card.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>

        </div>
      </section>

      {/* ── OBJECTION HANDLING: HOW EDUNEXUS FITS ─────────────────────────────── */}
      <section className="py-16 md:py-20">
        <div className="max-w-225 mx-auto px-6">

          <div className="text-center mb-10">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 block">
              A Common Question
            </span>
            <h2 className="text-xl md:text-2xl font-extrabold text-white leading-tight mb-4">
              Does this replace our school system?
            </h2>
            <p className="text-white/55 leading-relaxed max-w-140 mx-auto text-sm">
              No. Registration, fees, and timetabling stay with your existing system. EduNexus adds
              one thing they don&apos;t: noticing a learning problem early enough to change the outcome.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/3 border border-white/8 rounded-2xl p-7">
              <p className="text-[11px] font-black text-white/50 uppercase tracking-widest mb-5">
                Administration alone
              </p>
              <ul className="space-y-3">
                {[
                  'Registration and fees',
                  'Timetabling and attendance',
                  'Reporting to Ministry',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-nexusteal-500/5 border border-nexusteal-500/20 rounded-2xl p-7">
              <p className="text-[11px] font-black text-nexusteal-400 uppercase tracking-widest mb-5">
                Educational Intelligence adds
              </p>
              <ul className="space-y-3">
                {[
                  'Learner progress and trajectory, every classroom',
                  'Teacher planning insights',
                  'Career readiness data',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <div className="w-4 h-4 rounded-full bg-nexusteal-500/20 border border-nexusteal-500/40 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-nexusteal-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* ── CLOSING CTA ───────────────────────────────────────────────────────── */}
      <section className="bg-white/3 py-24 md:py-32">
        <div className="max-w-190 mx-auto px-6 text-center">

          <p className="text-white/35 text-sm font-semibold tracking-wide mb-6">
            {closing.kicker}
          </p>

          <h2
            className={`${montserrat.className} font-extrabold leading-tight tracking-[-0.02em] text-white mb-4`}
            style={{ fontSize: 'clamp(30px, 5vw, 50px)' }}
          >
            {closing.heading}
          </h2>
          <p className="text-white/55 text-lg mb-10 leading-relaxed max-w-120 mx-auto">
            {closing.subtitle}
          </p>

          {closing.external ? (
            <a
              href={closing.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 bg-nexusteal-600 text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-nexusteal-500 hover:scale-105 transition-all shadow-2xl shadow-nexusteal-600/30 ${FOCUS_RING}`}
            >
              {closing.label}
              <ArrowRight className="w-5 h-5" />
            </a>
          ) : (
            <Link
              href={closing.href}
              className={`inline-flex items-center gap-2 bg-nexusteal-600 text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-nexusteal-500 hover:scale-105 transition-all shadow-2xl shadow-nexusteal-600/30 ${FOCUS_RING}`}
            >
              {closing.label}
              <ArrowRight className="w-5 h-5" />
            </Link>
          )}
          {closing.altLabel && closing.altHref && (
            <p className="mt-5">
              <a
                href={closing.altHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm text-white/40 hover:text-white/70 transition-colors rounded ${FOCUS_RING}`}
              >
                {closing.altLabel}
              </a>
            </p>
          )}

          <p className="text-sm text-white/50 mt-10">
            ✓ No contract required &nbsp;·&nbsp; ✓ Fair, transparent pricing &nbsp;·&nbsp; ✓ M-PESA accepted
          </p>
          <p className="text-xs text-white/20 mt-2">
            <Link href="/pricing" className={`text-trustblue-400/70 hover:text-trustblue-300 transition-colors rounded ${FOCUS_RING}`}>
              View pricing →
            </Link>
          </p>

        </div>
      </section>

      {/* ── DEMO MODALS ───────────────────────────────────────────────────────── */}
      <AcademicClinicDemo isOpen={demoOpen}      onClose={() => setDemoOpen(false)}      />
      <KcseClinicDemo     isOpen={kcseDemoOpen}  onClose={() => setKcseDemoOpen(false)}  />
    </>
  )
}
