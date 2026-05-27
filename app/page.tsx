'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  Sparkles,
  FileText,
  Users,
  BookOpen,
  ClipboardList,
  Star,
  ArrowRight,
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
  const [demoOpen, setDemoOpen] = useState(false)
  const [kcseDemoOpen, setKcseDemoOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <span className="font-bold text-white text-lg">EduNexus</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/teacher/dashboard"
              className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block"
            >
              For Teachers
            </Link>
            <Link
              href="/login"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup?role=parent"
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <p className="text-white/40 text-2xl md:text-3xl mb-4 leading-snug">
            In a class of 45 learners,
          </p>
          <h1 className="text-5xl md:text-7xl font-black leading-tight">
            <span className="text-white block">your child is just</span>
            <span className="text-white block">another student.</span>
          </h1>
          <h1 className="text-5xl md:text-7xl font-black mt-8 bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Not here.
          </h1>
          <p className="mt-10 text-white/50 text-xl max-w-lg mx-auto leading-relaxed">
            EduNexus gives every child three things a classroom never can.
          </p>
          <a
            href="#products"
            className="inline-block mt-10 px-8 py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all"
          >
            See What Your Child Gets →
          </a>
        </div>
      </section>

      {/* ── PRODUCT 1: LEARNING COMPASS ── */}
      <section id="products" className="py-24 px-4">
        <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-16 flex flex-col gap-12">

          {/* Left — text */}
          <div className="relative">
            <span className="absolute -top-4 -left-2 text-8xl font-black text-white/10 select-none leading-none">
              01
            </span>
            <div className="relative">
              <p className="text-amber-400 text-xs font-black uppercase tracking-widest mb-4">
                Learning Compass
              </p>
              <h2 className="text-4xl md:text-5xl font-black leading-tight mb-6">
                A tutor that knows<br />your child by name.
              </h2>
              <div className="text-white/55 text-base leading-relaxed space-y-4 mb-8">
                <p>
                  Every teacher has 45 students.<br />
                  Learning Compass has one — yours.
                </p>
                <p>
                  Before your child&apos;s first session, Compass already knows their subject levels,
                  their weak topics, and where they left off last time.
                </p>
                <p>
                  It never lectures. It never gives answers.<br />
                  It asks questions until your child figures it out themselves.
                </p>
                <p>
                  That&apos;s the difference between teaching a class and teaching a child.
                </p>
              </div>
              <ul className="space-y-2 text-white/45 text-sm">
                {[
                  'Adapts to Level 1–4 (CBC) or Grade A*–G (IGCSE)',
                  'Every subject — Maths, English, Sciences, Kiswahili',
                  'Knows weak points before session 1',
                  'Never gives direct answers — Socratic method',
                  'CBC · Cambridge IGCSE · 8-4-4 supported',
                  'Available every day including school holidays',
                ].map((f) => (
                  <li key={f}>— {f}</li>
                ))}
              </ul>
              <Link
                href="/signup?role=parent"
                className="group inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:text-white hover:bg-amber-500/25 px-6 py-3 rounded-xl font-black text-sm transition-all mt-6"
              >
                Try Learning Compass Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Right — Chat mockup */}
          <div className="rounded-2xl bg-slate-900 border border-white/8 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <span className="text-amber-400 text-xs font-black">LC</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Learning Compass</p>
                <p className="text-xs text-white/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Active · Mathematics · Level 2
                </p>
              </div>
            </div>

            {/* Chat */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {/* Student */}
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-white/8 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white/85">
                  I don&apos;t understand how to find x when there&apos;s an x² in the equation
                </div>
              </div>
              {/* Compass */}
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-amber-500/10 border border-amber-500/20 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/85">
                  Good question. Let&apos;s think carefully.<br />
                  If I told you that x × x = 9,<br />
                  what would x have to be?
                </div>
              </div>
              {/* Student */}
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-white/8 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white/85">
                  3? Because 3 × 3 = 9
                </div>
              </div>
              {/* Compass */}
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-amber-500/10 border border-amber-500/20 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/85">
                  Exactly right.<br />
                  You just solved your first quadratic.<br /><br />
                  Now — what if x × x = 16?<br />
                  There are actually two answers.<br />
                  Can you find both?
                </div>
              </div>
              {/* Typing indicator */}
              <div className="flex justify-start">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/8 text-xs text-white/30">
              Session 3 · Guides thinking — never gives answers
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODUCT 2: ACADEMIC CLINIC ── */}
      <section className="py-24 px-4 bg-violet-950/20">
        <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-16 flex flex-col gap-12">

          {/* Left — Report visual */}
          <div className="rounded-2xl bg-slate-900 border border-white/8 overflow-hidden flex flex-col">
            {/* Window chrome */}
            <div className="px-4 py-3 border-b border-white/8 flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/60" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <span className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs text-white/30 ml-2">academic_clinic_report.pdf</span>
            </div>

            {/* Report content */}
            <div className="p-6 flex-1">
              <div className="text-center mb-6">
                <p className="text-xs text-white/40 uppercase tracking-widest">EduNexus · Academic Clinic</p>
                <p className="text-white font-bold mt-1">Clinical Assessment Report</p>
                <p className="text-xs text-white/35 mt-0.5">Grade 9 · Term 1 · 2026</p>
              </div>

              <div className="space-y-2 mb-6">
                {[
                  '01 · Clinical Overview',
                  '02 · Subject Performance Matrix',
                  '03 · Learning Gap Analysis',
                  '04 · 3-Week Holiday Study Plan',
                  '05 · Pathway / Career Guidance',
                  '06 · Learning Compass Guidance',
                  '07 · Teacher Collaboration Page',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 py-2 border-b border-white/5 text-sm text-white/50"
                  >
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-violet-300/60 uppercase tracking-widest">
                    CBC Junior School · Grade 7–9
                  </p>
                  <button
                    onClick={() => setDemoOpen(true)}
                    className="flex flex-col items-start gap-1 p-4 rounded-xl bg-violet-600/15 border border-violet-500/25 hover:bg-violet-600/25 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-violet-400" />
                      <span className="text-xs text-violet-300 font-semibold">CBC · Grade 8</span>
                    </div>
                    <p className="text-sm font-bold text-white">Brian Otieno</p>
                    <p className="text-xs text-white/40">See sample report →</p>
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-amber-300/60 uppercase tracking-widest">
                    8-4-4 Senior School · Form 3–4
                  </p>
                  <button
                    onClick={() => setKcseDemoOpen(true)}
                    className="flex flex-col items-start gap-1 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-amber-300 font-semibold">8-4-4 · Form 3</span>
                    </div>
                    <p className="text-sm font-bold text-white">James Kamau</p>
                    <p className="text-xs text-white/40">See KCSE report →</p>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right — text */}
          <div className="relative">
            <span className="absolute -top-4 -left-2 text-8xl font-black text-white/10 select-none leading-none">
              02
            </span>
            <div className="relative">
              <p className="text-teal-400 text-xs font-black uppercase tracking-widest mb-4">
                Academic Clinic
              </p>
              <h2 className="text-4xl md:text-5xl font-black leading-tight mb-6">
                A clinical report.<br />Not a report card.
              </h2>
              <div className="text-white/55 text-base leading-relaxed space-y-4 mb-8">
                <p>
                  A report card tells you the grade.<br />
                  The Academic Clinic tells you the <em>why</em> —<br />
                  and exactly what to do about it.
                </p>
                <p>
                  7 pages. Every subject assessed strand by strand.
                  A 3-week holiday study plan built specifically for your child&apos;s gaps.
                </p>
                <p>
                  <strong className="text-white/70">For CBC Junior School (Grade 7–9):</strong><br />
                  Which senior school pathway fits them — STEM, Social Sciences, or Arts &amp; Sports?
                  Know before Grade 10 selection.
                </p>
                <p>
                  <strong className="text-white/70">For KCSE Senior School (Form 3–4):</strong><br />
                  What does their current mean grade actually open up?
                  Which subject gap to close first to reach their target?
                </p>
              </div>
              <ul className="space-y-2 text-white/45 text-sm mb-8">
                {[
                  'Subject-by-subject clinical assessment',
                  'Identifies exact topic gaps, not just marks',
                  '3-week holiday study plan, specific to your child',
                  'CBC: Senior school pathway recommendation',
                  'KCSE: University entry + career intelligence',
                  'Teacher collaboration page (printable)',
                  'Professional PDF — shareable with anyone',
                ].map((f) => (
                  <li key={f}>— {f}</li>
                ))}
              </ul>
              <Link
                href="/signup?role=parent"
                className="inline-block px-7 py-3.5 rounded-2xl font-black bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 transition-all"
              >
                Get My Child&apos;s Report — Free →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODUCT 3: FOR TEACHERS ── */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-violet-400 text-xs font-black uppercase tracking-widest mb-4">
              For Teachers
            </p>
            <h2 className="text-4xl md:text-5xl font-black leading-tight mb-6">
              Everything your class needs.<br />In one place.
            </h2>
            <p className="text-white/50 text-base leading-relaxed max-w-2xl mx-auto">
              EduNexus works alongside teachers —<br />
              not around them.
              <br /><br />
              When a teacher enters class marks,
              Learning Compass already knows each
              learner&apos;s level before the next session.
              <br /><br />
              When a teacher marks an assignment
              or raises a concern, the parent is
              notified instantly — WhatsApp and email.
              <br /><br />
              Teacher planning tools — SOW generator,
              lesson plans, record of work — are built
              to CBC standards and TSC inspection ready.
              <br /><br />
              The teacher stays in control.<br />
              EduNexus handles the intelligence layer.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              {
                Icon: BookOpen,
                title: 'Scheme of Work',
                desc: 'CBC-aligned SOW generator. Strand by strand, term by term.',
              },
              {
                Icon: FileText,
                title: 'Lesson Plans',
                desc: 'TSC-ready lesson plans. Generated in minutes.',
              },
              {
                Icon: ClipboardList,
                title: 'Record of Work',
                desc: 'Digital record of work. Always inspection-ready.',
              },
              {
                Icon: Users,
                title: 'Class Dashboard',
                desc: "See every learner's level. Spot who needs help first.",
              },
            ].map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl bg-slate-900 border border-white/8 p-6"
              >
                <Icon className="w-6 h-6 text-violet-400 mb-4" />
                <p className="font-bold text-white mb-2">{title}</p>
                <p className="text-sm text-white/45 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/teacher/dashboard"
              className="inline-block px-6 py-3 rounded-xl border border-violet-500/30 text-violet-300 hover:text-white hover:border-violet-400/50 transition-colors text-sm font-semibold"
            >
              Access Teacher Tools →
            </Link>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-black text-white mb-10">What parents say</h2>
          <div className="grid md:grid-cols-2 gap-6">

            <div className="rounded-2xl bg-slate-900 border border-violet-500/25 p-6 text-left">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-violet-400 text-violet-400" />
                ))}
              </div>
              <p className="text-white/65 text-sm leading-relaxed mb-6">
                &ldquo;The Academic Clinic report showed me my daughter needed help in Chemistry —
                not because she&apos;s slow, but because she missed a foundational concept.
                We fixed it in 2 weeks.&rdquo;
              </p>
              <div>
                <p className="text-sm font-semibold text-white">Parent</p>
                <p className="text-xs text-white/35">Grade 10 student · Nairobi</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-amber-500/25 p-6 text-left">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-white/65 text-sm leading-relaxed mb-6">
                &ldquo;Parents actually cry when they read it — because finally someone told them
                what no teacher had the time to say.&rdquo;
              </p>
              <div>
                <p className="text-sm font-semibold text-white">CBC Teacher</p>
                <p className="text-xs text-white/35">Nairobi · on parent reactions</p>
              </div>
            </div>
          </div>

          <p className="mt-8 text-white/15 text-xs">
            Representative experiences. Individual results vary.
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-96 h-96 rounded-full bg-violet-600/10 blur-3xl" />
        </div>
        <div className="relative max-w-2xl mx-auto bg-violet-900/15 border border-white/10 rounded-3xl py-20 px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-black leading-tight mb-6">
            Your child deserves<br />to be truly known.
          </h2>
          <p className="text-white/45 text-base leading-relaxed mb-10 max-w-md mx-auto">
            Not by their grade.<br />
            By their actual learning level —<br />
            what they know, and what they&apos;re missing.
          </p>
          <Link
            href="/signup?role=parent"
            className="inline-block px-10 py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all mb-10"
          >
            Get My Child&apos;s Report — Free →
          </Link>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-white/40 text-sm">
            <span>✓ M-PESA accepted</span>
            <span>✓ CBC + 8-4-4 + IGCSE</span>
            <span>✓ Made in Kenya 🇰🇪</span>
            <span>✓ No card needed to start</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-5xl mx-auto">

          {/* Teacher link */}
          <div className="text-center mb-8">
            <p className="text-white/20 text-xs">
              Are you a teacher?{' '}
              <Link
                href="/teacher/dashboard"
                className="text-white/35 hover:text-white/50 underline underline-offset-2 transition-colors"
              >
                Access your tools →
              </Link>
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-white/5 pt-8">

            {/* Links row */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-6">
              <Link
                href="/legal/privacy"
                className="text-white/20 hover:text-white/40 text-xs transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/legal/terms"
                className="text-white/20 hover:text-white/40 text-xs transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/legal/refund"
                className="text-white/20 hover:text-white/40 text-xs transition-colors"
              >
                Refund Policy
              </Link>
            </div>

            {/* Developer credit */}
            <p className="text-center text-white/15 text-xs mb-2">
              Developed by{' '}
              <span className="text-white/25 font-semibold">Jashor Technologies</span>
              {' '}· © 2026
            </p>

            {/* The phrase */}
            <p className="text-center text-white/10 text-xs italic max-w-sm mx-auto">
              Built alongside Kenyan teachers,
              parents, and learners —
              growing with the system we serve.
            </p>

          </div>
        </div>
      </footer>

      {/* ── DEMO MODALS ── */}
      <AcademicClinicDemo isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
      <KcseClinicDemo isOpen={kcseDemoOpen} onClose={() => setKcseDemoOpen(false)} />
    </div>
  )
}
