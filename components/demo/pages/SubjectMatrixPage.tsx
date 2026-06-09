import { SUBJECTS, LEVEL_LABEL, LEVEL_BADGE_CLASS, LEVEL_BAR_CLASS, LEVEL_PCT, type Trend } from '../mockData'
import PageHeader from './PageHeader'

const WM = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
    <div className="font-black text-slate-900 select-none" style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', whiteSpace: 'nowrap' }}>
      SAMPLE REPORT — edunexus.co.ke
    </div>
  </div>
)

function TrendIndicator({ trend }: { trend: Trend }) {
  if (trend === 'improving') return <span className="text-green-600 font-black text-sm leading-none">↑</span>
  if (trend === 'declining') return <span className="text-red-600 font-black text-sm leading-none">↓</span>
  return <span className="text-slate-400 font-black text-sm leading-none">→</span>
}

export default function SubjectMatrixPage() {
  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <PageHeader page={3} />

      <div className="relative z-10 flex-1 flex flex-col min-h-0 px-5 pt-4 pb-2">
        {/* Section header */}
        <div className="shrink-0">
          <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">Subject Analysis</div>
          <h2 className="text-[#1a2744] text-xl font-black mb-2">Performance Matrix</h2>
          <div className="h-0.5 bg-[#1a2744]/15 mb-3" />
        </div>

        {/* ── DESKTOP TABLE (md+) ── */}
        <div className="hidden md:flex flex-col flex-1 min-h-0">
          {/* Column headers */}
          <div className="bg-[#1a2744] text-white grid grid-cols-[1.5rem_1fr_7rem_1fr_2rem] gap-2 items-center px-3 py-2 rounded-t-lg shrink-0">
            <div />
            <div className="text-[10px] font-black tracking-widest">SUBJECT</div>
            <div className="text-[10px] font-black tracking-widest">LEVEL</div>
            <div className="text-[10px] font-black tracking-widest">COMPETENCY</div>
            <div className="text-[10px] font-black tracking-widest text-center">TREND</div>
          </div>

          {/* Rows — overflow hidden, fixed height */}
          <div className="border border-slate-200 border-t-0 rounded-b-lg overflow-hidden divide-y divide-slate-100 flex-1">
            {SUBJECTS.map((s, i) => (
              <div key={s.name} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                {/* Data row — tighter py-2 */}
                <div className="grid grid-cols-[1.5rem_1fr_7rem_1fr_2rem] gap-2 items-center px-3 py-2">
                  <div className="text-base">{s.emoji}</div>
                  <div className="text-slate-800 font-bold text-xs">{s.name}</div>
                  <div>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${LEVEL_BADGE_CLASS[s.level]}`}>
                      {s.level} · {LEVEL_LABEL[s.level]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                      <div className={`h-full rounded-full ${LEVEL_BAR_CLASS[s.level]}`} style={{ width: `${LEVEL_PCT[s.level]}%` }} />
                    </div>
                    <span className="text-slate-400 text-[10px] w-5 text-right">{LEVEL_PCT[s.level]}%</span>
                  </div>
                  <div className="text-center"><TrendIndicator trend={s.trend} /></div>
                </div>
                {/* Clinical note — 1 line, truncated */}
                <div className={`px-3 pb-1.5 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                  <p className={`text-[10px] leading-tight pl-7 truncate ${s.trend === 'declining' ? 'text-red-500' : 'text-slate-400'}`}>
                    {s.clinicalNote}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Legend row */}
          <div className="shrink-0 flex flex-wrap gap-3 pt-2 text-[10px] text-slate-400">
            {[['bg-red-400','L1 Emerging'],['bg-amber-400','L2 Developing'],['bg-green-500','L3 Proficient'],['bg-teal-500','L4 Exemplary']].map(([cls,lbl]) => (
              <span key={lbl} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full inline-block ${cls}`} />{lbl}</span>
            ))}
            <span className="ml-2 flex items-center gap-1"><span className="text-green-600 font-black">↑</span>Improving</span>
            <span className="flex items-center gap-1"><span className="text-slate-400 font-black">→</span>Stable</span>
            <span className="flex items-center gap-1"><span className="text-red-600 font-black">↓</span>Declining</span>
          </div>
        </div>

        {/* ── MOBILE CARDS (below md) — no clinical notes, compact ── */}
        <div className="md:hidden flex-1 overflow-y-auto">
          <div className="space-y-2 pb-2">
            {SUBJECTS.map(s => (
              <div key={s.name} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-3">
                <span className="text-xl shrink-0">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-slate-800 font-bold text-xs truncate">{s.name}</span>
                    <TrendIndicator trend={s.trend} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${LEVEL_BADGE_CLASS[s.level]}`}>
                      {s.level} · {LEVEL_LABEL[s.level]}
                    </span>
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                      <div className={`h-full rounded-full ${LEVEL_BAR_CLASS[s.level]}`} style={{ width: `${LEVEL_PCT[s.level]}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 pt-1 border-t border-slate-200 flex justify-between mt-1">
          <span className="text-slate-300 text-[10px]">Report ID: EC-2026-BT9K2M</span>
          <span className="text-slate-300 text-[10px]">edunexus.co.ke</span>
        </div>
      </div>
    </div>
  )
}
