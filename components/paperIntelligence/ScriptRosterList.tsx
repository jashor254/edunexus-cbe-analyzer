// components/paperIntelligence/ScriptRosterList.tsx
//
// Paper Intelligence — the class list on the script-capture screen. UI only:
// every learner, how far their script has got (not captured → pages → marking
// → AI marks), tap to capture. Mobile-first, big touch targets.

import type { ScriptRosterEntry } from '@/lib/paperIntelligence/scriptRoster'

export type MarkingState = 'marking' | 'failed'

type Props = {
  learners: ScriptRosterEntry[]
  maxTotal: number
  marking: Record<string, MarkingState>
  onPick: (learner: ScriptRosterEntry) => void
}

export function ScriptRosterList({ learners, maxTotal, marking, onPick }: Props) {
  const marked = learners.filter(l => l.marks).length
  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">
        <span className="font-bold text-gray-800">{marked}</span> of {learners.length} scripts marked
      </p>
      <ul className="space-y-2">
        {learners.map(l => (
          <li key={l.submissionId}>
            <button
              onClick={() => onPick(l)}
              className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white border border-gray-200 px-4 py-3 text-left active:bg-teal-50"
            >
              <span className="font-semibold text-gray-800 truncate">{l.name}</span>
              <Status learner={l} maxTotal={maxTotal} state={marking[l.submissionId]} />
            </button>
          </li>
        ))}
      </ul>
      {learners.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">No learners on this assignment yet.</p>
      )}
    </div>
  )
}

function Status({ learner, maxTotal, state }: { learner: ScriptRosterEntry; maxTotal: number; state: MarkingState | undefined }) {
  if (state === 'marking') return <span className="shrink-0 text-xs font-bold text-teal-600 animate-pulse">Marking…</span>
  if (state === 'failed') return <span className="shrink-0 text-xs font-bold text-red-600">Marking failed — tap</span>
  if (learner.marks) {
    const { proposedTotal, plausibleTotal, needsAttention } = learner.marks
    const range = plausibleTotal > proposedTotal ? `${proposedTotal}–${plausibleTotal}` : `${proposedTotal}`
    return (
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold text-gray-800">{range}<span className="text-gray-400 font-medium">/{maxTotal}</span></span>
        {needsAttention > 0 && <span className="block text-[11px] font-bold text-amber-600">⚑ {needsAttention} to check</span>}
      </span>
    )
  }
  if (learner.pageNumbers.length > 0) {
    return <span className="shrink-0 text-xs font-bold text-gray-500">{learner.pageNumbers.length} page{learner.pageNumbers.length > 1 ? 's' : ''} · not marked</span>
  }
  return <span className="shrink-0 text-xs text-gray-400">Not captured</span>
}
