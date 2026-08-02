'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { FOCUS_RING } from '../constants'
import { BlueprintCardMockup, SampleReportButtons } from '../components/BlueprintCard'

const AcademicClinicDemo = dynamic(
  () => import('@/components/demo/AcademicClinicDemo'),
  { ssr: false }
)
const KcseClinicDemo = dynamic(
  () => import('@/components/demo/kcse/KcseClinicDemo'),
  { ssr: false }
)

export default function BlueprintPage() {
  const [demoOpen, setDemoOpen] = useState(false)
  const [kcseDemoOpen, setKcseDemoOpen] = useState(false)

  return (
    <>
      {/* ── WHY MARKS ALONE AREN'T ENOUGH ─────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-170 mx-auto px-6 text-center">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 block">
            Learner Blueprint
          </span>
          <h1
            className="font-extrabold text-white leading-[1.1] tracking-[-0.02em] mb-6"
            style={{ fontSize: 'clamp(32px, 5.5vw, 56px)' }}
          >
            A mark tells you what happened.<br />Blueprint tells you why.
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-140 mx-auto">
            &ldquo;Mathematics: 58%&rdquo; doesn&apos;t tell a parent or a teacher what to actually
            do next. It doesn&apos;t say which concept is holding a learner back, whether they&apos;re
            improving or sliding, or what would close the gap. A mark is a snapshot after the fact.
            Blueprint is the evidence underneath it — strand by strand, term by term.
          </p>
        </div>
      </section>

      {/* ── WHAT EVIDENCE CONTRIBUTES ──────────────────────────────────────────── */}
      <section className="bg-white/3 py-16 md:py-20">
        <div className="max-w-140 mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-5">
            Built from real classroom evidence.
          </h2>
          <p className="text-white/55 leading-relaxed">
            Blueprint isn&apos;t generated from a single test. It&apos;s built from what a teacher
            already produces — assessments marked, schemes of work taught, lessons delivered —
            read strand by strand, term over term. That&apos;s why it can say something a single
            exam can&apos;t: not just where a learner is, but where they&apos;re heading.
          </p>
        </div>
      </section>

      {/* ── BLUEPRINT — CENTERPIECE ────────────────────────────────────────────── */}
      <section id="report" className="py-20 md:py-28">
        <div className="max-w-275 mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            <div className="order-2 md:order-1 flex justify-center">
              <BlueprintCardMockup />
            </div>

            <div className="order-1 md:order-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 block">
                What A Blueprint Shows
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
                Discovered while there<br />was still time to fix it.
              </h2>
              <p className="text-white/60 leading-relaxed mb-6">
                Every term, each learner receives a strand-by-strand intelligence profile — not a
                general &ldquo;Mathematics is weak&rdquo; summary, but the specific concept holding
                them back and the precise path to close it, while it&apos;s still one strand wide
                and not a whole subject wide.
                <br /><br />
                Teachers, parents, and school leadership each see the same picture. One learner.
                One truth. Everyone informed early enough to act on it.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Strand-level diagnosis per subject — not just overall marks',
                  'Trajectory tracking — improving, plateauing, or declining',
                  '3-week targeted study plan included',
                  'Visible to the teacher, parent, and school leadership',
                  'Career and pathway guidance built in for CBC learners',
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
              <div className="mb-6">
                <SampleReportButtons
                  onOpenCBC={() => setDemoOpen(true)}
                  onOpenKCSE={() => setKcseDemoOpen(true)}
                  focusRingClass={FOCUS_RING}
                />
              </div>

              <Link
                href="/signup?role=parent"
                className={`inline-flex items-center gap-2 bg-white/8 border border-white/10 hover:bg-white/14 text-white px-7 py-3.5 rounded-xl font-bold transition-all ${FOCUS_RING}`}
              >
                Get My Child&apos;s Free Report
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── WHAT IT DOES NOT CLAIM ─────────────────────────────────────────────── */}
      <section className="bg-white/3 py-16 md:py-20">
        <div className="max-w-140 mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-5">
            What Blueprint isn&apos;t.
          </h2>
          <p className="text-white/55 leading-relaxed">
            Blueprint isn&apos;t a verdict, and it isn&apos;t a replacement for a teacher&apos;s
            judgment. It surfaces evidence — it doesn&apos;t decide what a specific child needs;
            the teacher and parent do that, informed by what Blueprint shows them. It also isn&apos;t
            a one-time score: it&apos;s a living profile, rebuilt from real evidence every term, and
            it can be wrong or incomplete the way any evidence-based read can be — which is exactly
            why it stays visible to the people who know the learner best, not treated as final.
          </p>
        </div>
      </section>

      {/* ── HOW EACH AUDIENCE USES IT ──────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-225 mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-3 block">
              One Report, Three Audiences
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
              The same evidence, read differently.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '👨‍🏫',
                title: 'Teachers',
                body: 'Blueprint tells a teacher which strand a learner needs support on before it becomes a pattern across a whole class — informing, not replacing, their own professional read of that learner.',
              },
              {
                icon: '👨‍👩‍👧',
                title: 'Parents',
                body: 'Instead of a mark with no context, parents see exactly which concept is holding their child back and what a 3-week plan to close it looks like — in plain language, in time to act.',
              },
              {
                icon: '🏫',
                title: 'School Leaders',
                body: 'Aggregated across a school, the same Blueprints become the School Intelligence dashboard — which classes are on track, which strands need attention, before an exam confirms it.',
              },
            ].map((card) => (
              <div key={card.title} className="bg-white/4 border border-white/10 rounded-2xl p-6">
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHERE BLUEPRINT SITS IN THE SYSTEM ─────────────────────────────────── */}
      <section className="bg-white/3 py-16 md:py-20">
        <div className="max-w-170 mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-5">
            One part of one system — not a standalone report.
          </h2>
          <p className="text-white/55 leading-relaxed mb-8">
            Blueprint doesn&apos;t exist on its own. It&apos;s built from evidence generated in the{' '}
            <Link href="/teachers" className={`text-amber-400 hover:text-amber-300 font-semibold rounded ${FOCUS_RING}`}>Teacher Workspace</Link>,
            it&apos;s what a{' '}
            <Link href="/compass" className={`text-teal-400 hover:text-teal-300 font-semibold rounded ${FOCUS_RING}`}>Learning Compass</Link>{' '}
            session starts from once a gap is identified, and over
            time the same evidence becomes a learner&apos;s{' '}
            <Link href="/career" className={`text-indigo-400 hover:text-indigo-300 font-semibold rounded ${FOCUS_RING}`}>Career Intelligence</Link>{' '}
            picture. Seen at school scale, it&apos;s the{' '}
            <Link href="/schools" className={`text-blue-400 hover:text-blue-300 font-semibold rounded ${FOCUS_RING}`}>School Intelligence</Link>{' '}
            dashboard leadership sees. Same evidence, same system, different vantage points.
          </p>
        </div>
      </section>

      {/* ── CLOSING CTA ────────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32">
        <div className="max-w-170 mx-auto px-6 text-center">
          <h2
            className="font-extrabold leading-tight tracking-[-0.02em] text-white mb-4"
            style={{ fontSize: 'clamp(28px, 4.5vw, 44px)' }}
          >
            See exactly where your child stands.
          </h2>
          <p className="text-white/55 text-lg mb-8 leading-relaxed max-w-120 mx-auto">
            The first Blueprint report is free — no card needed. See what it actually shows before
            deciding to continue.
          </p>
          <Link
            href="/signup?role=parent"
            className={`inline-flex items-center gap-2 bg-linear-to-r from-violet-600 to-purple-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-all shadow-2xl shadow-violet-600/30 ${FOCUS_RING}`}
          >
            Get My Child&apos;s Free Report
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-xs text-white/40 mt-4">Free first report · M-PESA accepted · Works on any phone</p>
        </div>
      </section>

      {/* ── DEMO MODALS ────────────────────────────────────────────────────────── */}
      <AcademicClinicDemo isOpen={demoOpen}     onClose={() => setDemoOpen(false)}     />
      <KcseClinicDemo     isOpen={kcseDemoOpen} onClose={() => setKcseDemoOpen(false)} />
    </>
  )
}
