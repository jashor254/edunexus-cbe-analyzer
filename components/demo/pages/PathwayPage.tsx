import { STUDENT } from '../mockData'
import PageHeader from './PageHeader'

const WM = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
    <div className="font-black text-slate-900 select-none" style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', whiteSpace: 'nowrap' }}>
      SAMPLE REPORT — edunexus.co.ke
    </div>
  </div>
)

const PATHWAYS = [
  { name: 'STEM', sub: 'Mathematics & Sciences', pct: 52, recommended: false, barColor: 'bg-blue-400' },
  { name: 'SOCIAL SCIENCES', sub: 'Humanities & Communication', pct: 84, recommended: true, barColor: 'bg-amber-400' },
  { name: 'ARTS & SPORTS SCIENCE', sub: 'Creative & Physical Education', pct: 61, recommended: false, barColor: 'bg-amber-400' },
]

export default function PathwayPage() {
  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <PageHeader page={4} />

      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        {/* Section header */}
        <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">
          Pathway Analysis · Grades 7–9
        </div>
        <h2 className="text-[#1a2744] text-xl font-black mb-2">Senior School Pathway Recommendation</h2>
        <div className="h-0.5 bg-[#1a2744]/15 mb-4" />

        {/* Pathway bars */}
        <div className="space-y-2.5 mb-4">
          {PATHWAYS.map(p => (
            <div key={p.name} className={`rounded-xl overflow-hidden ${p.recommended ? 'ring-2 ring-[#1a2744] shadow-md' : 'border border-slate-200'}`}>
              <div className={`px-4 py-3 ${p.recommended ? 'bg-[#1a2744]' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className={`text-sm font-black ${p.recommended ? 'text-white' : 'text-slate-700'}`}>{p.name}</div>
                    <div className={`text-xs mt-0.5 ${p.recommended ? 'text-slate-300' : 'text-slate-400'}`}>{p.sub}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.recommended && (
                      <span className="bg-amber-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full tracking-wider">RECOMMENDED</span>
                    )}
                    <span className={`text-xl font-black ${p.recommended ? 'text-amber-400' : 'text-slate-500'}`}>{p.pct}%</span>
                  </div>
                </div>
                <div className={`rounded-full h-2 ${p.recommended ? 'bg-white/15' : 'bg-slate-100'}`}>
                  <div className={`h-full rounded-full ${p.recommended ? 'bg-amber-400' : p.barColor}`} style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Confidence badge */}
        <div className="flex justify-center mb-4">
          <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-black px-4 py-1 rounded-full tracking-wider">
            {STUDENT.pathwayConfidence}
          </span>
        </div>

        {/* Two columns — stack on mobile */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <div className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-2">Why it fits</div>
            <div className="space-y-2">
              {[
                'Exemplary Kiswahili and Social Studies — the two highest-weight Social Sciences subjects',
                'Devolution, East Africa community units, and map work all at outstanding level',
                'Proficient English and strong reflective reasoning across CRE align with pathway demands',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-green-100 border border-green-200 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-green-600 text-[9px] font-black">✓</span>
                  </div>
                  <p className="text-slate-600 text-xs leading-snug">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-2">Strengthen before Grade 10</div>
            <div className="space-y-2">
              {[
                'Pre-Technical Studies (Level 2 — consolidate design & draw before Grade 10)',
                'Mathematics — maintain Proficient level, do not let it slip in Grade 10',
                'Integrated Science — strong foundation needed for Biology/Chemistry/Physics split',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-red-100 border border-red-200 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-red-600 text-[9px] font-black">!</span>
                  </div>
                  <p className="text-slate-600 text-xs leading-snug">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Navy insight box */}
        <div className="bg-[#1a2744] rounded-xl p-4">
          <div className="text-amber-500 text-[10px] font-black tracking-widest uppercase mb-2">What this means for Brian&apos;s future</div>
          <p className="text-slate-200 text-xs leading-relaxed mb-2">
            Social Sciences leads to Law, Business, Education, Public Policy, and Finance — careers at the heart of Kenya&apos;s growth story. Brian&apos;s Exemplary Kiswahili and Social Studies already place him above average for this pathway.
          </p>
          <p className="text-amber-300 text-xs leading-relaxed font-medium">
            With HIGH CONFIDENCE in this recommendation, Brian should confirm Social Sciences as his Grade 10 pathway and focus the holiday on closing the Pre-Technical Studies gap.
          </p>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between">
          <span className="text-slate-300 text-[10px]">Report ID: EC-2026-BT9K2M</span>
          <span className="text-slate-300 text-[10px]">edunexus.co.ke</span>
        </div>
      </div>
    </div>
  )
}
