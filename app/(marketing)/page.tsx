'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { CURRICULA, FOCUS_RING, SCHOOL_DEMO_WA_LINK } from './constants'
// Canonical demonstration learner — the same record the real interactive
// sample-report demo uses (components/demo/AcademicClinicDemo.tsx). Every
// illustrative mockup on this page reads name/grade from here so they can
// never silently drift out of sync with the actual demo, the way they did
// before (this page said "Grade 8", the real demo data says Grade 9).
import { STUDENT as DEMO_STUDENT } from '@/components/demo/mockData'
import { BlueprintCardMockup } from './components/BlueprintCard'

const AcademicClinicDemo = dynamic(
  () => import('@/components/demo/AcademicClinicDemo'),
  { ssr: false }
)
const KcseClinicDemo = dynamic(
  () => import('@/components/demo/kcse/KcseClinicDemo'),
  { ssr: false }
)

type SelectedRole = 'school' | 'teacher' | 'family' | null

const ROLES: { id: Exclude<SelectedRole, null>; label: string }[] = [
  { id: 'school',  label: '🏫 For Schools'  },
  { id: 'teacher', label: '👨‍🏫 For Teachers' },
  { id: 'family',  label: '👨‍👩‍👧 For Families' },
]

export default function LandingPage() {
  const [demoOpen,     setDemoOpen]     = useState(false)
  const [kcseDemoOpen, setKcseDemoOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null)

  type HeroVariant = {
    badge:         string
    badgeClass:    string
    line1:         string
    line2:         string
    gradientLine:  string
    gradientClass: string
    subtitle:      string
    ctaHref:       string
    ctaLabel:      string
    trust:         string
    secondary:     { label: string; action: 'demo' | 'link'; href?: string } | null
    roleColor:     string
  }

  const hero: HeroVariant =
    selectedRole === 'teacher' ? {
      badge:         '👨‍🏫 For Teachers',
      badgeClass:    'bg-amber-500/10 border-amber-500/20 text-amber-300',
      line1:         'Plan your full term.',
      line2:         'Before the bell rings Monday.',
      gradientLine:  'EduNexus handles the paperwork.',
      gradientClass: 'from-amber-400 via-orange-400 to-yellow-400',
      subtitle:      'Schemes of work, lesson plans, and class insights — ready when you need them, formatted the way TSC expects.',
      ctaHref:       '/signup?role=teacher',
      ctaLabel:      'Start Planning for Free',
      trust:         '✓ TSC-ready formats  ·  ✓ CBC-aligned  ·  ✓ Auto lesson plans',
      secondary:     null,
      roleColor:     'amber',
    }
    : selectedRole === 'family' ? {
      badge:         '👨‍👩‍👧 For Families',
      badgeClass:    'bg-teal-500/10 border-teal-500/20 text-teal-300',
      line1:         'Finally know',
      line2:         'where your child truly stands.',
      gradientLine:  'Not just their marks. Their potential.',
      gradientClass: 'from-teal-400 via-cyan-400 to-blue-400',
      subtitle:      "The Learner Blueprint shows you exactly which strands are holding your child back — and a precise plan to close the gap before next term.",
      ctaHref:       '/signup?role=parent',
      ctaLabel:      'Get Your Child\'s Free Report',
      trust:         '✓ Free first report  ·  ✓ M-PESA accepted  ·  ✓ Works on any phone',
      secondary:     { label: 'Try a real sample report →', action: 'demo' },
      roleColor:     'teal',
    }
    : {
      badge:         '🔎 Catch it early. Change the outcome.',
      badgeClass:    'bg-violet-500/10 border-violet-500/20 text-violet-300',
      line1:         'Schools should never',
      line2:         'discover a problem too late.',
      gradientLine:  'EduNexus shortens that gap.',
      gradientClass: 'from-violet-400 via-purple-400 to-indigo-400',
      subtitle:      'EduNexus shortens the distance between when a learning problem begins and when someone notices — while there is still time to act on it.',
      ctaHref:       '/blueprint',
      ctaLabel:      'See How EduNexus Notices Early',
      trust:         '✓ CBC · Cambridge IGCSE · 8-4-4  ·  ✓ Grades 7–12  ·  ✓ 50+ pioneer teachers',
      secondary:     { label: 'Try a real sample report →', action: 'demo' },
      roleColor:     'violet',
    }

  return (
    <>
      {/* ── HUMAN PROBLEM ─────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32">
        <div className="max-w-170 mx-auto px-6 text-center">

          <p
            className="font-extrabold text-white leading-snug tracking-[-0.01em] mb-8"
            style={{ fontSize: 'clamp(26px, 4.5vw, 40px)' }}
          >
            Every learner has potential<br />that marks alone cannot measure.
          </p>

          <div className="space-y-2 text-white/45 text-lg leading-relaxed mb-8">
            <p>Some need more time.</p>
            <p>Some need a different explanation.</p>
            <p>Some need someone to believe they will get there.</p>
            <p>Some need to see where they are going<br className="hidden sm:block" /> before they commit to the journey.</p>
          </div>

          <p className="text-white/65 leading-relaxed max-w-125 mx-auto">
            A learning problem rarely announces itself. It starts small — one concept in one
            subject that didn&apos;t quite land — and for a while, nothing looks wrong.
            By the time it shows up in a report card, it&apos;s often already three terms old.
            By exam time, it can be too late to be the easy fix it once was.
          </p>

        </div>
      </section>

      {/* ── TRANSFORMATION (HERO) ─────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-white/3">
        <div className="max-w-[820px] mx-auto px-6 text-center">

          {/* Role selector */}
          <div
            className="flex justify-center gap-2 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRole(selectedRole === r.id ? null : r.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all whitespace-nowrap ${FOCUS_RING} ${
                  selectedRole === r.id
                    ? r.id === 'school'
                      ? 'bg-violet-500/15 border-violet-500/35 text-violet-300'
                      : r.id === 'teacher'
                      ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                      : 'bg-teal-500/15 border-teal-500/35 text-teal-300'
                    : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className={`inline-flex items-center gap-2 ${hero.badgeClass} border px-4 py-1.5 rounded-full text-sm font-semibold mb-8 transition-all`}>
            {hero.badge}
          </div>

          <h1
            className="font-extrabold leading-[1.05] tracking-[-0.02em] mb-6"
            style={{ fontSize: 'clamp(44px, 7vw, 72px)' }}
          >
            <span className="block text-white">{hero.line1}</span>
            <span className="block text-white">{hero.line2}</span>
            <span className={`block bg-linear-to-r ${hero.gradientClass} bg-clip-text text-transparent mt-1 transition-all`}>
              {hero.gradientLine}
            </span>
          </h1>

          <p className="text-[18px] md:text-[20px] text-white/60 max-w-140 mx-auto mb-8 leading-relaxed">
            {hero.subtitle}
          </p>

          {/* Curriculum pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {CURRICULA.map((pill) => (
              <span
                key={pill}
                className="bg-white/5 border border-white/10 text-white/40 px-4 py-1.5 rounded-full text-sm font-semibold"
              >
                {pill}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Link
              href={hero.ctaHref}
              className={`inline-flex items-center gap-2 bg-linear-to-r from-violet-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-all shadow-2xl shadow-violet-600/30 ${FOCUS_RING}`}
            >
              {hero.ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
            {hero.secondary && (
              hero.secondary.action === 'demo' ? (
                <button
                  onClick={() => setDemoOpen(true)}
                  className={`text-violet-400 hover:text-violet-300 font-semibold transition-colors rounded ${FOCUS_RING}`}
                >
                  {hero.secondary.label}
                </button>
              ) : (
                <a
                  href={hero.secondary.href}
                  className={`text-violet-400 hover:text-violet-300 font-semibold transition-colors rounded ${FOCUS_RING}`}
                >
                  {hero.secondary.label}
                </a>
              )
            )}
          </div>

          <p className="text-sm text-white/40">{hero.trust}</p>

          {/* Audience benefit cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14 max-w-190 mx-auto text-left">
            {[
              {
                icon: '🏫',
                who: 'For Schools',
                body: 'One platform showing every learner\'s progress, every teacher\'s planning, every classroom\'s performance.',
              },
              {
                icon: '👨‍🏫',
                who: 'For Teachers',
                body: 'Plan your full term before Monday. Teach knowing exactly where every learner is.',
              },
              {
                icon: '👨‍👩‍👧',
                who: 'For Families',
                body: 'Stop guessing. Know exactly which strand is holding your child back — and what to do about it.',
              },
            ].map((card) => (
              <div key={card.who} className="bg-white/4 border border-white/10 rounded-2xl px-5 py-4">
                <div className="text-2xl mb-2">{card.icon}</div>
                <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">{card.who}</div>
                <p className="text-sm text-white/65 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── TRUST BAR ─────────────────────────────────────────────────────────── */}
      <section className="py-10 md:py-12">
        <div className="max-w-275 mx-auto px-6">
          <p className="text-center text-sm font-semibold text-white/40 uppercase tracking-widest mb-1">
            Trusted by CBC and 8-4-4 teachers across Kenya
          </p>
          <p className="text-center text-xs text-white/50">
            50+ pioneer teachers &nbsp;·&nbsp; Nairobi, Kisumu, Nakuru &nbsp;·&nbsp; CBC · 8-4-4 · Cambridge IGCSE
          </p>
        </div>
      </section>

      {/* ── BLUEPRINT SUMMARY — full experience lives at /blueprint ───────────── */}
      <section id="evidence" className="bg-white/5 py-20 md:py-28">
        <div className="max-w-275 mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            <div className="order-2 md:order-1 flex justify-center">
              <BlueprintCardMockup />
            </div>

            <div className="order-1 md:order-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 block">
                The Evidence
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
                Discovered while there<br />was still time to fix it.
              </h2>
              <p className="text-white/60 leading-relaxed mb-8">
                Marks tell you what happened. The Learner Blueprint tells you why — a strand-by-
                strand intelligence profile every term, visible to the teacher, parent, and school
                leadership, all reading the same evidence.
              </p>
              <Link
                href="/blueprint"
                className={`inline-flex items-center gap-2 bg-white/8 border border-white/10 hover:bg-white/14 text-white px-7 py-3.5 rounded-xl font-bold transition-all ${FOCUS_RING}`}
              >
                Explore the Learner Blueprint
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── SCHOOL SUMMARY — full experience lives at /schools ────────────────── */}
      <section id="school" className="py-20 md:py-28">
        <div className="max-w-170 mx-auto px-6 text-center">
          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 block">
            For School Leaders
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
            The same evidence.<br />Every learner. Every classroom.
          </h2>
          <p className="text-white/60 leading-relaxed max-w-150 mx-auto mb-8">
            EduNexus gives school leadership the same early-noticing picture — not just
            end-of-term averages, but what is happening inside every classroom, every week,
            while there is still time to respond.
          </p>
          <Link
            href="/schools"
            className={`inline-flex items-center gap-2 bg-white/8 border border-white/10 hover:bg-white/14 text-white px-7 py-3.5 rounded-xl font-bold transition-all ${FOCUS_RING}`}
          >
            Explore the School Experience
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── ACTION: LEARNING COMPASS ──────────────────────────────────────────── */}
      <section id="compass" className="bg-white/3 py-20 md:py-28">
        <div className="max-w-275 mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            {/* Text */}
            <div>
              <span className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-3 block">
                Learning Compass
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
                Knowing isn&apos;t enough.
              </h2>
              <p className="text-white/60 leading-relaxed mb-6">
                Once the Blueprint identifies exactly which concept is holding a learner back,
                the Learning Compass starts there — not a generic tutoring session, that exact
                gap, met at the level the learner is actually at.
                <br /><br />
                Some learners are behind because they missed one foundational concept two terms
                ago. Some understand the idea but need it explained differently. Some just need
                someone to be patient with them.
                <br /><br />
                The diagnosis becomes the intervention. Available anytime, on any device, in
                familiar Kenyan context.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Starts from the exact strand the Blueprint identified",
                  'Explains concepts in familiar Kenyan contexts',
                  'Tracks mastery concept by concept across terms',
                  'Visible to teachers and parents in real time',
                  'Connects learning to career intelligence over time',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/60">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup?role=parent"
                className={`text-violet-400 hover:text-violet-300 font-semibold transition-colors rounded ${FOCUS_RING}`}
              >
                Try your child&apos;s first free session →
              </Link>
              <p className="text-xs text-white/40 mt-2">First session is always free. No card needed.</p>
            </div>

            {/* Chat mockup */}
            <div className="flex justify-center">
              <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur overflow-hidden w-full max-w-sm">
                <div className="bg-white/8 border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">🧭 Learning Compass</div>
                    <div className="text-xs text-white/40">{DEMO_STUDENT.name.split(' ')[0]}, Grade {DEMO_STUDENT.grade}</div>
                  </div>
                  <span className="text-xs font-semibold bg-teal-500/20 text-teal-300 px-2.5 py-1 rounded-full whitespace-nowrap">
                    Maths · Level 2
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-white/10 bg-white/3">
                  <span className="text-xs font-semibold text-white/40">Illustrative example</span>
                </div>
                <div className="px-4 py-2 border-b border-white/10 bg-teal-500/5">
                  <span className="text-[11px] text-teal-300/80 leading-snug">
                    Same learner as the Blueprint above — this session opens on his diagnosed
                    gap directly, not a generic topic menu.
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex gap-2 items-start">
                    <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 text-sm">
                      🧭
                    </div>
                    <div className="bg-teal-500/20 text-white/90 text-sm rounded-2xl rounded-tl-none px-4 py-3 max-w-55 leading-relaxed">
                      Let&apos;s start with fractions. If you have 3 chapatis and eat 1, what fraction is left?
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="bg-white/10 text-white/70 text-sm rounded-2xl rounded-tr-none px-4 py-3 max-w-40">
                      2/3?
                    </div>
                  </div>

                  <div className="flex gap-2 items-start">
                    <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 text-sm">
                      🧭
                    </div>
                    <div className="bg-teal-500/20 text-white/90 text-sm rounded-2xl rounded-tl-none px-4 py-3 max-w-55 leading-relaxed">
                      Almost! You have 3 total, ate 1, so 2 remain. That makes it 2/3. Correct! ✓ Let&apos;s try a harder one.
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-1.5 bg-teal-500/30 rounded-full overflow-hidden">
                      <div className="h-1.5 bg-teal-500 rounded-full w-2/5" />
                    </div>
                    <span className="text-xs text-teal-300 font-semibold whitespace-nowrap">
                      Difficulty: 2/5 ↑
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── TEACHER SUMMARY — full experience lives at /teachers ──────────────── */}
      <section id="teachers" className="py-20 md:py-28">
        <div className="max-w-170 mx-auto px-6 text-center">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 block">
            How The Noticing Happens
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
            Every lesson<br />becomes evidence.
          </h2>
          <p className="text-white/60 leading-relaxed max-w-150 mx-auto mb-8">
            None of this works without the teacher. Every assessment marked, every scheme of work
            built, every lesson taught is the raw material behind the Blueprint and Compass you
            just saw — with the documentation handled for you, CBC-aligned and TSC-ready.
          </p>
          <Link
            href="/teachers"
            className={`inline-flex items-center gap-2 bg-white/8 border border-white/10 hover:bg-white/14 text-white px-7 py-3.5 rounded-xl font-bold transition-all ${FOCUS_RING}`}
          >
            Explore the Teacher Experience
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── FUTURE OUTCOME: CAREER INTELLIGENCE ───────────────────────────────── */}
      <section id="career" className="bg-white/3 py-20 md:py-28">
        <div className="max-w-275 mx-auto px-6">

          <div className="text-center mb-14">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 block">
              Career Intelligence
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
              Education that prepares learners for life.<br />Not only examinations.
            </h2>
            <p className="text-white/60 leading-relaxed max-w-150 mx-auto">
              Do this consistently — notice early, act early, term after term — and something
              else becomes visible that a single report card never could. By the time a learner
              sits their final exam, the platform has been building their career intelligence
              picture for years — from classroom performance and learning patterns to interests,
              strengths, and growth trajectories that marks alone will never capture.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {[
              {
                icon: '🌱',
                title: 'Early Pathway Signals',
                body: 'Performance patterns in early grades often predict subject strengths. EduNexus flags these early so learners can explore — not just react to results.',
              },
              {
                icon: '💡',
                title: 'Strength-Based Guidance',
                body: 'Not every learner is strong in the same way. Career intelligence recognises what a learner is genuinely good at — and what grows with them over time.',
              },
              {
                icon: '🗺️',
                title: 'School-Level Readiness',
                body: 'School leadership can see, across all learners, which career pathways are emerging — and whether the curriculum is building towards them.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-6 hover:bg-indigo-500/8 hover:scale-[1.02] transition-all"
              >
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl px-8 py-5 text-center max-w-180 mx-auto">
            <p className="text-white/55 text-sm leading-relaxed">
              Career Intelligence is not a separate tool. It is the same evidence, the same
              noticing, carried forward — built into EduNexus from Grade 7, with no separate
              subscription.
            </p>
            <p className="text-indigo-400 font-semibold text-sm mt-2">
              EduNexus does not wait until Form 6 to think about where a learner is headed.
            </p>
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
              Most schools already have a reliable way to handle registration, timetabling, fee
              collection, and attendance — that operational layer matters, and it&apos;s not what
              EduNexus is built to compete on. What EduNexus adds is a different, higher-order
              capability: noticing a learning problem early enough to change the outcome, before
              it shows up in a report card.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/3 border border-white/8 rounded-2xl p-7">
              <p className="text-[11px] font-black text-white/50 uppercase tracking-widest mb-5">
                Administration alone
              </p>
              <ul className="space-y-3">
                {[
                  'Registration and enrolment',
                  'Fees and finance',
                  'Timetabling',
                  'Attendance tracking',
                  'Reporting to Ministry',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-7">
              <p className="text-[11px] font-black text-violet-400 uppercase tracking-widest mb-5">
                Educational Intelligence adds
              </p>
              <ul className="space-y-3">
                {[
                  'Learning intelligence across every classroom',
                  'Learner progress and trajectory tracking',
                  'Teacher planning insights',
                  'Parent communication and engagement',
                  'Career readiness data',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <div className="w-4 h-4 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
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
            We are not building a smarter exam.
            <br />
            We are building a smarter school.
          </p>

          <h2
            className="font-extrabold leading-tight tracking-[-0.02em] text-white mb-4"
            style={{ fontSize: 'clamp(30px, 5vw, 50px)' }}
          >
            Ready to see what your school&apos;s<br />learning intelligence looks like?
          </h2>
          <p className="text-white/55 text-lg mb-10 leading-relaxed max-w-120 mx-auto">
            Book a 20-minute demo and we will show you exactly how EduNexus would work in your school.
          </p>

          <a
            href={SCHOOL_DEMO_WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 bg-linear-to-r from-violet-600 to-purple-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-all shadow-2xl shadow-violet-600/30 ${FOCUS_RING}`}
          >
            Book a School Demo
            <ArrowRight className="w-5 h-5" />
          </a>
          <p className="text-xs text-white/40 mt-4 max-w-100 mx-auto leading-relaxed">
            Opens a real WhatsApp conversation with our team — no forms, no call center. We&apos;ll
            ask a few questions about your school first, then recommend where to start (most
            schools begin with a pilot on one grade or stream before rolling out further).
          </p>

          {/* Secondary paths */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-5">
              Or start individually
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup?role=teacher"
                className={`inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all ${FOCUS_RING}`}
              >
                👨‍🏫 Start planning free — for teachers
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/signup?role=parent"
                className={`inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all ${FOCUS_RING}`}
              >
                👨‍👩‍👧 Get your child&apos;s free report
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <p className="text-sm text-white/50 mt-8">
            ✓ No contract required &nbsp;·&nbsp; ✓ School pricing available &nbsp;·&nbsp; ✓ M-PESA accepted
          </p>
          <p className="text-xs text-white/20 mt-2">
            Your school&apos;s data never trains our models. &nbsp;·&nbsp;{' '}
            <Link href="/pricing" className={`text-violet-400/60 hover:text-violet-300 transition-colors rounded ${FOCUS_RING}`}>
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
