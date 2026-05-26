'use client'

import { useState } from 'react'
import KcsePageHeader from './KcsePageHeader'

const WM = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
    <div className="font-black text-slate-900 select-none" style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', whiteSpace: 'nowrap' }}>
      SAMPLE REPORT — edunexus.co.ke
    </div>
  </div>
)

const PHASES = [
  {
    label: 'WEEKS 1–3',
    title: 'CHEMISTRY RESCUE',
    sub: 'Close the Biggest Gap',
    focus: 'Chemistry (daily), Biology (alternate days)',
    goal: 'Move Chemistry from D+ to C+. Stop Biology decline at C.',
    borderColor: 'border-red-400',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    badgeBorder: 'border-red-200',
    activities: [
      'Chemistry: Mole calculations — 10 problems daily until automatic',
      'Chemistry: Organic chemistry basics — alkanes, alkenes, reactions, naming',
      'Chemistry: Acid-base and salts — reactions, salt preparation, pH',
      'Biology: Genetics — Mendelian inheritance, punnet squares, genetic disorders',
      'Biology: Paper 3 practical — draw and label 3 biological diagrams daily',
    ],
    schedule: [
      { time: 'MORNING', task: 'Chemistry', dur: '45 min', bg: 'bg-white/10' },
      { time: 'AFTERNOON', task: 'Biology', dur: '20 min', bg: 'bg-white/10' },
      { time: 'EVENING', task: 'Compass', dur: '20 min', bg: 'bg-amber-500/20' },
    ],
  },
  {
    label: 'WEEKS 4–6',
    title: 'MATHS & SCIENCES',
    sub: 'Building Phase — Consolidation',
    focus: 'Mathematics Paper 2, Physics',
    goal: 'Push Mathematics from C+ to B-. Maintain Chemistry improvement.',
    borderColor: 'border-amber-400',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    activities: [
      'Mathematics: Differentiation and integration — master basics first',
      'Mathematics: Statistics and probability — consistently tested in Paper 2',
      'Mathematics: Vectors and matrices — follow KNEC marking scheme structure',
      'Physics: Electricity circuits — Ohm\'s law, series and parallel, power',
      'Past paper: One full Paper 2 per week under timed conditions',
    ],
    schedule: null,
  },
  {
    label: 'WEEKS 7–8',
    title: 'PROTECT STRENGTHS',
    sub: 'Excellence Phase',
    focus: 'English Paper 3, History, Geography maps',
    goal: 'Push strong subjects toward A. Secure the mean grade foundation.',
    borderColor: 'border-green-400',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    badgeBorder: 'border-green-200',
    activities: [
      'English: Blossoms of the Savannah — character analysis, themes, essay technique',
      'History: Essay structure — intro + 5 developed points + conclusion',
      'Geography: 1:50,000 map reading — grid references, contours, distance',
      'CRE: Applied ethics — structure answers using KNEC command words',
    ],
    schedule: null,
  },
]

function PhaseCard({ p }: { p: typeof PHASES[0] }) {
  return (
    <div className={`bg-white border-l-4 ${p.borderColor} border border-slate-200 rounded-r-xl h-full flex flex-col`}>
      <div className="px-3 py-3 flex-1">
        <div className="flex items-start gap-2 mb-2 flex-wrap">
          <span className={`${p.badgeBg} ${p.badgeText} border ${p.badgeBorder} text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider shrink-0`}>
            {p.label}
          </span>
          <div className="min-w-0">
            <div className="text-[#1a2744] font-black text-xs leading-tight">{p.title}</div>
            <div className="text-slate-400 text-[10px]">{p.focus}</div>
          </div>
        </div>

        <p className="text-slate-600 text-[10px] leading-snug mb-2 italic">{p.goal}</p>

        <div className="space-y-1">
          {p.activities.map((a, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className={`${p.badgeText} font-black text-xs mt-px shrink-0`}>▸</span>
              <p className="text-slate-600 text-[10px] leading-snug">{a}</p>
            </div>
          ))}
        </div>

        {p.schedule && (
          <div className="mt-3 bg-[#1a2744] rounded-lg p-2">
            <div className="text-amber-500 text-[9px] font-black tracking-widest uppercase mb-1.5">Daily KCSE Schedule</div>
            <div className="grid grid-cols-3 gap-1.5">
              {p.schedule.map(slot => (
                <div key={slot.time} className={`${slot.bg} rounded-md p-1.5 text-center`}>
                  <div className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5">{slot.time}</div>
                  <div className="text-white font-black text-[10px] mb-0.5">{slot.task}</div>
                  <div className="text-amber-400 text-[9px] font-bold">{slot.dur}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function KcseStudyPlanPage() {
  const [activePhase, setActivePhase] = useState(0)

  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <KcsePageHeader page={5} />

      <div className="relative z-10 flex-1 flex flex-col min-h-0 px-5 pt-4 pb-3">
        <div className="shrink-0">
          <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">KCSE Intensive Study Programme</div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-[#1a2744] text-xl font-black">8-Week Plan to B Plain</h2>
            <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">
              ⏰ Start immediately
            </span>
          </div>
          <div className="h-0.5 bg-[#1a2744]/15 mb-3" />
        </div>

        {/* Desktop: 3-column */}
        <div className="hidden md:grid md:grid-cols-3 gap-3 flex-1 min-h-0">
          {PHASES.map(p => <PhaseCard key={p.label} p={p} />)}
        </div>

        {/* Mobile: tabs */}
        <div className="flex flex-col md:hidden flex-1 min-h-0">
          <div className="flex gap-2 mb-3 shrink-0">
            {PHASES.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setActivePhase(i)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${
                  activePhase === i
                    ? `${p.badgeBg} ${p.badgeText} border ${p.badgeBorder}`
                    : 'bg-white border border-slate-200 text-slate-500'
                }`}
              >
                Wk {i === 0 ? '1–3' : i === 1 ? '4–6' : '7–8'}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PhaseCard p={PHASES[activePhase]} />
          </div>
        </div>

        <div className="shrink-0 pt-2 border-t border-slate-200 flex justify-between mt-2">
          <span className="text-slate-300 text-[10px]">KR-2026-JK3F8M</span>
          <span className="text-slate-300 text-[10px]">edunexus.co.ke</span>
        </div>
      </div>
    </div>
  )
}
