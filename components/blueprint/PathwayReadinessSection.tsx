// components/blueprint/PathwayReadinessSection.tsx
//
// The pathway readiness section, in the compact form the parent portal's
// section cards use. The teacher/learner Blueprint renders its own richer
// Page 4 layout (BlueprintView.tsx) from exactly the same composed data — one
// composition, two presentations, per ADR-0010 Part 3.
//
// Every branch here is required to show the disclaimer, because the KJSEA
// thresholds behind these figures come from a rule set flagged provisional
// (lib/config/kjseaRules.ts). A parent reading a composite must be able to see
// that it is a planning aid, not a placement result.

import type { PathwayReadinessData } from '@/lib/learnerBlueprint/types'

export function PathwayReadinessSection({ data }: { data: PathwayReadinessData }) {
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <p>{data.stageMessage}</p>

      {data.stage === 'decision_year' && (
        <>
          <p>
            Current composite:{' '}
            <span className="font-bold">
              {data.isPartialComposite ? 'at least ' : ''}
              {data.compositeScore}
            </span>{' '}
            of {data.kjseaMaxScore}, from {data.subjectsEntered} of {data.subjectGroupsTotal} subject groups.
          </p>

          {data.qualifiesFor.length > 0 && (
            <p>
              On the record so far, this reaches the threshold for:{' '}
              <span className="font-bold">{data.qualifiesFor.join(', ')}</span>.
            </p>
          )}

          {data.nextDoor && (
            <div className="rounded border border-teal-200 bg-teal-50 px-2 py-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800">
                What would open {data.nextDoor.pathway}
              </p>
              <p>
                Moving {data.nextDoor.keyLever.subject} from level {data.nextDoor.keyLever.currentLevel} to
                level {data.nextDoor.keyLever.targetLevel}
                {data.nextDoor.keyLever.wouldUnlock
                  ? ' would be enough on its own.'
                  : ` would close ${data.nextDoor.keyLever.pointsGained} of the ${data.nextDoor.pointsShort} points still needed.`}
              </p>
            </div>
          )}
        </>
      )}

      {data.notes.map((note, i) => (
        <p key={i} className="text-[11px] text-gray-500">{note}</p>
      ))}

      <p className="text-[11px] text-gray-400">{data.disclaimer}</p>
    </div>
  )
}
