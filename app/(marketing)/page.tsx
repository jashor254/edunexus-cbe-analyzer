'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

const AcademicClinicDemo = dynamic(
  () => import('@/components/demo/AcademicClinicDemo'),
  { ssr: false }
)
const KcseClinicDemo = dynamic(
  () => import('@/components/demo/kcse/KcseClinicDemo'),
  { ssr: false }
)

type SelectedRole = 'teacher' | 'parent' | 'student' | null

const ROLES: { id: Exclude<SelectedRole, null>; label: string }[] = [
  { id: 'teacher', label: '👨‍🏫 Teacher' },
  { id: 'parent',  label: '👨‍👩‍👧 Parent'  },
  { id: 'student', label: '🎒 Student'  },
]

const TEACHER_TIMELINE = [
  { icon: '📋', label: 'SOW generated'     },
  { icon: '📖', label: 'Lesson plans sent' },
  { icon: '📊', label: 'Insights updated'  },
  { icon: '💬', label: 'Parents notified'  },
]

export default function LandingPage() {
  const [demoOpen,     setDemoOpen]     = useState(false)
  const [kcseDemoOpen, setKcseDemoOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null)

  const hero =
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
      trust:         '✓ TSC-ready formats  ·  ✓ CBC-aligned  ·  ✓ Auto lesson plans',
    }
    : selectedRole === 'student' ? {
      badge:         '🎒 For Students',
      badgeClass:    'bg-teal-500/10 border-teal-500/20 text-teal-300',
      line1:         'Finally feel like',
      line2:         'you actually get it.',
      gradientLine:  'Start exactly where you are.',
      gradientClass: 'from-teal-400 via-cyan-400 to-blue-400',
      subtitle:      'A personal tutor that meets you at your exact CBC/IGCSE level — anytime, on any device.',
      ctaHref:       '/signup?role=student',
      ctaLabel:      'Start Learning for Free',
      trust:         '✓ Free first session  ·  ✓ Works on any phone  ·  ✓ CBC/IGCSE/8-4-4',
    }
    : {
      badge:         '🇰🇪 Built for Kenyan learners',
      badgeClass:    'bg-violet-500/10 border-violet-500/20 text-violet-300',
      line1:         'Your child is capable of more',
      line2:         'than their marks show.',
      gradientLine:  'EduNexus helps them prove it.',
      gradientClass: 'from-violet-400 via-purple-400 to-pink-400',
      subtitle:      "Because every child deserves a teacher who knows exactly where they're stuck.",
      ctaHref:       '/signup?role=parent',
      ctaLabel:      'Start Free — No Card Needed',
      trust:         '✓ Free first report  ·  ✓ M-PESA accepted  ·  ✓ Works on any phone',
    }

  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32">
        <div className="max-w-[820px] mx-auto px-6 text-center">

          {/* Role selector — horizontal scroll strip on mobile */}
          <div
            className="flex justify-center gap-2 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRole(selectedRole === r.id ? null : r.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all whitespace-nowrap ${
                  selectedRole === r.id
                    ? r.id === 'teacher'
                      ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                      : r.id === 'student'
                      ? 'bg-teal-500/15 border-teal-500/35 text-teal-300'
                      : 'bg-violet-500/15 border-violet-500/35 text-violet-300'
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
            <span className={`block bg-gradient-to-r ${hero.gradientClass} bg-clip-text text-transparent mt-1 transition-all`}>
              {hero.gradientLine}
            </span>
          </h1>

          <p className="text-[18px] md:text-[20px] text-white/60 max-w-[560px] mx-auto mb-8 leading-relaxed">
            {hero.subtitle}
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {['CBC', 'Cambridge IGCSE', '8-4-4', 'Grade 7–12'].map((pill) => (
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
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-all shadow-2xl shadow-violet-600/30"
            >
              {hero.ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setDemoOpen(true)}
              className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
            >
              See a sample report →
            </button>
          </div>

          <p className="text-sm text-white/40">
            {hero.trust}
          </p>

          {/* Three benefit cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14 max-w-[760px] mx-auto text-left">
            {[
              {
                icon: '👨‍🏫',
                who: 'For Teachers',
                body: 'Plan your full term in the time it takes to mark one set of books.',
              },
              {
                icon: '👨‍👩‍👧',
                who: 'For Parents',
                body: "Stop guessing. Know exactly where your child is falling behind — and what to do about it.",
              },
              {
                icon: '🎒',
                who: 'For Students',
                body: 'Finally feel like you actually get it — with a learning partner that starts exactly where you are.',
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

      {/* ── SOCIAL PROOF STRIP ────────────────────────────────────────────────── */}
      <section className="bg-white/3 py-14 md:py-16">
        <div className="max-w-[1100px] mx-auto px-6">

          <p className="text-center text-sm font-semibold text-white/40 uppercase tracking-widest mb-10">
            Already trusted by CBC teachers and parents across Kenya
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "Brian was always failing Number Patterns. The report pinpointed exactly that strand — not just 'Mathematics is weak'. We focused on it for two weeks and his teacher noticed immediately.",
                name: "Grace W.",
                role: "Parent · Grade 8 · Westlands, Nairobi",
                tag: "Learner Blueprint",
                tagColor: "text-violet-400",
              },
              {
                quote: "I used to spend my Sunday planning. Now I generate a complete SOW in under 10 minutes — CBC-aligned, TSC-ready. It's not an exaggeration to say this changed my term.",
                name: "Mr. Omondi K.",
                role: "CBC Integrated Science Teacher · Kisumu",
                tag: "Teacher Tools",
                tagColor: "text-amber-400",
              },
              {
                quote: "My son is Form 3 and I've never understood why he's passing English but failing every comprehension exam. The strand breakdown showed it was inference — now we know what to fix.",
                name: "Peter M.",
                role: "Parent · Form 3 · Nakuru",
                tag: "Learner Blueprint",
                tagColor: "text-violet-400",
              },
            ].map((t) => (
              <div key={t.name} className="bg-white/4 border border-white/10 rounded-2xl px-6 py-5 flex flex-col">
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${t.tagColor}`}>{t.tag}</div>
                <p className="text-white/70 text-sm leading-relaxed mb-4 flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div className="text-xs text-white/50 font-semibold">{t.name}</div>
                <div className="text-xs text-white/30">{t.role}</div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── LEARNING COMPASS ──────────────────────────────────────────────────── */}
      <section id="compass" className="bg-white/3 py-20 md:py-28">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            {/* Text — left */}
            <div>
              <span className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-3 block">
                Learning Compass
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
                The tutor that knows exactly where your child got lost.
              </h2>
              <p className="text-white/60 leading-relaxed mb-6">
                Most children don&apos;t struggle because they&apos;re not trying. They struggle because
                nobody has ever met them exactly where they are.
                <br /><br />
                The Learning Compass 🧭 learns your child&apos;s exact level in every subject and teaches
                them at precisely that level — Level 1 or Level 4, every session is built just for them.
                Available anytime, on any device.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Adapts to each student's CBC/IGCSE level",
                  'Explains concepts in simple Kenyan context',
                  'Tracks mastery concept by concept',
                  'Career-aware — connects learning to goals',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/60">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup?role=parent"
                className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
              >
                Try your child&apos;s first free session →
              </Link>
              <p className="text-xs text-white/40 mt-2">First session is on us. No card needed.</p>
            </div>

            {/* Chat mockup — right */}
            <div className="flex justify-center">
              <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur overflow-hidden w-full max-w-sm">
                {/* Header */}
                <div className="bg-white/8 border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">🧭 Learning Compass</div>
                    <div className="text-xs text-white/40">Brian, Grade 8</div>
                  </div>
                  <span className="text-xs font-semibold bg-teal-500/20 text-teal-300 px-2.5 py-1 rounded-full whitespace-nowrap">
                    Maths · Level 2
                  </span>
                </div>

                {/* Chat body */}
                <div className="p-4 space-y-3">

                  {/* AI bubble */}
                  <div className="flex gap-2 items-start">
                    <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 text-sm">
                      🧭
                    </div>
                    <div className="bg-teal-500/20 text-white/90 text-sm rounded-2xl rounded-tl-none px-4 py-3 max-w-[220px] leading-relaxed">
                      Let&apos;s start with fractions. If you have 3 chapatis and eat 1, what
                      fraction is left?
                    </div>
                  </div>

                  {/* Student reply */}
                  <div className="flex justify-end">
                    <div className="bg-white/10 text-white/70 text-sm rounded-2xl rounded-tr-none px-4 py-3 max-w-[160px]">
                      2/3?
                    </div>
                  </div>

                  {/* AI follow-up */}
                  <div className="flex gap-2 items-start">
                    <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 text-sm">
                      🧭
                    </div>
                    <div className="bg-teal-500/20 text-white/90 text-sm rounded-2xl rounded-tl-none px-4 py-3 max-w-[220px] leading-relaxed">
                      Almost! You have 3 total, ate 1, so 2 remain. That makes it 2/3. Correct!
                      ✓ Let&apos;s try a harder one.
                    </div>
                  </div>

                  {/* Difficulty indicator */}
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

      {/* ── WORKS BEST WITH TEACHER — transparency section ───────────────────── */}
      <section className="py-14 md:py-16">
        <div className="max-w-[820px] mx-auto px-6">
          <div className="bg-white/4 border border-white/10 rounded-3xl px-8 py-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <p className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-2">Honest note</p>
              <h3 className="text-lg font-extrabold text-white mb-2">
                EduNexus works best when your child&apos;s teacher is on it too.
              </h3>
              <p className="text-white/50 text-sm leading-relaxed">
                When the teacher is connected, EduNexus sees their assessments, class data, and
                assignments — making the Compass and Clinic significantly more accurate.
                If the teacher isn&apos;t on EduNexus yet, you can still use everything — you
                just enter your child&apos;s scores yourself. It still works. But with the teacher,
                it&apos;s a different level.
              </p>
            </div>
            <div className="shrink-0">
              <Link
                href="/signup?role=teacher"
                className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-500/30 text-teal-300 hover:bg-teal-500/30 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap"
              >
                Invite your child&apos;s teacher →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── ACADEMIC CLINIC ───────────────────────────────────────────────────── */}
      <section id="clinic" className="bg-white/5 py-20 md:py-28">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            {/* Report mockup — left */}
            <div className="order-2 md:order-1 flex justify-center">
              <div className="relative">
                {/* Back card — peeks behind */}
                <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-2xl rotate-1 translate-x-2 translate-y-1" />
                {/* Front card */}
                <div className="relative bg-white/8 border border-white/15 rounded-2xl -rotate-2 w-64 p-7">
                  <div className="text-[10px] font-bold text-teal-400 tracking-[0.15em] uppercase mb-1">
                    EDUNEXUS
                  </div>
                  <div className="text-xl font-extrabold text-white mb-0.5">Learner Blueprint</div>
                  <div className="text-xs text-white/60 mb-5">Personalised Learner Intelligence Report</div>

                  <div className="border-t border-white/15 mb-4" />

                  <div className="text-base font-extrabold text-white font-black mb-0.5">Brian Otieno</div>
                  <div className="text-xs text-white/50 mb-0.5">Grade 8 · Junior School</div>
                  <div className="text-xs text-white/50 mb-5">Term 1, 2026</div>

                  <div className="border-t border-white/15 mb-4" />

                  <div className="text-xs text-white/50 mb-2">
                    Overall Competency:{' '}
                    <span className="font-bold text-white">DEVELOPING</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold px-3 py-1 rounded-full">
                      Level 2
                    </span>
                  </div>
                  <div className="text-xs text-green-400 font-semibold mb-6">
                    Trajectory: IMPROVING ↑
                  </div>

                  <div className="border-t border-white/15 pt-3">
                    <div className="text-[10px] text-white/25">edunexus.co.ke · CONFIDENTIAL</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Text — right */}
            <div className="order-1 md:order-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 block">
                Learner Blueprint
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
                A diagnosis, not just a grade.
              </h2>
              <p className="text-white/60 leading-relaxed mb-6">
                Your child gets marks. You get a number. But what does it mean? What&apos;s
                actually wrong? What do you fix first?
                <br /><br />
                When the report lands in your inbox, you won&apos;t have to wonder anymore. You&apos;ll
                see exactly which strand is holding your child back, a 3-week plan to fix it, and — for
                the first time — a clear sense that you know what to do next.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Strand-by-strand diagnosis per subject',
                  'Career and pathway guidance (CBC Junior)',
                  '3-week holiday study plan',
                  'PDF sent to your email automatically',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/60">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>

              <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
                Sample reports
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={() => setDemoOpen(true)}
                  className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/8 transition-all text-left"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">Brian Otieno</div>
                    <div className="text-xs text-white/40">CBC · Grade 8</div>
                  </div>
                </button>

                <button
                  onClick={() => setKcseDemoOpen(true)}
                  className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/8 transition-all text-left"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">James Kamau</div>
                    <div className="text-xs text-white/40">8-4-4 · Form 3</div>
                  </div>
                </button>
              </div>

              <Link
                href="/signup?role=parent"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-7 py-3.5 rounded-xl font-bold hover:scale-105 transition-all shadow-2xl shadow-violet-600/30"
              >
                Get My Child&apos;s Free Report
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── TEACHER SECTION ───────────────────────────────────────────────────── */}
      <section id="teachers" className="bg-white/3 py-20 md:py-28">
        <div className="max-w-[1100px] mx-auto px-6">

          <div className="text-center mb-12">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 block">
              For Teachers
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
              A full term planned.<br />Before the bell rings Monday.
            </h2>
            <p className="text-white/60 leading-relaxed max-w-[640px] mx-auto">
              You have 40+ students, end-of-term reports due, a TSC inspection coming, and a
              WhatsApp group full of parent messages you haven&apos;t had time to answer. We know that
              reality — because this was built by people who&apos;ve lived it.
              <br /><br />
              EduNexus handles the paperwork so you can focus on the teaching. Schemes of work,
              lesson plans, and class insights — ready when you need them, formatted the way TSC
              expects them.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {[
              {
                icon: '📋',
                title: 'SOW Generator',
                body: 'Your full Scheme of Work — CBC-aligned, TSC inspection ready — generated in minutes, not a full Sunday afternoon.',
              },
              {
                icon: '📖',
                title: 'Lesson Plan Generator',
                body: "Every Friday, your next week's lesson plans land automatically. Objectives, activities, assessments — done before you leave school.",
              },
              {
                icon: '📊',
                title: 'Class Dashboard',
                body: "See every student's Learning Compass level at a glance. Know who needs help before you find out the hard way in a parent meeting.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-white/3 border border-white/10 rounded-2xl p-6 hover:bg-white/5 hover:scale-[1.02] transition-all"
              >
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>

          {/* Automation timeline */}
          <div className="mb-10">
            <p className="text-center text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-4">
              Your week on autopilot
            </p>
            <div
              className="flex items-center justify-center overflow-x-auto [&::-webkit-scrollbar]:hidden pb-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {TEACHER_TIMELINE.map((step, i) => (
                <div key={step.label} className="flex items-center shrink-0">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-base">{step.icon}</span>
                    <span className="text-[10px] text-teal-400 font-medium whitespace-nowrap">
                      {step.label}
                    </span>
                  </div>
                  {i < TEACHER_TIMELINE.length - 1 && (
                    <div className="w-8 md:w-14 shrink-0 mx-2 border-t border-dashed border-teal-500/30" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/teacher/dashboard"
              className="text-amber-400 hover:text-amber-300 font-semibold transition-colors"
            >
              Go to Teacher Dashboard →
            </Link>
            <p className="text-xs text-white/40 mt-2">Trusted by CBC teachers from Nairobi to Kisumu.</p>
          </div>

        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section className="bg-white/5 py-20 md:py-28">
        <div className="max-w-[800px] mx-auto px-6 text-center">

          <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-3">
            Three steps. Five minutes.
          </h2>
          <p className="text-white/60 mb-14">
            From scores to insights — in the time it takes to make chai.
          </p>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting dashed line — desktop only */}
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px border-t-2 border-dashed border-white/10" />

            {[
              {
                num: '01',
                icon: '📝',
                color: '#a78bfa',
                title: "Enter your child's scores",
                body: 'Type in their latest term results or mid-term marks. Takes 2–3 minutes.',
              },
              {
                num: '02',
                icon: '📊',
                color: '#2dd4bf',
                title: 'Get the full picture',
                body: '7-page clinical report generated instantly. Subject by subject, strand by strand.',
              },
              {
                num: '03',
                icon: '🚀',
                color: '#fbbf24',
                title: 'Follow the plan',
                body: "3-week study plan + Learning Compass sessions. You'll know exactly what to tackle first — and in which subject.",
              },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center">
                <div className="w-20 h-20 bg-white/3 border border-white/10 rounded-2xl flex flex-col items-center justify-center mb-5 relative z-10">
                  <span className="text-2xl mb-1">{step.icon}</span>
                  <span className="text-[10px] font-bold" style={{ color: step.color }}>
                    {step.num}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 5 TUTORS SECTION ──────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-[860px] mx-auto px-6">

          {/* Label */}
          <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest text-center mb-5">
            The honest maths
          </p>

          {/* Headline */}
          <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight tracking-[-0.02em] text-center mb-5">
            You don&apos;t need 5 remedial teachers.
          </h2>
          <p className="text-lg text-white/50 text-center max-w-xl mx-auto leading-relaxed mb-14">
            Your child&apos;s school teacher already knows the CBC curriculum. EduNexus makes sure they know your child too — and fills every gap in between.
          </p>

          {/* Side-by-side comparison */}
          <div className="grid md:grid-cols-2 gap-5 mb-10">

            {/* Old way */}
            <div className="bg-white/3 border border-white/8 rounded-3xl p-8">
              <p className="text-[11px] font-black text-white/25 uppercase tracking-widest mb-6">
                The old way
              </p>
              <ul className="space-y-4">
                {[
                  { subject: 'Mathematics',  cost: 'KES 2,000/session' },
                  { subject: 'English',      cost: 'KES 1,500/session' },
                  { subject: 'Kiswahili',    cost: 'KES 1,500/session' },
                  { subject: 'Sciences',     cost: 'KES 2,000/session' },
                  { subject: 'Humanities',   cost: 'KES 1,500/session' },
                ].map(({ subject, cost }) => (
                  <li key={subject} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                      <span className="text-sm text-white/50">Remedial teacher — {subject}</span>
                    </div>
                    <span className="text-sm font-bold text-white/30 shrink-0">{cost}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-5 border-t border-white/8 flex items-center justify-between">
                <span className="text-sm text-white/30">Monthly total</span>
                <span className="text-2xl font-black text-white/30">KES 17,000<span className="text-sm font-bold text-white/20">+</span></span>
              </div>
              <p className="text-xs text-white/20 mt-2">
                5 strangers · 5 different teaching styles · no shared picture of your child
              </p>
            </div>

            {/* EduNexus way */}
            <div className="bg-teal-500/6 border-2 border-teal-500/25 rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl" />
              <p className="text-[11px] font-black text-teal-400 uppercase tracking-widest mb-6">
                The EduNexus way
              </p>
              <ul className="space-y-4">
                {[
                  { who: "Your child's school teacher",   role: 'Teaches · marks · knows the child' },
                  { who: 'Learning Compass (AI tutor)',    role: 'Personalised sessions · every subject' },
                  { who: 'Learner Blueprint',               role: 'Who your child is becoming — and what comes next' },
                  { who: 'Parent dashboard',               role: 'You see everything in real time' },
                  { who: 'Career intelligence',            role: 'Where it all points — from day one' },
                ].map(({ who, role }) => (
                  <li key={who} className="flex items-start gap-3">
                    <div className="w-4 h-4 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/80">{who}</p>
                      <p className="text-xs text-white/35 mt-0.5">{role}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-5 border-t border-teal-500/15 flex items-center justify-between">
                <span className="text-sm text-teal-400/60">Per term</span>
                <span className="text-2xl font-black text-teal-300">KES 2,499</span>
              </div>
              <p className="text-xs text-teal-400/40 mt-2">
                One platform · one teacher relationship · five subjects covered
              </p>
            </div>
          </div>

          {/* Bottom line */}
          <div className="bg-white/3 border border-white/8 rounded-2xl px-8 py-6 text-center">
            <p className="text-white/70 leading-relaxed max-w-2xl mx-auto">
              Remedial teachers solve last term&apos;s problems. EduNexus closes the gap while the term is still running — so by results day, you&apos;re not surprised.
            </p>
          </div>

        </div>
      </section>

      {/* ── CLOSING CTA ───────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32">
        <div className="max-w-[600px] mx-auto px-6 text-center">

          <h2
            className="font-extrabold leading-tight tracking-[-0.02em] text-white mb-4"
            style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}
          >
            The first report is on us.
          </h2>
          <p className="text-white/55 text-lg mb-10 leading-relaxed">
            See exactly where your child stands — before you spend a single shilling.
          </p>

          <Link
            href="/signup?role=parent"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-all shadow-2xl shadow-violet-600/30"
          >
            Get My Child&apos;s Free Report
            <ArrowRight className="w-5 h-5" />
          </Link>

          <p className="text-sm text-white/35 mt-5">
            ✓ No card needed &nbsp;·&nbsp; ✓ M-PESA accepted &nbsp;·&nbsp; ✓ Works on any phone
          </p>

          <p className="text-xs text-white/25 mt-4">
            Ready to see full pricing?{' '}
            <Link href="/pricing" className="text-violet-400 hover:text-violet-300 transition-colors">
              View plans →
            </Link>
          </p>

        </div>
      </section>

      {/* ── DEMO MODALS ───────────────────────────────────────────────────────── */}
      <AcademicClinicDemo isOpen={demoOpen}     onClose={() => setDemoOpen(false)}     />
      <KcseClinicDemo     isOpen={kcseDemoOpen} onClose={() => setKcseDemoOpen(false)} />
    </>
  )
}
