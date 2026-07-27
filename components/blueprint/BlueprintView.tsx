// components/blueprint/BlueprintView.tsx
//
// Learner Blueprint renderer — a deliberate seven-page premium report over
// the one canonical Blueprint composition, passed in as a prop. Presentation
// only: no new intelligence, no new queries, no duplicated reasoning, and it
// never composes its own Blueprint data. Visual language recovers the
// institutional-report quality of the legacy academic-report PDF (navy/gold,
// branded header/footer, subject matrix, action plan, signature page)
// without importing anything from that legacy pipeline — every fact below
// traces to a canonical Blueprint section.

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ParentAction } from '@/lib/parentExperience/actions'
import type { LearnerBlueprint, BlueprintSection, AttendanceData, RiskData, SubjectRecord } from '@/lib/learnerBlueprint/types'
import type { BlueprintValidationResult } from '@/lib/learnerBlueprint/validation'
import EvidenceTrailPlaceholder from './EvidenceTrailPlaceholder'
import HistoricalBanner, { type HistoricalMeta } from './HistoricalBanner'

const TOTAL_PAGES = 7
const ATTENDANCE_RESPONSE_THRESHOLD_PERCENT = 90

type ActionPlanItem = {
  title: string
  detail: string
  why: string
}

// CBC's own 1-4 rubric (mirrors lib/curriculum/regional/ke-cbc.ts's
// GRADING_SCALE) — a display-label lookup for an already-real level, not a
// new calculation or a second scale.
const CBC_LEVEL_LABEL: Record<1 | 2 | 3 | 4, string> = {
  4: 'Exceeding Expectations',
  3: 'Meeting Expectations',
  2: 'Approaching Expectations',
  1: 'Below Expectations',
}

const CBC_LEVEL_ACCENT: Record<1 | 2 | 3 | 4, string> = {
  4: 'bg-emerald-600 text-white',
  3: 'bg-sky-700 text-white',
  2: 'bg-amber-500 text-white',
  1: 'bg-rose-600 text-white',
}

// Presentation-layer phrasing of the real `trend` enum Projection already
// computed — never a re-derivation of the trend itself.
const TREND_LABEL: Record<SubjectRecord['trend'], string> = {
  improving: 'Trend improving',
  declining: 'Trend declining',
  stable: 'Trend steady',
  insufficient_data: 'Trend developing',
  mixed: 'Trend mixed',
}

const RISK_LABEL: Record<RiskData['overallRiskLevel'], string> = {
  normal: 'Stable',
  watch: 'Watching Closely',
  at_risk: 'Needs Active Support',
  critical: 'Needs Urgent Support',
}

const RISK_ACCENT: Record<RiskData['overallRiskLevel'], string> = {
  normal: 'bg-emerald-600 text-white',
  watch: 'bg-amber-500 text-white',
  at_risk: 'bg-orange-600 text-white',
  critical: 'bg-rose-600 text-white',
}

// ── Shared report chrome ─────────────────────────────────────────────────────

function ReportHeader({
  pageNumber,
  learnerName,
  schoolName,
  schoolLogoUrl,
}: {
  pageNumber: number
  learnerName: string | null
  schoolName?: string | null
  schoolLogoUrl?: string | null
}) {
  return (
    <div
      data-blueprint-report-header="true"
      className="flex items-center justify-between border-b-4 border-amber-500 bg-[#0b1530] px-6 py-3 text-white print:px-8"
    >
      <div className="flex items-center gap-3">
        {schoolLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- printed into a PDF via headless Chromium, not served through next/image's optimizer
          <img src={schoolLogoUrl} alt={`${schoolName ?? 'School'} crest`} className="h-8 w-8 rounded-md object-cover" />
        )}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">
            {schoolName ? `${schoolName} · Learner Blueprint` : 'EduNexus · Learner Blueprint'}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-white/70">{learnerName ?? 'Learner Blueprint'} — Educational Intelligence Report</p>
        </div>
      </div>
      <p className="text-xs font-bold text-white/60">Page {pageNumber} of {TOTAL_PAGES}</p>
    </div>
  )
}

function ReportFooter({ reportId, generatedAtLabel }: { reportId: string; generatedAtLabel: string }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-6 py-2 text-[10px] text-slate-400 print:px-8">
      <p>EduNexus Learner Blueprint · Generated {generatedAtLabel}</p>
      <p>{reportId} · CONFIDENTIAL</p>
    </div>
  )
}

function PageShell({
  pageNumber,
  title,
  question,
  children,
  transition,
  exportMode,
  learnerName,
  reportId,
  generatedAtLabel,
  schoolName,
  schoolLogoUrl,
}: {
  pageNumber: number
  title: string
  question: string
  children: ReactNode
  transition: string
  exportMode: 'screen' | 'pdf'
  learnerName: string | null
  reportId: string
  generatedAtLabel: string
  schoolName?: string | null
  schoolLogoUrl?: string | null
}) {
  return (
    <section
      data-blueprint-page-shell="true"
      data-blueprint-print-break="before"
      className="overflow-hidden rounded-3xl border border-gray-100 bg-white print:rounded-none print:border-0"
      style={exportMode === 'pdf' ? { breakInside: 'avoid-page', pageBreakInside: 'avoid' } : undefined}
    >
      <ReportHeader pageNumber={pageNumber} learnerName={learnerName} schoolName={schoolName} schoolLogoUrl={schoolLogoUrl} />

      <div className="space-y-5 px-5 py-6 sm:px-6 print:px-8">
        <div className="space-y-1 border-b border-slate-100 pb-4">
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-600">{title}</h2>
          <p className="text-sm font-semibold text-slate-600">{question}</p>
        </div>

        <div className="space-y-5">{children}</div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm italic text-slate-500">{transition}</p>
        </div>
      </div>

      <ReportFooter reportId={reportId} generatedAtLabel={generatedAtLabel} />
    </section>
  )
}

function StatusNote<T>({ label, section }: { label: string; section: BlueprintSection<T> }) {
  if (section.status === 'available') return null

  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="mt-1 text-sm text-gray-500">
        {section.status === 'not_implemented'
          ? 'Not yet available in the current Blueprint.'
          : section.unavailableReason ?? 'Unavailable — no relevant evidence exists yet.'}
      </p>
    </div>
  )
}

function EvidenceBox({
  title,
  children,
  tone = 'default',
}: {
  title: string
  children: ReactNode
  tone?: 'default' | 'gold' | 'amber' | 'navy'
}) {
  const toneClass =
    tone === 'gold'
      ? 'border-amber-100 bg-amber-50/60'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50/60'
        : tone === 'navy'
          ? 'border-[#0b1530]/10 bg-[#0b1530]/[0.03]'
          : 'border-slate-100 bg-slate-50'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 space-y-2 text-sm text-slate-700">{children}</div>
    </div>
  )
}

function MetricCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-[#0b1530]">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-slate-500">{sublabel}</p>}
    </div>
  )
}

function CompactList({ items, empty }: { items: ActionPlanItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">{item.title}</p>
          <p className="mt-1 text-sm text-slate-700">{item.detail}</p>
          <p className="mt-1 text-xs text-slate-500">{item.why}</p>
        </div>
      ))}
    </div>
  )
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="pt-6">
      <div className="h-px w-full bg-slate-300" />
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}

function WritableArea({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-px w-full bg-slate-200" />
        ))}
      </div>
    </div>
  )
}

// ── Presentation helpers (selection only, no new computation) ───────────────

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function extractGradeLevel(className: string | null): number | null {
  if (!className) return null
  const match = className.match(/(?:grade|form)\s*(\d{1,2})/i)
  return match ? Number(match[1]) : null
}

function getGradeBand(className: string | null): 'grade_7_8' | 'grade_9' | 'grade_10_12' | 'unknown' {
  const grade = extractGradeLevel(className)
  if (grade === null) return 'unknown'
  if (grade >= 7 && grade <= 8) return 'grade_7_8'
  if (grade === 9) return 'grade_9'
  if (grade >= 10 && grade <= 12) return 'grade_10_12'
  return 'unknown'
}

function attendanceNeedsResponse(section: BlueprintSection<AttendanceData>): boolean {
  return section.status === 'available'
    && section.data?.attendancePercentage !== null
    && section.data.attendancePercentage < ATTENDANCE_RESPONSE_THRESHOLD_PERCENT
}

function dedupeAction(bucket: ActionPlanItem[], seen: Set<string>, item: ActionPlanItem | null) {
  if (!item) return
  const key = normalizeText(item.detail || item.title)
  if (!key || seen.has(key)) return
  seen.add(key)
  bucket.push(item)
}

function actionFromParentAction(action: ParentAction): ActionPlanItem {
  return {
    title: action.title,
    detail: action.description,
    why: `Supported by ${action.sourceDomain}.`,
  }
}

function formatEvidenceRecency(subject: SubjectRecord): string {
  if (subject.evidenceCount === 0 || !subject.latestEvidenceAt) return 'No confirmed evidence yet.'
  const count = `Based on ${subject.evidenceCount} confirmed evidence item${subject.evidenceCount === 1 ? '' : 's'}`
  const recency = new Date(subject.latestEvidenceAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })
  return `${count} · most recent ${recency}`
}

function futureEvidenceItems(blueprint: LearnerBlueprint): ActionPlanItem[] {
  const items: ActionPlanItem[] = []

  if (blueprint.portfolio.status === 'available' && blueprint.portfolio.data) {
    const { publishedCount, featuredItem, latestItem } = blueprint.portfolio.data
    if (publishedCount > 0) {
      items.push({
        title: 'Portfolio evidence',
        detail: featuredItem
          ? `${publishedCount} published portfolio item${publishedCount === 1 ? '' : 's'}, with ${featuredItem.title} currently standing out.`
          : `${publishedCount} published portfolio item${publishedCount === 1 ? '' : 's'} are already visible.`,
        why: 'This shows work the learner has already made public.',
      })
    } else if (latestItem) {
      items.push({
        title: 'Portfolio evidence',
        detail: `${latestItem.title} is the latest portfolio signal currently visible.`,
        why: 'This offers a small but real clue about the learner’s emerging interests.',
      })
    }
  }

  if (blueprint.achievement.status === 'available' && blueprint.achievement.data) {
    const { achievementCount, highestLevelAchievement, latestVerifiedAchievement } = blueprint.achievement.data
    if (achievementCount > 0) {
      items.push({
        title: 'Verified achievement',
        detail: highestLevelAchievement
          ? `${achievementCount} verified achievement${achievementCount === 1 ? '' : 's'} are visible, including ${highestLevelAchievement.title}.`
          : `${achievementCount} verified achievement${achievementCount === 1 ? '' : 's'} are visible.`,
        why: latestVerifiedAchievement
          ? `${latestVerifiedAchievement.title} gives recent evidence of follow-through.`
          : 'This shows the learner has already demonstrated something worth recognising.',
      })
    }
  }

  if (blueprint.projects.status === 'available' && blueprint.projects.data) {
    const { projectCount, currentActiveProject, featuredProject } = blueprint.projects.data
    if (projectCount > 0 || currentActiveProject || featuredProject) {
      items.push({
        title: 'Project evidence',
        detail: currentActiveProject
          ? `${currentActiveProject.title} is currently active.`
          : featuredProject
            ? `${featuredProject.title} stands out among the learner’s project evidence.`
            : `${projectCount} project signal${projectCount === 1 ? '' : 's'} are currently visible.`,
        why: 'Projects show sustained application, not just short performance snapshots.',
      })
    }
  }

  if (blueprint.competitions.status === 'available' && blueprint.competitions.data) {
    const { totalCompetitions, verifiedCompetitions, currentParticipation, latestCompetition } = blueprint.competitions.data
    if (totalCompetitions > 0 || currentParticipation || latestCompetition) {
      items.push({
        title: 'Competition evidence',
        detail: currentParticipation
          ? `${currentParticipation.name} shows the learner is currently participating beyond everyday classwork.`
          : latestCompetition
            ? `${latestCompetition.name} is the latest competition signal currently visible.`
            : `${verifiedCompetitions} verified competition record${verifiedCompetitions === 1 ? '' : 's'} are visible.`,
        why: 'Competition signals can show confidence, stretch, and willingness to test strengths in public.',
      })
    }
  }

  if (blueprint.leadership.status === 'available' && blueprint.leadership.data) {
    const { currentRole, completedRoleCount, latestCompletedRole } = blueprint.leadership.data
    if (currentRole || completedRoleCount > 0 || latestCompletedRole) {
      items.push({
        title: 'Leadership evidence',
        detail: currentRole
          ? `${currentRole.title} is the learner’s current leadership role.`
          : latestCompletedRole
            ? `${latestCompletedRole.title} is the latest completed leadership signal visible here.`
            : `${completedRoleCount} completed leadership role${completedRoleCount === 1 ? '' : 's'} are recorded.`,
        why: 'Leadership evidence matters when future readiness depends on responsibility and service.',
      })
    }
  }

  if (blueprint.innovations.status === 'available' && blueprint.innovations.data) {
    const { currentStage, iterationCount, latestMilestone } = blueprint.innovations.data
    if (currentStage || iterationCount > 0 || latestMilestone) {
      items.push({
        title: 'Innovation evidence',
        detail: currentStage
          ? `${currentStage.problemAddressed} is currently at ${currentStage.status}.`
          : latestMilestone
            ? `${latestMilestone} is the latest innovation milestone visible in this Blueprint.`
            : `${iterationCount} innovation iteration${iterationCount === 1 ? '' : 's'} are recorded.`,
        why: 'Innovation signals matter when the learner is learning through iteration and problem-solving.',
      })
    }
  }

  return items
}

// A stable, non-random report identifier built from real identifiers
// already on the Blueprint (learnerId + generation timestamp) — a display
// convenience for the printed page, not an educational claim.
function buildReportId(learnerId: string, generatedAt: string): string {
  const datePart = generatedAt.slice(0, 10).replace(/-/g, '')
  return `BP-${learnerId.slice(0, 8).toUpperCase()}-${datePart}`
}

// ── Page 1 — Cover ────────────────────────────────────────────────────────

function CoverPage({
  blueprint,
  reportId,
  generatedAtLabel,
  exportMode,
}: {
  blueprint: LearnerBlueprint
  reportId: string
  generatedAtLabel: string
  exportMode: 'screen' | 'pdf'
}) {
  const identity = blueprint.identity.data
  const subjectCount = blueprint.academicRecord.status === 'available' ? blueprint.academicRecord.data?.bySubject.length ?? 0 : 0
  const capabilitySnapshot = blueprint.learningStory.status === 'available' ? blueprint.learningStory.data?.evidence ?? null : null
  const direction = blueprint.career.status === 'available' ? blueprint.career.data?.careerCluster ?? null : null

  return (
    <section
      data-blueprint-page-shell="true"
      data-blueprint-print-break="none"
      className="overflow-hidden rounded-3xl border border-[#0b1530]/10 bg-[#0b1530] text-white print:rounded-none print:border-0"
      style={exportMode === 'pdf' ? { breakInside: 'avoid-page', pageBreakInside: 'avoid' } : undefined}
    >
      <div className="border-b-4 border-amber-500 px-8 pb-8 pt-10 sm:px-12">
        <div className="flex items-center gap-3">
          {identity?.schoolLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- printed into a PDF via headless Chromium, not served through next/image's optimizer
            <img src={identity.schoolLogoUrl} alt={`${identity.schoolName} crest`} className="h-10 w-10 rounded-lg object-cover" />
          )}
          <p className="text-xs font-black uppercase tracking-[0.32em] text-amber-400">
            {identity?.schoolName ?? 'EduNexus'}
          </p>
        </div>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Learner Blueprint</h1>
        <p className="mt-1 text-sm font-semibold text-white/60">Educational Intelligence Report</p>
      </div>

      <div className="space-y-6 px-8 py-8 sm:px-12">
        <div>
          <h2 className="text-2xl font-black sm:text-3xl">{identity?.learnerName ?? 'Learner'}</h2>
          <p className="mt-2 text-sm text-white/70">
            {[identity?.currentClassName, identity?.schoolName, identity?.termLabel].filter(Boolean).join(' · ') || 'Learner context is not yet available.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-400">Current Snapshot</p>
            <p className="mt-1 text-sm leading-6 text-white/85">
              {capabilitySnapshot ?? 'Not enough evidence yet to describe a current capability snapshot.'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-400">Learning Direction</p>
            <p className="mt-1 text-sm leading-6 text-white/85">
              {direction ?? 'A future direction has not yet emerged clearly from the current evidence.'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-400">Subjects Represented</p>
            <p className="mt-1 text-2xl font-black text-white">{subjectCount}</p>
            <p className="text-xs text-white/60">with confirmed evidence</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/20 px-8 py-4 text-[11px] text-white/60 sm:px-12">
        <p>Report ID: {reportId} · Generated {generatedAtLabel}</p>
        <p className="font-bold uppercase tracking-wide text-amber-400">Confidential — For Named Recipients Only</p>
      </div>
    </section>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function BlueprintView({
  blueprint,
  validation,
  learnerId,
  historicalMeta,
  exportMode = 'screen',
}: {
  blueprint: LearnerBlueprint
  validation: BlueprintValidationResult
  learnerId: string
  historicalMeta?: HistoricalMeta
  exportMode?: 'screen' | 'pdf'
}) {
  const generatedAt = blueprint.metadata.generatedAt
  const generatedAtLabel = new Date(generatedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
  const reportId = buildReportId(learnerId, generatedAt)
  const learnerName = blueprint.identity.data?.learnerName ?? null
  const gradeBand = getGradeBand(blueprint.identity.data?.currentClassName ?? null)
  const attendanceAsConcern = attendanceNeedsResponse(blueprint.attendance)
  const futureEvidence = futureEvidenceItems(blueprint)

  const seenActions = new Set<string>()
  const teacherItems: ActionPlanItem[] = []
  const learnerItems: ActionPlanItem[] = []
  const parentItems: ActionPlanItem[] = []
  const compassItems: ActionPlanItem[] = []

  if (blueprint.teacherReflection.status === 'available' && blueprint.teacherReflection.data) {
    dedupeAction(teacherItems, seenActions, {
      title: 'Teacher support focus',
      detail: blueprint.teacherReflection.data.recommendedSupport,
      why: 'This is the clearest current teacher-authored support recommendation in the Blueprint.',
    })
  }

  if (blueprint.teacherReflection.status === 'available' && blueprint.teacherReflection.data?.holidayFocus) {
    dedupeAction(learnerItems, seenActions, {
      title: 'Holiday focus',
      detail: blueprint.teacherReflection.data.holidayFocus,
      why: 'The current teacher reflection names this as a useful near-term focus.',
    })
  }

  if (blueprint.learningCompass.status === 'available' && blueprint.learningCompass.data?.nextRecommendedAction) {
    dedupeAction(compassItems, seenActions, {
      title: 'Learning Compass next step',
      detail: blueprint.learningCompass.data.nextRecommendedAction,
      why: 'Learning Compass already identifies this as the learner’s next actionable move.',
    })
  }

  if (blueprint.learningCompass.status === 'available' && blueprint.learningCompass.data?.holidayProgrammeAvailable) {
    dedupeAction(compassItems, seenActions, {
      title: 'Holiday programme available',
      detail: 'A holiday learning programme is already available to keep momentum going.',
      why: 'Learning Compass currently reports an active holiday programme.',
    })
  }

  if (blueprint.parentSummary.status === 'available' && blueprint.parentSummary.data?.action) {
    dedupeAction(parentItems, seenActions, {
      title: 'Family support priority',
      detail: blueprint.parentSummary.data.action,
      why: 'This comes from the existing parent-facing summary inside the Blueprint.',
    })
  }

  if (blueprint.recommendedNextSteps.status === 'available' && blueprint.recommendedNextSteps.data) {
    for (const action of blueprint.recommendedNextSteps.data.actions) {
      dedupeAction(parentItems, seenActions, actionFromParentAction(action))
    }
  }

  if (attendanceAsConcern && blueprint.attendance.status === 'available' && blueprint.attendance.data?.attendancePercentage !== null) {
    dedupeAction(teacherItems, seenActions, {
      title: 'Protect learning time',
      detail: `Attendance is currently at ${blueprint.attendance.data.attendancePercentage}%, so attendance support should be part of the response plan.`,
      why: 'Reduced learning time can weaken progress across every other area.',
    })
  }

  const futureIntro =
    gradeBand === 'grade_7_8'
      ? 'At this stage, the Blueprint widens exploration and notices emerging strengths rather than narrowing the future too early.'
      : gradeBand === 'grade_9'
        ? 'At this transition point, the Blueprint tests pathway readiness and clarifies what still needs to grow.'
        : gradeBand === 'grade_10_12'
          ? 'At senior level, the Blueprint connects demonstrated evidence to further education, TVET, entrepreneurship, or work-related opportunities when the record supports it.'
          : 'The current Blueprint can point toward possibilities, but its future-facing interpretation stays cautious until stronger evidence accumulates.'

  const shellProps = {
    exportMode,
    learnerName,
    reportId,
    generatedAtLabel,
    schoolName: blueprint.identity.data?.schoolName ?? null,
    schoolLogoUrl: blueprint.identity.data?.schoolLogoUrl ?? null,
  }

  return (
    <div
      data-blueprint-root="true"
      data-blueprint-ready="true"
      data-blueprint-export-mode={exportMode}
      className={`mx-auto max-w-4xl space-y-4 px-4 py-6 ${exportMode === 'pdf' ? 'bg-white text-slate-900' : ''}`}
    >
      {exportMode !== 'pdf' && historicalMeta && <HistoricalBanner meta={historicalMeta} />}

      {exportMode !== 'pdf' && (
        <div className="mb-2 rounded-3xl border border-gray-100 bg-white p-5 sm:p-6" data-blueprint-hide-in-pdf="true">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-gray-900">
              {historicalMeta ? 'Learner Blueprint — Historical Record' : 'Learner Blueprint'}
            </h1>
            {!historicalMeta && (
              <span aria-label="This is the Current, live Blueprint" className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                Current
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {historicalMeta
              ? `Composition as it was on ${generatedAtLabel} — frozen, never recalculated.`
              : `Composition ${blueprint.metadata.freshness === 'live' ? 'fully live' : 'partial — some sections unavailable'} · generated ${generatedAtLabel}`}
          </p>
          {!validation.valid && (
            <div role="alert" className="mt-3 rounded-2xl border border-red-100 bg-red-50 p-3">
              <p className="text-xs font-bold text-red-600">This Blueprint failed validation:</p>
              {validation.errors.map((error, index) => (
                <p key={index} className="text-[11px] text-red-500">{error.field}: {error.message}</p>
              ))}
            </div>
          )}
          <nav aria-label="Blueprint history navigation" data-blueprint-nav="true" className="mt-3">
            {historicalMeta ? (
              <Link href={`/student/blueprint/${learnerId}/history`} className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
                ← Back to History
              </Link>
            ) : (
              <Link href={`/student/blueprint/${learnerId}/history`} className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
                View History →
              </Link>
            )}
          </nav>
        </div>
      )}

      {/* PAGE 1 — Cover */}
      <CoverPage blueprint={blueprint} reportId={reportId} generatedAtLabel={generatedAtLabel} exportMode={exportMode} />

      {/* PAGE 2 — Learner Overview */}
      <PageShell
        pageNumber={2}
        title="Learner Overview"
        question="Who is this learner becoming?"
        transition="If this interpretation is sound, what evidence supports it?"
        {...shellProps}
      >
        {blueprint.learningStory.status === 'available' && blueprint.learningStory.data ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
              <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">Current Educational Judgment</p>
              <p className="mt-2 text-lg leading-7 text-slate-900">{blueprint.learningStory.data.evidence} {blueprint.learningStory.data.interpretation}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <EvidenceBox title="Strongest supported pattern">
                <p>{blueprint.learningStory.data.evidence}</p>
              </EvidenceBox>
              <EvidenceBox title="Current opportunity" tone="gold">
                <p>{blueprint.learningStory.data.opportunity}</p>
              </EvidenceBox>
            </div>

            {blueprint.learningCompass.status === 'available' && blueprint.learningCompass.data?.nextRecommendedAction && (
              <EvidenceBox title="Next actionable step" tone="navy">
                <p>{blueprint.learningCompass.data.nextRecommendedAction}</p>
              </EvidenceBox>
            )}

            <EvidenceBox title="Compact confidence summary">
              <p>{blueprint.learningStory.data.confidenceStatement}</p>
            </EvidenceBox>
          </div>
        ) : (
          <StatusNote label="Learner overview" section={blueprint.learningStory} />
        )}

        {blueprint.identity.status === 'available' && blueprint.identity.data && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Learner context</p>
            <p className="mt-1 text-sm text-slate-700">
              <span className="font-bold text-slate-900">{blueprint.identity.data.learnerName}</span>
              {' · '}{blueprint.identity.data.schoolName}
              {blueprint.identity.data.currentClassName ? ` · ${blueprint.identity.data.currentClassName}` : ''}
              {blueprint.identity.data.academicYearLabel ? ` · ${blueprint.identity.data.academicYearLabel}` : ''}
              {blueprint.identity.data.termLabel ? ` · ${blueprint.identity.data.termLabel}` : ''}
            </p>
          </div>
        )}
        <StatusNote label="Learner context" section={blueprint.identity} />
      </PageShell>

      {/* PAGE 3 — Academic Evidence Matrix */}
      <PageShell
        pageNumber={3}
        title="Academic Evidence Matrix"
        question="What does the confirmed evidence show, subject by subject?"
        transition="What, if unattended, could weaken or distort this picture?"
        {...shellProps}
      >
        {blueprint.academicRecord.status === 'available' && blueprint.academicRecord.data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Subjects with evidence" value={String(blueprint.academicRecord.data.bySubject.length)} />
              <MetricCard label="Overall pattern" value={(blueprint.academicRecord.data.overallTrend ?? 'insufficient data').replace('_', ' ')} />
              <MetricCard
                label="Composition confidence"
                value={blueprint.academicRecord.data.confidence !== null ? `${blueprint.academicRecord.data.confidence}%` : 'Unavailable'}
              />
            </div>

            {blueprint.academicRecord.data.bySubject.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0b1530] text-left text-[9px] font-black uppercase tracking-wide text-white">
                      <th className="px-3 py-1.5">Subject</th>
                      <th className="px-3 py-1.5">Level</th>
                      <th className="px-3 py-1.5">Competency Category</th>
                      <th className="px-3 py-1.5">Evidence &amp; Recency</th>
                      <th className="px-3 py-1.5">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blueprint.academicRecord.data.bySubject.map((subject, index) => (
                      <tr key={subject.subject} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-3 py-1.5 font-bold text-slate-900">{subject.subject}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-black ${CBC_LEVEL_ACCENT[subject.latestLevel]}`}>
                            L{subject.latestLevel}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">{CBC_LEVEL_LABEL[subject.latestLevel]}</td>
                        <td className="px-3 py-1.5 text-slate-600">{formatEvidenceRecency(subject)}</td>
                        <td className="px-3 py-1.5 font-semibold text-slate-800">{TREND_LABEL[subject.trend]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No subject currently has confirmed evidence in this Blueprint.</p>
            )}

            <p className="text-[11px] text-slate-400">
              Each level above is a Current recorded snapshot, not a long-run average. "Trend developing" means one
              confirmed point so far — not yet enough to describe a direction. Subjects without confirmed evidence
              are not listed — absence here means no evidence has arrived yet, never a poor result.
            </p>
          </div>
        ) : (
          <StatusNote label="Academic evidence matrix" section={blueprint.academicRecord} />
        )}
      </PageShell>

      {/* PAGE 4 — Growth, Risk and Conditions */}
      <PageShell
        pageNumber={4}
        title="Growth, Risk and Conditions"
        question="How is this picture moving, and what needs a response now?"
        transition="So what must each person do differently next?"
        {...shellProps}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {blueprint.growthTimeline.status === 'available' && blueprint.growthTimeline.data ? (
            blueprint.growthTimeline.data.map((entry, index) => (
              <EvidenceBox key={index} title="Movement over time (trend, not a new snapshot)">
                <p className="font-semibold capitalize text-slate-900">{entry.direction.replace('_', ' ')}</p>
                <p>{entry.trajectory}</p>
                <p className="text-xs text-slate-500">
                  Window {new Date(entry.windowStart).toLocaleDateString('en-KE', { dateStyle: 'medium' })} – {new Date(entry.windowEnd).toLocaleDateString('en-KE', { dateStyle: 'medium' })} · confidence {entry.confidence}%
                </p>
              </EvidenceBox>
            ))
          ) : (
            <StatusNote label="Movement over time" section={blueprint.growthTimeline} />
          )}

          {blueprint.risk.status === 'available' && blueprint.risk.data ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-slate-900">Current severity</p>
                <span className={`rounded px-2 py-0.5 text-[10px] font-black ${RISK_ACCENT[blueprint.risk.data.overallRiskLevel]}`}>
                  {RISK_LABEL[blueprint.risk.data.overallRiskLevel]}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {blueprint.risk.data.flags.length === 0 ? (
                  <p>No active supported concern is currently being flagged across the available scored evidence.</p>
                ) : (
                  blueprint.risk.data.flags.map((flag, index) => (
                    <div key={index} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="font-semibold text-slate-900">{flag.subject ?? 'General learning condition'}</p>
                      <p className="mt-1">{flag.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <StatusNote label="Current severity" section={blueprint.risk} />
          )}
        </div>

        {attendanceAsConcern && blueprint.attendance.status === 'available' && blueprint.attendance.data?.attendancePercentage !== null && (
          <EvidenceBox title="Attendance condition" tone="amber">
            <p>
              Attendance is currently at <span className="font-semibold text-slate-900">{blueprint.attendance.data.attendancePercentage}%</span>, which may weaken the learner’s opportunity to sustain progress.
            </p>
            <p className="text-xs text-slate-500">
              Present {blueprint.attendance.data.presentCount} · Late {blueprint.attendance.data.lateCount} · Absent {blueprint.attendance.data.absentCount} · Excused {blueprint.attendance.data.excusedCount}
            </p>
          </EvidenceBox>
        )}
        {!attendanceAsConcern && blueprint.attendance.status === 'available' && blueprint.attendance.data?.attendancePercentage !== null && (
          <EvidenceBox title="Attendance as protective strength">
            <p>
              Learning time is currently holding at <span className="font-semibold text-slate-900">{blueprint.attendance.data.attendancePercentage}%</span>.
            </p>
          </EvidenceBox>
        )}

        {blueprint.teacherReflection.status === 'available' && blueprint.teacherReflection.data && (
          <div className="grid gap-4 md:grid-cols-2">
            <EvidenceBox title="Protective strengths (teacher-observed)">
              <p>{blueprint.teacherReflection.data.strengths}</p>
            </EvidenceBox>
            <EvidenceBox title="Teacher context">
              <p><span className="font-semibold text-slate-900">Growth area:</span> {blueprint.teacherReflection.data.growthArea}</p>
              <p><span className="font-semibold text-slate-900">Learning habits:</span> {blueprint.teacherReflection.data.learningHabits}</p>
            </EvidenceBox>
          </div>
        )}

        {blueprint.learningStory.status === 'available' && blueprint.learningStory.data && (
          <EvidenceBox title="Missing corroboration" tone="amber">
            <p>{blueprint.learningStory.data.missingEvidence}</p>
          </EvidenceBox>
        )}
      </PageShell>

      {/* PAGE 5 — Pathway and Future Intelligence */}
      <PageShell
        pageNumber={5}
        title="Pathway and Future Intelligence"
        question="What future does this evidence make possible?"
        transition="This direction is still a possibility, never a destiny."
        {...shellProps}
      >
        <EvidenceBox title="Emerging direction" tone="navy">
          <p>{futureIntro}</p>
          {blueprint.career.status === 'available' && blueprint.career.data ? (
            <div className="space-y-1">
              {blueprint.career.data.careerCluster && (
                <p><span className="font-semibold text-slate-900">Emerging direction:</span> {blueprint.career.data.careerCluster}</p>
              )}
              {blueprint.career.data.strengthProfile && (
                <p><span className="font-semibold text-slate-900">Why it fits:</span> {blueprint.career.data.strengthProfile}</p>
              )}
              {blueprint.career.data.futureDirection && (
                <p><span className="font-semibold text-slate-900">Future bridge:</span> {blueprint.career.data.futureDirection}</p>
              )}
              {blueprint.career.data.confidence && (
                <p className="text-sm text-slate-500">Career confidence: {blueprint.career.data.confidence}</p>
              )}
              {!blueprint.career.data.careerCluster && !blueprint.career.data.strengthProfile && !blueprint.career.data.futureDirection && (
                <p className="text-sm text-slate-500">The current career signal is still too thin for a more specific future interpretation.</p>
              )}
              <p className="text-xs text-slate-500">
                Only one supported direction is available from current evidence — broader exploration should continue before narrowing further.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {blueprint.career.status === 'not_implemented'
                ? 'Career interpretation is not yet available in the current Blueprint.'
                : blueprint.career.unavailableReason ?? 'Career interpretation is currently unavailable.'}
            </p>
          )}
        </EvidenceBox>

        {blueprint.learningStory.status === 'available' && blueprint.learningStory.data && (
          <EvidenceBox title="Subjects to strengthen" tone="gold">
            <p>{blueprint.learningStory.data.opportunity}</p>
          </EvidenceBox>
        )}

        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-sm font-black text-slate-900">Supporting evidence of future direction</p>
          <p className="mt-1 text-xs text-slate-500">These signals support the future picture when present. They do not replace it.</p>
          <div className="mt-4 space-y-3">
            {futureEvidence.length > 0 ? (
              futureEvidence.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{item.detail}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.why}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Future evidence is still limited, so this page should guide exploration more than it suggests any firm direction.</p>
            )}
          </div>
        </div>
      </PageShell>

      {/* PAGE 6 — Coordinated Action Plan */}
      <PageShell
        pageNumber={6}
        title="Coordinated Action Plan"
        question="What should each person do next?"
        transition="If we respond well, what future becomes more possible?"
        {...shellProps}
      >
        {blueprint.parentSummary.status === 'available' && blueprint.parentSummary.data && (blueprint.parentSummary.data.headline || blueprint.parentSummary.data.detail) && (
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Shared plan context</p>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              {blueprint.parentSummary.data.headline && <p>{blueprint.parentSummary.data.headline}</p>}
              {blueprint.parentSummary.data.detail && <p>{blueprint.parentSummary.data.detail}</p>}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-sm font-black text-slate-900">Teacher Action</p>
            <p className="mt-1 text-xs text-slate-500">Changes to the learner’s day-to-day classroom support.</p>
            <div className="mt-3"><CompactList items={teacherItems} empty="No teacher-specific action is currently supported clearly enough by evidence." /></div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-sm font-black text-slate-900">Learner Action</p>
            <p className="mt-1 text-xs text-slate-500">What the learner can own directly.</p>
            <div className="mt-3"><CompactList items={learnerItems} empty="No learner-specific action is currently supported clearly enough by evidence." /></div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-sm font-black text-slate-900">Parent / Guardian Action</p>
            <p className="mt-1 text-xs text-slate-500">Family support that doesn’t duplicate school work.</p>
            <div className="mt-3"><CompactList items={parentItems} empty="No family-specific action is currently supported clearly enough by evidence." /></div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
            <p className="text-sm font-black text-slate-900">Learning Compass Action</p>
            <p className="mt-1 text-xs text-slate-500">The system’s own live next-step recommendation.</p>
            <div className="mt-3"><CompactList items={compassItems} empty="Learning Compass has no distinct next step recorded yet." /></div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">Review checkpoint</p>
          <p className="mt-1 text-sm text-slate-500">Review this plan when new evidence becomes available — no fixed date is invented here.</p>
        </div>
      </PageShell>

      {/* PAGE 7 — School and Family Review */}
      <PageShell
        pageNumber={7}
        title="School and Family Review"
        question="What do we agree, together, right now?"
        transition="This Blueprint stays live — the next confirmed evidence will update it, not replace it."
        {...shellProps}
      >
        <EvidenceBox title="Learner summary">
          <p>
            {blueprint.parentSummary.status === 'available' && blueprint.parentSummary.data?.headline
              ? blueprint.parentSummary.data.headline
              : blueprint.learningStory.status === 'available' && blueprint.learningStory.data
                ? blueprint.learningStory.data.evidence
                : 'A learner summary is not yet available from current evidence.'}
          </p>
        </EvidenceBox>

        {blueprint.teacherReflection.status === 'available' && blueprint.teacherReflection.data ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <EvidenceBox title="Classroom support areas">
              <p>{blueprint.teacherReflection.data.recommendedSupport}</p>
            </EvidenceBox>
            <EvidenceBox title="Strengths to nurture">
              <p>{blueprint.teacherReflection.data.strengths}</p>
            </EvidenceBox>
            <div className="sm:col-span-2 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Teacher observations on file</p>
              <p className="mt-2">{blueprint.teacherReflection.data.learningHabits}</p>
              <p className="mt-2 text-xs text-slate-400">
                {blueprint.teacherReflection.data.teacherSignature
                  ? `Recorded by ${blueprint.teacherReflection.data.teacherSignature} on ${new Date(blueprint.teacherReflection.data.writtenAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}`
                  : `Recorded ${new Date(blueprint.teacherReflection.data.writtenAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}`}
              </p>
            </div>
          </div>
        ) : (
          <StatusNote label="Teacher observations" section={blueprint.teacherReflection} />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <WritableArea label="Parent observations" />
          <WritableArea label="Action agreed at this meeting" />
        </div>

        <div className="grid gap-6 pt-2 sm:grid-cols-2">
          <SignatureLine label="Teacher signature / date" />
          <SignatureLine label="Parent / guardian signature / date" />
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4">
          <p className="text-sm font-black text-slate-900">Evidence traceability</p>
          <p className="mt-1 text-xs text-slate-500">Every statement in this report traces to a named, canonical source, recorded internally on the live Blueprint.</p>
          <div className="mt-3">
            <EvidenceTrailPlaceholder />
          </div>
        </div>
      </PageShell>
    </div>
  )
}
