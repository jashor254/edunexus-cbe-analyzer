// components/blueprint/HistoricalBanner.tsx
//
// The banner that makes a Historical Snapshot visibly, unmistakably
// different from the Current Blueprint (Sprint 12K mission: "Never appear
// identical to Current Blueprint"). Rendered once, at the top of
// BlueprintView, only when historical metadata is supplied — reusing the
// same renderer, per mission ("reuse the same renderer with historical
// metadata injected"), never a second component tree.

import type { BlueprintSnapshotType } from '@/lib/repositories/blueprintSnapshot.repository'

const SNAPSHOT_TYPE_LABEL: Record<BlueprintSnapshotType, string> = {
  report_card_publication: 'Report Card Publication',
  end_of_term: 'End of Term',
  graduation: 'Graduation',
}

const GENERATED_FROM_LABEL: Record<BlueprintSnapshotType, string> = {
  report_card_publication: 'Generated automatically when a Report Card was published',
  end_of_term: 'Generated automatically at End of Term',
  graduation: 'Generated automatically at Graduation',
}

export type HistoricalMeta = {
  snapshotId: string
  snapshotDate: string
  academicYearLabel: string | null
  termLabel: string | null
  snapshotType: BlueprintSnapshotType
  /** Sprint 12L-R Phase 5 — all read straight from the stored row/payload, never recomputed. */
  schoolName: string | null
  schemaVersion: string
  blueprintVersion: string
  generatedFrom: BlueprintSnapshotType
}

export default function HistoricalBanner({ meta }: { meta: HistoricalMeta }) {
  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 mb-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-black text-amber-800 uppercase tracking-wide">Historical Snapshot</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-amber-100 text-amber-700 border-amber-200">
          Immutable — cannot be edited
        </span>
      </div>
      <p className="text-sm text-amber-900 font-bold mt-1">
        {new Date(meta.snapshotDate).toLocaleDateString('en-KE', { dateStyle: 'long' })}
      </p>
      <p className="text-xs text-amber-700 mt-0.5">
        {[meta.schoolName, meta.academicYearLabel, meta.termLabel].filter(Boolean).join(' · ')}
        {(meta.schoolName || meta.academicYearLabel || meta.termLabel) && ' · '}
        {SNAPSHOT_TYPE_LABEL[meta.snapshotType]}
      </p>
      <p className="text-[11px] text-amber-600 mt-1">
        This is a frozen historical record — it never changes. It is not the learner&apos;s Current Blueprint.
      </p>
      <dl className="mt-2 pt-2 border-t border-amber-200/60 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-amber-700">
        <div className="flex gap-1">
          <dt className="font-bold">Generated From:</dt>
          <dd>{GENERATED_FROM_LABEL[meta.generatedFrom]}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold">Schema Version:</dt>
          <dd>{meta.schemaVersion}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-bold">Blueprint Version:</dt>
          <dd>{meta.blueprintVersion}</dd>
        </div>
      </dl>
    </div>
  )
}
