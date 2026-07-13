import Link from 'next/link'

export const metadata = {
  title: 'About | EduNexus',
  description:
    'EduNexus is an AI-powered education platform developed and operated by EduNexus Kenya, a registered sole proprietorship in Kenya.',
}

export default function AboutPage() {
  return (
    <div className="max-w-[900px] mx-auto px-6 py-20">
      <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-8">About EduNexus</h1>

      <div className="space-y-6 text-white/70 text-lg leading-relaxed">
        <p>
          EduNexus is an AI-powered education platform developed and operated by{' '}
          <strong className="text-white">EduNexus Kenya</strong>, a registered sole proprietorship
          in Kenya.
        </p>
        <p>
          We build learning intelligence tools for CBC Junior (Grade 7–9), CBC Senior
          (Grade 10–12), and 8-4-4 (Form 3–4) students, their parents, and their teachers —
          helping Kenyan families understand where a learner stands today and what to do next.
        </p>
      </div>

      <div className="mt-10 bg-white/5 border border-white/10 rounded-2xl p-6">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Contact EduNexus Kenya</p>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-white/70 text-base">
          <a href="tel:+254710798030" className="hover:text-white transition-colors">
            Phone: +254 710 798 030
          </a>
          <a href="mailto:support@edunexus.co.ke" className="hover:text-white transition-colors">
            support@edunexus.co.ke
          </a>
          <span>Nairobi, Kenya</span>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-white/10 flex flex-wrap gap-4 text-sm text-white/40">
        <Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
        <span>•</span>
        <Link href="/legal/terms" className="hover:text-white transition-colors">Terms of Service</Link>
      </div>
    </div>
  )
}
