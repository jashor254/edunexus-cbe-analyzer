import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { FOCUS_RING } from '../constants'
import { CompassChatMockup } from '../components/CompassChatMockup'

export const metadata = {
  title: 'Learning Compass | EduNexus',
  description:
    'How the EduNexus Learning Compass turns a Blueprint diagnosis into a targeted session — and why it isn\'t a generic AI chatbot.',
}

export default function CompassPage() {
  return (
    <>
      {/* ── KNOWING ISN'T ENOUGH ───────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-170 mx-auto px-6 text-center">
          <span className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-3 block">
            Learning Compass
          </span>
          <h1
            className="font-extrabold text-white leading-[1.1] tracking-[-0.02em] mb-6"
            style={{ fontSize: 'clamp(32px, 5.5vw, 56px)' }}
          >
            Knowing isn&apos;t enough.<br />Closing the gap is.
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-140 mx-auto">
            Blueprint tells you exactly which strand is holding a learner back. Learning Compass is
            what happens next — a session that starts from that exact gap, at the level the learner
            is actually at, instead of a generic review of the whole subject.
          </p>
        </div>
      </section>

      {/* ── EVIDENCE → REASONING → RECOMMENDATION ──────────────────────────────── */}
      <section className="bg-white/3 py-16 md:py-20">
        <div className="max-w-170 mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-5">
              Not a chatbot. A diagnosis becoming a session.
            </h2>
            <p className="text-white/55 leading-relaxed max-w-140 mx-auto">
              A generic AI chatbot answers whatever you ask it. Compass doesn&apos;t start from a
              blank prompt — it starts from real evidence about one specific learner.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: 'Evidence', body: 'The learner\'s Blueprint — built from real classroom evidence — identifies the exact strand where they\'re stuck.' },
              { step: 'Reasoning', body: 'Compass reads that specific gap, not a generic topic list, and meets the learner at the level they\'re actually at.' },
              { step: 'Recommendation', body: 'The session that follows is one thing: closing that gap, explained in familiar Kenyan context, until mastery is genuinely shown.' },
            ].map((item, i) => (
              <div key={item.step} className="bg-white/4 border border-white/10 rounded-2xl p-6">
                <div className="w-7 h-7 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-black flex items-center justify-center mb-4">
                  {i + 1}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{item.step}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPASS — CENTERPIECE ──────────────────────────────────────────────── */}
      <section id="session" className="py-20 md:py-28">
        <div className="max-w-275 mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            <div>
              <span className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-3 block">
                A Real Session
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
                The diagnosis becomes<br />the intervention.
              </h2>
              <p className="text-white/60 leading-relaxed mb-6">
                Some learners are behind because they missed one foundational concept two terms
                ago. Some understand the idea but need it explained differently. Some just need
                someone to be patient with them. Compass starts from whichever of those is actually
                true for this learner — not a one-size-fits-all lesson.
                <br /><br />
                Available anytime, on any device, in familiar Kenyan context.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Starts from the exact strand the Blueprint identified',
                  'Explains concepts in familiar Kenyan contexts',
                  'Tracks mastery concept by concept across terms',
                  'Visible to teachers and parents in real time',
                  'Connects learning to career intelligence over time',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/60">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup?role=parent"
                className={`inline-flex items-center gap-2 bg-white/8 border border-white/10 hover:bg-white/14 text-white px-7 py-3.5 rounded-xl font-bold transition-all ${FOCUS_RING}`}
              >
                Try Your Child&apos;s First Free Session
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-xs text-white/40 mt-2">First session is always free. No card needed.</p>
            </div>

            <div className="flex justify-center">
              <CompassChatMockup />
            </div>

          </div>
        </div>
      </section>

      {/* ── HOW EACH AUDIENCE USES IT ──────────────────────────────────────────── */}
      <section className="bg-white/3 py-20 md:py-28">
        <div className="max-w-225 mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 block">
              Support, Not Replacement
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
              Compass supports the learner.<br />It doesn&apos;t replace the teacher.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '🧑‍🎓',
                title: 'Learners',
                body: 'A session that starts exactly where they got stuck — not a generic tutoring menu they have to navigate themselves.',
              },
              {
                icon: '👨‍🏫',
                title: 'Teachers',
                body: 'Compass extends practice time between lessons; it never decides what a specific learner needs on its own — that professional judgment stays with the teacher, informed by what Compass and Blueprint show.',
              },
              {
                icon: '👨‍👩‍👧',
                title: 'Parents',
                body: 'Visible in real time — a parent can see what their child worked on and whether it&apos;s clicking, not just a session count.',
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

      {/* ── WHERE COMPASS SITS IN THE SYSTEM ───────────────────────────────────── */}
      <section className="py-16 md:py-20">
        <div className="max-w-170 mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-5">
            One part of one system.
          </h2>
          <p className="text-white/55 leading-relaxed mb-8">
            Compass doesn&apos;t work in isolation. It starts from a gap identified in the{' '}
            <Link href="/blueprint" className={`text-amber-400 hover:text-amber-300 font-semibold rounded ${FOCUS_RING}`}>Learner Blueprint</Link>,
            which is itself built from evidence generated in the{' '}
            <Link href="/teachers" className={`text-amber-400 hover:text-amber-300 font-semibold rounded ${FOCUS_RING}`}>Teacher Workspace</Link>.
            Over time, the same mastery record feeds a learner&apos;s{' '}
            <Link href="/career" className={`text-indigo-400 hover:text-indigo-300 font-semibold rounded ${FOCUS_RING}`}>Career Intelligence</Link>{' '}
            picture, and rolled up across a school, it&apos;s part of what{' '}
            <Link href="/schools" className={`text-blue-400 hover:text-blue-300 font-semibold rounded ${FOCUS_RING}`}>School Intelligence</Link>{' '}
            shows leadership. Same evidence, same system, different vantage points.
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
            See it start from a real gap.
          </h2>
          <p className="text-white/55 text-lg mb-8 leading-relaxed max-w-120 mx-auto">
            The first Compass session is free — no card needed. See exactly how it meets your
            child where they are.
          </p>
          <Link
            href="/signup?role=parent"
            className={`inline-flex items-center gap-2 bg-linear-to-r from-teal-500 to-cyan-500 text-white px-10 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-all shadow-2xl shadow-teal-600/30 ${FOCUS_RING}`}
          >
            Try the First Session Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-xs text-white/40 mt-4">First session is always free · No card needed</p>
        </div>
      </section>
    </>
  )
}
