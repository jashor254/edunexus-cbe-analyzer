import { STUDENT } from '../mockData'

export default function CoverPage() {
  return (
    <div className="relative bg-[#1a2744] h-full flex flex-col overflow-hidden">
      {/* Gold top bar */}
      <div className="h-1 bg-amber-500 shrink-0" />

      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div
          className="font-black text-white select-none"
          style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
        >
          SAMPLE REPORT — edunexus.co.ke
        </div>
      </div>

      <div className="flex-1 flex flex-col px-8 py-6 min-h-0">
        {/* Top branding */}
        <div className="shrink-0">
          <div className="text-amber-500 text-xs font-black tracking-[0.25em] uppercase mb-0.5">
            EduNexus
          </div>
          <div className="text-white text-2xl font-black leading-tight">Learner Intelligence Report</div>
        </div>

        {/* Center — fills remaining space */}
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
          <div className="text-amber-500 text-[11px] font-black tracking-[0.3em] uppercase mb-6">
            Learner Intelligence Report
          </div>

          <div className="text-white text-4xl md:text-6xl font-black mb-2 leading-none">
            {STUDENT.name}
          </div>
          <div className="text-slate-300 text-lg mb-1">
            Grade {STUDENT.grade} · Term {STUDENT.term}, {STUDENT.year}
          </div>
          <div className="text-slate-400 text-base mb-8">{STUDENT.school}</div>

          {/* Stats — stack on mobile, side by side on md+ */}
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-16">
            <div className="text-center">
              <div className="text-amber-500 text-[10px] font-black tracking-[0.2em] uppercase mb-2">
                Overall Competency
              </div>
              <div className="text-white text-xl font-black mb-0.5">{STUDENT.overallLabel}</div>
              <div className="text-slate-300 text-sm">Level {STUDENT.overallLevel} of 4</div>
            </div>

            <div className="hidden md:block w-px bg-white/15 self-stretch" />

            <div className="text-center">
              <div className="text-amber-500 text-[10px] font-black tracking-[0.2em] uppercase mb-2">
                Trajectory
              </div>
              <div className="text-amber-400 text-xl font-black mb-0.5">{STUDENT.trajectory}</div>
              <div className="text-slate-400 text-sm">{STUDENT.trajectoryNote}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 text-center space-y-1">
          <div className="text-slate-500 text-xs">CONFIDENTIAL — For Parent and Teacher Use Only</div>
          <div className="text-slate-600 text-xs">
            Report ID: {STUDENT.reportId} · Generated: {STUDENT.generatedDate}
          </div>
        </div>
      </div>

      {/* Gold bottom bar */}
      <div className="h-1 bg-amber-500 shrink-0" />
    </div>
  )
}
