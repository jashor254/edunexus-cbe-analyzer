import { KCSE_STUDENT, KCSE_PATHWAYS } from '../kcseMockData'
import KcsePageHeader from './KcsePageHeader'

const WM = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
    <div className="font-black text-slate-900 select-none" style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', whiteSpace: 'nowrap' }}>
      SAMPLE REPORT — edunexus.co.ke
    </div>
  </div>
)

export default function KcsePathwayPage() {
  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <KcsePageHeader page={4} />

      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">
          University Pathway Analysis
        </div>
        <h2 className="text-[#1a2744] text-xl font-black mb-1">Senior School &amp; University Pathway</h2>
        <div className="text-slate-400 text-xs mb-2">Based on Form 3 performance — projecting to KCSE</div>
        <div className="h-0.5 bg-[#1a2744]/15 mb-4" />

        {/* Grade prediction box */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
              <div className="text-[10px] font-black text-amber-700 tracking-widest uppercase mb-1">AT CURRENT TRAJECTORY</div>
              <div className="text-4xl font-black text-amber-600 mb-1">{KCSE_STUDENT.meanGrade}</div>
              <div className="text-slate-500 text-xs mb-2">Projected mean grade if no intervention</div>
              <div className="space-y-1 text-left">
                <div className="text-[10px] text-slate-500">Best 7 subjects average = C+ (6.7 pts)</div>
                <div className="text-[10px] text-slate-500">University: Minimum entry only</div>
                <div className="text-[10px] text-red-500 font-bold">Course options: Limited</div>
              </div>
            </div>
            <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-[10px] font-black text-green-700 tracking-widest uppercase mb-1">WITH 8-WEEK INTERVENTION</div>
              <div className="text-4xl font-black text-green-600 mb-1">B-<span className="text-2xl text-green-500"> → B</span></div>
              <div className="text-slate-500 text-xs mb-2">Achievable with targeted Chemistry + Biology work</div>
              <div className="space-y-1 text-left">
                <div className="text-[10px] text-slate-500">Chemistry C+ improvement = +0.4 pts</div>
                <div className="text-[10px] text-slate-500">Biology C+ improvement = +0.3 pts</div>
                <div className="text-[10px] text-green-700 font-bold">New mean: B- to B plain</div>
              </div>
            </div>
          </div>
        </div>

        {/* Pathway bars */}
        <div className="space-y-2.5 mb-4">
          {KCSE_PATHWAYS.map(p => (
            <div key={p.name} className={`rounded-xl overflow-hidden ${p.recommended ? 'ring-2 ring-[#1a2744] shadow-md' : 'border border-slate-200'}`}>
              <div className={`px-4 py-3 ${p.recommended ? 'bg-[#1a2744]' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className={`text-sm font-black ${p.recommended ? 'text-white' : 'text-slate-700'}`}>{p.name}</div>
                    <div className={`text-xs mt-0.5 ${p.recommended ? 'text-slate-300' : 'text-slate-400'}`}>{p.sub}</div>
                    {p.note && <div className={`text-[10px] mt-0.5 ${p.recommended ? 'text-amber-300' : 'text-slate-400'}`}>{p.note}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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

        {/* Confidence + why fits */}
        <div className="flex justify-center mb-4">
          <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-black px-4 py-1 rounded-full tracking-wider">
            {KCSE_STUDENT.pathwayConfidence}
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <div className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-2">Why Humanities Fits</div>
            <div className="space-y-2">
              {[
                'B grades in English and Kiswahili — core humanities subjects',
                'History & Government improving — genuine aptitude for civic analysis',
                'CRE consistent — ethical reasoning strength',
                'Communication skills across assessments',
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
            <div className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-2">Before KCSE, Strengthen</div>
            <div className="space-y-2">
              {[
                'Chemistry — critical, must improve from D+',
                'Biology — declining, needs recovery',
                'Mathematics Paper 2 — calculus gaps',
                'Geography map reading — easy marks',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-amber-100 border border-amber-200 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-amber-600 text-[9px] font-black">!</span>
                  </div>
                  <p className="text-slate-600 text-xs leading-snug">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Navy insight */}
        <div className="bg-[#1a2744] rounded-xl p-4">
          <div className="text-amber-500 text-[10px] font-black tracking-widest uppercase mb-2">The Honest KCSE Picture</div>
          <p className="text-slate-200 text-xs leading-relaxed mb-2">
            James is {KCSE_STUDENT.monthsToMock} months from the KCSE mock exam. At current trajectory, mean grade C+ gives access to university — but limits course options.
          </p>
          <p className="text-amber-300 text-xs leading-relaxed font-medium mb-2">
            The difference between C+ and B plain is largely ONE subject: Chemistry.
          </p>
          <p className="text-slate-300 text-xs leading-relaxed">
            Improving Chemistry from D+ to C+ alone would add 0.4 points to the mean grade. That single improvement, combined with maintaining current strengths, puts B plain within realistic reach.
          </p>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between">
          <span className="text-slate-300 text-[10px]">KR-2026-JK3F8M</span>
          <span className="text-slate-300 text-[10px]">edunexus.co.ke</span>
        </div>
      </div>
    </div>
  )
}
