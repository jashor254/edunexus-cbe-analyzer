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

export default function LandingPage() {
  const [demoOpen,     setDemoOpen]     = useState(false)
  const [kcseDemoOpen, setKcseDemoOpen] = useState(false)

  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32">
        <div className="max-w-[820px] mx-auto px-6 text-center">

          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 px-4 py-1.5 rounded-full text-sm font-semibold mb-8">
            🇰🇪 Built for Kenyan learners
          </div>

          <h1
            className="font-extrabold leading-[1.05] tracking-[-0.02em] mb-6"
            style={{ fontSize: 'clamp(44px, 7vw, 72px)' }}
          >
            <span className="block text-white">Your child is capable of more</span>
            <span className="block text-white">than their marks show.</span>
            <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mt-1">
              EduNexus helps them prove it.
            </span>
          </h1>

          <p className="text-[18px] md:text-[20px] text-white/60 max-w-[560px] mx-auto mb-8 leading-relaxed">
            Because every child deserves a teacher who knows exactly where they&apos;re stuck.
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
              href="/signup?role=parent"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-all shadow-2xl shadow-violet-600/30"
            >
              Start Free — No Card Needed
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
            ✓ Free first report &nbsp;·&nbsp; ✓ M-PESA accepted &nbsp;·&nbsp; ✓ Works on any phone
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
                quote: "My son went from a C to a B in Mathematics this term. The report showed us exactly which strands he was failing — we never knew that before.",
                name: "Grace Wanjiku",
                role: "Parent of Grade 8 student, Nairobi",
              },
              {
                quote: "I generated my entire Term 2 scheme of work in one sitting. TSC inspection is no longer something I dread.",
                name: "Mr. Omondi",
                role: "CBC Science Teacher, Kisumu",
              },
              {
                quote: "The report told me things about my Form 3 son that I had been trying to figure out for two years. It was like finally getting a straight answer.",
                name: "Peter Muthoni",
                role: "Parent of Form 3 student, Nakuru",
              },
            ].map((t) => (
              <div key={t.name} className="bg-white/4 border border-white/10 rounded-2xl px-6 py-5">
                <p className="text-white/70 text-sm leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                <div className="text-xs text-white/40 font-semibold">— {t.name}</div>
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
                  <div className="text-xl font-extrabold text-white mb-0.5">Academic Clinic</div>
                  <div className="text-xs text-white/60 mb-5">Personalised Clinical Learning Report</div>

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
                Academic Clinic
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
