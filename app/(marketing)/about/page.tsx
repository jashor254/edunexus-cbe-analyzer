import Link from 'next/link'
import { FOCUS_RING } from '../constants'

export const metadata = {
  title: 'About | EduNexus',
  description:
    'EduNexus is an AI-powered education platform developed and operated by Jashor Technologies, incorporated in Kenya, trading as EduNexus Kenya.',
}

export default function AboutPage() {
  return (
    <div className="max-w-[900px] mx-auto px-6 py-20">
      <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-8">About EduNexus</h1>

      <div className="space-y-6 text-white/70 text-lg leading-relaxed">
        <p>
          EduNexus is an AI-powered education platform developed and operated by{' '}
          <strong className="text-white">Jashor Technologies</strong>, incorporated in Kenya,
          trading as <strong className="text-white">EduNexus Kenya</strong>.
        </p>
        <p>
          A learning gap usually starts small and stays invisible until it shows up on a report
          card, by which point it has often had a term or more to grow. We exist to close that
          gap between when a problem begins and when someone can act on it — for CBC Junior
          (Grade 7–9), CBC Senior (Grade 10–12), and 8-4-4 (Form 3–4) learners, by turning what
          teachers already observe into evidence parents and schools can actually see and use.
        </p>
      </div>

      <div className="mt-14">
        <h2 className="text-2xl font-black tracking-tight mb-5 text-white">How the intelligence works</h2>
        <div className="space-y-6 text-white/70 text-lg leading-relaxed">
          <p>
            At the core is a{' '}
            <strong className="text-white">deterministic learner-intelligence engine</strong>: it
            turns teacher-entered evidence into a strand-by-strand profile of each learner — the
            Learner Blueprint — without AI guesswork, so every insight traces back to a real
            observation.
          </p>
          <p>
            Around that engine, we run{' '}
            <strong className="text-white">AI models</strong> for the language-heavy work teachers
            spend the most time on: generating CBC-aligned schemes of work and lesson plans, marking
            written work such as essays and insha, tutoring learners on the exact gap holding them
            back, and mapping career pathways from Grade 7. This is where accelerated computing
            matters to us — inference is the workload we run at scale as more schools come on board.
          </p>
        </div>
      </div>

      <div className="mt-14">
        <h2 className="text-2xl font-black tracking-tight mb-5 text-white">Where learner data lives</h2>
        <div className="space-y-6 text-white/70 text-lg leading-relaxed">
          <p>
            Kenyan children&apos;s work is not ours to give away. We already strip learner names
            before any text reaches an AI model. Our priority now is to bring that inference{' '}
            <strong className="text-white">in-house, on infrastructure we control</strong>, so that
            learner data never has to leave the country to be understood — the reason we are pursuing
            accelerated-computing partnerships to power EduNexus.
          </p>
        </div>
      </div>

      <div className="mt-14">
        <h2 className="text-2xl font-black tracking-tight mb-5 text-white">Who is building this</h2>
        <div className="space-y-6 text-white/70 text-lg leading-relaxed">
          <p>
            EduNexus is founded and built by{' '}
            <strong className="text-white">Dennis Kariuki</strong>, based in Nairobi. It operates as
            EduNexus Kenya, registered in Kenya as a sole proprietorship under Jashor Technologies.
            We are in our pioneer phase, working directly with Kenyan teachers to make sure every
            feature earns its place in a real classroom.
          </p>
        </div>
      </div>

      <div className="mt-10 bg-white/5 border border-white/10 rounded-2xl p-6">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Contact EduNexus Kenya</p>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-white/70 text-base">
          <a href="tel:+254710798030" className={`hover:text-white transition-colors rounded ${FOCUS_RING}`}>
            Phone: +254 710 798 030
          </a>
          <a href="mailto:support@edunexus.co.ke" className={`hover:text-white transition-colors rounded ${FOCUS_RING}`}>
            support@edunexus.co.ke
          </a>
          <span>Nairobi, Kenya</span>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-white/10 flex flex-wrap gap-4 text-sm text-white/40">
        <Link href="/legal/privacy" className={`hover:text-white transition-colors rounded ${FOCUS_RING}`}>Privacy Policy</Link>
        <span>•</span>
        <Link href="/legal/terms" className={`hover:text-white transition-colors rounded ${FOCUS_RING}`}>Terms of Service</Link>
      </div>
    </div>
  )
}
