'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Compass,
  CheckCircle2,
  BarChart3,
  Search,
  Sparkles,
  Map,
  BookOpen,
  Globe,
  ChevronRight,
  GraduationCap,
  FileText,
  Calendar,
  Users,
  Star,
  ClipboardList,
  Shield,
  Trophy,
} from 'lucide-react'

type PioneerStats = { claimed: number; total: number; remaining: number }

// ─── Teacher Feature Cards ─────────────────────────────────────────────────────

const TEACHER_FEATURES = [
  {
    icon: ClipboardList,
    title: 'SOW Generator',
    line1: 'CBC + 8-4-4',
    line2: 'Grade 7–12',
    gradient: 'from-teal-500 to-cyan-500',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    label: 'text-teal-300',
  },
  {
    icon: Calendar,
    title: 'Lesson Plans',
    line1: 'Auto every Friday',
    line2: 'Break-aware',
    gradient: 'from-cyan-500 to-blue-500',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    label: 'text-cyan-300',
  },
  {
    icon: FileText,
    title: 'Record of Work',
    line1: 'Auto-fills itself',
    line2: 'HOD ready',
    gradient: 'from-blue-500 to-indigo-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    label: 'text-blue-300',
  },
  {
    icon: BarChart3,
    title: 'Class Dashboard',
    line1: 'Every student',
    line2: 'Level 1–4 view',
    gradient: 'from-indigo-500 to-violet-500',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    label: 'text-indigo-300',
  },
]

// ─── Parent / Student Feature Cards ───────────────────────────────────────────

const PARENT_FEATURES = [
  {
    emoji: '🧭',
    icon: Compass,
    title: 'Learning Compass',
    subtitle: "Your child's personal AI tutor",
    badge: null as string | null,
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-300',
    check: 'text-amber-400',
    quoteBg: 'bg-amber-500/10 border-amber-500/20',
    quoteText: 'text-amber-300',
    highlights: [
      'Adapts to their exact level',
      'Level 1 (struggling) → breaks topics down',
      'Level 4 (excelling) → pushes them further',
      'No direct answers — builds real understanding',
      'CBC Grade 7–12 + Cambridge IGCSE',
    ],
    quote: null as string | null,
  },
  {
    emoji: '🏥',
    icon: BarChart3,
    title: 'Academic Clinic',
    subtitle: 'A clinical report — not just a report card',
    badge: null,
    gradient: 'from-violet-500 to-purple-500',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    text: 'text-violet-300',
    check: 'text-violet-400',
    quoteBg: 'bg-violet-500/10 border-violet-500/20',
    quoteText: 'text-violet-300',
    highlights: [
      '7-page professional PDF report',
      'Subject-by-subject clinical assessment',
      '3-week holiday study plan included',
      'Career & pathway guidance inside',
      'Teacher collaboration page',
    ],
    quote: '"Parents actually cry when they read it"',
  },
  {
    emoji: '🎯',
    icon: Map,
    title: 'Pathway Guide',
    subtitle: 'Know BEFORE Grade 10 which path fits',
    badge: 'Junior — Grade 7–9',
    gradient: 'from-green-500 to-emerald-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    text: 'text-green-300',
    check: 'text-green-400',
    quoteBg: 'bg-green-500/10 border-green-500/20',
    quoteText: 'text-green-300',
    highlights: [
      'STEM vs Social Sciences vs Arts & Sports',
      'Based on real performance data',
      'Specific subjects to strengthen now',
      'Confidence: HIGH / MEDIUM / DEVELOPING',
    ],
    quote: null,
  },
  {
    emoji: '💼',
    icon: Search,
    title: 'Career Intelligence',
    subtitle: 'Honest careers — Kenya reality check',
    badge: 'Senior — Grade 10–12',
    gradient: 'from-cyan-500 to-blue-500',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    text: 'text-cyan-300',
    check: 'text-cyan-400',
    quoteBg: 'bg-cyan-500/10 border-cyan-500/20',
    quoteText: 'text-cyan-300',
    highlights: [
      '25+ careers with Kenyan market data',
      'AI disruption risk per career',
      'Salary ranges (KES, realistic)',
      'University + TVET pathways shown',
    ],
    quote: '"Not just doctor or lawyer — real options"',
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [pioneer, setPioneer] = useState<PioneerStats | null>(null)

  useEffect(() => {
    fetch('/api/beta/teacher-count')
      .then(r => r.json())
      .then(setPioneer)
      .catch(() => setPioneer({ claimed: 0, total: 500, remaining: 500 }))
  }, [])

  const pct     = pioneer ? Math.min(100, (pioneer.claimed / pioneer.total) * 100) : 0
  const isFull  = (pioneer?.remaining ?? 1) <= 0

  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="text-center">

          <div className="inline-flex items-center gap-2 bg-teal-500/10 backdrop-blur-sm border border-teal-500/20 text-teal-300 px-4 py-2 rounded-full text-sm font-black mb-8 animate-in fade-in slide-in-from-top duration-700">
            <Sparkles className="w-4 h-4" />
            KENYA&apos;S COMPLETE EDUCATION PLATFORM
          </div>

          <h1
            className="text-5xl md:text-8xl font-black mb-4 leading-[0.92] animate-in fade-in slide-in-from-bottom duration-1000"
            style={{ animationDelay: '100ms' }}
          >
            <span className="block text-white/90">Kenya&apos;s Complete</span>
            <span className="block bg-linear-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mt-2">
              Education Platform
            </span>
          </h1>

          <p
            className="text-2xl md:text-3xl font-black text-white/50 mb-10 animate-in fade-in slide-in-from-bottom duration-1000"
            style={{ animationDelay: '150ms' }}
          >
            For Teachers. For Parents &amp; Students.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center mb-10 animate-in fade-in slide-in-from-bottom duration-1000"
            style={{ animationDelay: '250ms' }}
          >
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 bg-linear-to-r from-teal-500 to-cyan-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-teal-500/30 text-lg"
            >
              <GraduationCap className="w-5 h-5" />
              I&apos;m a Teacher
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 bg-linear-to-r from-violet-500 to-purple-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-violet-500/30 text-lg"
            >
              <Users className="w-5 h-5" />
              I&apos;m a Parent / Student
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div
            className="flex flex-wrap justify-center gap-3 text-sm animate-in fade-in duration-1000"
            style={{ animationDelay: '350ms' }}
          >
            <span className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 px-4 py-2 rounded-full text-teal-300 font-bold">
              <GraduationCap className="w-4 h-4" /> Pioneer Teachers — 50% Off, Always
            </span>
            <span className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 px-4 py-2 rounded-full text-violet-300 font-bold">
              <Users className="w-4 h-4" /> Parents from KES 500
            </span>
            <span className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full text-blue-300 font-bold">
              <BookOpen className="w-4 h-4" /> Schools — Coming Soon
            </span>
          </div>
        </div>
      </section>

      {/* ── PIONEER TEACHER PROGRAM ───────────────────────────────────────────── */}
      <section id="teachers" className="py-24 relative">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-teal-950/25 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6">

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 px-4 py-2 rounded-full text-sm font-black mb-5">
              <Trophy className="w-4 h-4" />
              PIONEER TEACHER PROGRAM · LIMITED SPOTS
            </div>
            <h2 className="text-4xl md:text-6xl font-black mb-4 text-white leading-[0.95]">
              Pioneer Teacher{' '}
              <span className="bg-linear-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                Program
              </span>
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              We&apos;re selecting{' '}
              <strong className="text-white">500 teachers</strong>{' '}
              to build EduNexus with us
            </p>
          </div>

          {/* Counter */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="relative">
              <div className="absolute -inset-1 bg-linear-to-r from-teal-500 to-cyan-500 rounded-3xl blur-xl opacity-20" />
              <div className="relative bg-teal-950/40 border border-teal-500/30 rounded-3xl p-7">
                <div className="flex items-center justify-between mb-3 text-sm font-black">
                  <span className="text-teal-300">Pioneer spots claimed</span>
                  {pioneer ? (
                    <span className="text-white">{pioneer.claimed} / {pioneer.total}</span>
                  ) : (
                    <span className="text-white/30 animate-pulse">Loading...</span>
                  )}
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden mb-3">
                  <div
                    className="h-full bg-linear-to-r from-teal-500 to-cyan-400 rounded-full transition-all duration-1000"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {pioneer ? (
                  isFull ? (
                    <p className="text-center text-amber-300 font-black text-sm">
                      All 500 pioneer spots are claimed! 🎉
                    </p>
                  ) : (
                    <p className="text-center text-teal-300 font-bold text-sm">
                      <strong className="text-white">{pioneer.remaining} pioneer spots remaining</strong>
                      {' '}— going fast
                    </p>
                  )
                ) : (
                  <p className="text-center text-white/20 text-sm animate-pulse">Checking availability...</p>
                )}
              </div>
            </div>
          </div>

          {/* Two columns: What you get / What we need */}
          <div className="grid md:grid-cols-2 gap-6 mb-10">

            {/* WHAT YOU GET */}
            <div className="bg-white/5 border border-teal-500/20 rounded-3xl p-7">
              <p className="text-xs font-black text-teal-300 uppercase tracking-wider mb-5">
                What you get during beta
              </p>
              <div className="space-y-3">
                {[
                  { icon: ClipboardList, text: 'SOW Generator — CBC, 8-4-4, IGCSE' },
                  { icon: Calendar,      text: 'Lesson Plans — auto-generated every Friday' },
                  { icon: FileText,      text: 'Record of Work — fills itself' },
                  { icon: BarChart3,     text: 'Class Dashboard — every student\'s level' },
                  { icon: Shield,        text: 'TSC Inspection ready — always' },
                  { icon: CheckCircle2,  text: 'KICD Aligned — automatically' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4 text-teal-400" />
                    </div>
                    <span className="text-white/80 text-sm font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* WHAT WE NEED + PIONEER PROMISE */}
            <div className="flex flex-col gap-5">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-7 flex-1">
                <p className="text-xs font-black text-white/50 uppercase tracking-wider mb-5">
                  What we need from you
                </p>
                <div className="space-y-3">
                  {[
                    'Use it in your real classroom',
                    'Tell us what\'s broken',
                    'Share with one colleague',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <ArrowRight className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <span className="text-white/70 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pioneer promise */}
              <div className="relative">
                <div className="absolute -inset-0.5 bg-linear-to-r from-amber-500 to-orange-500 rounded-2xl blur opacity-20" />
                <div className="relative bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-black text-amber-300 uppercase tracking-wider">Pioneer Promise</span>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Beta teachers lock in{' '}
                    <strong className="text-amber-300">50% off forever</strong>{' '}
                    when we go paid.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            {isFull ? (
              <>
                <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-5 py-3 rounded-2xl text-sm font-black mb-5">
                  🎉 Pioneer spots are full! Join the waitlist for launch pricing.
                </div>
                <br />
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 bg-linear-to-r from-amber-500 to-orange-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-amber-500/30 text-lg"
                >
                  Join Waitlist
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 bg-linear-to-r from-teal-500 to-cyan-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-teal-500/30 text-lg"
                >
                  <Trophy className="w-5 h-5" />
                  Claim Your Pioneer Spot
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <p className="text-sm text-white/40 mt-3">
                  Pioneer teachers always enjoy 50% off — locked in for life.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── FOR STUDENTS & PARENTS ────────────────────────────────────────────── */}
      <section id="parents" className="py-24 relative">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-violet-950/15 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 px-4 py-2 rounded-full text-sm font-black mb-5">
              <Users className="w-4 h-4" /> FOR STUDENTS & PARENTS
            </div>
            <h2 className="text-4xl md:text-6xl font-black mb-4 text-white leading-[0.95]">
              Learning that{' '}
              <span className="bg-linear-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                knows your child
              </span>
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Not every child learns the same way. EduNexus adapts to yours.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {PARENT_FEATURES.map((f, i) => (
              <div key={i} className="group relative">
                <div className={`absolute -inset-0.5 bg-linear-to-br ${f.gradient} rounded-3xl blur opacity-10 group-hover:opacity-25 transition`} />
                <div className="relative bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/8 transition-all h-full">
                  <div className="flex items-start gap-4 mb-5">
                    <div className={`w-12 h-12 bg-linear-to-br ${f.gradient} rounded-2xl flex items-center justify-center shrink-0 shadow-lg text-xl`}>
                      {f.emoji}
                    </div>
                    <div>
                      {f.badge && (
                        <span className={`text-xs font-black px-2 py-1 rounded-full ${f.bg} border ${f.border} ${f.text} mb-1.5 inline-block`}>
                          {f.badge}
                        </span>
                      )}
                      <h3 className="text-2xl font-black text-white leading-tight">{f.title}</h3>
                      <p className={`text-sm font-bold ${f.text} mt-0.5`}>{f.subtitle}</p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {f.highlights.map((h, j) => (
                      <div key={j} className="flex items-start gap-2.5">
                        <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${f.check}`} />
                        <span className="text-white/70 text-sm">{h}</span>
                      </div>
                    ))}
                  </div>
                  {f.quote && (
                    <div className={`mt-4 border rounded-xl px-4 py-3 ${f.quoteBg}`}>
                      <p className={`text-sm font-bold italic ${f.quoteText}`}>{f.quote}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 bg-linear-to-r from-violet-500 to-purple-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-violet-500/30 text-lg"
            >
              <Compass className="w-5 h-5" />
              Start with 1 free session
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="text-sm text-white/40 mt-3">
              1 free Learning Compass session + 1 free Academic Clinic report. No card needed.
            </p>
          </div>
        </div>
      </section>

      {/* ── IGCSE SUPPORT ─────────────────────────────────────────────────────── */}
      <section id="igcse" className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative">
            <div className="absolute -inset-1 bg-linear-to-r from-blue-500 to-indigo-500 rounded-3xl blur-xl opacity-15" />
            <div className="relative bg-linear-to-br from-blue-950/40 to-indigo-950/40 border border-blue-500/20 rounded-3xl p-10 text-center">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 px-4 py-2 rounded-full text-sm font-black mb-5">
                <Globe className="w-4 h-4" /> INTERNATIONAL SCHOOLS
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white mb-3 leading-tight">
                International school?{' '}
                <span className="bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  We&apos;ve got you.
                </span>
              </h2>
              <div className="flex flex-wrap justify-center gap-3 my-5">
                {['Brookhouse', 'Hillcrest', 'ISK', 'Braeburn'].map((school) => (
                  <span key={school} className="bg-blue-500/10 border border-blue-500/20 text-blue-200 px-4 py-2 rounded-xl text-sm font-bold">
                    {school}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-5 mb-7 text-sm text-white/60">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" /> Grade A*–G tracking
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" /> Cambridge pathway guidance
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" /> IGCSE subject support
                </span>
              </div>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-linear-to-r from-blue-500 to-indigo-500 text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-xl"
              >
                Learn more <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ──────────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-black mb-3 text-white">Heard across Kenya</h2>
            <p className="text-white/50 text-lg">Teachers. Parents. Students.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {/* Teacher quote */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-linear-to-r from-teal-500 to-cyan-500 rounded-3xl blur opacity-10 group-hover:opacity-20 transition" />
              <div className="relative bg-white/5 border border-teal-500/20 rounded-3xl p-8 hover:bg-white/8 transition-all h-full flex flex-col">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-teal-400 fill-teal-400" />)}
                </div>
                <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 px-3 py-1 rounded-full text-xs font-black mb-4 w-fit">
                  <GraduationCap className="w-3.5 h-3.5" /> Teacher
                </div>
                <p className="text-white/80 leading-relaxed flex-1 mb-5 text-lg">
                  &ldquo;I used to spend every Sunday writing lesson plans. Now EduNexus does it Friday night while I sleep.&rdquo;
                </p>
                <div className="border-t border-white/10 pt-4">
                  <div className="font-black text-white">Dennis K.</div>
                  <div className="text-sm text-teal-300/70">CBC Teacher, Nairobi</div>
                </div>
              </div>
            </div>

            {/* Parent quote */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-linear-to-r from-violet-500 to-purple-500 rounded-3xl blur opacity-10 group-hover:opacity-20 transition" />
              <div className="relative bg-white/5 border border-violet-500/20 rounded-3xl p-8 hover:bg-white/8 transition-all h-full flex flex-col">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-violet-400 fill-violet-400" />)}
                </div>
                <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 px-3 py-1 rounded-full text-xs font-black mb-4 w-fit">
                  <Users className="w-3.5 h-3.5" /> Parent
                </div>
                <p className="text-white/80 leading-relaxed flex-1 mb-5 text-lg">
                  &ldquo;The Academic Clinic report showed me my daughter needed help in Chemistry — not because she&apos;s slow, but because she missed a foundational concept. We fixed it in 2 weeks.&rdquo;
                </p>
                <div className="border-t border-white/10 pt-4">
                  <div className="font-black text-white">Parent</div>
                  <div className="text-sm text-violet-300/70">Grade 10 student, Nairobi</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING PREVIEW ───────────────────────────────────────────────────── */}
      <section className="py-16 relative">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-2">Simple, honest pricing</h2>
            <p className="text-white/50">The right plan for everyone in a child&apos;s education</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mb-8">

            {/* Teachers */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-linear-to-br from-teal-500 to-cyan-500 rounded-3xl blur opacity-15 group-hover:opacity-30 transition" />
              <div className="relative bg-teal-950/40 border border-teal-500/30 rounded-3xl p-7 text-center h-full flex flex-col">
                <div className="text-3xl mb-3">👨‍🏫</div>
                <h3 className="text-xl font-black text-white mb-1">Teachers</h3>
                <div className="text-4xl font-black text-teal-300 my-3">Free</div>
                <p className="text-white/50 text-sm mb-2">forever. always.</p>
                <p className="text-xs text-white/40 mb-6 flex-1">SOW · Lesson Plans · Class Dashboard · TSC ready</p>
                <Link href="/signup" className="block w-full bg-linear-to-r from-teal-500 to-cyan-500 text-white py-3 rounded-xl font-black hover:scale-105 transition-all text-sm">
                  Teacher Sign Up →
                </Link>
              </div>
            </div>

            {/* Parents */}
            <div className="group relative md:-mt-4 md:mb-4">
              <div className="absolute -inset-0.5 bg-linear-to-br from-violet-500 to-purple-500 rounded-3xl blur opacity-25 group-hover:opacity-40 transition" />
              <div className="relative bg-violet-950/40 border border-violet-500/30 rounded-3xl p-7 text-center h-full flex flex-col">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-linear-to-r from-violet-500 to-purple-500 text-white px-4 py-1 rounded-full text-[11px] font-black tracking-wider shadow-lg whitespace-nowrap">
                  ⭐ MOST POPULAR
                </div>
                <div className="text-3xl mb-3">👨‍👩‍👧</div>
                <h3 className="text-xl font-black text-white mb-1">Parents</h3>
                <div className="text-4xl font-black text-violet-300 my-3">From KES 500</div>
                <p className="text-white/50 text-sm mb-2">per term</p>
                <p className="text-xs text-white/40 mb-6 flex-1">Learning Compass · Academic Clinic · Career Intelligence</p>
                <Link href="/pricing" className="block w-full bg-linear-to-r from-violet-500 to-purple-500 text-white py-3 rounded-xl font-black hover:scale-105 transition-all text-sm">
                  Parent Sign Up →
                </Link>
              </div>
            </div>

            {/* Schools */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-linear-to-br from-blue-500 to-indigo-500 rounded-3xl blur opacity-10 group-hover:opacity-15 transition" />
              <div className="relative bg-blue-950/20 border border-blue-500/20 rounded-3xl p-7 text-center h-full flex flex-col opacity-70">
                <div className="text-3xl mb-3">🏫</div>
                <h3 className="text-xl font-black text-white mb-1">Schools</h3>
                <div className="text-4xl font-black text-blue-300/60 my-3">Coming</div>
                <p className="text-white/40 text-sm mb-2">institutional plans</p>
                <p className="text-xs text-white/30 mb-6 flex-1">Whole-school dashboard · HOD reports · Admin portal</p>
                <button disabled className="block w-full bg-white/5 border border-white/10 text-white/30 py-3 rounded-xl font-black text-sm cursor-not-allowed">
                  Coming Soon
                </button>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-white/30 mb-2">*Teacher Pro features KES 1,500/term</p>
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-white/50 hover:text-white transition font-bold text-sm">
              See full pricing details <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6 mb-10">
        <div className="absolute inset-0 bg-linear-to-r from-teal-600/8 via-purple-600/8 to-blue-600/8 rounded-3xl blur-3xl" />
        <div className="relative max-w-4xl mx-auto text-center bg-linear-to-br from-teal-900/15 via-purple-900/15 to-blue-900/15 backdrop-blur-xl border border-white/10 rounded-3xl py-20 px-6">
          <div className="w-16 h-16 bg-linear-to-br from-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-teal-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-5 text-white leading-[0.95]">
            Kenya&apos;s education
            <span className="block bg-linear-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mt-1">
              deserves better.
            </span>
          </h2>
          <p className="text-xl text-white/60 mb-3 max-w-2xl mx-auto leading-relaxed">
            Teachers save hours. Students learn faster. Parents stay informed.
          </p>
          <p className="text-white/40 text-base mb-10">
            Join Kenyan educators and families already on EduNexus.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-teal-500 to-cyan-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-teal-500/30 text-lg"
            >
              <GraduationCap className="w-5 h-5" /> Join as Pioneer Teacher
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-violet-500 to-purple-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-violet-500/30 text-lg"
            >
              <Users className="w-5 h-5" /> Start as Parent
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-white/30">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> M-PESA accepted</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> CBC + 8-4-4 + IGCSE</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> Made in Kenya 🇰🇪</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> Pioneer teachers: 50% off, always</span>
          </div>
        </div>
      </section>
    </>
  )
}
