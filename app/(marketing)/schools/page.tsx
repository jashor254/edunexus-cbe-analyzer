import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { FOCUS_RING, SCHOOL_DEMO_WA_LINK } from '../constants'
import { SchoolIntelligenceDashboard, SchoolCapabilitiesGrid } from '../components/SchoolIntelligenceDashboard'

export const metadata = {
  title: 'For Schools | EduNexus',
  description:
    'How EduNexus fits into an existing school — Educational Intelligence at the institutional level, not another school management system.',
}

export default function SchoolsPage() {
  return (
    <>
      {/* ── THE PROBLEM, AT INSTITUTIONAL SCALE ───────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-170 mx-auto px-6 text-center">
          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 block">
            For School Leaders
          </span>
          <h1
            className="font-extrabold text-white leading-[1.1] tracking-[-0.02em] mb-6"
            style={{ fontSize: 'clamp(32px, 5.5vw, 56px)' }}
          >
            The learning gaps in your school<br />are already there.
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-140 mx-auto">
            Every school already knows which learners passed and which didn&apos;t. What&apos;s
            harder to see is the gap forming three terms before an exam confirms it — one strand,
            in one subject, in one classroom, quietly widening while every report still looks fine.
            By the time an average drops, the cheap, early fix is already gone.
          </p>
        </div>
      </section>

      {/* ── WHY TRADITIONAL DATA ISN'T ENOUGH ─────────────────────────────────── */}
      <section className="bg-white/3 py-16 md:py-20">
        <div className="max-w-140 mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-5">
            Term averages tell you what happened.<br />Not what&apos;s happening.
          </h2>
          <p className="text-white/55 leading-relaxed">
            A school management system tells you who&apos;s enrolled, who paid, who attended.
            An end-of-term report tells you who passed. Neither tells you that a specific
            learner has been quietly stuck on one concept for three weeks, or that one class&apos;s
            planning has fallen behind, while there&apos;s still time to do something about it.
            That gap — between when a problem starts and when someone with the authority to help
            actually notices — is what Educational Intelligence exists to close.
          </p>
        </div>
      </section>

      {/* ── SCHOOL INTELLIGENCE — CENTERPIECE ─────────────────────────────────── */}
      <section id="dashboard" className="py-20 md:py-28">
        <div className="max-w-275 mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 block">
              School Intelligence
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
              The same evidence.<br />Every learner. Every classroom.
            </h2>
            <p className="text-white/60 leading-relaxed max-w-150 mx-auto">
              EduNexus gives school leadership the same early-noticing picture teachers and parents
              see — not just end-of-term averages, but what is happening inside every classroom,
              every week, while there is still time to respond.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            <SchoolIntelligenceDashboard />
            <SchoolCapabilitiesGrid />
          </div>
        </div>
      </section>

      {/* ── HOW IT REACHES EVERY AUDIENCE IN THE SCHOOL ───────────────────────── */}
      <section className="bg-white/3 py-20 md:py-28">
        <div className="max-w-225 mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 block">
              How It Fits Into Your School
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
              One system. Every role sees<br />what they actually need.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '👨‍🏫',
                title: 'Teachers',
                body: 'Every assessment marked and every lesson planned becomes the raw evidence the rest of the system reads. Planning documentation (schemes of work, lesson plans, TSC-ready formats) is handled automatically, so teachers spend less time on paperwork and more on noticing what a form can’t capture.',
              },
              {
                icon: '🧭',
                title: 'Learners',
                body: 'Every learner’s Blueprint shows exactly which strand needs attention, and the Learning Compass meets them there — not a generic tutoring session, but a session that starts from their actual, diagnosed gap.',
              },
              {
                icon: '👨‍👩‍👧',
                title: 'Parents',
                body: 'Parents see the same evidence teachers and school leadership see, in plain language, in time to act on it — not a surprise at the end of term.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-white/4 border border-white/10 rounded-2xl p-6"
              >
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHOOL JOURNEY — ONLY VERIFIED STEPS ──────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-170 mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 block">
              What Happens Next
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5 text-center">
              We diagnose before we recommend.
            </h2>
            <p className="text-white/55 leading-relaxed text-center max-w-140 mx-auto">
              EduNexus sells through educational consultation, not price negotiation. We understand
              your school first — learner count, curriculum, current systems, reporting needs —
              then recommend the right plan.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { step: 'A conversation', body: 'You reach out — by WhatsApp, directly with our team, no form disappearing into a queue. We ask about your school before recommending anything.' },
              { step: 'A pilot recommendation', body: 'Most schools start with a pilot on one grade or one stream, not a full rollout — a real, low-risk way to see the intelligence in action before scaling further.' },
              { step: 'Onboarding', body: 'Starter schools get guided self-serve onboarding. Growth and above include a setup session, teacher training, and data import support — scaled to the plan you choose.' },
              { step: 'Ongoing use', body: 'Teacher Pro is included automatically for every teacher at a subscribed school, at no extra cost. Support continues through the channel appropriate to your plan.' },
            ].map((item, i) => (
              <div key={item.step} className="flex gap-4 items-start bg-white/3 border border-white/8 rounded-xl p-5">
                <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
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

      {/* ── PRICING POINTER ────────────────────────────────────────────────────── */}
      <section className="bg-white/3 py-16 md:py-20">
        <div className="max-w-140 mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-5">
            Per-learner pricing, three plans.
          </h2>
          <p className="text-white/55 leading-relaxed mb-8">
            Starter, Growth, and Institution scale by learner count and by how much implementation
            support your school wants — not by how much Educational Intelligence any single learner
            receives. Every learner at a subscribed school gets the full{' '}
            <Link href="/blueprint" className={`text-blue-400 hover:text-blue-300 font-semibold rounded ${FOCUS_RING}`}>Blueprint</Link>,{' '}
            <Link href="/compass" className={`text-blue-400 hover:text-blue-300 font-semibold rounded ${FOCUS_RING}`}>Compass</Link>, and Career Intelligence experience regardless of plan.
          </p>
          <Link
            href="/pricing?tab=school"
            className={`inline-flex items-center gap-2 bg-white/8 border border-white/10 hover:bg-white/14 text-white px-7 py-3.5 rounded-xl font-bold transition-all ${FOCUS_RING}`}
          >
            View School Plans
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
            Ready to see what your school&apos;s<br />learning intelligence looks like?
          </h2>
          <p className="text-white/55 text-lg mb-8 leading-relaxed max-w-120 mx-auto">
            Book a demo and we&apos;ll show you exactly how EduNexus would work in your school.
          </p>
          <a
            href={SCHOOL_DEMO_WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 bg-linear-to-r from-violet-600 to-purple-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-all shadow-2xl shadow-violet-600/30 ${FOCUS_RING}`}
          >
            Book a School Demo
            <ArrowRight className="w-5 h-5" />
          </a>
          <p className="text-xs text-white/40 mt-4 max-w-100 mx-auto leading-relaxed">
            Opens a real WhatsApp conversation with our team — no forms, no call center. We&apos;ll
            ask a few questions about your school first, then recommend where to start.
          </p>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-sm text-white/50">
            {[
              'No contract required',
              'M-PESA accepted',
              'Your school’s data never trains our models',
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
