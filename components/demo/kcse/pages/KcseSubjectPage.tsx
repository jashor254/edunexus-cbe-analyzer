import { KCSE_SUBJECTS, GRADE_BADGE_CLASS, GRADE_BAR_CLASS, type KcseTrend } from '../kcseMockData'
import KcsePageHeader from './KcsePageHeader'

const WM = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
    <div className="font-black text-slate-900 select-none" style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', whiteSpace: 'nowrap' }}>
      SAMPLE REPORT — edunexus.co.ke
    </div>
  </div>
)

function TrendIndicator({ trend }: { trend: KcseTrend }) {
  if (trend === 'improving') return <span className="text-green-600 font-black text-sm leading-none">↑</span>
  if (trend === 'declining') return <span className="text-red-500 font-black text-sm leading-none">↓</span>
  return <span className="text-slate-400 font-black text-sm leading-none">→</span>
}

export default function KcseSubjectPage() {
  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <KcsePageHeader page={3} />

      <div className="relative z-10 flex-1 flex flex-col min-h-0 px-5 pt-4 pb-2">
        <div className="shrink-0">
          <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">Subject Analysis</div>
          <h2 className="text-[#1a2744] text-xl font-black mb-2">KCSE Subject Performance</h2>
          <div className="h-0.5 bg-[#1a2744]/15 mb-3" />
        </div>

        {/* Desktop table */}
        <div className="hidden md:flex flex-col flex-1 min-h-0">
          <div className="bg-[#1a2744] text-white grid grid-cols-[1fr_6rem_1fr_2rem_2fr] gap-2 items-center px-3 py-2 rounded-t-lg shrink-0">
            <div className="text-[10px] font-black tracking-widest">SUBJECT</div>
            <div className="text-[10px] font-black tracking-widest">GRADE</div>
            <div className="text-[10px] font-black tracking-widest">KCSE BAR</div>
            <div className="text-[10px] font-black tracking-widest text-center">TREND</div>
            <div className="text-[10px] font-black tracking-widest">PAPER FOCUS</div>
          </div>

          <div className="border border-slate-200 border-t-0 rounded-b-lg overflow-hidden divide-y divide-slate-100 flex-1">
            {KCSE_SUBJECTS.map((s, i) => (
              <div key={s.name} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                <div className="grid grid-cols-[1fr_6rem_1fr_2rem_2fr] gap-2 items-center px-3 py-1.5">
                  <div className="text-slate-800 font-bold text-xs">{s.name}</div>
                  <div>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${GRADE_BADGE_CLASS[s.status]}`}>
                      {s.grade} · {s.pct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                      <div className={`h-full rounded-full ${GRADE_BAR_CLASS[s.status]}`} style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-slate-400 text-[10px] w-6 text-right">{s.pct}%</span>
                  </div>
                  <div className="text-center"><TrendIndicator trend={s.trend} /></div>
                  <div className="text-slate-400 text-[10px]">{s.paperFocus}</div>
                </div>
                <div className={`px-3 pb-1.5 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                  <p className={`text-[10px] leading-tight truncate ${s.status === 'critical' || s.trend === 'declining' ? 'text-red-500' : 'text-slate-400'}`}>
                    {s.clinicalNote}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="shrink-0 flex flex-wrap gap-3 pt-2 text-[10px] text-slate-400">
            {[['bg-green-500','B- and above'],['bg-amber-400','C to C+'],['bg-red-500','D+ and below']].map(([cls,lbl]) => (
              <span key={lbl} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full inline-block ${cls}`} />{lbl}</span>
            ))}
            <span className="ml-2 flex items-center gap-1"><span className="text-green-600 font-black">↑</span>Improving</span>
            <span className="flex items-center gap-1"><span className="text-slate-400 font-black">→</span>Stable</span>
            <span className="flex items-center gap-1"><span className="text-red-500 font-black">↓</span>Declining</span>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden flex-1 overflow-y-auto">
          <div className="space-y-2 pb-2">
            {KCSE_SUBJECTS.map(s => (
              <div key={s.name} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-slate-800 font-bold text-xs flex-1">{s.name}</span>
                  <TrendIndicator trend={s.trend} />
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${GRADE_BADGE_CLASS[s.status]}`}>
                    {s.grade}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                    <div className={`h-full rounded-full ${GRADE_BAR_CLASS[s.status]}`} style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="text-slate-400 text-[10px]">{s.pct}%</span>
                </div>
                <p className={`text-[10px] leading-snug ${s.status === 'critical' || s.trend === 'declining' ? 'text-red-500' : 'text-slate-400'}`}>
                  {s.clinicalNote}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 pt-1 border-t border-slate-200 flex justify-between mt-1">
          <span className="text-slate-300 text-[10px]">KR-2026-JK3F8M</span>
          <span className="text-slate-300 text-[10px]">edunexus.co.ke</span>
        </div>
      </div>
    </div>
  )
}
