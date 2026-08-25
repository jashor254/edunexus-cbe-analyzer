import { STUDENT, SUBJECTS } from '../mockData'
import PageHeader from './PageHeader'

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

export default function TeacherPage() {
  const strengths = SUBJECTS.filter(s => s.level >= 3)
  const priorities = SUBJECTS.filter(s => s.level <= 2)

  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <PageHeader page={7} />

      {/* Print / share instruction banner */}
      <div className="relative z-10 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 shrink-0">
        <span className="text-amber-600 text-xs font-black">
          <span className="hidden md:inline">🖨️</span>
          <span className="md:hidden">📤</span>
        </span>
        <span className="text-amber-700 text-xs font-bold">
          <span className="hidden md:inline">Print this page and bring it to school</span>
          <span className="md:hidden">Share this report with Brian&apos;s class teacher</span>
        </span>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-3 pb-3">
        {/* Section header */}
        <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">
          Teacher Reference Page
        </div>
        <h2 className="text-[#1a2744] text-xl font-black mb-1">For the Class Teacher</h2>
        <div className="h-0.5 bg-[#1a2744]/15 mb-3" />

        {/* Student summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3">
          <p className="text-slate-700 text-xs leading-relaxed">
            <strong>{STUDENT.name} (Grade {STUDENT.grade})</strong> has a new EduNexus Learner Intelligence Report for Term {STUDENT.term}, {STUDENT.year}.
            Overall competency is rated <strong>{STUDENT.overallLabel} (Level {STUDENT.overallLevel})</strong>{' '}
            with a trajectory of <strong className="text-amber-600">{STUDENT.trajectory}</strong>.
          </p>
          <p className="text-slate-500 text-xs leading-relaxed mt-1.5">
            {SUBJECTS.length} subjects assessed · {strengths.length} at Proficient or above · {priorities.length} require structured support
          </p>
        </div>

        {/* Two columns — stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* Support needed */}
          <div>
            <div className="bg-red-700 text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-t-lg">
              SUGGESTED CLASSROOM SUPPORT
            </div>
            <div className="bg-red-50 border border-red-200 border-t-0 rounded-b-lg p-2.5 space-y-1.5">
              {priorities.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-slate-700 text-xs flex-1">{s.name}</span>
                  <span className="text-amber-600 text-[10px] font-black">L{s.level}</span>
                  {s.trend === 'declining' && <span className="text-red-500 text-xs">⚠️</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Excels */}
          <div>
            <div className="bg-green-700 text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-t-lg">
              AREAS WHERE BRIAN EXCELS
            </div>
            <div className="bg-green-50 border border-green-200 border-t-0 rounded-b-lg p-2.5 space-y-1.5">
              {strengths.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-slate-700 text-xs flex-1">{s.name}</span>
                  <span className="text-green-600 text-[10px] font-black ml-auto">L{s.level}</span>
                </div>
              ))}
              <p className="text-slate-500 text-[10px] italic pt-1">
                Consider peer leadership opportunities in these subjects.
              </p>
            </div>
          </div>
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
            Action Agreed with Parent
          </div>
          <p className="text-slate-400 text-[10px] mb-1 italic">(Record commitments from the parent-teacher discussion)</p>
          <WritingLines count={2} />
        </div>

        {/* Signatures — stacked on mobile, 3-col on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-3">
          {["Teacher's Signature", "Parent's Signature", 'Date'].map(label => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-2.5 flex md:flex-col items-center md:items-stretch gap-3 md:gap-0 md:text-center">
              <div className="border-b border-slate-200 hidden md:block h-8 mb-2" />
              <div className="flex-1 border-b border-slate-200 md:hidden h-px" />
              <div className="text-slate-400 text-[10px] font-bold shrink-0">{label}</div>
            </div>
          ))}
        </div>

        {/* Report footer */}
        <div className="bg-[#1a2744] rounded-xl px-4 py-2.5 text-center">
          <div className="text-slate-300 text-xs mb-0.5">This is an EduNexus Learner Intelligence Report</div>
          <div className="text-slate-400 text-[10px]">Report ID: {STUDENT.reportId} · edunexus.co.ke</div>
          <div className="text-slate-500 text-[10px] mt-0.5">CONFIDENTIAL — For Parent and Teacher Use Only</div>
        </div>
      </div>
    </div>
  )
}
