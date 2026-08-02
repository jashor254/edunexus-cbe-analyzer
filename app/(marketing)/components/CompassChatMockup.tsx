'use client'

// Extracted from the homepage's former #compass section so the same
// mockup can be reused, unduplicated, across the homepage summary card
// and the /compass destination page. Content and demo-student data are
// unchanged from what was already trust-reviewed on the homepage.

import { STUDENT as DEMO_STUDENT } from '@/components/demo/mockData'

export function CompassChatMockup() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur overflow-hidden w-full max-w-sm">
      <div className="bg-white/8 border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-white">🧭 Learning Compass</div>
          <div className="text-xs text-white/40">{DEMO_STUDENT.name.split(' ')[0]}, Grade {DEMO_STUDENT.grade}</div>
        </div>
        <span className="text-xs font-semibold bg-teal-500/20 text-teal-300 px-2.5 py-1 rounded-full whitespace-nowrap">
          Maths · Level 2
        </span>
      </div>
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-white/10 bg-white/3">
        <span className="text-xs font-semibold text-white/40">Illustrative example</span>
      </div>
      <div className="px-4 py-2 border-b border-white/10 bg-teal-500/5">
        <span className="text-[11px] text-teal-300/80 leading-snug">
          Same learner as the Blueprint above — this session opens on his diagnosed
          gap directly, not a generic topic menu.
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 text-sm">
            🧭
          </div>
          <div className="bg-teal-500/20 text-white/90 text-sm rounded-2xl rounded-tl-none px-4 py-3 max-w-55 leading-relaxed">
            Let&apos;s start with fractions. If you have 3 chapatis and eat 1, what fraction is left?
          </div>
        </div>

        <div className="flex justify-end">
          <div className="bg-white/10 text-white/70 text-sm rounded-2xl rounded-tr-none px-4 py-3 max-w-40">
            2/3?
          </div>
        </div>

        <div className="flex gap-2 items-start">
          <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 text-sm">
            🧭
          </div>
          <div className="bg-teal-500/20 text-white/90 text-sm rounded-2xl rounded-tl-none px-4 py-3 max-w-55 leading-relaxed">
            Almost! You have 3 total, ate 1, so 2 remain. That makes it 2/3. Correct! ✓ Let&apos;s try a harder one.
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 h-1.5 bg-teal-500/30 rounded-full overflow-hidden">
            <div className="h-1.5 bg-teal-500 rounded-full w-2/5" />
          </div>
          <span className="text-xs text-teal-300 font-semibold whitespace-nowrap">
            Difficulty: 2/5 ↑
          </span>
        </div>
      </div>
    </div>
  )
}
