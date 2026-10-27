// components/parent/ParentBlueprintView.tsx
//
// The parent's Learner Progress Report. The four questions come first and are
// the SAME BlueprintView every learner and teacher reads (viewer="parent"
// only changes voice and parent-safe links) — so the parent never gets a
// separate, differently-worded account of their child. Below it, a "More
// detail" area holds the supporting records a parent may want to check.
//
// "More detail" is deliberately supplementary: nothing that changes the
// educational picture (levels, priorities, concerns, direction) lives only
// here. Server-rendered <details> disclosures — no client component, no
// render-function props crossing the server/client boundary (the previous
// accordion passed functions into a 'use client' card), no JavaScript needed,
// and they print.
//
// Not repeated here because the four questions already carry them: the
// parent summary, recommended next steps, Learning Compass focus, career /
// pathway direction.

import type { ReactNode } from 'react'
import type { BlueprintSection, LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import type { BlueprintValidationResult } from '@/lib/learnerBlueprint/validation'
import BlueprintView from '@/components/blueprint/BlueprintView'
import type { HistoricalMeta } from '@/components/blueprint/HistoricalBanner'
import {
  IdentitySection,
  AcademicRecordSection,
  AttendanceSection,
  PortfolioSection,
  AchievementSection,
  TeacherReflectionSection,
} from '@/components/blueprint/sections'

function DetailCard<T>({ title, section, children }: { title: string; section: BlueprintSection<T>; children: (data: T) => ReactNode }) {
  const ready = section.status === 'available' && section.data !== null
  return (
    <details className="group rounded-2xl border border-gray-100 bg-white" data-parent-detail={title}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-black text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
        <span>{title}</span>
        <span aria-hidden="true" className="text-gray-400 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-gray-50 px-5 pb-5 pt-4">
        {/* Never the composer's internal `unavailableReason` — it can name
            architecture ("bridged", "Projection", ADR numbers). */}
        {ready ? children(section.data as T) : <p className="text-sm text-gray-500">Nothing recorded here yet.</p>}
      </div>
    </details>
  )
}

export default function ParentBlueprintView({
  blueprint,
  validation,
  learnerId,
  historicalMeta,
}: {
  blueprint: LearnerBlueprint
  validation: BlueprintValidationResult
  learnerId: string
  /** Present only when rendering a stored Blueprint Snapshot, never the current report. */
  historicalMeta?: HistoricalMeta
}) {
  const className = blueprint.identity.data?.currentClassName ?? null

  return (
    <div className="space-y-2 pb-8">
      <BlueprintView
        blueprint={blueprint}
        validation={validation}
        learnerId={learnerId}
        historicalMeta={historicalMeta}
        viewer="parent"
        historyHref={`/child/${learnerId}/history`}
      />

      <section aria-labelledby="parent-more-detail" className="mx-auto max-w-4xl space-y-3 px-4">
        <h2 id="parent-more-detail" className="text-sm font-black uppercase tracking-wide text-gray-500">More detail</h2>

        <DetailCard title="About your child" section={blueprint.identity}>
          {data => <IdentitySection data={data} />}
        </DetailCard>
        <DetailCard title="Subject by subject" section={blueprint.academicRecord}>
          {data => <AcademicRecordSection data={data} className={className} />}
        </DetailCard>
        <DetailCard title="Learning time (attendance)" section={blueprint.attendance}>
          {data => <AttendanceSection data={data} />}
        </DetailCard>
        <DetailCard title="The teacher’s full reflection" section={blueprint.teacherReflection}>
          {data => <TeacherReflectionSection data={data} />}
        </DetailCard>
        <DetailCard title="Portfolio" section={blueprint.portfolio}>
          {data => <PortfolioSection data={data} />}
        </DetailCard>
        <DetailCard title="Achievements" section={blueprint.achievement}>
          {data => <AchievementSection data={data} />}
        </DetailCard>
      </section>
    </div>
  )
}
