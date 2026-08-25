import { KCSE_STUDENT, KCSE_SUBJECTS } from '../kcseMockData'
import KcsePageHeader from './KcsePageHeader'

const WM = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
    <div className="font-black text-slate-900 select-none" style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', whiteSpace: 'nowrap' }}>
      SAMPLE REPORT — edunexus.co.ke
    </div>
  </div>
)

const WritingLines = ({ count }: { count: number }) => (
  <div className="space-y-4 mt-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="border-b border-dashed border-slate-300 h-5" />
    ))}
  </div>
)

export default function KcseTeacherPage() {
  const strong = KCSE_SUBJECTS.filter(s => s.status === 'strong')
  const urgent = KCSE_SUBJECTS.filter(s => s.status === 'critical' || (s.status === 'developing' && s.trend === 'declining'))

  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <KcsePageHeader page={7} />

      {/* Print banner */}
      <div className="relative z-10 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 shrink-0">
        <span className="text-amber-700 text-xs font-bold">
          <span className="hidden md:inline">🖨️ Print this page and share with subject teachers — especially Chemistry</span>
          <span className="md:hidden">📤 Share this page with James&apos;s class teacher</span>
        </span>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-3 pb-3">
        <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">
          Teacher Reference Page · KCSE
        </div>
        <h2 className="text-[#1a2744] text-xl font-black mb-1">For James&apos;s Class Teachers</h2>
        <div className="h-0.5 bg-[#1a2744]/15 mb-3" />

        {/* Student summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3">
          <p className="text-slate-700 text-xs leading-relaxed">
            <strong>{KCSE_STUDENT.name} (Form {KCSE_STUDENT.form})</strong> has completed an EduNexus KCSE Readiness Assessment for Term {KCSE_STUDENT.term}, {KCSE_STUDENT.year}.
          </p>
          <p className="text-slate-700 text-xs leading-relaxed mt-1">
            Current mean grade: <strong>C+</strong> (targeting B plain by KCSE). Timeline: <strong className="text-amber-700">{KCSE_STUDENT.monthsToMock} months to KCSE Mock Examination</strong>
          </p>
          <p className="text-slate-500 text-xs leading-relaxed mt-1.5">
            9 subjects assessed · 4 subjects performing at B level · 4 subjects need structured support · 1 subject (Chemistry) at critical level — D+.
          </p>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <div className="bg-red-700 text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-t-lg">
              URGENT CLASSROOM SUPPORT
            </div>
            <div className="bg-red-50 border border-red-200 border-t-0 rounded-b-lg p-2.5 space-y-2">
              {urgent.map(s => (
                <div key={s.name}>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="text-slate-700 text-xs font-bold flex-1">{s.name} — {s.grade}</span>
                    {s.status === 'critical' && <span className="text-red-600 text-[9px] font-black">🚨 CRITICAL</span>}
                    {s.trend === 'declining' && s.status !== 'critical' && <span className="text-amber-600 text-[9px] font-black">⚠️ Declining</span>}
                  </div>
                  <div className="text-slate-400 text-[10px] pl-4">{s.paperFocus}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="bg-green-700 text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-t-lg">
              MAINTAINING STRENGTH
            </div>
            <div className="bg-green-50 border border-green-200 border-t-0 rounded-b-lg p-2.5 space-y-1.5">
              {strong.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-slate-700 text-xs flex-1">{s.name}</span>
                  <span className="text-green-600 text-[10px] font-black">{s.grade}</span>
                  {s.trend === 'improving' && <span className="text-green-500 text-[10px]">↑</span>}
                </div>
              ))}
              <p className="text-slate-400 text-[10px] italic pt-1">
                Consider extension questions for these subjects.
              </p>
            </div>
          </div>
        </div>

        {/* Chemistry-specific note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
          <div className="text-amber-700 text-[10px] font-black tracking-widest uppercase mb-1">Note for Chemistry Teacher</div>
          <p className="text-slate-700 text-xs leading-relaxed">
            James&apos;s Chemistry has declined from C to D+ this term. The specific gaps identified are: <strong>mole calculations</strong> and <strong>organic chemistry naming</strong>. Targeted support on these two topics specifically would have the highest impact on mean grade.
          </p>
        </div>

        {/* Teacher observations */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3">
          <div className="text-[#1a2744] text-[10px] font-black tracking-widest uppercase mb-1">
            Teacher&apos;s Observations
          </div>
          <p className="text-slate-400 text-[10px] mb-1 italic">(Write your classroom observations here)</p>
          <WritingLines count={3} />
        </div>

        {/* Action agreed */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3">
          <div className="text-[#1a2744] text-[10px] font-black tracking-widest uppercase mb-1">
            Action Agreed with Parent + Teacher
          </div>
          <WritingLines count={2} />
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {['Class Teacher', 'Chemistry Teacher', 'Parent', 'Date'].map(label => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-2.5 text-center">
              <div className="border-b border-slate-200 h-7 mb-2" />
              <div className="text-slate-400 text-[10px] font-bold">{label}</div>
            </div>
          ))}
        </div>

        {/* Report footer */}
        <div className="bg-[#1a2744] rounded-xl px-4 py-2.5 text-center">
          <div className="text-slate-300 text-xs mb-0.5">KCSE Readiness — EduNexus Learner Intelligence Report</div>
          <div className="text-slate-400 text-[10px]">edunexus.co.ke · Report ID: {KCSE_STUDENT.reportId}</div>
          <div className="text-slate-500 text-[10px] mt-0.5">CONFIDENTIAL — For School and Parent Use Only</div>
        </div>
      </div>
    </div>
  )
}
