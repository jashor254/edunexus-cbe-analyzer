// components/blueprint/BlueprintView.tsx
//
// Current Blueprint view — renders one composeBlueprint() result in order:
// Identity, Academic Record, Attendance, Learning Compass, Career
// Intelligence, Portfolio, Achievements (Sprint 6, ADR-0011/0012's own
// "summary + link out" field budget — Blueprint never re-renders a full
// Portfolio/Achievement record), Teacher Reflection, Parent Summary,
// Educational Identity, Growth Timeline, Evidence Trail. Single scrolling
// document, expand/collapse only — no tabs (ADR-0009 §4). Audience-neutral:
// every section renders for every viewer this sprint; audience filtering is
// explicitly deferred (mission: "Audience filtering belongs later").
//
// Sprint 12K: the same renderer also serves the Historical Snapshot viewer
// — pass `historicalMeta` and it renders the HistoricalBanner + disables
// the "live" framing in the header, with zero duplicated section-rendering
// logic (mission: "reuse the same renderer with historical metadata
// injected"). `blueprint` itself is untouched either way — a Snapshot's
// stored payload renders through the exact same BlueprintSectionCard/
// per-section components as a live composition.

import Link from 'next/link'
import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import type { BlueprintValidationResult } from '@/lib/learnerBlueprint/validation'
import BlueprintSectionCard from './BlueprintSectionCard'
import EvidenceTrailPlaceholder from './EvidenceTrailPlaceholder'
import HistoricalBanner, { type HistoricalMeta } from './HistoricalBanner'
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
} from './sections'

export default function BlueprintView({
  blueprint,
  validation,
  learnerId,
  historicalMeta,
}: {
  blueprint: LearnerBlueprint
  validation: BlueprintValidationResult
  /** Needed only to link forward to History (Current Blueprint) or back to it (Historical Viewer) — ADR-0009 §6, one-directional. */
  learnerId: string
  /** Present only when rendering a stored Blueprint Snapshot, never the Current Blueprint. */
  historicalMeta?: HistoricalMeta
}) {
  const generatedAt = blueprint.metadata.generatedAt

  return (
    <div className="max-w-2xl mx-auto space-y-3 py-6 px-4">
      {historicalMeta && <HistoricalBanner meta={historicalMeta} />}

      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-black text-gray-900">
            {historicalMeta ? 'Learner Blueprint — Historical Record' : 'Learner Blueprint'}
          </h1>
          {!historicalMeta && (
            <span aria-label="This is the Current, live Blueprint" className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-emerald-50 text-emerald-700 border-emerald-100">
              Current
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {historicalMeta
            ? `Composition as it was on ${new Date(generatedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })} — frozen, never recalculated.`
            : `Composition ${blueprint.metadata.freshness === 'live' ? 'fully live' : 'partial — some sections unavailable'} · generated ${new Date(generatedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}`}
        </p>
        {!validation.valid && (
          <div role="alert" className="mt-2 rounded-xl bg-red-50 border border-red-100 p-3">
            <p className="text-xs font-bold text-red-600">This Blueprint failed validation:</p>
            {validation.errors.map((e, i) => (
              <p key={i} className="text-[11px] text-red-500">{e.field}: {e.message}</p>
            ))}
          </div>
        )}
        <nav aria-label="Blueprint history navigation" className="mt-2">
          {historicalMeta ? (
            <Link
              href={`/student/blueprint/${learnerId}/history`}
              className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              ← Back to History
            </Link>
          ) : (
            <Link
              href={`/student/blueprint/${learnerId}/history`}
              className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              View History →
            </Link>
          )}
        </nav>
      </div>

      <BlueprintSectionCard title="Identity" sectionNumber={1} section={blueprint.identity} generatedAt={generatedAt} defaultOpen>
        {data => <IdentitySection data={data} />}
      </BlueprintSectionCard>

      <BlueprintSectionCard title="Academic Record" sectionNumber={2} section={blueprint.academicRecord} generatedAt={generatedAt} defaultOpen>
        {data => <AcademicRecordSection data={data} />}
      </BlueprintSectionCard>

      <BlueprintSectionCard title="Attendance" sectionNumber={3} section={blueprint.attendance} generatedAt={generatedAt}>
        {data => <AttendanceSection data={data} />}
      </BlueprintSectionCard>

      <BlueprintSectionCard title="Learning Compass" sectionNumber={4} section={blueprint.learningCompass} generatedAt={generatedAt}>
        {data => <LearningCompassSection data={data} />}
      </BlueprintSectionCard>

      <BlueprintSectionCard title="Career Intelligence" sectionNumber={5} section={blueprint.career} generatedAt={generatedAt}>
        {data => <CareerSection data={data} />}
      </BlueprintSectionCard>

      <BlueprintSectionCard title="Portfolio" sectionNumber={6} section={blueprint.portfolio} generatedAt={generatedAt}>
        {data => <PortfolioSection data={data} />}
      </BlueprintSectionCard>

      <BlueprintSectionCard title="Achievements" sectionNumber={7} section={blueprint.achievement} generatedAt={generatedAt}>
        {data => <AchievementSection data={data} />}
      </BlueprintSectionCard>

      <BlueprintSectionCard title="Teacher Reflection" sectionNumber={8} section={blueprint.teacherReflection} generatedAt={generatedAt}>
        {data => <TeacherReflectionSection data={data} />}
      </BlueprintSectionCard>

      <BlueprintSectionCard title="Parent Summary" sectionNumber={9} section={blueprint.parentSummary} generatedAt={generatedAt}>
        {data => <ParentSummarySection data={data} />}
      </BlueprintSectionCard>

      <BlueprintSectionCard title="Educational Identity" sectionNumber={10} section={blueprint.educationalIdentity} generatedAt={generatedAt}>
        {() => null}
      </BlueprintSectionCard>

      <BlueprintSectionCard title="Growth Timeline" sectionNumber={11} section={blueprint.growthTimeline} generatedAt={generatedAt}>
        {() => null}
      </BlueprintSectionCard>

      <BlueprintSectionCard title="Recommended Next Steps" sectionNumber={12} section={blueprint.recommendedNextSteps} generatedAt={generatedAt} defaultOpen>
        {data => <RecommendedNextStepsSection data={data} />}
      </BlueprintSectionCard>

      <EvidenceTrailPlaceholder />
    </div>
  )
}
