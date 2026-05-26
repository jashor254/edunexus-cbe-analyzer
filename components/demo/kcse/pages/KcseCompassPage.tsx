import KcsePageHeader from './KcsePageHeader'

const WM = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
    <div className="font-black text-slate-900 select-none" style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', whiteSpace: 'nowrap' }}>
      SAMPLE REPORT — edunexus.co.ke
    </div>
  </div>
)

const KCSE_PROMPTS = [
  "I'm in Form 3 at Alliance High preparing for KCSE. Help me understand mole calculations in Chemistry — start from the very beginning and test me as we go.",
  "Walk me through Chemistry Paper 2 organic chemistry — explain alkanes and alkenes and give me KCSE-style questions to practice",
  "Help me structure a History essay answer for KCSE — I have the points but I don't know how to write them to get full marks",
]

const COMMAND_WORDS = [
  { word: 'State', meaning: 'list only (1 mark each)' },
  { word: 'Explain', meaning: 'point + because/therefore (2 marks)' },
  { word: 'Discuss', meaning: 'multiple points + conclusion (15 marks)' },
  { word: 'Calculate', meaning: 'show ALL working + units' },
]

export default function KcseCompassPage() {
  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <KcsePageHeader page={6} />

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-3 pb-3">
        <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">
          AI Tutoring Guidance — KCSE Mode
        </div>
        <h2 className="text-[#1a2744] text-xl font-black mb-1">Learning Compass Recommendations</h2>
        <div className="h-0.5 bg-[#1a2744]/15 mb-3" />

        {/* Priority subject box */}
        <div className="bg-[#1a2744] rounded-xl p-4 mb-3 text-center">
          <div className="text-slate-400 text-[9px] font-black tracking-widest uppercase mb-1">
            Start Your First Session With
          </div>
          <div className="text-white text-3xl font-black mb-1">Chemistry</div>
          <p className="text-slate-300 text-xs leading-snug max-w-xs mx-auto">
            This is James&apos;s highest-risk subject. Learning Compass will work through mole calculations from first principles — adapting to his exact level.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
            <span className="text-amber-400 text-xs font-black">5 sessions/week minimum</span>
            <span className="text-white/30 text-[10px]">·</span>
            <span className="text-slate-300 text-xs">daily during 8-week phase</span>
          </div>
        </div>

        {/* Session goal */}
        <div className="bg-white border-l-4 border-amber-500 px-3 py-2.5 rounded-r-xl shadow-sm mb-3">
          <div className="text-amber-600 text-[9px] font-black tracking-widest uppercase mb-1">Session Goal</div>
          <p className="text-slate-700 text-xs leading-snug">
            Close the Chemistry D+ gap and achieve at least C+ before the end of term. Stop Biology decline. Maintain B grades in History, English, Kiswahili.{' '}
            <strong className="text-[#1a2744]">Target mean grade by KCSE mock: B plain.</strong>
          </p>
        </div>

        {/* 3 KCSE prompts */}
        <div className="mb-3">
          <div className="text-[#1a2744] text-[10px] font-black tracking-widest uppercase mb-2">
            3 KCSE Prompts to Try
          </div>
          <div className="space-y-1.5">
            {KCSE_PROMPTS.map((topic, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <div className="w-5 h-5 bg-[#1a2744] rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-amber-400 text-[10px] font-black">{i + 1}</span>
                </div>
                <p className="text-slate-600 text-[10px] leading-snug italic">&ldquo;{topic}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>

        {/* KCSE command words box */}
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-3">
          <div className="text-teal-700 text-[9px] font-black tracking-widest uppercase mb-2">
            Learning Compass Teaches KCSE Exam Technique
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {COMMAND_WORDS.map(cw => (
              <div key={cw.word} className="bg-white border border-teal-100 rounded-lg px-2 py-1.5">
                <span className="text-teal-700 font-black text-xs">{cw.word}</span>
                <span className="text-slate-400 text-[10px]"> = {cw.meaning}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gold CTA */}
        <div className="bg-amber-500 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-white font-black text-sm">Start your first Chemistry session →</div>
            <div className="text-amber-900/70 text-xs">Open Learning Compass — type prompt 1</div>
          </div>
          <div className="text-white text-right shrink-0">
            <div className="font-black text-xs">edunexus.co.ke/chat</div>
            <div className="text-amber-900/60 text-[10px]">Free first session</div>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between">
          <span className="text-slate-300 text-[10px]">KR-2026-JK3F8M</span>
          <span className="text-slate-300 text-[10px]">edunexus.co.ke</span>
        </div>
      </div>
    </div>
  )
}
