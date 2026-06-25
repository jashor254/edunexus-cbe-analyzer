import SlideGeneratorForm from '@/components/slides/SlideGeneratorForm'

export const metadata = { title: 'AI Slide Generator — EduNexus' }

export default function SlidesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c1929] to-[#0f2744] pb-16">
      {/* Hero header */}
      <div className="px-6 pt-10 pb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-4">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-blue-300 text-xs font-medium">Powered by AI</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          AI Slide Generator
        </h1>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Enter your topic and get a ready-to-use PowerPoint presentation —
          CBC-aligned, beautifully designed, downloaded in under 30 seconds.
        </p>
      </div>

      {/* Form */}
      <div className="px-4">
        <SlideGeneratorForm />
      </div>
    </div>
  )
}
