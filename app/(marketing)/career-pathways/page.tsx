import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { FOCUS_RING } from '../constants'
import { CareerIntelligenceCards, CareerIntelligenceCallout } from '../components/CareerIntelligence'

export const metadata = {
  title: 'Career Intelligence | EduNexus',
  description:
    'How EduNexus builds a learner\'s career readiness picture continuously from Grade 7 — not a separate tool, the same evidence carried forward.',
}

export default function CareerIntelligencePage() {
  return (
    <>
      {/* ── EDUCATION FOR LIFE, NOT ONLY EXAMS ─────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-170 mx-auto px-6 text-center">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 block">
            Career Intelligence
          </span>
          <h1
            className="font-extrabold text-white leading-[1.1] tracking-[-0.02em] mb-6"
            style={{ fontSize: 'clamp(32px, 5.5vw, 56px)' }}
          >
            Education that prepares learners<br />for life. Not only examinations.
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-140 mx-auto">
            Do this consistently — notice early, act early, term after term — and something else
            becomes visible that a single report card never could. By the time a learner sits their
            final exam, the platform has been building their career intelligence picture for
            years — from classroom performance and learning patterns to interests, strengths, and
            growth trajectories that marks alone will never capture.
          </p>
        </div>
      </section>

      {/* ── WHAT IT ACTUALLY SIGNALS ───────────────────────────────────────────── */}
      <section id="signals" className="bg-white/3 py-20 md:py-28">
        <div className="max-w-275 mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 block">
              What It Actually Signals
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
              Not a prediction. A pattern, surfaced early.
            </h2>
            <p className="text-white/60 leading-relaxed max-w-150 mx-auto">
              Career Intelligence doesn&apos;t tell a learner what to become. It surfaces patterns
              in their own evidence — the same evidence behind their Blueprint and Compass sessions
              — early enough for a learner, a parent, and a teacher to explore them together.
            </p>
          </div>

          <CareerIntelligenceCards />

          <div className="mt-10">
            <CareerIntelligenceCallout />
          </div>
        </div>
      </section>

      {/* ── HOW EACH AUDIENCE USES IT ──────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-225 mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 block">
              One Picture, Built Over Years
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
              Not a Form 6 decision made in a hurry.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '🧑‍🎓',
                title: 'Learners',
                body: 'See strengths surfaced from real classroom evidence, not a single aptitude test taken once and treated as final.',
              },
              {
                icon: '👨‍👩‍👧',
                title: 'Parents',
                body: 'Understand where a child\'s genuine strengths are pointing, years before a pathway decision has to be made under pressure.',
              },
              {
                icon: '🏫',
                title: 'School Leaders',
                body: 'See, across the whole school, which pathways are emerging and whether the curriculum is actually building toward them.',
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

      {/* ── WHERE IT SITS IN THE SYSTEM ────────────────────────────────────────── */}
      <section className="bg-white/3 py-16 md:py-20">
        <div className="max-w-170 mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-5">
            One part of one system.
          </h2>
          <p className="text-white/55 leading-relaxed mb-8">
            Career Intelligence is downstream of everything else — the evidence a teacher records in
            the{' '}
            <Link href="/teachers" className={`text-amber-400 hover:text-amber-300 font-semibold rounded ${FOCUS_RING}`}>Teacher Workspace</Link>,
            the strand-level picture in a learner&apos;s{' '}
            <Link href="/learner-blueprint" className={`text-amber-400 hover:text-amber-300 font-semibold rounded ${FOCUS_RING}`}>Blueprint</Link>,
            and the mastery record built through{' '}
            <Link href="/compass" className={`text-teal-400 hover:text-teal-300 font-semibold rounded ${FOCUS_RING}`}>Learning Compass</Link>{' '}
            sessions — carried forward, term after term, into a picture no single exam produces.
            Seen at school scale, it&apos;s part of what{' '}
            <Link href="/schools" className={`text-blue-400 hover:text-blue-300 font-semibold rounded ${FOCUS_RING}`}>School Intelligence</Link>{' '}
            shows leadership.
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
            See what the evidence already shows.
          </h2>
          <p className="text-white/55 text-lg mb-8 leading-relaxed max-w-120 mx-auto">
            Career Intelligence is included in every Learner Blueprint — no separate subscription.
            Start with a free first report to see it for yourself.
          </p>
          <Link
            href="/signup?role=parent"
            className={`inline-flex items-center gap-2 bg-nexusteal-600 text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-nexusteal-500 hover:scale-105 transition-all shadow-2xl shadow-nexusteal-600/30 ${FOCUS_RING}`}
          >
            Get My Child&apos;s Free Report
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </>
  )
}
