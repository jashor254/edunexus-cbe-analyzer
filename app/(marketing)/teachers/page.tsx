import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { FOCUS_RING } from '../constants'
import { TeacherWorkspaceCards, TeacherAutomationTimeline } from '../components/TeacherWorkspace'

export const metadata = {
  title: 'For Teachers | EduNexus',
  description:
    'Teacher Workspace, planning tools, and Educational Intelligence built for the way CBC and 8-4-4 teachers actually work.',
}

export default function TeachersPage() {
  return (
    <>
      {/* ── TEACHING TODAY ─────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-170 mx-auto px-6 text-center">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 block">
            For Teachers
          </span>
          <h1
            className="font-extrabold text-white leading-[1.1] tracking-[-0.02em] mb-6"
            style={{ fontSize: 'clamp(32px, 5.5vw, 56px)' }}
          >
            You already notice things<br />a form can&apos;t capture.
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-140 mx-auto">
            Between marking, planning, and forty learners a class, the paperwork isn&apos;t what
            makes you a good teacher — it&apos;s what takes time away from being one. EduNexus
            exists to hand back that time, and to turn what you already do in class into evidence
            that helps every learner, not just the ones you happen to remember at report-card time.
          </p>
        </div>
      </section>

      {/* ── EDUCATIONAL INTELLIGENCE, FROM A TEACHER'S SEAT ───────────────────── */}
      <section className="bg-white/3 py-16 md:py-20">
        <div className="max-w-140 mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-5">
            Not a chatbot. Not another system to update.
          </h2>
          <p className="text-white/55 leading-relaxed">
            EduNexus doesn&apos;t ask you to explain your class to it. It reads what you&apos;re
            already producing — schemes of work, lesson plans, marked assessments — and turns that
            into a strand-by-strand picture of where every learner actually stands. Your professional
            judgment stays exactly where it belongs: with you. EduNexus surfaces evidence; it
            doesn&apos;t replace the decision a teacher makes about a specific child.
          </p>
        </div>
      </section>

      {/* ── TEACHER WORKSPACE — CENTERPIECE ───────────────────────────────────── */}
      <section id="workspace" className="py-20 md:py-28">
        <div className="max-w-275 mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 block">
              Teacher Workspace
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
              Every lesson<br />becomes evidence.
            </h2>
            <p className="text-white/60 leading-relaxed max-w-150 mx-auto">
              None of this works without the teacher. Every assessment marked, every scheme of work
              built, every lesson taught is the raw material behind a learner&apos;s{' '}
              <Link href="/blueprint" className={`text-amber-400 hover:text-amber-300 font-semibold rounded ${FOCUS_RING}`}>Blueprint</Link>{' '}
              and their Learning Compass sessions. The documentation is handled for you — CBC-aligned
              schemes of work, lesson plans formatted exactly as TSC expects — so there&apos;s more
              room left to notice the things a form can&apos;t. Walk into Monday&apos;s lesson
              prepared, not exhausted.
            </p>
          </div>

          <TeacherWorkspaceCards />

          <div className="mt-10">
            <TeacherAutomationTimeline />
          </div>
        </div>
      </section>

      {/* ── HOW A WEEK ACTUALLY WORKS ──────────────────────────────────────────── */}
      <section className="bg-white/3 py-20 md:py-28">
        <div className="max-w-170 mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-3 block">
              A Realistic Week
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5 text-center">
              How it actually fits into teaching.
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { step: 'Lesson planning', body: 'A scheme of work and the week’s lesson plans are ready before the week starts — CBC-aligned, TSC-inspection formatted, generated from what you’ve already told the system about your term.' },
              { step: 'Teaching', body: 'You teach the lesson the way you always would. Nothing about the classroom itself changes.' },
              { step: 'Evidence collection', body: 'Assessments you mark become the evidence layer — the specific, strand-level record of what each learner actually understood, not just a score.' },
              { step: 'Blueprint updates', body: 'That evidence updates each learner’s Blueprint automatically — the strand-by-strand picture parents and school leadership see too.' },
              { step: 'Compass support', body: 'Where a learner’s Blueprint shows a specific gap, Learning Compass gives them a session that starts exactly there — not a generic review.' },
              { step: 'Parent communication', body: 'Parents see the same evidence you do, in plain language, without you having to write a separate update.' },
              { step: 'Reflection', body: 'Class Intelligence shows you, at a glance, who needs support before it becomes an end-of-term conversation.' },
            ].map((item, i) => (
              <div key={item.step} className="flex gap-4 items-start bg-white/4 border border-white/8 rounded-xl p-5">
                <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <div className="text-sm font-bold text-white mb-1">{item.step}</div>
                  <p className="text-sm text-white/50 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEACHER ACADEMY ────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-20">
        <div className="max-w-140 mx-auto px-6 text-center">
          <span className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3 block">
            EduNexus Academy
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-5">
            Growth for you, not just your class.
          </h2>
          <p className="text-white/55 leading-relaxed">
            Alongside the Workspace, EduNexus includes an ongoing professional development track —
            phased modules with a portfolio and certificate path — for teachers who want to keep
            building their own practice, not only manage their classroom.
          </p>
        </div>
      </section>

      {/* ── PRICING POINTER ────────────────────────────────────────────────────── */}
      <section className="bg-white/3 py-16 md:py-20">
        <div className="max-w-140 mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-5">
            Your first Scheme of Work is on us.
          </h2>
          <p className="text-white/55 leading-relaxed mb-8">
            Every teacher&apos;s genuinely first Scheme of Work is free — no card, no wallet needed.
            After that, a Planning Bundle (one scheme, all its lesson plans, and its Record of Work)
            is KES 100 per subject, or go unlimited with Teacher Pro at KES 2,499/term. If your
            school is on EduNexus, Teacher Pro is included automatically, at no extra cost to you.
          </p>
          <Link
            href="/pricing?tab=teacher"
            className={`inline-flex items-center gap-2 bg-white/8 border border-white/10 hover:bg-white/14 text-white px-7 py-3.5 rounded-xl font-bold transition-all ${FOCUS_RING}`}
          >
            View Teacher Plans
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── CLOSING CTA ────────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32">
        <div className="max-w-170 mx-auto px-6 text-center">
          <h2
            className="font-extrabold leading-tight tracking-[-0.02em] text-white mb-4"
            style={{ fontSize: 'clamp(28px, 4.5vw, 44px)' }}
          >
            Plan your full term.<br />Before the bell rings Monday.
          </h2>
          <p className="text-white/55 text-lg mb-8 leading-relaxed max-w-120 mx-auto">
            Generate your first Scheme of Work free and see exactly what EduNexus produces before
            deciding to continue.
          </p>
          <Link
            href="/signup?role=teacher"
            className={`inline-flex items-center gap-2 bg-linear-to-r from-amber-500 to-orange-500 text-white px-10 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-all shadow-2xl shadow-amber-600/30 ${FOCUS_RING}`}
          >
            Start Planning for Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-sm text-white/50">
            {[
              'No card needed for your first scheme',
              'TSC-ready formats',
              'CBC-aligned',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
