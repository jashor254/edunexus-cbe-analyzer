// components/parent/ParentBlueprintView.tsx
//
// Full Blueprint view for the Parent audience (Sprint 12Q, ADR-0010 Part 3
// visibility matrix + Phase 3: "consume composeBlueprint() directly, no
// transformations, no recalculations, no parent-specific Blueprint —
// exactly the same Blueprint with the Parent visibility matrix"). Renders
// `blueprint` — the exact object `composeBlueprint()` (Current) or a
// stored Snapshot's `blueprint_payload` (Historical) already produced —
// through the same per-section content renderers Teacher Blueprint uses
// (components/blueprint/sections.tsx, unchanged, reused verbatim), so
// there is exactly one place educational content is composed and exactly
// one place each section's content is rendered.
//
// Sections shown, per ADR-0010 Part 3's Visibility Matrix: Identity,
// Academic Record, Attendance (already summary-only), Learning Compass,
// Career (already cluster-only, Sprint 12N), Portfolio, Achievements
// (Sprint 6 — summary-only per ADR-0011 Phase 4 / ADR-0012 Phase 7's own
// Parent Portal row, same discipline as every other section here), Teacher
// Reflection, Parent Summary. Never shown: Educational Identity, Growth
// Timeline (both `not_implemented` — Part 3's "Future: shows nothing until
// the domain exists"), Evidence Trail (Part 3: "No").

import Link from 'next/link'
import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import ParentSectionCard from './ParentSectionCard'
import HistoricalBanner, { type HistoricalMeta } from '@/components/blueprint/HistoricalBanner'
import {
  IdentitySection,
  AcademicRecordSection,
  AttendanceSection,
  LearningCompassSection,
  CareerSection,
  PortfolioSection,
  AchievementSection,
  TeacherReflectionSection,
  ParentSummarySection,
  RecommendedNextStepsSection,
} from '@/components/blueprint/sections'

export default function ParentBlueprintView({
  blueprint,
  learnerId,
  historicalMeta,
}: {
  blueprint: LearnerBlueprint
  learnerId: string
  /** Present only when rendering a stored Blueprint Snapshot, never the Current Blueprint (ADR-0010 Phase 4: "Clear distinction between Current Blueprint and Historical Snapshot"). */
  historicalMeta?: HistoricalMeta
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-3 py-6 px-4">
      {historicalMeta && <HistoricalBanner meta={historicalMeta} />}

      <div className="mb-2">
        <h1 className="text-lg font-black text-gray-900">
          {historicalMeta ? "A Moment in Their Journey" : "Your Child's Full Picture"}
        </h1>
        <nav aria-label="Parent Blueprint navigation" className="mt-1">
          {historicalMeta ? (
            <Link href={`/child/${learnerId}/history`} className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
              ← Back to Timeline
            </Link>
          ) : (
            <Link href={`/child/${learnerId}`} className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
              ← Back to Home
            </Link>
          )}
        </nav>
      </div>

      <ParentSectionCard title="About Your Child" section={blueprint.identity} defaultOpen>
        {data => <IdentitySection data={data} />}
      </ParentSectionCard>

      <ParentSectionCard title="Academic Progress" section={blueprint.academicRecord} defaultOpen>
        {data => <AcademicRecordSection data={data} />}
      </ParentSectionCard>

      <ParentSectionCard title="Learning Time (Attendance)" section={blueprint.attendance}>
        {data => <AttendanceSection data={data} />}
      </ParentSectionCard>

      <ParentSectionCard title="Learning Compass" section={blueprint.learningCompass}>
        {data => <LearningCompassSection data={data} />}
      </ParentSectionCard>

      <ParentSectionCard title="Career Exploration" section={blueprint.career}>
        {data => <CareerSection data={data} />}
      </ParentSectionCard>

      <ParentSectionCard title="Portfolio" section={blueprint.portfolio}>
        {data => <PortfolioSection data={data} />}
      </ParentSectionCard>

      <ParentSectionCard title="Achievements" section={blueprint.achievement}>
        {data => <AchievementSection data={data} />}
      </ParentSectionCard>

      <ParentSectionCard title="Teacher Reflection" section={blueprint.teacherReflection}>
        {data => <TeacherReflectionSection data={data} />}
      </ParentSectionCard>

      <ParentSectionCard title="What This Means For You" section={blueprint.parentSummary} defaultOpen>
        {data => <ParentSummarySection data={data} />}
      </ParentSectionCard>

      <ParentSectionCard title="Recommended Next Steps" section={blueprint.recommendedNextSteps} defaultOpen>
        {data => <RecommendedNextStepsSection data={data} />}
      </ParentSectionCard>
    </div>
  )
}
