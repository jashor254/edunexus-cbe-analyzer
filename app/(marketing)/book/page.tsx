import type { Metadata } from 'next'
import { Download } from 'lucide-react'
import { montserrat } from '../layout'
import { FOCUS_RING } from '../constants'

export const metadata: Metadata = {
  title: 'Engineering Educational Intelligence — Book by Dennis Kariuki | EduNexus',
  description:
    'What a learner record must be, and what a system is entitled to claim it knows. A book on evidence, trajectory, and confidence in educational AI, by EduNexus founder Dennis Kariuki. Free PDF.',
  openGraph: {
    title: 'Engineering Educational Intelligence',
    description:
      'What a learner record must be — and what a system is entitled to claim it knows.',
    url: 'https://edunexus.co.ke/book',
    type: 'website',
  },
  alternates: { canonical: 'https://edunexus.co.ke/book' },
}

const CHAPTERS = [
  { n: '1', title: 'Learning Is Not Data', blurb: 'Why a single grade destroys the exact information a teacher needs — and what a record has to keep instead.' },
  { n: '2', title: 'The Architecture of Educational Intelligence', blurb: 'The bounded-context architecture a system needs to reason from evidence rather than scores.' },
  { n: '3', title: 'The Reasoning Engine', blurb: 'How reasoning holds competing explanations open instead of collapsing to one confident verdict.' },
  { n: '4', title: 'Computational Intelligence', blurb: 'Where a language model is structurally entitled to help — and where it explicitly is not.' },
  { n: '5', title: 'Operational Architecture', blurb: 'What it takes for all of this to keep working correctly, for every learner, every day, including when something fails.' },
  { n: '6', title: 'The Institution', blurb: 'What actually changes for a school, a teacher, and a parent once the record is honest.' },
]

export default function BookPage() {
  return (
    <div className="min-h-screen">
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="pt-20 pb-16 border-b border-white/8">
        <div className="max-w-[820px] mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-brass-500/10 border border-brass-500/20 text-brass-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
            Book · First Edition, 2026
          </div>

          <h1
            className={`${montserrat.className} font-extrabold text-white leading-[1.08] tracking-tight mb-5`}
            style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}
          >
            Engineering Educational Intelligence
          </h1>

          <p className="text-lg text-white/60 italic leading-relaxed mb-3 max-w-[620px] mx-auto">
            What a learner record must be — and what a system is entitled to claim it knows.
          </p>

          <p className="text-sm text-white/40 mb-10">By Dennis Kariuki · Founder, EduNexus</p>

          <div className="flex flex-col items-center gap-3">
            <a
              href="/book/engineering-educational-intelligence.pdf"
              download
              className={`inline-flex items-center gap-2 text-sm font-bold bg-brass-500 hover:bg-brass-400 text-nexus-ink px-7 py-3.5 rounded-full transition-colors ${FOCUS_RING}`}
            >
              <Download className="w-4 h-4" />
              Download the Book (PDF)
            </a>
            <p className="text-xs text-white/35">Free · No signup required · ISBN 978-9914-29-126-1</p>
          </div>
        </div>
      </section>

      {/* ── WHY THIS EXISTS ──────────────────────────────────────────────── */}
      <section className="py-16 border-b border-white/8">
        <div className="max-w-[720px] mx-auto px-6">
          <p className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-5">Why I wrote this</p>
          <div className="space-y-5 text-white/70 text-lg leading-relaxed">
            <p>
              Two students sit for the same exam and score 65%. One climbed from 40%. One fell
              from 90%. The average is the same number for both of them — and it tells you nothing
              about which is which.
            </p>
            <p>
              That&apos;s not a small rounding problem. It&apos;s the reason most systems that claim to
              understand a learner can&apos;t actually distinguish a struggling student from a
              recovering one. This book works through what a system has to get right before any
              AI can responsibly help a teacher — starting with the representation underneath it,
              long before a model ever enters the picture.
            </p>
            <p>
              It&apos;s the argument behind what EduNexus is actually built on: evidence instead of
              grades, trajectory instead of averages, and an honest signal of how much of any of
              it is actually known versus guessed.
            </p>
          </div>
        </div>
      </section>

      {/* ── CONTENTS ─────────────────────────────────────────────────────── */}
      <section className="py-16 border-b border-white/8">
        <div className="max-w-[720px] mx-auto px-6">
          <p className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-8">Inside the book</p>
          <div className="space-y-8">
            {CHAPTERS.map((ch) => (
              <div key={ch.n} className="flex gap-5">
                <span className="shrink-0 text-2xl font-black text-white/15 tabular-nums">{ch.n}</span>
                <div>
                  <h3 className="text-white font-bold text-lg mb-1">{ch.title}</h3>
                  <p className="text-white/55 leading-relaxed">{ch.blurb}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT THE AUTHOR ─────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-[720px] mx-auto px-6">
          <p className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-5">About the author</p>
          <p className="text-white/70 text-lg leading-relaxed mb-8">
            Dennis Kariuki is a Kenyan educator, software engineer, and founder of EduNexus,
            where he works on educational intelligence systems designed around evidence, learner
            progression, and human-guided decision-making. His work sits at the intersection of
            classroom practice, educational systems design, and software architecture.
          </p>

          <div className="flex flex-col items-center gap-3 pt-4 border-t border-white/10">
            <a
              href="/book/engineering-educational-intelligence.pdf"
              download
              className={`inline-flex items-center gap-2 text-sm font-bold bg-brass-500 hover:bg-brass-400 text-nexus-ink px-7 py-3.5 rounded-full transition-colors ${FOCUS_RING}`}
            >
              <Download className="w-4 h-4" />
              Download the Book (PDF)
            </a>
            <a
              href="mailto:hello@edunexus.co.ke"
              className={`text-sm text-white/50 hover:text-white transition-colors rounded ${FOCUS_RING}`}
            >
              hello@edunexus.co.ke
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
