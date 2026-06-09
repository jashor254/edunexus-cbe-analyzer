import { STUDENT, SUBJECTS } from '../mockData'
import PageHeader from './PageHeader'

const WM = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
    <div className="font-black text-slate-900 select-none" style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', whiteSpace: 'nowrap' }}>
      SAMPLE REPORT — edunexus.co.ke
    </div>
  </div>
)

export default function ClinicalOverviewPage() {
  const strengths = SUBJECTS.filter(s => s.level >= 3)
  const priorities = SUBJECTS.filter(s => s.level <= 2)

  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <PageHeader page={2} tall />

      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        {/* Section header */}
        <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">
          Clinical Overview
        </div>
        <h2 className="text-[#1a2744] text-xl font-black mb-2">Academic Performance Assessment</h2>
        <div className="h-0.5 bg-[#1a2744]/15 mb-4" />

        {/* Overall level row */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="w-10 h-10 bg-green-100 border-2 border-green-300 rounded-full flex items-center justify-center shrink-0">
            <span className="text-green-700 text-lg font-black">3</span>
          </div>
          <div className="min-w-0">
            <div className="bg-green-100 text-green-700 border border-green-200 text-xs font-black px-3 py-0.5 rounded-full inline-block">
              LEVEL 3 — PROFICIENT
            </div>
            <div className="text-slate-400 text-[10px] mt-0.5">
              Average across 9 CBC subjects · Term {STUDENT.term}, {STUDENT.year}
            </div>
          </div>
          <div className="ml-auto shrink-0">
            <div className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-3 py-1.5 rounded-lg text-center">
              <div className="opacity-60 tracking-wider">TRAJECTORY</div>
              <div>{STUDENT.trajectory}</div>
            </div>
          </div>
        </div>

        {/* 4 vital cards — 2×2 on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {[
            { label: 'SUBJECTS', value: SUBJECTS.length, sub: 'assessed', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
            { label: 'STRENGTHS', value: strengths.length, sub: 'Level 3–4', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
            { label: 'DEVELOPING', value: priorities.length, sub: 'Level 2', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
            { label: 'PRIORITY', value: SUBJECTS.filter(s => s.level === 1).length, sub: 'Level 1', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-2.5 text-center`}>
              <div className={`text-[9px] font-black tracking-wider mb-0.5 ${c.text} opacity-70`}>{c.label}</div>
              <div className={`text-2xl font-black leading-none mb-0.5 ${c.text}`}>{c.value}</div>
              <div className={`text-[10px] ${c.text} opacity-60`}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Clinical paragraph */}
        <div className="bg-white border-l-4 border-green-500 px-4 py-3 rounded-r-xl shadow-sm mb-4">
          <p className="text-slate-700 text-xs leading-relaxed mb-2">
            Brian demonstrates strong and consistent academic competency across the CBC Grade 9 curriculum, with <strong>Exemplary performance in Kiswahili and Social Studies</strong> — the clearest indicators of genuine Social Sciences pathway aptitude.
          </p>
          <p className="text-slate-700 text-xs leading-relaxed mb-2">
            A notable positive trajectory: <strong>Mathematics has recovered from Developing to Proficient this term</strong>, reflecting Brian&apos;s improving work ethic and structured revision approach.
          </p>
          <p className="text-slate-600 text-xs leading-relaxed">
            Pre-Technical Studies (Level 2) is the single priority intervention area — targeted hands-on workshop practice this holiday will consolidate the design and drawing skills needed before Grade 10 subject choices.
          </p>
        </div>

        {/* Two columns — stack on mobile */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <div className="bg-green-700 text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-t-lg">
              CLINICAL STRENGTHS
            </div>
            <div className="bg-white border border-green-200 border-t-0 rounded-b-lg p-3 space-y-1.5">
              {strengths.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-slate-700 text-xs flex-1">{s.name}</span>
                  <span className="text-green-600 text-[10px] font-black">L{s.level}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <div className="bg-red-700 text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-t-lg">
              PRIORITY INTERVENTION
            </div>
            <div className="bg-white border border-red-200 border-t-0 rounded-b-lg p-3 space-y-1.5">
              {priorities.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-slate-700 text-xs flex-1">{s.name}</span>
                  {s.trend === 'declining' && <span className="text-[10px]">⚠️</span>}
                  <span className="text-amber-600 text-[10px] font-black">L{s.level}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between">
          <span className="text-slate-300 text-[10px]">{STUDENT.reportId}</span>
          <span className="text-slate-300 text-[10px]">edunexus.co.ke</span>
        </div>
      </div>
    </div>
  )
}
