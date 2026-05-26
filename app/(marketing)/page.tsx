'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import Link from 'next/link'
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
} from 'lucide-react'

const AcademicClinicDemo = dynamic(
  () => import('@/components/demo/AcademicClinicDemo'),
  { ssr: false }
)
const KcseClinicDemo = dynamic(
  () => import('@/components/demo/kcse/KcseClinicDemo'),
  { ssr: false }
)

export default function LandingPage() {
  const [demoOpen,      setDemoOpen]      = useState(false)
  const [kcseDemoOpen,  setKcseDemoOpen]  = useState(false)

  return (
    <>
      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 md:pt-32 md:pb-20 text-center">

        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 px-4 py-2 rounded-full text-sm font-black mb-8 animate-in fade-in slide-in-from-top duration-700">
          <Sparkles className="w-4 h-4" />
          ACADEMIC CLINIC · KENYA&apos;S FIRST AI REPORT CARD
        </div>

        <h1
          className="text-5xl md:text-7xl font-black mb-6 leading-[0.95] animate-in fade-in slide-in-from-bottom duration-1000"
          style={{ animationDelay: '100ms' }}
        >
          <span className="block text-white/60 text-3xl md:text-4xl font-black mb-3 tracking-tight">
            In a class of 45,
          </span>
          <span className="block text-white">your child is just</span>
          <span className="block text-white">another student.</span>
          <span className="block bg-linear-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mt-3">
            Not here.
          </span>
        </h1>

        <p
          className="text-xl md:text-2xl text-white/55 max-w-2xl mx-auto mb-3 leading-relaxed animate-in fade-in duration-1000"
          style={{ animationDelay: '150ms' }}
        >
          One 7-page clinical report shows exactly where they&apos;re struggling,
          why, and what to fix this holiday.
        </p>

        <p className="text-teal-400/50 text-xs font-semibold tracking-widest uppercase mb-10">
          CBC · Cambridge IGCSE · 8-4-4 · Grade 7–12
        </p>

        <Link
          href="/signup?role=parent"
          className="group inline-flex items-center justify-center gap-2 bg-linear-to-r from-violet-500 to-purple-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-violet-500/30 text-lg mb-6"
        >
          Get My Child&apos;s Report — Free
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/35 mb-14">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400/70" /> Free first report</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400/70" /> No card needed</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400/70" /> M-PESA accepted</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400/70" /> Ready in 5 minutes</span>
        </div>

        <p className="text-xs font-black text-white/30 uppercase tracking-widest mb-4">
          See a real sample report
        </p>
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">

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
      </section>

      {/* ── WHAT'S IN THE REPORT ────────────────────────────────────────────── */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-violet-950/15 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-3 leading-tight">
              A report card tells you the score.
            </h2>
            <p className="text-xl text-white/40">
              Academic Clinic tells you the{' '}
              <span className="text-white/75 font-black">why</span>.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '🔍', title: 'Subject-by-subject diagnosis',  desc: 'Every subject scored, exact gaps identified — not just marks.' },
              { icon: '🗺️', title: 'Career & pathway guidance',     desc: 'STEM vs Arts vs Social Sciences — based on real performance data.' },
              { icon: '📅', title: '3-week holiday study plan',     desc: 'Specific topics to fix, in priority order. Ready to act on today.' },
              { icon: '🧭', title: 'Learning Compass access',       desc: "AI tutor that knows your child's exact weak points. Adapts as they improve." },
              { icon: '👩‍🏫', title: 'Teacher collaboration page',   desc: 'Share one page with their class teacher. Professional, actionable.' },
              { icon: '📊', title: 'Level 1–4 mastery tracking',    desc: 'CBC-aligned levels so you know exactly how far to the next grade.' },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 transition-all">
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="text-sm font-black text-white mb-1.5">{item.title}</h3>
                <p className="text-xs text-white/45 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THREE PILLARS ───────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-3">Three things your child gets.</h2>
            <p className="text-white/40">That a class of 45 cannot give.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">

            <div className="bg-white/3 border border-white/8 rounded-2xl p-8 flex flex-col">
              <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/20 rounded-xl flex items-center justify-center mb-4">
                <Compass className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">A tutor that knows them</h3>
              <p className="text-sm text-white/45 leading-relaxed flex-1">
                Learning Compass adapts to your child&apos;s exact level — not the class average.
                Level 1 learner or Level 4, every session is built for them specifically.
              </p>
              <span className="inline-block mt-4 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400/70 self-start">
                Available 24/7
              </span>
            </div>

            <div className="bg-white/3 border border-white/8 rounded-2xl p-8 flex flex-col">
              <div className="w-10 h-10 bg-teal-500/15 border border-teal-500/20 rounded-xl flex items-center justify-center mb-4">
                <FileText className="w-5 h-5 text-teal-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">A diagnosis, not a grade</h3>
              <p className="text-sm text-white/45 leading-relaxed flex-1">
                The Academic Clinic produces a 7-page clinical report — strand by strand, subject by subject.
                A 3-week plan built for your child&apos;s specific gaps.
              </p>
              <span className="inline-block mt-4 px-3 py-1 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400/70 self-start">
                PDF download included
              </span>
            </div>

            <div className="bg-white/3 border border-white/8 rounded-2xl p-8 flex flex-col">
              <div className="w-10 h-10 bg-violet-500/15 border border-violet-500/20 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">Their teacher, in the loop</h3>
              <p className="text-sm text-white/45 leading-relaxed flex-1">
                When your child&apos;s teacher marks work or raises a concern, you&apos;re notified instantly.
                Both you and the teacher see the same picture of your child.
              </p>
              <span className="inline-block mt-4 px-3 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400/70 self-start">
                WhatsApp + email alerts
              </span>
            </div>

          </div>
          <div className="text-center mt-12">
            <Link
              href="/signup?role=parent"
              className="group inline-flex items-center gap-2 bg-linear-to-r from-violet-500 to-purple-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-violet-500/30 text-lg"
            >
              Get My Child&apos;s Free Report
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── IGCSE BANNER ────────────────────────────────────────────────────── */}
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative">
            <div className="absolute -inset-1 bg-linear-to-r from-blue-500 to-indigo-500 rounded-3xl blur-xl opacity-15" />
            <div className="relative bg-linear-to-br from-blue-950/40 to-indigo-950/40 border border-blue-500/20 rounded-3xl px-8 py-7 flex flex-col sm:flex-row items-center gap-6">
              <Globe className="w-10 h-10 text-blue-400 shrink-0" />
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-black text-white mb-1">International school? We&apos;ve got you.</h3>
                <p className="text-sm text-white/50">
                  Brookhouse · Hillcrest · ISK · Braeburn · Cambridge IGCSE Grade A*–G tracking supported.
                </p>
              </div>
              <Link
                href="/signup?role=parent"
                className="shrink-0 inline-flex items-center gap-2 bg-linear-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-xl font-black hover:scale-105 transition-all text-sm shadow-lg"
              >
                Start Free <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-2">What parents say</h2>
            <p className="text-white/40">Across Kenya.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">

            <div className="group relative">
              <div className="absolute -inset-0.5 bg-linear-to-r from-violet-500 to-purple-500 rounded-3xl blur opacity-10 group-hover:opacity-20 transition" />
              <div className="relative bg-white/5 border border-violet-500/20 rounded-3xl p-8 h-full flex flex-col">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-violet-400 fill-violet-400" />)}
                </div>
                <p className="text-white/80 leading-relaxed flex-1 mb-5 text-base">
                  &ldquo;The Academic Clinic report showed me my daughter needed help in Chemistry — not because she&apos;s slow,
                  but because she missed a foundational concept. We fixed it in 2 weeks.&rdquo;
                </p>
                <div className="border-t border-white/10 pt-4">
                  <div className="font-black text-white">Parent</div>
                  <div className="text-sm text-violet-300/70">Grade 10 student, Nairobi</div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute -inset-0.5 bg-linear-to-r from-amber-500 to-orange-500 rounded-3xl blur opacity-10 group-hover:opacity-20 transition" />
              <div className="relative bg-white/5 border border-amber-500/20 rounded-3xl p-8 h-full flex flex-col">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-white/80 leading-relaxed flex-1 mb-5 text-base">
                  &ldquo;Parents actually cry when they read it — because finally someone told them what no teacher
                  had the time to say.&rdquo;
                </p>
                <div className="border-t border-white/10 pt-4">
                  <div className="font-black text-white">CBC Teacher</div>
                  <div className="text-sm text-amber-300/70">Nairobi, on parent reactions</div>
                </div>
              </div>
            </div>

          </div>
          <p className="text-center text-white/15 text-xs mt-8">
            Representative experiences. Individual results vary.
          </p>
        </div>
      </section>

      {/* ── PRICING PREVIEW ─────────────────────────────────────────────────── */}
      <section className="py-16 relative">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-2">Start free. Pay only if it helps.</h2>
            <p className="text-white/45">First Academic Clinic report is completely free. No card required.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: 'First report',            price: 'Free',      sub: 'No card needed',       highlight: false },
              { label: 'Per Term · 1 child',       price: 'KES 3,200', sub: 'Full access all term',  highlight: true  },
              { label: 'Family Plan · 3 children', price: 'KES 5,500', sub: 'Up to 3 children',      highlight: false },
            ].map((p, i) => (
              <div
                key={i}
                className={`rounded-2xl p-6 border text-center ${
                  p.highlight ? 'bg-violet-950/40 border-violet-500/30' : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="text-xs font-black text-white/40 mb-1.5">{p.label}</div>
                <div className={`text-2xl font-black mb-1 ${p.highlight ? 'text-violet-300' : 'text-white'}`}>
                  {p.price}
                </div>
                <div className="text-xs text-white/35">{p.sub}</div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-xs text-white/25 mb-4">Tokens from KES 500 for pay-as-you-go · M-PESA accepted · Cancel anytime</p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-white/40 hover:text-white transition font-bold text-sm"
            >
              See full pricing <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6 mb-10">
        <div className="absolute inset-0 bg-linear-to-r from-violet-600/8 via-purple-600/8 to-pink-600/8 rounded-3xl blur-3xl" />
        <div className="relative max-w-3xl mx-auto text-center bg-linear-to-br from-violet-900/15 via-purple-900/15 to-pink-900/15 backdrop-blur-xl border border-white/10 rounded-3xl py-20 px-6">
          <h2 className="text-4xl md:text-5xl font-black mb-4 text-white leading-[0.95]">
            Your child deserves to know
            <span className="block bg-linear-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mt-2">
              exactly where they stand.
            </span>
          </h2>
          <p className="text-lg text-white/50 mb-8 max-w-xl mx-auto leading-relaxed">
            Not a guess. Not a vague report card.
            A clinical diagnosis, a study plan, and a path forward.
          </p>
          <Link
            href="/signup?role=parent"
            className="group inline-flex items-center gap-2 bg-linear-to-r from-violet-500 to-purple-500 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-violet-500/30 text-lg"
          >
            Get My Child&apos;s Report — Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <div className="flex flex-wrap justify-center gap-5 mt-8 text-sm text-white/25">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400/70" /> M-PESA accepted</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400/70" /> CBC + 8-4-4 + IGCSE</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400/70" /> Made in Kenya 🇰🇪</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400/70" /> Free for teachers — always</span>
          </div>
        </div>
      </section>

      {/* ── TEACHER FOOTNOTE ────────────────────────────────────────────────── */}
      <div className="text-center py-10 border-t border-white/5">
        <p className="text-white/20 text-xs">
          Are you a teacher?{' '}
          <Link
            href="/teacher/dashboard"
            className="text-white/35 hover:text-white/50 underline underline-offset-2 transition-colors"
          >
            Free planning tools — SOW generator, lesson plans, class dashboard. No card needed →
          </Link>
        </p>
      </div>

      {/* ── DEMO MODALS ─────────────────────────────────────────────────────── */}
      <AcademicClinicDemo isOpen={demoOpen}     onClose={() => setDemoOpen(false)}     />
      <KcseClinicDemo     isOpen={kcseDemoOpen} onClose={() => setKcseDemoOpen(false)} />
    </>
  )
}
