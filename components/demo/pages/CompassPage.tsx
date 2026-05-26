import PageHeader from './PageHeader'

const WM = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
    <div className="font-black text-slate-900 select-none" style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', whiteSpace: 'nowrap' }}>
      SAMPLE REPORT — edunexus.co.ke
    </div>
  </div>
)

const TOPICS = [
  'Explain the key concepts in fractions and basic algebra I need to master this holiday.',
  'Walk me through Integrated Science — help me understand where I\'m going wrong.',
  'Help me build a 3-week revision plan based on my Academic Clinic report.',
]

export default function CompassPage() {
  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <PageHeader page={6} />

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-3 pb-3">
        {/* Section header */}
        <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">
          AI Tutoring Guidance
        </div>
        <h2 className="text-[#1a2744] text-xl font-black mb-1">Learning Compass Recommendations</h2>
        <div className="h-0.5 bg-[#1a2744]/15 mb-3" />

        {/* Navy hero box */}
        <div className="bg-[#1a2744] rounded-xl p-4 mb-3 text-center">
          <div className="text-slate-400 text-[9px] font-black tracking-widest uppercase mb-1">
            Start your first session with
          </div>
          <div className="text-white text-2xl font-black mb-1">Mathematics</div>
          <p className="text-slate-300 text-xs leading-snug max-w-xs mx-auto">
            Highest-priority intervention area based on this assessment.
          </p>
          {/* B2 hero statement */}
          <p className="text-base font-bold text-white mt-3 text-center leading-relaxed">
            Learning Compass adapts to Brian&apos;s exact level — from the very first question.
          </p>
          <div className="mt-2.5 inline-flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
            <span className="text-amber-400 text-xs font-black">3 sessions/week</span>
            <span className="text-white/30 text-[10px]">·</span>
            <span className="text-slate-300 text-xs">holiday + term time</span>
          </div>
        </div>

        {/* Session goal — compact */}
        <div className="bg-white border-l-4 border-amber-500 px-3 py-2.5 rounded-r-xl shadow-sm mb-3">
          <div className="text-amber-600 text-[9px] font-black tracking-widest uppercase mb-1">Session Goal</div>
          <p className="text-slate-700 text-xs leading-snug">
            Close gaps in <strong>Mathematics</strong> and <strong>Integrated Science</strong> — reach Level 3 in both before Term 2 begins.
          </p>
        </div>

        {/* 3 topics — compact */}
        <div className="mb-3">
          <div className="text-[#1a2744] text-[10px] font-black tracking-widest uppercase mb-2">
            3 Topics to Ask Learning Compass
          </div>
          <div className="space-y-1.5">
            {TOPICS.map((topic, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <div className="w-5 h-5 bg-[#1a2744] rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-amber-400 text-[10px] font-black">{i + 1}</span>
                </div>
                <p className="text-slate-600 text-[10px] leading-snug italic">&ldquo;{topic}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>

        {/* Gold CTA — compact */}
        <div className="bg-amber-500 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-white font-black text-sm">Start your first session now</div>
            <div className="text-amber-900/70 text-xs">Open Learning Compass → type topic 1</div>
          </div>
          <div className="text-white text-right shrink-0">
            <div className="font-black text-xs">edunexus.co.ke/chat</div>
            <div className="text-amber-900/60 text-[10px]">Free first session</div>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between">
          <span className="text-slate-300 text-[10px]">Report ID: EC-2026-BT9K2M</span>
          <span className="text-slate-300 text-[10px]">edunexus.co.ke</span>
        </div>
      </div>
    </div>
  )
}
