import { KCSE_STUDENT } from '../kcseMockData'

export default function KcseCoverPage() {
  return (
    <div className="relative bg-[#1a2744] h-full flex flex-col overflow-hidden">
      {/* Gold top bar */}
      <div className="h-1.5 bg-amber-500 shrink-0" />

      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div
          className="font-black text-white select-none"
          style={{ transform: 'rotate(-30deg)', opacity: 0.04, fontSize: '2.5rem', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
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
          <div className="text-white text-2xl font-black leading-tight">Academic Clinic</div>
        </div>

        {/* Center */}
        <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
          <div className="text-amber-500 text-[11px] font-black tracking-[0.3em] uppercase mb-6">
            KCSE Readiness Report
          </div>

          <div className="text-white text-4xl md:text-6xl font-black mb-2 leading-none">
            {KCSE_STUDENT.name}
          </div>
          <div className="text-slate-300 text-lg mb-1">
            Form {KCSE_STUDENT.form} · Term {KCSE_STUDENT.term}, {KCSE_STUDENT.year}
          </div>
          <div className="text-slate-400 text-base mb-8">{KCSE_STUDENT.school}</div>

          {/* Stats */}
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-16">
            <div className="text-center">
              <div className="text-amber-500 text-[10px] font-black tracking-[0.2em] uppercase mb-2">
                Current Mean Grade
              </div>
              <div className="text-white text-5xl font-black mb-1 leading-none">
                {KCSE_STUDENT.meanGrade}
              </div>
              <div className="text-teal-400 text-sm">Targeting {KCSE_STUDENT.targetGrade} plain</div>
            </div>

            <div className="hidden md:block w-px bg-white/15 self-stretch" />

            <div className="text-center">
              <div className="text-amber-500 text-[10px] font-black tracking-[0.2em] uppercase mb-2">
                KCSE Trajectory
              </div>
              <div className="text-amber-400 text-2xl font-black mb-1">
                {KCSE_STUDENT.trajectory}
              </div>
              <div className="text-red-400 text-sm">{KCSE_STUDENT.trajectoryNote}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 text-center space-y-1">
          <div className="text-slate-500 text-xs">CONFIDENTIAL — For Parent and Teacher Use Only</div>
          <div className="text-slate-600 text-xs">
            Report ID: {KCSE_STUDENT.reportId} · Generated: {KCSE_STUDENT.generatedDate}
          </div>
        </div>
      </div>

      {/* Urgency strip */}
      <div className="bg-amber-500 px-6 py-2.5 text-center shrink-0">
        <span className="text-white font-black text-sm">
          ⏰ {KCSE_STUDENT.monthsToMock} months to KCSE Mock Examination
        </span>
      </div>

      {/* Gold bottom bar */}
      <div className="h-1.5 bg-amber-600 shrink-0" />
    </div>
  )
}
