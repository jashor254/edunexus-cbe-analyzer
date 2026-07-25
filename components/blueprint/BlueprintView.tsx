// components/blueprint/BlueprintView.tsx
//
// Learner Blueprint renderer — recomposed as a five-page educational
// argument over the one canonical composeBlueprint() output. Presentation
// only: no new intelligence, no new queries, no duplicated reasoning.

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ParentAction } from '@/lib/parentExperience/actions'
import type { LearnerBlueprint, BlueprintSection, AttendanceData, RiskData } from '@/lib/learnerBlueprint/types'
import type { BlueprintValidationResult } from '@/lib/learnerBlueprint/validation'
import EvidenceTrailPlaceholder from './EvidenceTrailPlaceholder'
import HistoricalBanner, { type HistoricalMeta } from './HistoricalBanner'

type ActionPlanItem = {
  title: string
  detail: string
  why: string
}

const ATTENDANCE_RESPONSE_THRESHOLD_PERCENT = 90

const RISK_LABEL: Record<RiskData['overallRiskLevel'], string> = {
  normal: 'stable',
  watch: 'watching closely',
  at_risk: 'needs active support',
  critical: 'needs urgent support',
}

const RISK_STYLE: Record<RiskData['overallRiskLevel'], string> = {
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  watch: 'bg-amber-50 text-amber-700 border-amber-100',
  at_risk: 'bg-orange-50 text-orange-700 border-orange-100',
  critical: 'bg-red-50 text-red-700 border-red-100',
}

function PageShell({
  pageNumber,
  title,
  question,
  children,
  transition,
  exportMode,
}: {
  pageNumber: number
  title: string
  question: string
  children: ReactNode
  transition: string
  exportMode: 'screen' | 'pdf'
}) {
  return (
    <section
      data-blueprint-page-shell="true"
      data-blueprint-print-break={pageNumber > 1 ? 'before' : 'none'}
      className="rounded-3xl border border-gray-100 bg-white p-5 sm:p-6"
      style={exportMode === 'pdf'
        ? { breakInside: 'avoid-page', pageBreakInside: 'avoid' }
        : undefined}
    >
      <div className="mb-5 space-y-2">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">Page {pageNumber}</p>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-gray-900">{title}</h2>
          <p className="text-sm font-semibold text-gray-600">{question}</p>
        </div>
      </div>

      <div className="space-y-5">{children}</div>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <p className="text-sm italic text-gray-500">{transition}</p>
      </div>
    </section>
  )
}

function StatusNote<T>({
  label,
  section,
}: {
  label: string
  section: BlueprintSection<T>
}) {
  if (section.status === 'available') return null

  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="mt-1 text-sm text-gray-500">
        {section.status === 'not_implemented'
          ? 'Not yet available in the current Blueprint.'
          : section.unavailableReason ?? 'This part of the Blueprint is currently unavailable.'}
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
  tone?: 'default' | 'teal' | 'amber'
}) {
  const toneClass =
    tone === 'teal'
      ? 'border-teal-100 bg-teal-50/60'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50/60'
        : 'border-gray-100 bg-gray-50'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">{title}</p>
      <div className="mt-2 space-y-2 text-sm text-gray-700">{children}</div>
    </div>
  )
}

function CompactList({
  items,
  empty,
}: {
  items: ActionPlanItem[]
  empty: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{empty}</p>
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-bold text-gray-900">{item.title}</p>
          <p className="mt-1 text-sm text-gray-700">{item.detail}</p>
          <p className="mt-1 text-xs text-gray-500">{item.why}</p>
        </div>
      ))}
    </div>
  )
}

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

function dedupeAction(
  bucket: ActionPlanItem[],
  seen: Set<string>,
  item: ActionPlanItem | null,
) {
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
  const gradeBand = getGradeBand(blueprint.identity.data?.currentClassName ?? null)
  const attendanceAsConcern = attendanceNeedsResponse(blueprint.attendance)
  const futureEvidence = futureEvidenceItems(blueprint)

  const seenActions = new Set<string>()
  const schoolTeacherItems: ActionPlanItem[] = []
  const learnerItems: ActionPlanItem[] = []
  const parentItems: ActionPlanItem[] = []
  const leadershipItems: ActionPlanItem[] = []

  if (blueprint.teacherReflection.status === 'available' && blueprint.teacherReflection.data) {
    dedupeAction(schoolTeacherItems, seenActions, {
      title: 'Teacher support focus',
      detail: blueprint.teacherReflection.data.recommendedSupport,
      why: 'This is the clearest current teacher-authored support recommendation in the Blueprint.',
    })
  }

  if (blueprint.learningCompass.status === 'available' && blueprint.learningCompass.data?.nextRecommendedAction) {
    dedupeAction(learnerItems, seenActions, {
      title: 'Learner next step',
      detail: blueprint.learningCompass.data.nextRecommendedAction,
      why: 'Learning Compass already identifies this as the learner’s next actionable move.',
    })
  }

  if (blueprint.teacherReflection.status === 'available' && blueprint.teacherReflection.data?.holidayFocus) {
    dedupeAction(learnerItems, seenActions, {
      title: 'Holiday focus',
      detail: blueprint.teacherReflection.data.holidayFocus,
      why: 'The current teacher reflection names this as a useful near-term focus.',
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
    dedupeAction(schoolTeacherItems, seenActions, {
      title: 'Protect learning time',
      detail: `Attendance is currently at ${blueprint.attendance.data.attendancePercentage}%, so attendance support should be part of the response plan.`,
      why: 'This matters because reduced learning time can weaken progress across every other area.',
    })
  }

  const futureIntro =
    gradeBand === 'grade_7_8'
      ? 'At this stage, the Blueprint should widen exploration, notice emerging strengths, and resist narrowing the future too early.'
      : gradeBand === 'grade_9'
        ? 'At this transition point, the Blueprint can test pathway readiness, show what evidence is strengthening, and clarify what still needs to grow.'
        : gradeBand === 'grade_10_12'
          ? 'At senior level, the Blueprint can connect demonstrated evidence to preparation for further education, TVET, entrepreneurship, or work-related opportunities when the record supports it.'
          : 'The current Blueprint can point toward possibilities, but its future-facing interpretation should stay cautious until stronger evidence accumulates.'

  return (
    <div
      data-blueprint-root="true"
      data-blueprint-ready="true"
      data-blueprint-export-mode={exportMode}
      className={`mx-auto max-w-4xl space-y-4 px-4 py-6 ${exportMode === 'pdf' ? 'bg-white text-slate-900' : ''}`}
    >
      {historicalMeta && <HistoricalBanner meta={historicalMeta} />}

      <div className="mb-2 rounded-3xl border border-gray-100 bg-white p-5 sm:p-6">
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
            ? `Composition as it was on ${new Date(generatedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })} — frozen, never recalculated.`
            : `Composition ${blueprint.metadata.freshness === 'live' ? 'fully live' : 'partial — some sections unavailable'} · generated ${new Date(generatedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}`}
        </p>
        {!validation.valid && (
          <div role="alert" className="mt-3 rounded-2xl border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-bold text-red-600">This Blueprint failed validation:</p>
            {validation.errors.map((error, index) => (
              <p key={index} className="text-[11px] text-red-500">{error.field}: {error.message}</p>
            ))}
          </div>
        )}
        {exportMode !== 'pdf' && (
          <nav
            aria-label="Blueprint history navigation"
            data-blueprint-nav="true"
            className="mt-3"
          >
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
        )}
      </div>

      <PageShell
        pageNumber={1}
        title="Learner Direction"
        question="Who is this learner becoming?"
        transition="If this interpretation is sound, what evidence supports it?"
        exportMode={exportMode}
      >
        {blueprint.learningStory.status === 'available' && blueprint.learningStory.data ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5">
              <p className="text-[11px] font-black uppercase tracking-wide text-teal-700">Current educational judgment</p>
              <p className="mt-2 text-lg leading-7 text-gray-900">{blueprint.learningStory.data.narrative}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <EvidenceBox title="Interpretation">
                <p>{blueprint.learningStory.data.interpretation}</p>
              </EvidenceBox>
              <EvidenceBox title="What this opens next" tone="teal">
                <p>{blueprint.learningStory.data.opportunity}</p>
              </EvidenceBox>
            </div>

            {blueprint.educationalIdentity.status === 'available' && blueprint.educationalIdentity.data && (
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Supporting interpretation</p>
                <p className="mt-1 text-sm text-gray-700">
                  <span className="font-semibold text-gray-900">{blueprint.educationalIdentity.data.label}</span>
                  {' · '}
                  {blueprint.educationalIdentity.data.evidencePhrase}
                </p>
              </div>
            )}
            {blueprint.educationalIdentity.status !== 'available' && blueprint.educationalIdentity.status !== 'not_implemented' && (
              <StatusNote label="Supporting interpretation" section={blueprint.educationalIdentity} />
            )}
          </div>
        ) : (
          <StatusNote label="Learner direction" section={blueprint.learningStory} />
        )}

        {blueprint.identity.status === 'available' && blueprint.identity.data && (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Learner context</p>
            <p className="mt-1 text-sm text-gray-700">
              <span className="font-bold text-gray-900">{blueprint.identity.data.learnerName}</span>
              {' · '}
              {blueprint.identity.data.schoolName}
              {blueprint.identity.data.currentClassName ? ` · ${blueprint.identity.data.currentClassName}` : ''}
              {blueprint.identity.data.academicYearLabel ? ` · ${blueprint.identity.data.academicYearLabel}` : ''}
              {blueprint.identity.data.termLabel ? ` · ${blueprint.identity.data.termLabel}` : ''}
            </p>
          </div>
        )}
        <StatusNote label="Learner context" section={blueprint.identity} />
      </PageShell>

      <PageShell
        pageNumber={2}
        title="Evidence for the Judgment"
        question="Why do we believe this?"
        transition="What, if unattended, could weaken or distort this growth?"
        exportMode={exportMode}
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            {blueprint.academicRecord.status === 'available' && blueprint.academicRecord.data ? (
              <EvidenceBox title="Academic evidence">
                <p>
                  Overall academic pattern:{' '}
                  <span className="font-semibold text-gray-900">
                    {blueprint.academicRecord.data.overallTrend ?? 'insufficient data'}
                  </span>
                  {blueprint.academicRecord.data.confidence !== null && (
                    <span className="text-gray-500"> · confidence {blueprint.academicRecord.data.confidence}%</span>
                  )}
                </p>
                {blueprint.academicRecord.data.bySubject.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {blueprint.academicRecord.data.bySubject.map(subject => (
                      <div key={subject.subject} className="rounded-xl border border-white/80 bg-white px-3 py-2">
                        <p className="text-sm font-bold text-gray-900">{subject.subject}</p>
                        <p className="text-xs text-gray-600">Level {subject.latestLevel} · {subject.trend.replace('_', ' ')}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No subject-level breakdown is currently available inside this Blueprint.</p>
                )}
              </EvidenceBox>
            ) : (
              <StatusNote label="Academic evidence" section={blueprint.academicRecord} />
            )}

            {blueprint.growthTimeline.status === 'available' && blueprint.growthTimeline.data ? (
              <EvidenceBox title="Evidence of movement">
                {blueprint.growthTimeline.data.map((entry, index) => (
                  <div key={index} className="rounded-xl border border-white/80 bg-white px-3 py-3">
                    <p className="font-semibold text-gray-900 capitalize">{entry.direction.replace('_', ' ')}</p>
                    <p className="mt-1 text-sm text-gray-700">{entry.trajectory}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Evidence window: {new Date(entry.windowStart).toLocaleDateString('en-KE', { dateStyle: 'medium' })} to {new Date(entry.windowEnd).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                    </p>
                    <p className="text-xs text-gray-500">
                      Confidence {entry.confidence}% · {entry.supportingEvidenceIds.length} supporting evidence reference{entry.supportingEvidenceIds.length === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
              </EvidenceBox>
            ) : (
              <StatusNote label="Evidence of movement" section={blueprint.growthTimeline} />
            )}

            {!attendanceAsConcern && blueprint.attendance.status === 'available' && blueprint.attendance.data?.attendancePercentage !== null && (
              <EvidenceBox title="Attendance as supporting evidence">
                <p>
                  Learning time is currently holding at{' '}
                  <span className="font-semibold text-gray-900">{blueprint.attendance.data.attendancePercentage}%</span>.
                </p>
                <p className="text-sm text-gray-500">
                  Present {blueprint.attendance.data.presentCount} · Late {blueprint.attendance.data.lateCount} · Absent {blueprint.attendance.data.absentCount}
                </p>
              </EvidenceBox>
            )}
          </div>

          <div className="space-y-4">
            {blueprint.learningStory.status === 'available' && blueprint.learningStory.data ? (
              <>
                <EvidenceBox title="Confidence and uncertainty">
                  <p>{blueprint.learningStory.data.confidenceStatement}</p>
                  <p>{blueprint.learningStory.data.uncertainty}</p>
                </EvidenceBox>
                <EvidenceBox title="Missing evidence" tone="amber">
                  <p>{blueprint.learningStory.data.missingEvidence}</p>
                </EvidenceBox>
              </>
            ) : (
              <StatusNote label="Confidence and missing evidence" section={blueprint.learningStory} />
            )}

            {blueprint.risk.status === 'available' && blueprint.risk.data && blueprint.risk.data.supportingEvidenceIds.length > 0 && (
              <EvidenceBox title="Evidence references already supporting this picture">
                <p>
                  {blueprint.risk.data.supportingEvidenceIds.length} supporting evidence reference{blueprint.risk.data.supportingEvidenceIds.length === 1 ? '' : 's'} are already attached to the current risk picture.
                </p>
                <p className="text-sm text-gray-500">
                  Latest evidence: {blueprint.risk.data.coverage.latestEvidenceAt ? new Date(blueprint.risk.data.coverage.latestEvidenceAt).toLocaleDateString('en-KE', { dateStyle: 'medium' }) : 'unknown'}
                </p>
              </EvidenceBox>
            )}
          </div>
        </div>
      </PageShell>

      <PageShell
        pageNumber={3}
        title="Conditions Requiring Response"
        question="What must the school respond to now?"
        transition="So what must each person do differently next?"
        exportMode={exportMode}
      >
        {blueprint.learningStory.status === 'available' && blueprint.learningStory.data && (
          <EvidenceBox title="Supported concern" tone="amber">
            <p>{blueprint.learningStory.data.nextConcern}</p>
          </EvidenceBox>
        )}

        {blueprint.risk.status === 'available' && blueprint.risk.data ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-gray-900">Current severity</p>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${RISK_STYLE[blueprint.risk.data.overallRiskLevel]}`}>
                {RISK_LABEL[blueprint.risk.data.overallRiskLevel]}
              </span>
              <span className="text-xs text-gray-500">confidence {blueprint.risk.data.confidence}%</span>
            </div>
            <div className="mt-3 space-y-3 text-sm text-gray-700">
              {blueprint.risk.data.flags.length === 0 ? (
                <p>No active supported concern is currently being flagged across the available scored evidence.</p>
              ) : (
                blueprint.risk.data.flags.map((flag, index) => (
                  <div key={index} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="font-semibold text-gray-900">{flag.subject ?? 'General learning condition'}</p>
                    <p className="mt-1">{flag.reason}</p>
                    <p className="mt-1 text-xs text-gray-500">Evidence references: {flag.evidenceIds.length}</p>
                  </div>
                ))
              )}
              <p className="text-xs text-gray-500">{blueprint.learningStory.status === 'available' && blueprint.learningStory.data ? blueprint.learningStory.data.uncertainty : 'Uncertainty remains visible wherever the current evidence is incomplete.'}</p>
            </div>
          </div>
        ) : (
          <StatusNote label="Current severity" section={blueprint.risk} />
        )}

        {attendanceAsConcern && blueprint.attendance.status === 'available' && blueprint.attendance.data?.attendancePercentage !== null && (
          <EvidenceBox title="Attendance condition">
            <p>
              Attendance is currently at{' '}
              <span className="font-semibold text-gray-900">{blueprint.attendance.data.attendancePercentage}%</span>,
              which may weaken the learner’s opportunity to sustain progress.
            </p>
            <p className="text-sm text-gray-500">
              Present {blueprint.attendance.data.presentCount} · Late {blueprint.attendance.data.lateCount} · Absent {blueprint.attendance.data.absentCount} · Excused {blueprint.attendance.data.excusedCount}
            </p>
          </EvidenceBox>
        )}

        {blueprint.teacherReflection.status === 'available' && blueprint.teacherReflection.data ? (
          <div className="grid gap-4 md:grid-cols-2">
            <EvidenceBox title="Teacher context">
              <p><span className="font-semibold text-gray-900">Growth area:</span> {blueprint.teacherReflection.data.growthArea}</p>
              <p><span className="font-semibold text-gray-900">Learning habits:</span> {blueprint.teacherReflection.data.learningHabits}</p>
            </EvidenceBox>
            <EvidenceBox title="Missing context and caution">
              <p>{blueprint.learningStory.status === 'available' && blueprint.learningStory.data ? blueprint.learningStory.data.missingEvidence : 'Some parts of the learner picture still need stronger evidence.'}</p>
            </EvidenceBox>
          </div>
        ) : (
          <StatusNote label="Teacher context" section={blueprint.teacherReflection} />
        )}
      </PageShell>

      <PageShell
        pageNumber={4}
        title="Coordinated Action Plan"
        question="What should the school do next?"
        transition="If we respond well, what future becomes more possible?"
        exportMode={exportMode}
      >
        {blueprint.parentSummary.status === 'available' && blueprint.parentSummary.data && (
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Shared plan context</p>
            <div className="mt-2 space-y-1 text-sm text-gray-700">
              {blueprint.parentSummary.data.headline && <p>{blueprint.parentSummary.data.headline}</p>}
              {blueprint.parentSummary.data.detail && <p>{blueprint.parentSummary.data.detail}</p>}
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-sm font-black text-gray-900">School / Teacher</p>
              <p className="mt-1 text-xs text-gray-500">Actions that should change the learner’s day-to-day support.</p>
              <div className="mt-3">
                <CompactList
                  items={schoolTeacherItems}
                  empty="No teacher-specific action is currently supported clearly enough to state separately in this Blueprint."
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-sm font-black text-gray-900">Learner</p>
              <p className="mt-1 text-xs text-gray-500">Actions the learner can own directly with current evidence.</p>
              <div className="mt-3">
                <CompactList
                  items={learnerItems}
                  empty="No learner-specific action is currently supported clearly enough to state separately in this Blueprint."
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-sm font-black text-gray-900">Parent / Guardian</p>
              <p className="mt-1 text-xs text-gray-500">Actions the family can take without duplicating school work.</p>
              <div className="mt-3">
                <CompactList
                  items={parentItems}
                  empty="No family-specific action is currently supported clearly enough to state separately in this Blueprint."
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-sm font-black text-gray-900">Leadership enablement</p>
              <p className="mt-1 text-xs text-gray-500">Only shown when the current Blueprint supports a distinct leadership role.</p>
              <div className="mt-3">
                <CompactList
                  items={leadershipItems}
                  empty="No leadership-specific enablement is supported distinctly by the current Blueprint."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm font-bold text-gray-900">Next review checkpoint</p>
          <p className="mt-1 text-sm text-gray-500">Review when new evidence is available.</p>
        </div>
      </PageShell>

      <PageShell
        pageNumber={5}
        title="Future Opened"
        question="What future does this make possible?"
        transition="This future is still a possibility, not a fixed destination."
        exportMode={exportMode}
      >
        <EvidenceBox title="Future-facing interpretation" tone="teal">
          <p>{futureIntro}</p>
          {blueprint.career.status === 'available' && blueprint.career.data ? (
            <div className="space-y-1">
              {blueprint.career.data.careerCluster && (
                <p><span className="font-semibold text-gray-900">Emerging direction:</span> {blueprint.career.data.careerCluster}</p>
              )}
              {blueprint.career.data.strengthProfile && (
                <p><span className="font-semibold text-gray-900">Strength profile:</span> {blueprint.career.data.strengthProfile}</p>
              )}
              {blueprint.career.data.futureDirection && (
                <p><span className="font-semibold text-gray-900">Future bridge:</span> {blueprint.career.data.futureDirection}</p>
              )}
              {blueprint.career.data.confidence && (
                <p className="text-sm text-gray-500">Career confidence: {blueprint.career.data.confidence}</p>
              )}
              {!blueprint.career.data.careerCluster && !blueprint.career.data.strengthProfile && !blueprint.career.data.futureDirection && (
                <p className="text-sm text-gray-500">The current career signal is still too thin for a more specific future interpretation.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {blueprint.career.status === 'not_implemented'
                ? 'Career interpretation is not yet available in the current Blueprint.'
                : blueprint.career.unavailableReason ?? 'Career interpretation is currently unavailable.'}
            </p>
          )}
        </EvidenceBox>

        {blueprint.learningCompass.status === 'available' && blueprint.learningCompass.data && (
          <EvidenceBox title="What should be strengthened next">
            {blueprint.learningCompass.data.currentLearningFocus ? (
              <p>
                The learner’s current focus in {blueprint.learningCompass.data.currentLearningFocus.subject}
                {blueprint.learningCompass.data.currentLearningFocus.subtopic ? ` — ${blueprint.learningCompass.data.currentLearningFocus.subtopic}` : ''}
                {' '}is the clearest near-term bridge between today’s evidence and tomorrow’s opportunities.
              </p>
            ) : (
              <p>No current learning focus is available yet to sharpen the next future-facing step.</p>
            )}
            {blueprint.learningCompass.data.holidayProgrammeAvailable && (
              <p className="text-sm text-gray-500">A holiday learning programme is already available as one practical way to keep momentum.</p>
            )}
          </EvidenceBox>
        )}

        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-sm font-black text-gray-900">Supporting evidence of future direction</p>
          <p className="mt-1 text-xs text-gray-500">These signals support the future picture when they are present. They do not replace it.</p>
          <div className="mt-4 space-y-3">
            {futureEvidence.length > 0 ? (
              futureEvidence.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-bold text-gray-900">{item.title}</p>
                  <p className="mt-1 text-sm text-gray-700">{item.detail}</p>
                  <p className="mt-1 text-xs text-gray-500">{item.why}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">
                Future evidence is still limited, so this page should guide exploration more than it suggests any firm direction.
              </p>
            )}
          </div>
        </div>
      </PageShell>

      <div className="rounded-3xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-black text-gray-900">Evidence traceability</p>
        <p className="mt-1 text-sm text-gray-500">Detailed evidence remains secondary to the main reading flow, but it is still available for readers who want to inspect why the Blueprint says what it says.</p>
        <div className="mt-4">
          <EvidenceTrailPlaceholder />
        </div>
      </div>
    </div>
  )
}
