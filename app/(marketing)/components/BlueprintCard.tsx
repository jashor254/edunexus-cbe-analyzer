'use client'

// Extracted from the homepage's former #evidence section so the same
// mockup and sample-report entry points can be reused, unduplicated,
// across the homepage summary card and the /blueprint destination page.
// Content and demo-student data are unchanged from what was already
// trust-reviewed and canonicalized (Sprint 3 — see mockData.ts) on the
// homepage.

import { STUDENT as CBC_STUDENT } from '@/components/demo/mockData'
import { KCSE_STUDENT } from '@/components/demo/kcse/kcseMockData'

export function BlueprintCardMockup() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-2xl rotate-1 translate-x-2 translate-y-1" />
      <div className="relative bg-white/8 border border-white/15 rounded-2xl -rotate-2 w-64 p-7">
        <div className="text-[10px] font-bold text-teal-400 tracking-[0.15em] uppercase mb-1">
          EDUNEXUS
        </div>
        <div className="text-xl font-extrabold text-white mb-0.5">Learner Blueprint</div>
        <div className="text-xs text-white/60 mb-2">Living Learner Intelligence Profile</div>
        <div className="inline-block text-[10px] font-semibold text-white/45 bg-white/5 border border-white/10 rounded-full px-2 py-0.5 mb-3">
          Illustrative example
        </div>

        <div className="border-t border-white/15 mb-4" />

        <div className="text-base font-extrabold text-white mb-0.5">{CBC_STUDENT.name}</div>
        <div className="text-xs text-white/50 mb-0.5">Grade {CBC_STUDENT.grade} · Junior School</div>
        <div className="text-xs text-white/50 mb-5">Term {CBC_STUDENT.term}, {CBC_STUDENT.year}</div>

        <div className="border-t border-white/15 mb-4" />

        <div className="text-xs text-white/50 mb-2">
          Overall Competency:{' '}
          <span className="font-bold text-white">DEVELOPING</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold px-3 py-1 rounded-full">
            Level 2
          </span>
        </div>
        <div className="text-xs text-green-400 font-semibold mb-4">
          Trajectory: IMPROVING ↑
        </div>

        {/* Mini strand bars */}
        <div className="space-y-2 mb-5">
          {[
            { label: 'Number Patterns', pct: 43, color: 'bg-red-400/70'   },
            { label: 'Algebra',          pct: 67, color: 'bg-amber-400/70' },
            { label: 'Geometry',         pct: 81, color: 'bg-green-400/70' },
          ].map(({ label, pct, color }) => (
            <div key={label}>
              <div className="flex justify-between text-[10px] text-white/35 mb-0.5">
                <span>{label}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                <div className={`h-1 rounded-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/15 pt-3">
          <div className="text-[10px] text-white/45">edunexus.co.ke · CONFIDENTIAL · Sample</div>
        </div>
      </div>
    </div>
  )
}

export function SampleReportButtons({
  onOpenCBC,
  onOpenKCSE,
  focusRingClass,
}: {
  onOpenCBC: () => void
  onOpenKCSE: () => void
  focusRingClass: string
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={onOpenCBC}
        className={`flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/8 transition-all text-left ${focusRingClass}`}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0" />
        <div>
          <div className="text-sm font-bold text-white">{CBC_STUDENT.name}</div>
          <div className="text-xs text-white/40">CBC · Grade {CBC_STUDENT.grade}</div>
        </div>
      </button>

      <button
        onClick={onOpenKCSE}
        className={`flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/8 transition-all text-left ${focusRingClass}`}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
        <div>
          <div className="text-sm font-bold text-white">{KCSE_STUDENT.name}</div>
          <div className="text-xs text-white/40">8-4-4 · Form {KCSE_STUDENT.form}</div>
        </div>
      </button>
    </div>
  )
}
