// components/parent/ParentActionCard.tsx
//
// "Today's Actions" (Sprint 12S Phase 6) — Parent Home's compact teaser
// over Blueprint's own "Recommended Next Steps" section. Pure rendering:
// receives the exact `ParentAction[]` `composeBlueprint()` already
// produced (via `blueprint.recommendedNextSteps.data.actions`) — this
// component calls `composeParentActions()` nowhere, reads no domain data
// itself, and performs no priority logic of its own (the list arrives
// pre-ordered by `lib/parentExperience/actions.ts`). Every card links
// outward to the action's own `destination` — never embeds another
// domain's content (Phase 9).
//
// Deliberately no "Source: X" attribution line here (unlike the full
// Blueprint's `RecommendedNextStepsSection`) — a home-page teaser is meant
// to answer "what do I do," not "which system said so" (ADR-0010 Part 6/
// Phase 10: understandable to low-literacy/phone users, no unnecessary
// detail).

import Link from 'next/link'
import type { ParentAction } from '@/lib/parentExperience/actions'

const PRIORITY_LABEL: Record<ParentAction['priority'], string> = {
  critical: 'Needs Attention',
  important: 'Worth Doing Soon',
  suggested: 'When You Have Time',
  completed: 'All Good',
}

const PRIORITY_STYLE: Record<ParentAction['priority'], string> = {
  critical: 'bg-red-50 text-red-700 border-red-100',
  important: 'bg-amber-50 text-amber-700 border-amber-100',
  suggested: 'bg-teal-50 text-teal-700 border-teal-100',
  completed: 'bg-gray-100 text-gray-500 border-gray-200',
}

export default function ParentActionCard({ actions, title = "Today's Actions" }: { actions: ParentAction[]; title?: string }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">{title}</h2>
      {actions.map((action, i) => (
        <Link
          key={i}
          href={action.destination}
          className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900">{action.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${PRIORITY_STYLE[action.priority]}`}>
              {PRIORITY_LABEL[action.priority]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{action.description}</p>
        </Link>
      ))}
    </div>
  )
}
