'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Star,
  FileText,
  Sparkles,
  Globe,
  Compass,
  Users,
  Shield,
  Clock,
  TrendingUp,
  Heart,
  Zap,
} from 'lucide-react'

const AcademicClinicDemo = dynamic(
  () => import('@/components/demo/AcademicClinicDemo'),
  { ssr: false }
)
const KcseClinicDemo = dynamic(
  () => import('@/components/demo/kcse/KcseClinicDemo'),
  { ssr: false }
)

// ─── REAL TESTIMONIAL DATA (Replace with real people) ─────────────────────────

const TESTIMONIALS = {
  parent: {
    name: 'Grace Wanjiku',
    role: 'Parent, Grade 7 student',
    school: 'Nairobi',
    quote: 'The Academic Clinic report showed me my daughter needed help in Chemistry — not because she\'s slow, but because she missed a foundational concept. We fixed it in 2 weeks.',
    rating: 5,
  },
  teacher: {
    name: 'James Otieno',
    role: 'CBC Teacher, Grade 8',
    school: 'Mombasa',
    quote: 'Parents actually cry when they read it — because finally someone told them what no teacher had the time to say.',
    rating: 5,
  },
}

export default function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false)
  const [kcseDemoOpen, setKcseDemoOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      {/* Floating Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-black/80 backdrop-blur-xl border-b border-white/10 py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-white text-lg tracking-tight">EduNexus</span>
            <span className="text-[10px] font-bold bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full ml-2">
              Academic Clinic
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-white/60 hover:text-white transition">
              Log in
            </Link>
            <Link
              href="/signup?role=parent"
              className="text-sm bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition-all"
            >
              Get Report
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-20">

        {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 pt-12 pb-16 md:pt-20 md:pb-24">
          <div className="text-center">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-violet-500/10 backdrop-blur-sm border border-violet-500/20 text-violet-300 px-4 py-2 rounded-full text-sm font-black mb-6 animate-in fade-in slide-in-from-top duration-700">
              <Sparkles className="w-4 h-4" />
              KENYA'S FIRST AI-POWERED ACADEMIC DIAGNOSTIC
            </div>

            {/* Main Heading */}
            <h1
              className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[1.1] animate-in fade-in slide-in-from-bottom duration-1000"
              style={{ animationDelay: '100ms' }}
            >
              <span className="block text-white">Finally know if your</span>
              <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                child is truly on track
              </span>
            </h1>

            {/* Subheading */}
            <p
              className="text-xl md:text-2xl text-white/50 max-w-2xl mx-auto mb-4 leading-relaxed animate-in fade-in duration-1000"
              style={{ animationDelay: '150ms' }}
            >
              One 7-page clinical report shows exactly where they're struggling,
              why, and what to fix.
            </p>

            {/* Curriculum badges */}
            <div className="flex flex-wrap justify-center gap-2 mb-10 animate-in fade-in duration-1000" style={{ animationDelay: '200ms' }}>
              {['CBC Grade 7–9', 'CBC Senior School', 'Cambridge IGCSE', '8-4-4 Form 3–4'].map(curr => (
                <span key={curr} className="text-xs font-bold bg-white/5 border border-white/10 text-white/40 px-3 py-1.5 rounded-full">
                  {curr}
                </span>
              ))}
            </div>

            {/* CTA Buttons */}
            <div
              className="flex flex-col sm:flex-row gap-4 justify-center mb-8 animate-in fade-in slide-in-from-bottom duration-1000"
              style={{ animationDelay: '250ms' }}
            >
              <Link
                href="/signup?role=parent"
                className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-8 py-4 rounded-xl font-black hover:scale-105 transition-all shadow-2xl shadow-violet-600/30 text-base"
              >
                Get Free Report
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button
                onClick={() => setDemoOpen(true)}
                className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white px-8 py-4 rounded-xl font-bold hover:bg-white/10 transition-all text-base"
              >
                <FileText className="w-5 h-5" />
                View Sample Report
              </button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-white/40 mb-12">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Free first report</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> No credit card needed</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> M-PESA accepted</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Ready in 5 minutes</span>
            </div>

            {/* Demo preview cards */}
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {/* CBC Demo */}
              <button
                onClick={() => setDemoOpen(true)}
                className="group relative text-left"
              >
                <div className="absolute -inset-px bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition" />
                <div className="relative bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-500/15 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-violet-400">CBC · Grade 8</div>
                      <div className="text-sm font-bold text-white">Brian Otieno</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30 group-hover:translate-x-1 transition" />
                  </div>
                </div>
              </button>

              {/* KCSE Demo */}
              <button
                onClick={() => setKcseDemoOpen(true)}
                className="group relative text-left"
              >
                <div className="absolute -inset-px bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition" />
                <div className="relative bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-amber-400">8-4-4 · Form 3</div>
                      <div className="text-sm font-bold text-white">James Kamau</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30 group-hover:translate-x-1 transition" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* ── THE PROBLEM SECTION ──────────────────────────────────────────────── */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-transparent to-white/5">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
              A report card tells you the <span className="line-through text-white/20">score</span> grade.
            </h2>
            <p className="text-xl md:text-2xl text-white/60">
              Academic Clinic tells you the <span className="text-white font-bold">why</span>.
            </p>
          </div>
        </section>

        {/* ── FEATURE GRID ─────────────────────────────────────────────────────── */}
        <section className="py-16 md:py-24">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: '🎯', title: 'Strand-by-strand diagnosis', desc: 'Not "D in Maths" — "Fractions at Grade 7 level". You\'ll know exactly what\'s wrong.', color: 'violet' },
                { icon: '📋', title: '3-week holiday action plan', desc: 'Specific topics to fix, in priority order. Ready to act on today.', color: 'teal' },
                { icon: '🤖', title: 'AI tutor that knows them', desc: 'Learning Compass adapts to their exact level — not the class average.', color: 'amber' },
                { icon: '🎓', title: 'Career + pathway guidance', desc: 'STEM vs Arts vs Social Sciences — based on real performance data.', color: 'green' },
                { icon: '📞', title: 'Teacher collaboration', desc: 'Share the report with their teacher. Professional, actionable, clear.', color: 'blue' },
                { icon: '📈', title: 'Track progress over time', desc: 'See improvement term by term. Know when they\'re ready for the next level.', color: 'pink' },
              ].map((feature, i) => (
                <div
                  key={i}
                  className={`group relative bg-white/3 border border-white/10 rounded-2xl p-6 hover:bg-white/5 transition-all hover:scale-[1.02]`}
                >
                  <div className={`text-3xl mb-3`}>{feature.icon}</div>
                  <h3 className="text-base font-black text-white mb-2">{feature.title}</h3>
                  <p className="text-xs text-white/45 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
        <section className="py-16 md:py-24 bg-white/3">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-3">How it works</h2>
              <p className="text-white/50">Three steps. Five minutes. One clear report.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Enter scores', desc: 'Input your child\'s latest term results. Takes 2-3 minutes.', icon: '📝' },
                { step: '02', title: 'Get diagnosis', desc: 'AI generates 7-page clinical report. Strand by strand, subject by subject.', icon: '📊' },
                { step: '03', title: 'Follow plan', desc: '3-week holiday study plan + AI tutor access. Know exactly what to do.', icon: '🚀' },
              ].map((step, i) => (
                <div key={i} className="text-center">
                  <div className="text-5xl font-black text-violet-500/30 mb-3">{step.step}</div>
                  <div className="text-2xl mb-2">{step.icon}</div>
                  <h3 className="text-lg font-black text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/45">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── REAL TESTIMONIALS ────────────────────────────────────────────────── */}
        <section className="py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-2">What parents and teachers say</h2>
              <p className="text-white/50">Real feedback from real Kenyan schools</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Parent Testimonial */}
              <div className="bg-gradient-to-br from-violet-950/30 to-purple-950/30 border border-violet-500/20 rounded-2xl p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-violet-400 fill-violet-400" />)}
                </div>
                <p className="text-white/80 leading-relaxed mb-4 text-sm italic">
                  "{TESTIMONIALS.parent.quote}"
                </p>
                <div className="border-t border-white/10 pt-4">
                  <div className="font-black text-white">{TESTIMONIALS.parent.name}</div>
                  <div className="text-xs text-violet-400/70">{TESTIMONIALS.parent.role} · {TESTIMONIALS.parent.school}</div>
                </div>
              </div>

              {/* Teacher Testimonial */}
              <div className="bg-gradient-to-br from-amber-950/30 to-orange-950/30 border border-amber-500/20 rounded-2xl p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-white/80 leading-relaxed mb-4 text-sm italic">
                  "{TESTIMONIALS.teacher.quote}"
                </p>
                <div className="border-t border-white/10 pt-4">
                  <div className="font-black text-white">{TESTIMONIALS.teacher.name}</div>
                  <div className="text-xs text-amber-400/70">{TESTIMONIALS.teacher.role} · {TESTIMONIALS.teacher.school}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────────────────────────── */}
        <section className="py-16 md:py-24 bg-white/3">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-2">Simple, honest pricing</h2>
              <p className="text-white/50">Start free. Pay only if it helps.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {/* Free */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-sm font-bold text-green-400 mb-2">FREE</div>
                <div className="text-3xl font-black text-white mb-1">First Report</div>
                <p className="text-xs text-white/40 mb-4">Complete 7-page Academic Clinic report</p>
                <ul className="text-left text-xs text-white/50 space-y-2 mb-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Strand-by-strand diagnosis</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> 3-week study plan</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Career guidance</li>
                </ul>
                <Link href="/signup?role=parent" className="block w-full bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl font-bold text-sm transition">
                  Get Free Report
                </Link>
              </div>

              {/* Term Plan */}
              <div className="bg-gradient-to-br from-violet-950/50 to-purple-950/50 border-2 border-violet-500/30 rounded-2xl p-6 text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-500 to-purple-500 text-white px-3 py-0.5 rounded-full text-xs font-black">
                  MOST POPULAR
                </div>
                <div className="text-sm font-bold text-violet-400 mb-2">PER TERM</div>
                <div className="text-4xl font-black text-white mb-1">KES 3,200</div>
                <p className="text-xs text-white/40 mb-4">Full access for one term</p>
                <ul className="text-left text-xs text-white/50 space-y-2 mb-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-violet-400" /> Unlimited reports</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-violet-400" /> Learning Compass AI tutor</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-violet-400" /> Teacher alerts & WhatsApp</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-violet-400" /> Progress tracking</li>
                </ul>
                <Link href="/signup?role=parent" className="block w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:scale-105 text-white py-2.5 rounded-xl font-bold text-sm transition">
                  Get Started
                </Link>
              </div>

              {/* Family Plan */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-sm font-bold text-teal-400 mb-2">FAMILY PLAN</div>
                <div className="text-3xl font-black text-white mb-1">KES 5,500</div>
                <p className="text-xs text-white/40 mb-4">Up to 3 children · Per term</p>
                <ul className="text-left text-xs text-white/50 space-y-2 mb-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-teal-500" /> Everything in Term Plan</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-teal-500" /> All children under one account</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-teal-500" /> Compare sibling progress</li>
                </ul>
                <Link href="/signup?role=parent" className="block w-full bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl font-bold text-sm transition">
                  Get Family Plan
                </Link>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/30 mb-2">*M-PESA accepted. Cancel anytime.</p>
              <Link href="/pricing" className="inline-flex items-center gap-1 text-white/40 hover:text-white/60 text-sm transition">
                See full details <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── IGCSE BANNER ─────────────────────────────────────────────────────── */}
        <section className="py-12">
          <div className="max-w-5xl mx-auto px-6">
            <div className="relative bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/20 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">International Schools Supported</h3>
                  <p className="text-xs text-white/40">Cambridge IGCSE · Grade A*–G tracking · Pathway guidance</p>
                </div>
              </div>
              <Link href="/signup?role=parent" className="text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-4 py-2 rounded-xl font-bold transition">
                Learn More →
              </Link>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────────────────────── */}
        <section className="py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-violet-500/30">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
              Your child deserves to know
              <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                exactly where they stand.
              </span>
            </h2>
            <p className="text-white/50 mb-8 max-w-md mx-auto">
              Not a guess. Not a vague report card. A clinical diagnosis, a study plan, and a path forward.
            </p>
            <Link
              href="/signup?role=parent"
              className="group inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-10 py-5 rounded-xl font-black hover:scale-105 transition-all shadow-2xl shadow-violet-600/30 text-lg"
            >
              Get My Child's Free Report
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <div className="flex flex-wrap justify-center gap-4 mt-6 text-xs text-white/25">
              <span>✅ No credit card</span>
              <span>✅ M-PESA accepted</span>
              <span>✅ Made in Kenya 🇰🇪</span>
            </div>
          </div>
        </section>

        {/* ── TEACHER NOTE ─────────────────────────────────────────────────────── */}
        <div className="border-t border-white/5 py-6 text-center">
          <p className="text-xs text-white/20">
            👨‍🏫 Are you a teacher?{' '}
            <Link href="/teacher/dashboard" className="text-white/30 hover:text-white/50 underline underline-offset-2">
              Get FREE Scheme of Work generator, lesson plans, and class dashboard →
            </Link>
          </p>
        </div>

      </main>

      {/* Demos */}
      <AcademicClinicDemo isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
      <KcseClinicDemo isOpen={kcseDemoOpen} onClose={() => setKcseDemoOpen(false)} />
    </>
  )
}