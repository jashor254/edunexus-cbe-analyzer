'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Compass,
  Star,
  CheckCircle2,
  BarChart3,
  Target,
  Search,
  Sparkles,
  Map,
  BookOpen,
  Zap,
  Globe,
  ChevronRight,
  GraduationCap,
  Shield,
  Moon,
  Home,
  FileText,
  Calendar,
  TrendingUp,
  Users,
} from 'lucide-react'

// ─── Feature Data ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    rank: 1,
    icon: Compass,
    title: 'Learning Compass',
    subtitle: 'Personal smart tutor',
    tagline: 'Knows their level. Adjusts every session.',
    desc: 'Not a generic tutor. Learning Compass learns from your child — where they struggle, where they fly — and adjusts every single session to match exactly where they are. No wasted time on topics they already know.',
    gradient: 'from-amber-500 to-orange-500',
    link: '/signup',
    cta: 'Start with 1 free session',
    highlights: [
      'Learns from your child every session',
      'Adjusts difficulty as they improve',
      'Kenyan examples — chapatis, matatus, shambas',
      'CBC Kenya & Cambridge IGCSE — Grade 7–12',
      'Sessions pick up where they left off',
    ],
    badge: '★ Most loved feature',
    badgeColor: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  },
  {
    rank: 2,
    icon: BarChart3,
    title: 'Academic Clinic',
    subtitle: 'Performance reports',
    tagline: 'See exactly where they need help.',
    desc: "A school report card says \"C in Maths.\" Ours tells you it's specifically fractions and percentages — and gives you a plan to fix exactly that. Subject by subject, strand by strand. No guessing.",
    gradient: 'from-violet-500 to-purple-500',
    link: '/signup',
    cta: 'Your first Academic Report is on us',
    highlights: [
      'Subject and strand level breakdown',
      'Competency levels: BE / AE / ME / EE',
      'Hidden gap detection',
      'Downloadable PDF — shareable with teachers',
      'Track improvement term by term',
    ],
    badge: '📋 First report is on us',
    badgeColor: 'bg-violet-500/10 border-violet-500/20 text-violet-300',
  },
  {
    rank: 3,
    icon: Map,
    title: 'Pathway Guide',
    subtitle: 'Junior School — Grade 7–9',
    tagline: 'Choose the right Senior School path.',
    desc: 'By Grade 9 (CBC) or Year 9 (IGCSE), your child faces critical path choices. Pathway Guide analyses real assessment data and tells you — clearly — which path fits best. CBC students get STEM/Arts/Social Sciences guidance. IGCSE students get optimal subject combination recommendations.',
    gradient: 'from-green-500 to-emerald-500',
    link: '/signup',
    cta: 'See the pathway report',
    highlights: [
      'CBC: STEM / Arts & Sports / Social Sciences',
      'IGCSE: Subject combination recommendations',
      'Based on real term-by-term performance',
      'Prevents costly wrong-path choices',
      'Career direction preview included',
    ],
    badge: '🏫 Junior School exclusive',
    badgeColor: 'bg-green-500/10 border-green-500/20 text-green-300',
  },
  {
    rank: 4,
    icon: Search,
    title: 'Career Intelligence',
    subtitle: 'Senior School — Grade 10–12',
    tagline: 'Honest career matching based on real results.',
    desc: "Matched to your child's actual strengths — not just what they say they want to be. 200+ careers including the newest opportunities in Kenya's growing sectors, each with real salary ranges and the exact subjects needed.",
    gradient: 'from-cyan-500 to-blue-500',
    link: '/signup',
    cta: 'Explore careers',
    highlights: [
      '200+ careers including 2025 emerging roles',
      'Matched to actual assessment performance',
      'Kenyan salary ranges in KES',
      'University and TVET paths clearly shown',
      'CBC subject requirements mapped',
    ],
    badge: '🇰🇪 Kenya-focused',
    badgeColor: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
  },
  {
    rank: 5,
    icon: BookOpen,
    title: 'Term Tracker',
    subtitle: 'Assessment history',
    tagline: 'Watch them grow term by term.',
    desc: 'Log every CBC assessment. Watch the trends. Spot the subjects climbing, catch the ones slipping before they become a problem. Three years of history in one clear view.',
    gradient: 'from-rose-500 to-pink-500',
    link: '/signup',
    cta: 'Start tracking',
    highlights: [
      'Term-by-term progress across years',
      'Subject trend graphs',
      'Competency level history',
      'Multiple students per account',
      'Works for all CBC subjects',
    ],
    badge: '📈 Multi-year view',
    badgeColor: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
  },
  {
    rank: 6,
    icon: Calendar,
    title: 'Holiday Plan',
    subtitle: '3-week study schedule',
    tagline: 'Make every holiday count.',
    desc: "Three weeks goes fast. A structured plan means your child doesn't waste the first week deciding what to study. Focused catch-up, subject by subject, built from exactly what the Academic Clinic found.",
    gradient: 'from-indigo-500 to-violet-500',
    link: '/signup',
    cta: 'Build the plan',
    highlights: [
      'Built from your Academic Clinic results',
      'Daily study schedule for 3 weeks',
      'Focuses on gaps, not strong subjects',
      'Works alongside Learning Compass sessions',
      'Shareable with parents and guardians',
    ],
    badge: '🌤️ Holiday-ready',
    badgeColor: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300',
  },
  {
    rank: 7,
    icon: Users,
    title: 'Study Groups',
    subtitle: 'Holiday peer learning',
    tagline: 'Learn together. Compete together.',
    desc: 'Students from the same boarding school scatter to 47 counties every holiday. Study Groups keep them learning together — daily challenges, leaderboards, and peer teaching powered by the Learning Compass.',
    gradient: 'from-pink-500 to-rose-500',
    link: '/signup',
    cta: 'Join a group',
    highlights: [
      'Daily Compass-generated challenges',
      'Class leaderboards and streaks',
      'Peer teaching earns most points',
      'Anonymous questions — no judgment',
      'Max 8 members per group',
    ],
    badge: '👥 Holiday feature',
    badgeColor: 'bg-pink-500/10 border-pink-500/20 text-pink-300',
  },
]

const BOARDING_TIMELINE = [
  {
    phase: 'During term',
    icon: BookOpen,
    color: 'from-blue-500 to-cyan-500',
    heading: 'Parent stays informed',
    body: "Log your child's term results as soon as they come home. Get the Academic Clinic report. Know exactly what to work on — before the holidays even begin. Share it with the class teacher if you want their input.",
  },
  {
    phase: 'School holidays',
    icon: Home,
    color: 'from-amber-500 to-orange-500',
    heading: '2–3 weeks of focused catch-up',
    body: 'Your child works through weak subjects with their personal tutor — at home, at their own pace, at any hour. No commute. No scheduling. Real progress on exactly what matters.',
  },
  {
    phase: 'Back to school',
    icon: GraduationCap,
    color: 'from-green-500 to-emerald-500',
    heading: 'Walk in prepared',
    body: 'Print the progress report. Share it with the class teacher. Your child returns knowing the topics they struggled with last term — properly this time. Most parents see improvement within one holiday.',
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState(0)
  const featured = FEATURES[activeFeature]

  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="text-center">

          <div className="inline-flex items-center gap-2 bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 text-amber-300 px-4 py-2 rounded-full text-sm font-black mb-8 animate-in fade-in slide-in-from-top duration-700">
            <Moon className="w-4 h-4" />
            CBC KENYA · CAMBRIDGE IGCSE · GRADE 7–12
            <span className="w-px h-3 bg-amber-500/40" />
            <span className="text-amber-200/60 text-xs">
              🇰🇪 & 🌍
            </span>
          </div>

          <h1
            className="text-5xl md:text-8xl font-black mb-6 leading-[0.92] animate-in fade-in slide-in-from-bottom duration-1000"
            style={{ animationDelay: '100ms' }}
          >
            <span className="block text-white/90">In a class of 45,</span>
            <span className="block text-white/90">your child is just</span>
            <span className="block bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400 bg-clip-text text-transparent mt-2">
              another student.
            </span>
          </h1>

          <p
            className="text-3xl md:text-4xl font-black text-white mb-6 animate-in fade-in slide-in-from-bottom duration-1000"
            style={{ animationDelay: '150ms' }}
          >
            Not here.
          </p>

          <p
            className="text-xl md:text-2xl text-white/60 max-w-3xl mx-auto mb-4 leading-relaxed animate-in fade-in slide-in-from-bottom duration-1000"
            style={{ animationDelay: '200ms' }}
          >
            Every lesson in EduNexus is built around your child — their pace, their gaps, their strengths. Not the class average. Not the syllabus schedule. Them.
          </p>

          <p
            className="text-lg text-amber-300/80 font-bold mb-10 animate-in fade-in duration-1000"
            style={{ animationDelay: '250ms' }}
          >
            Mtoto wako anastahili zaidi ya average.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center mb-10 animate-in fade-in slide-in-from-bottom duration-1000"
            style={{ animationDelay: '300ms' }}
          >
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-amber-500/30 text-lg"
            >
              <Compass className="w-5 h-5" />
              Start with 1 free session
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/early-access"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-green-500/20 text-lg"
            >
              🚀 Early Access
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 bg-white/5 backdrop-blur-sm border-2 border-white/10 text-white px-8 py-5 rounded-2xl font-black hover:bg-white/10 hover:border-white/20 transition-all text-lg"
            >
              See plans &amp; pricing
            </Link>
          </div>

          {/* What you get — stated plainly, not as a pitch */}
          <div
            className="inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-8 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white/60 animate-in fade-in duration-1000"
            style={{ animationDelay: '400ms' }}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span><strong className="text-white">1 full Learning Compass session</strong> — not a demo</span>
            </span>
            <span className="hidden sm:block text-white/20">|</span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span><strong className="text-white">1 Academic Clinic PDF report</strong> — yours to keep</span>
            </span>
            <span className="hidden sm:block text-white/20">|</span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              No card needed
            </span>
          </div>
        </div>
      </section>

      {/* ── BOARDING SCHOOL SECTION ───────────────────────────────────────────── */}
      <section id="boarding" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/20 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 px-4 py-2 rounded-full text-sm font-black mb-5">
              <Home className="w-4 h-4" /> FOR BOARDING SCHOOL FAMILIES
            </div>
            <h2 className="text-4xl md:text-6xl font-black mb-5 text-white leading-[0.95]">
              Built for Kenyan{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                boarding school students
              </span>
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
              Your child is away for 3 months. You get a report at the end of term.
              That gap — between results and real action — is exactly what EduNexus closes.
            </p>
          </div>

          {/* Timeline */}
          <div className="grid md:grid-cols-3 gap-6 mb-14">
            {BOARDING_TIMELINE.map((phase, i) => (
              <div key={i} className="group relative">
                <div className={`absolute -inset-0.5 bg-gradient-to-br ${phase.color} rounded-3xl blur opacity-10 group-hover:opacity-25 transition`} />
                <div className="relative bg-white/5 border border-white/10 rounded-3xl p-7 hover:bg-white/8 transition-all h-full">
                  <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${phase.color} text-white px-3 py-1.5 rounded-full text-xs font-black mb-4`}>
                    <phase.icon className="w-3.5 h-3.5" />
                    {phase.phase}
                  </div>
                  <h3 className="text-xl font-black text-white mb-3">{phase.heading}</h3>
                  <p className="text-white/60 leading-relaxed">{phase.body}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:flex absolute top-1/2 -right-3 z-10 items-center">
                    <ChevronRight className="w-6 h-6 text-white/20" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Proof statement */}
          <div className="relative max-w-3xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl blur-xl opacity-15" />
            <div className="relative bg-white/5 border border-amber-500/20 rounded-3xl p-8 text-center">
              <div className="text-4xl font-black text-amber-300 mb-2">One holiday.</div>
              <p className="text-xl text-white/80 leading-relaxed mb-4">
                Most parents see noticeable improvement in their child&apos;s weakest subjects within a single 3-week holiday — when they use EduNexus consistently.
              </p>
              <p className="text-white/40 text-sm italic">
                &ldquo;Soma vizuri, bila wasiwasi.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── IGCSE SECTION ── */}
      <section id="igcse" className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-3xl blur-xl opacity-15" />
            <div className="relative bg-gradient-to-br from-blue-900/30 to-cyan-900/30 backdrop-blur-xl border border-blue-500/20 rounded-3xl p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Left side */}
                <div>
                  <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 px-4 py-2 rounded-full text-sm font-black mb-5">
                    🌍 NOW SUPPORTING CAMBRIDGE IGCSE
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-[0.95]">
                    Braeburn. Brookhouse.
                    <span className="block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mt-1">
                      Hillcrest. ISK.
                    </span>
                  </h2>
                  <p className="text-xl text-white/60 mb-6 leading-relaxed">
                    If your child attends a Cambridge school in Kenya, EduNexus now adapts to their curriculum — IGCSE subjects, A*–G grading, and subject selection guidance for Year 10.
                  </p>
                  <div className="space-y-3 mb-8">
                    {[
                      'Year 7–11 Cambridge Lower Secondary & IGCSE',
                      'Grades A*–G with color-coded performance',
                      'Subject combination recommendations for Year 10',
                      'A-Level pathway preview after IGCSE',
                      'Learning Compass uses Cambridge exam framing',
                      'International career paths included',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <span className="text-white/80">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-xl shadow-blue-500/20"
                    >
                      Start with IGCSE →
                    </Link>
                    <span className="text-white/30 text-sm">Free first session</span>
                  </div>
                </div>

                {/* Right side — comparison */}
                <div className="space-y-4">
                  {/* CBC card */}
                  <div className="bg-white/5 border border-amber-500/20 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-lg">🇰🇪</span>
                      <div>
                        <div className="font-black text-white text-sm">CBC Kenya</div>
                        <div className="text-xs text-white/40">Grade 7–12 · Levels 1–4</div>
                      </div>
                      <span className="ml-auto text-xs font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                        Boarding schools
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { s: 'Mathematics', v: 3, l: 'Meets' },
                        { s: 'English', v: 2, l: 'Approaching' },
                        { s: 'Science', v: 4, l: 'Exceeds' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <span className="text-white/50 w-28 flex-shrink-0">{item.s}</span>
                          <div className="flex-1 bg-white/10 rounded-full h-1">
                            <div className="h-1 rounded-full bg-amber-500" style={{ width: `${item.v * 25}%` }} />
                          </div>
                          <span className="text-amber-300 font-bold w-20 text-right">{item.v}/4 {item.l}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* IGCSE card */}
                  <div className="bg-white/5 border border-blue-500/20 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-lg">🌍</span>
                      <div>
                        <div className="font-black text-white text-sm">Cambridge IGCSE</div>
                        <div className="text-xs text-white/40">Year 7–11 · Grades A*–G</div>
                      </div>
                      <span className="ml-auto text-xs font-black text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
                        International schools
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { s: 'Mathematics', g: 'B', c: 'text-green-400' },
                        { s: 'English Lang', g: 'A*', c: 'text-purple-400' },
                        { s: 'Biology', g: 'C', c: 'text-amber-400' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-white/50">{item.s}</span>
                          <span className={`font-black text-base ${item.c}`}>{item.g}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Same compass */}
                  <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
                    <p className="text-sm font-black text-white/80">Same Learning Compass.</p>
                    <p className="text-xs text-white/40 mt-1">Adapts to CBC or IGCSE automatically.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LEARNING COMPASS ──────────────────────────────────────────────────── */}
      <section id="compass" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-600/4 via-orange-600/4 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            {/* Chat preview */}
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl blur-2xl opacity-15" />
              <div className="relative bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/30">
                    <Compass className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-black text-white text-lg">Learning Compass</div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-xs text-green-300 font-bold">With Amina — Grade 8, 11:47pm</span>
                    </div>
                  </div>
                  <div className="ml-auto">
                    <Moon className="w-5 h-5 text-amber-300/60" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl rounded-bl-sm p-4 text-sm text-white max-w-[85%]">
                    Sijui simultaneous equations kabisa 😭
                  </div>
                  <div className="bg-gradient-to-r from-amber-500/30 to-orange-500/30 backdrop-blur-sm border border-amber-400/30 rounded-2xl rounded-br-sm p-4 text-sm text-white ml-auto max-w-[90%]">
                    <p className="mb-2">Sawa Amina! Bei ya unga — 2 packets na 1 sugar = KES 180. Hiyo ni equation yako ya kwanza...</p>
                    <div className="flex gap-2 mt-3">
                      <span className="bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs px-2 py-1 rounded-lg font-bold">Grade 8 level ✓</span>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl rounded-bl-sm p-4 text-sm text-white max-w-[85%]">
                    OH! So x ni unga na y ni sugar? Nimeelewa! 🤔
                  </div>
                  <div className="bg-gradient-to-r from-amber-500/30 to-orange-500/30 backdrop-blur-sm border border-amber-400/30 rounded-2xl rounded-br-sm p-4 text-sm text-white ml-auto max-w-[90%]">
                    <p>Exactly! Sasa tuweke equation ya pili — same items, different amounts...</p>
                    <div className="flex gap-2 mt-3">
                      <span className="bg-green-500/20 border border-green-500/30 text-green-300 text-xs px-2 py-1 rounded-lg font-bold">Level adjusted up ↑</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex gap-2">
                  <span className="text-xs text-white/30 font-bold uppercase tracking-wider mr-1">
                    Curriculum:
                  </span>
                  <span className="text-xs bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-1 rounded-lg font-bold">
                    🇰🇪 CBC Kenya
                  </span>
                  <span className="text-xs bg-white/10 border border-white/10 text-white/30 px-2 py-1 rounded-lg font-bold">
                    🌍 IGCSE
                  </span>
                </div>

                <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-3">
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/30">
                    Uliza swali lolote la CBC...
                  </div>
                  <button className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-2 rounded-full text-sm font-black mb-5">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> #1 FEATURE
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-5 leading-[0.95]">
                <span className="text-white">Learning Compass</span>
                <span className="block bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent mt-1">
                  Adjusts to their pace
                </span>
              </h2>
              <p className="text-xl text-white/70 mb-3 leading-relaxed">
                Most tutors teach the same way to every child. Learning Compass watches how your child responds and changes its approach in real time.
              </p>
              <p className="text-lg text-white/50 mb-8 leading-relaxed">
                Struggling with fractions? It slows down, uses a different example — chai cups, not abstract numbers. Getting it right? It moves ahead. <strong className="text-white/80">No wasted sessions.</strong>
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { text: 'Learns from how your child responds', icon: Zap },
                  { text: 'Kenyan examples — unga, matatus, KCSE past papers', icon: Globe },
                  { text: 'Remembers where they got stuck last session', icon: Target },
                  { text: 'CBC Kenya & Cambridge IGCSE — Grade 7–12', icon: BookOpen },
                  { text: 'IGCSE: Cambridge-aware exam technique tips', icon: Globe },
                  { text: 'Works at midnight. No scheduling needed.', icon: Moon },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-amber-400" />
                    </div>
                    <span className="text-white/80">{item.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-xl shadow-amber-500/25"
                >
                  One free session. See the difference yourself. <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ALL FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/60 px-4 py-2 rounded-full text-sm font-black mb-4">
              <Sparkles className="w-4 h-4" /> SIX TOOLS, ONE PLATFORM
            </div>
            <h2 className="text-4xl md:text-6xl font-black mb-4 text-white">Everything your child needs.</h2>
            <p className="text-xl text-white/50 max-w-2xl mx-auto">Each tool built specifically for CBC Kenya. Nothing generic.</p>
          </div>

          {/* Feature selector */}
          <div className="grid md:grid-cols-3 gap-3 mb-10">
            {FEATURES.map((f, idx) => (
              <button
                key={idx}
                onClick={() => setActiveFeature(idx)}
                className={`group relative text-left rounded-2xl p-5 border-2 transition-all duration-300 ${
                  activeFeature === idx
                    ? 'bg-white/10 border-white/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                }`}
              >
                {activeFeature === idx && (
                  <div className={`absolute -inset-0.5 bg-gradient-to-r ${f.gradient} rounded-2xl blur opacity-25 -z-10`} />
                )}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${f.gradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
                    <f.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-black text-white text-sm truncate">{f.title}</span>
                    </div>
                    <p className="text-xs text-white/50 leading-snug">{f.tagline}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-1 transition-transform ${activeFeature === idx ? 'rotate-90 text-white' : 'text-white/20'}`} />
                </div>
              </button>
            ))}
          </div>

          {/* Expanded panel */}
          <div className="relative rounded-3xl overflow-hidden">
            <div className={`absolute -inset-0.5 bg-gradient-to-r ${featured.gradient} rounded-3xl blur opacity-20`} />
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-10 items-center">
                <div>
                  <div className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-full text-xs font-black mb-5 ${featured.badgeColor}`}>
                    {featured.badge}
                  </div>
                  <h3 className="text-3xl md:text-5xl font-black mb-2 text-white">{featured.title}</h3>
                  <p className={`text-base font-bold bg-gradient-to-r ${featured.gradient} bg-clip-text text-transparent mb-2`}>
                    {featured.subtitle}
                  </p>
                  <p className="text-white/40 text-sm italic mb-5">{featured.tagline}</p>
                  <p className="text-white/70 leading-relaxed text-lg mb-8">{featured.desc}</p>
                  <Link
                    href={featured.link}
                    className={`inline-flex items-center gap-2 bg-gradient-to-r ${featured.gradient} text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-xl`}
                  >
                    {featured.cta} <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {featured.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
                      <div className={`w-8 h-8 bg-gradient-to-br ${featured.gradient} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-white/80 font-medium">{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ACADEMIC CLINIC ───────────────────────────────────────────────────── */}
      <section id="clinic" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 px-4 py-2 rounded-full text-sm font-black mb-5">
                <BarChart3 className="w-4 h-4" /> ACADEMIC CLINIC
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-5 leading-[0.95]">
                <span className="text-white">Your first report</span>
                <span className="block bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent mt-1">
                  is on us.
                </span>
              </h2>
              <p className="text-xl text-white/70 mb-4 leading-relaxed">
                A school report card gives you a grade. Ours tells you exactly which topics are dragging the grade down — and what to do first.
              </p>
              <p className="text-lg text-white/50 mb-8 leading-relaxed">
                Log one term of results. Get a full subject and strand breakdown. Download the PDF and sit with your child — or share it with the school.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  'Competency levels per subject and strand',
                  'Highlights exactly which topics need work',
                  'Downloadable PDF — shareable with teachers',
                  'Progress compared to previous terms',
                  'Paired with a personalised improvement plan',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-violet-400 flex-shrink-0" />
                    <span className="text-white/80">{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-xl shadow-violet-500/20"
              >
                Your first Academic Report is on us <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Report mockup */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-purple-500 rounded-3xl blur-xl opacity-20" />
              <div className="relative bg-white/5 border border-violet-500/20 rounded-3xl p-6 md:p-8">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/10">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-black text-white">Academic Clinic Report</div>
                    <div className="text-xs text-white/40">Term 1, 2025 — Grade 8</div>
                  </div>
                  <div className="ml-auto bg-green-500/20 border border-green-500/30 text-green-300 text-xs px-2 py-1 rounded-lg font-bold">
                    PDF ready
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { subject: 'Mathematics', level: 'EE', pct: 87, color: 'from-green-500 to-emerald-500', note: 'Exceeding — strong' },
                    { subject: 'Integrated Science', level: 'ME', pct: 72, color: 'from-blue-500 to-cyan-500', note: 'Meeting expectations' },
                    { subject: 'English', level: 'AE', pct: 55, color: 'from-amber-500 to-orange-500', note: 'Needs work on writing' },
                    { subject: 'Kiswahili', level: 'BE', pct: 38, color: 'from-red-500 to-rose-500', note: '⚠ Action needed — grammar' },
                    { subject: 'Social Studies', level: 'ME', pct: 66, color: 'from-blue-500 to-cyan-500', note: 'Steady' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-black text-white">{s.subject}</span>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-lg bg-gradient-to-r ${s.color} text-white`}>{s.level}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5 mb-1">
                        <div className={`h-1.5 rounded-full bg-gradient-to-r ${s.color}`} style={{ width: `${s.pct}%` }} />
                      </div>
                      <p className="text-xs text-white/40">{s.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────────── */}
      <section id="testimonials" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-black mb-3 text-white">Parents across Kenya</h2>
            <p className="text-white/50 text-lg">Nairobi. Kisumu. Mombasa. Nakuru. Eldoret.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                quote: 'Learning Compass explained simultaneous equations using unga prices at 11pm. My son finally got it after struggling the whole term.',
                author: 'Grace M.',
                location: 'Nairobi',
                feature: 'Learning Compass',
                color: 'from-amber-500 to-orange-500',
              },
              {
                quote: "The Academic Clinic told us my daughter's problem wasn't Maths overall — it was specifically fractions and percentages. We fixed exactly that in two weeks.",
                author: 'Peter O.',
                location: 'Kisumu',
                feature: 'Academic Clinic',
                color: 'from-violet-500 to-purple-500',
              },
              {
                quote: "The pathway report told us in Grade 8 that our son belongs in STEM. We stopped guessing. His Form 1 teacher confirmed it immediately.",
                author: 'Fatuma A.',
                location: 'Mombasa',
                feature: 'Pathway Guide',
                color: 'from-green-500 to-emerald-500',
              },
              {
                quote: "My son is at Brookhouse. I couldn't find anything that understood IGCSE grading. EduNexus showed me exactly which subjects he needs for medicine A-Levels. Worth every shilling.",
                author: 'Dr. Wanjiku K.',
                location: 'Karen, Nairobi',
                feature: 'Cambridge IGCSE',
                color: 'from-blue-500 to-cyan-500',
              },
            ].map((t, idx) => (
              <div key={idx} className="group relative">
                <div className={`absolute -inset-0.5 bg-gradient-to-r ${t.color} rounded-3xl blur opacity-10 group-hover:opacity-20 transition`} />
                <div className="relative bg-white/5 border border-white/10 rounded-3xl p-7 hover:bg-white/8 transition-all h-full flex flex-col">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                  </div>
                  <p className="text-white/80 leading-relaxed flex-1 mb-5">&ldquo;{t.quote}&rdquo;</p>
                  <div className="border-t border-white/10 pt-4 flex items-center justify-between">
                    <div>
                      <div className="font-black text-white">{t.author}</div>
                      <div className="text-sm text-white/50">{t.location}</div>
                    </div>
                    <div className={`text-xs font-black px-3 py-1 rounded-full bg-gradient-to-r ${t.color} text-white`}>
                      {t.feature}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR TEACHERS ──────────────────────────────────────────────────────── */}
      <section id="teachers" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-teal-600 to-blue-600 rounded-3xl blur-xl opacity-20" />
            <div className="relative bg-gradient-to-br from-teal-900/40 to-blue-900/40 backdrop-blur-xl border border-teal-500/20 rounded-3xl p-8 md:p-12">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 px-4 py-2 rounded-full text-sm font-black mb-5">
                    👨‍🏫 ARE YOU A TEACHER?
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
                    Free class management,<br />
                    <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                      built for CBC teachers.
                    </span>
                  </h2>
                  <p className="text-white/60 mb-6 leading-relaxed">
                    Track every student's progress, identify learning gaps by subject and strand,
                    set Compass-guided assignments, and export KNEC CBA data with one click.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3 mb-8">
                    {[
                      '✅ Class performance dashboard',
                      '✅ Learning gap radar per subject',
                      '✅ Compass-guided assignments',
                      '✅ Early warning student alerts',
                      '✅ KNEC CBA export (one click)',
                      '✅ Holiday bridge tracking',
                      '✅ Supports CBC & IGCSE classes',
                      '✅ WhatsApp parent integration',
                    ].map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-white/80">
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-xl shadow-teal-500/20"
                    >
                      Create Teacher Account Free →
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-4">
                    <span className="text-xs bg-teal-500/10 border border-teal-500/20 text-teal-300 px-3 py-1.5 rounded-full font-bold">
                      🇰🇪 CBC Kenya
                    </span>
                    <span className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300 px-3 py-1.5 rounded-full font-bold">
                      🌍 Cambridge IGCSE
                    </span>
                    <span className="text-xs bg-white/5 border border-white/10 text-white/40 px-3 py-1.5 rounded-full font-bold">
                      More curricula coming
                    </span>
                  </div>
                  <p className="text-white/30 text-xs mt-3">Free forever. No credit card needed.</p>
                </div>
                <div className="w-full md:w-64 shrink-0">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                    <div className="text-xs font-black text-white/40 uppercase tracking-wider mb-2">Class 8B — Mathematics</div>
                    {[
                      { name: 'Brian Otieno',  level: 'Below',       color: 'text-red-400',    bar: 20 },
                      { name: 'Grace Wanjiku', level: 'Approaching',  color: 'text-amber-400',  bar: 45 },
                      { name: 'Amina Juma',    level: 'Meets',        color: 'text-green-400',  bar: 70 },
                      { name: 'Kamau N.',      level: 'Exceeds',      color: 'text-purple-400', bar: 92 },
                    ].map((s, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-white/70 font-medium">{s.name}</span>
                          <span className={`font-bold ${s.color}`}>{s.level}</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${s.color.replace('text-', 'bg-')}`} style={{ width: `${s.bar}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-white/10 text-xs text-red-400 font-bold">
                      ⚠️ Brian inactive 8 days — send reminder?
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STUDY GROUPS ── */}
      <section id="groups" className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 text-pink-300 px-4 py-2 rounded-full text-sm font-black mb-5">
            <Users className="w-4 h-4" />
            STUDY GROUPS — HOLIDAY FEATURE
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-5 leading-[0.95]">
            Your classmates are scattered.
            <span className="block bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent mt-1">
              Study together anyway.
            </span>
          </h2>
          <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Boarding school students go home to 47 different counties every holiday.
            Study Groups keep the class connected — daily challenges, leaderboards, and
            the student who explains it best earns the most points.
          </p>
          <div className="grid md:grid-cols-4 gap-4 mb-10">
            {[
              { icon: '🏆', title: 'Daily Challenge', desc: 'Compass generates one question daily per subject' },
              { icon: '🥇', title: 'Leaderboard', desc: 'Compete with classmates — streaks earn bonus points' },
              { icon: '🤝', title: 'Peer Teaching', desc: 'Explain to a classmate and earn 2.5x points' },
              { icon: '🙈', title: 'Anonymous Ask', desc: 'Ask questions without anyone knowing it was you' },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.08] transition-all">
                <div className="text-3xl mb-3">{item.icon}</div>
                <div className="font-black text-white text-sm mb-2">{item.title}</div>
                <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-xl shadow-pink-500/20"
            >
              <Users className="w-5 h-5" />
              Create a Study Group →
            </Link>
            <p className="text-white/30 text-sm self-center">Max 8 members · Any subject</p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6 mb-10">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-600/8 via-purple-600/8 to-blue-600/8 rounded-3xl blur-3xl" />
        <div className="relative max-w-4xl mx-auto text-center bg-gradient-to-br from-amber-900/15 via-purple-900/15 to-blue-900/15 backdrop-blur-xl border border-white/10 rounded-3xl py-20 px-6">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-amber-500/30">
            <Compass className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-5 text-white leading-[0.95]">
            One session.
            <span className="block bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent mt-1">
              See the difference yourself.
            </span>
          </h2>
          <p className="text-xl text-white/60 mb-3 max-w-2xl mx-auto leading-relaxed">
            One full Learning Compass session. One Academic Clinic PDF report.
            Both on us. No card needed.
          </p>
          <p className="text-white/40 text-base mb-3">
            After that — choose what works for your family.
          </p>
          <p className="text-amber-300/70 font-bold mb-10">
            Hakuna tutor wa usiku — mpaka sasa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-amber-500/30 text-lg"
            >
              <Compass className="w-5 h-5" /> Start — no card needed
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 bg-white/5 border-2 border-white/15 text-white px-8 py-5 rounded-2xl font-black hover:bg-white/10 transition-all text-lg"
            >
              See plans &amp; pricing <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-white/30">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> M-PESA accepted</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> CBC & Cambridge IGCSE</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> Made in Kenya 🇰🇪</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> Works at midnight</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> Teachers free forever</span>
          </div>
        </div>
      </section>
    </>
  )
}
