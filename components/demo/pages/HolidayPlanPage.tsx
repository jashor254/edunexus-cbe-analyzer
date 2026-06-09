'use client'

import { useState } from 'react'
import PageHeader from './PageHeader'

const WM = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
    <div className="font-black text-slate-900 select-none" style={{ transform: 'rotate(-30deg)', opacity: 0.05, fontSize: '2.5rem', whiteSpace: 'nowrap' }}>
      SAMPLE REPORT — edunexus.co.ke
    </div>
  </div>
)

const WEEKS = [
  {
    number: 1,
    days: '1–7',
    title: 'FOUNDATION WEEK',
    sub: 'Close the Single Gap',
    focus: 'Pre-Technical Studies',
    daily: '45 min/day',
    goal: 'Bring Pre-Technical Studies from Developing to Proficient — consolidate design, draw, and materials work before Grade 10.',
    borderColor: 'border-amber-400',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    dotColor: 'bg-amber-500',
    activities: [
      'Technical drawing: practise 3 design-and-draw exercises from class notes daily',
      'Materials classification: build a reference chart of wood, metal, and plastic properties',
      'Complete 10 past class questions on construction and basic mechanisms',
    ],
    schedule: [
      { time: 'MORNING', task: 'Pre-Technical', dur: '45 min', bg: 'bg-white/10' },
      { time: 'AFTERNOON', task: 'Mathematics', dur: '30 min', bg: 'bg-white/10' },
      { time: 'EVENING', task: 'Learning Compass', dur: '20 min', bg: 'bg-amber-500/20' },
    ],
  },
  {
    number: 2,
    days: '8–14',
    title: 'BUILDING WEEK',
    sub: 'Consolidate and Apply',
    focus: 'Mathematics, Integrated Science',
    daily: '30 min/day',
    goal: 'Maintain Proficient level in Maths and Science — apply to past exam questions and real-world contexts.',
    borderColor: 'border-blue-400',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    dotColor: 'bg-blue-500',
    activities: [
      'Maths: 15 applied word problems per session — market pricing, distance, data charts',
      'Science: explain Newton\'s Laws and ecology concepts using real Kenyan examples',
      'Review Grade 9 CBC assessment criteria for both subjects',
    ],
    schedule: null,
  },
  {
    number: 3,
    days: '15–21',
    title: 'EXCELLENCE WEEK',
    sub: 'Push to Exemplary',
    focus: 'Social Studies, Kiswahili',
    daily: '20 min/day',
    goal: 'Deepen pathway-defining strengths — target Exemplary-level engagement in Social Sciences subjects before Grade 10.',
    borderColor: 'border-green-400',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    badgeBorder: 'border-green-200',
    dotColor: 'bg-green-500',
    activities: [
      'Read Daily Nation or Standard and analyse one article on Kenya governance per day',
      'Write a persuasive insha (Kiswahili essay) on a current Kenyan social issue',
      'Research one East African country — economy, geography, political structure — and present findings',
    ],
    schedule: null,
  },
]

function WeekCard({ w }: { w: typeof WEEKS[0] }) {
  return (
    <div className={`bg-white border-l-4 ${w.borderColor} border border-slate-200 rounded-r-xl h-full flex flex-col`}>
      <div className="px-3 py-3 flex-1">
        {/* Header */}
        <div className="flex items-start gap-2 mb-2 flex-wrap">
          <span className={`${w.badgeBg} ${w.badgeText} border ${w.badgeBorder} text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider shrink-0`}>
            WK {w.number} · {w.days}
          </span>
          <div className="min-w-0">
            <div className="text-[#1a2744] font-black text-xs leading-tight">{w.title}</div>
            <div className="text-slate-400 text-[10px]">{w.focus} · {w.daily}</div>
          </div>
        </div>

        {/* Goal */}
        <p className="text-slate-600 text-[10px] leading-snug mb-2 italic">{w.goal}</p>

        {/* Activities */}
        <div className="space-y-1">
          {w.activities.map((a, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className={`${w.badgeText} font-black text-xs mt-px shrink-0`}>▸</span>
              <p className="text-slate-600 text-[10px] leading-snug">{a}</p>
            </div>
          ))}
        </div>

        {/* Daily schedule — Week 1 only */}
        {w.schedule && (
          <div className="mt-3 bg-[#1a2744] rounded-lg p-2">
            <div className="text-amber-500 text-[9px] font-black tracking-widest uppercase mb-1.5">Daily Schedule</div>
            <div className="grid grid-cols-3 gap-1.5">
              {w.schedule.map(slot => (
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

export default function HolidayPlanPage() {
  const [activeWeek, setActiveWeek] = useState(0)

  return (
    <div className="relative bg-slate-50 h-full flex flex-col overflow-hidden">
      <WM />
      <PageHeader page={5} />

      <div className="relative z-10 flex-1 flex flex-col min-h-0 px-5 pt-4 pb-3">
        {/* Section header */}
        <div className="shrink-0">
          <div className="text-amber-600 text-[10px] font-black tracking-[0.25em] uppercase mb-0.5">Holiday Study Programme</div>
          <h2 className="text-[#1a2744] text-xl font-black mb-1">3-Week Holiday Action Plan</h2>
          <div className="h-0.5 bg-[#1a2744]/15 mb-3" />
        </div>

        {/* ── DESKTOP: 3-column grid ── */}
        <div className="hidden md:grid md:grid-cols-3 gap-3 flex-1 min-h-0">
          {WEEKS.map(w => <WeekCard key={w.number} w={w} />)}
        </div>

        {/* ── MOBILE: Tabs ── */}
        <div className="flex flex-col md:hidden flex-1 min-h-0">
          {/* Tab buttons */}
          <div className="flex gap-2 mb-3 shrink-0">
            {WEEKS.map((w, i) => (
              <button
                key={w.number}
                onClick={() => setActiveWeek(i)}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${
                  activeWeek === i
                    ? `${w.badgeBg} ${w.badgeText} border ${w.badgeBorder}`
                    : 'bg-white border border-slate-200 text-slate-500'
                }`}
              >
                Week {w.number}
              </button>
            ))}
          </div>
          {/* Active week */}
          <div className="flex-1 min-h-0">
            <WeekCard w={WEEKS[activeWeek]} />
          </div>
        </div>

        <div className="shrink-0 pt-2 border-t border-slate-200 flex justify-between mt-2">
          <span className="text-slate-300 text-[10px]">Report ID: EC-2026-BT9K2M</span>
          <span className="text-slate-300 text-[10px]">edunexus.co.ke</span>
        </div>
      </div>
    </div>
  )
}
