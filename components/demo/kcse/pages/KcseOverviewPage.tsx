import { KCSE_STUDENT, KCSE_SUBJECTS } from '../kcseMockData'
import KcsePageHeader from './KcsePageHeader'

const WM = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
    <div className="font-black text-slate-900 select-none" style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', whiteSpace: 'nowrap' }}>
      SAMPLE REPORT — edunexus.co.ke
    </div>
  </div>
)

export default function KcseOverviewPage() {
  const strong = KCSE_SUBJECTS.filter(s => s.status === 'strong')
  const developing = KCSE_SUBJECTS.filter(s => s.status === 'developing')
  const critical = KCSE_SUBJECTS.filter(s => s.status === 'critical')

  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <KcsePageHeader page={2} tall />

      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">
          KCSE Readiness Overview
        </div>
        <h2 className="text-[#1a2744] text-xl font-black mb-2">Academic Performance Assessment</h2>
        <div className="h-0.5 bg-[#1a2744]/15 mb-4" />

        {/* Mean grade row */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="w-12 h-12 bg-amber-100 border-2 border-amber-300 rounded-full flex items-center justify-center shrink-0">
            <span className="text-amber-700 text-xl font-black">{KCSE_STUDENT.meanGrade}</span>
          </div>
          <div className="min-w-0">
            <div className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-black px-3 py-0.5 rounded-full inline-block">
              MEAN GRADE {KCSE_STUDENT.meanGrade} — ABOVE AVERAGE
            </div>
            <div className="text-slate-400 text-[10px] mt-0.5">
              9 subjects assessed · Term {KCSE_STUDENT.term}, {KCSE_STUDENT.year}
            </div>
          </div>
          <div className="ml-auto shrink-0">
            <div className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-3 py-1.5 rounded-lg text-center">
              <div className="opacity-60 tracking-wider">TRAJECTORY</div>
              <div>{KCSE_STUDENT.trajectory}</div>
            </div>
          </div>
        </div>

        {/* 4 vital cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {[
            { label: 'SUBJECTS', value: KCSE_SUBJECTS.length, sub: 'assessed', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
            { label: 'STRONG', value: strong.length, sub: 'B- and above', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
            { label: 'DEVELOPING', value: developing.length, sub: 'C to C+', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
            { label: 'CRITICAL', value: critical.length, sub: 'D+ and below', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-2.5 text-center`}>
              <div className={`text-[9px] font-black tracking-wider mb-0.5 ${c.text} opacity-70`}>{c.label}</div>
              <div className={`text-2xl font-black leading-none mb-0.5 ${c.text}`}>{c.value}</div>
              <div className={`text-[10px] ${c.text} opacity-60`}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Clinical paragraph */}
        <div className="bg-white border-l-4 border-amber-500 px-4 py-3 rounded-r-xl shadow-sm mb-4">
          <p className="text-slate-700 text-xs leading-relaxed mb-2">
            James demonstrates solid performance in humanities and languages, with History & Government and Kiswahili showing consistent strength. However, the Sciences present a significant concern — Chemistry has declined to D+ this term, representing the single biggest risk to James&apos;s KCSE mean grade target of B plain.
          </p>
          <p className="text-slate-700 text-xs leading-relaxed mb-2">
            With {KCSE_STUDENT.monthsToMock} months to the KCSE mock examination, the window for intervention is open but narrowing. Chemistry requires immediate structured attention — a one-grade improvement in Chemistry alone would lift James&apos;s projected mean grade from C+ to B-.
          </p>
          <p className="text-slate-600 text-xs leading-relaxed">
            Targeted Learning Compass sessions focusing on Chemistry fundamentals and Biology consolidation, combined with maintaining current momentum in History and English, gives James a realistic pathway to B plain by KCSE.
          </p>
        </div>

        {/* Two columns */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <div className="bg-green-700 text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-t-lg">
              PERFORMING WELL
            </div>
            <div className="bg-white border border-green-200 border-t-0 rounded-b-lg p-3 space-y-1.5">
              {strong.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-slate-700 text-xs flex-1">{s.name}</span>
                  <span className="text-green-600 text-[10px] font-black">
                    {s.grade}
                    {s.trend === 'improving' && <span className="text-green-500 ml-0.5">↑</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <div className="bg-red-700 text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-t-lg">
              REQUIRES INTERVENTION
            </div>
            <div className="bg-white border border-red-200 border-t-0 rounded-b-lg p-3 space-y-1.5">
              {[...critical, ...developing].map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="text-slate-700 text-xs flex-1">{s.name}</span>
                  {s.trend === 'declining' && <span className="text-[10px]">⚠️</span>}
                  {s.status === 'critical' && <span className="text-red-600 text-[9px] font-black">CRITICAL</span>}
                  <span className={`text-[10px] font-black ${s.status === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>{s.grade}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between">
          <span className="text-slate-300 text-[10px]">{KCSE_STUDENT.reportId}</span>
          <span className="text-slate-300 text-[10px]">edunexus.co.ke</span>
        </div>
      </div>
    </div>
  )
}
