// components/blueprint/BlueprintView.tsx
//
// Learner Blueprint renderer — a four-page document over the one canonical
// Blueprint composition, passed in as a prop. Presentation only: no new
// intelligence, no new queries, no duplicated reasoning, and it never
// composes its own Blueprint data. Each page answers exactly one question
// (Where does the learner stand? Why? What next? What's emerging?) and the
// whole document reads as one continuous story about one learner — not as
// separate outputs from Academic Record, Compass, Risk, Career and
// Projection stitched together. See docs/architecture (Blueprint
// presentation redesign) for the full design brief this implements.
//
// Non-negotiable rule this file follows throughout: one genuine assessment
// is enough for an honest interpretation. `trend: "insufficient_data"`
// never becomes "no data" — the level is known, only the direction of
// change isn't yet. Confidence/evidence-maturity is communicated through
// sentence wording (blueprintNarrative.ts), never a raw percentage, badge,
// owner name, freshness label, or evidence ID.

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ParentAction } from '@/lib/parentExperience/actions'
import type { LearnerBlueprint, BlueprintSection, AttendanceData } from '@/lib/learnerBlueprint/types'
import type { BlueprintValidationResult } from '@/lib/learnerBlueprint/validation'
import HistoricalBanner, { type HistoricalMeta } from './HistoricalBanner'
import {
  firstName,
  toDisplayName,
  subjectLabel,
  evidenceMaturityTier,
  describeAcademicPicture,
  describeVariation,
  describeRiskForReader,
  describeCareerDirection,
  describeClosing,
  describePriorityAction,
  describeContinuedChallenge,
  describeCareerAction,
  describeExplorationSuggestions,
  DOOR_LABEL,
} from './blueprintNarrative'

const TOTAL_PAGES = 4
const ATTENDANCE_RESPONSE_THRESHOLD_PERCENT = 90

type ActionItem = { title: string; detail: string }

// CBC's own 1-4 rubric — a display-label lookup for an already-real level,
// not a new calculation or a second scale.
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
            {schoolName ? `${schoolName} · Learner Blueprint` : 'Learner Blueprint'}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-white/70">{learnerName ?? 'Learner Blueprint'}</p>
        </div>
      </div>
      <p className="text-xs font-bold text-white/60">Page {pageNumber} of {TOTAL_PAGES}</p>
    </div>
  )
}

function ReportFooter({ reportId, generatedAtLabel }: { reportId: string; generatedAtLabel: string }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-6 py-2 text-[10px] text-slate-400 print:px-8">
      <p>Learner Blueprint · Prepared {generatedAtLabel}</p>
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
    >
      <ReportHeader pageNumber={pageNumber} learnerName={learnerName} schoolName={schoolName} schoolLogoUrl={schoolLogoUrl} />

      <div className="space-y-5 px-5 py-6 sm:px-6 print:px-8">
        <div className="space-y-1 border-b border-slate-100 pb-4">
          <h2 className="text-lg font-black text-[#0b1530]">{title}</h2>
          <p className="text-sm font-medium text-slate-500">{question}</p>
        </div>

        <div className="space-y-5 text-[15px] leading-7 text-slate-800">{children}</div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm italic text-slate-500">{transition}</p>
        </div>
      </div>

      <ReportFooter reportId={reportId} generatedAtLabel={generatedAtLabel} />
    </section>
  )
}

function Prose({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  )
}

function EvidenceBox({
  title,
  children,
  tone = 'default',
  dense = false,
}: {
  title: string
  children: ReactNode
  tone?: 'default' | 'gold' | 'navy'
  /** Page 4-only density reduction (moderately smaller padding/gap) — never applied elsewhere, so Pages 1-3 are unaffected. */
  dense?: boolean
}) {
  const toneClass =
    tone === 'gold'
      ? 'border-amber-100 bg-amber-50/60'
      : tone === 'navy'
        ? 'border-[#0b1530]/10 bg-[#0b1530]/[0.03]'
        : 'border-slate-100 bg-slate-50'

  return (
    <div className={`rounded-2xl border ${dense ? 'p-3' : 'p-4'} ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{title}</p>
      <div className={`${dense ? 'mt-1 space-y-1' : 'mt-2 space-y-2'} text-sm text-slate-700`}>{children}</div>
    </div>
  )
}

function OrderedActions({ items, empty }: { items: ActionItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <span className="text-sm font-black text-amber-600">{index + 1}</span>
          <p className="text-sm text-slate-700">{item.detail}</p>
        </li>
      ))}
    </ol>
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

function pushUnique(bucket: ActionItem[], seen: Set<string>, item: ActionItem | null) {
  if (!item) return
  const key = normalizeText(item.detail)
  if (!key || seen.has(key)) return
  seen.add(key)
  bucket.push(item)
}

function actionFromParentAction(action: ParentAction): ActionItem {
  return { title: action.title, detail: action.description }
}

function futureEvidenceItems(blueprint: LearnerBlueprint): ActionItem[] {
  const items: ActionItem[] = []

  if (blueprint.portfolio.status === 'available' && blueprint.portfolio.data) {
    const { publishedCount, featuredItem, latestItem } = blueprint.portfolio.data
    if (publishedCount > 0) {
      items.push({
        title: 'Portfolio',
        detail: featuredItem
          ? `${publishedCount} published portfolio item${publishedCount === 1 ? '' : 's'}, with ${featuredItem.title} currently standing out.`
          : `${publishedCount} published portfolio item${publishedCount === 1 ? '' : 's'} already visible.`,
      })
    } else if (latestItem) {
      items.push({ title: 'Portfolio', detail: `${latestItem.title} is the latest portfolio signal so far.` })
    }
  }

  if (blueprint.achievement.status === 'available' && blueprint.achievement.data) {
    const { achievementCount, highestLevelAchievement } = blueprint.achievement.data
    if (achievementCount > 0) {
      items.push({
        title: 'Achievement',
        detail: highestLevelAchievement
          ? `${achievementCount} verified achievement${achievementCount === 1 ? '' : 's'}, including ${highestLevelAchievement.title}.`
          : `${achievementCount} verified achievement${achievementCount === 1 ? '' : 's'} so far.`,
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
  const learnerName = toDisplayName(blueprint.identity.data?.learnerName ?? null)
  const name = firstName(learnerName)
  const gradeBand = getGradeBand(blueprint.identity.data?.currentClassName ?? null)
  const attendanceAsConcern = attendanceNeedsResponse(blueprint.attendance)
  const futureEvidence = futureEvidenceItems(blueprint)

  const hasNoLegacyBridge = (reason?: string) => !!reason && reason.toLowerCase().includes('bridged')

  const tier = blueprint.academicRecord.status === 'available' && blueprint.academicRecord.data
    ? evidenceMaturityTier(blueprint.academicRecord.data.bySubject)
    : 'first-snapshot'

  // ── Page 3 action list, one canonical priority + ordered follow-ons ──────
  const priorityAction = describePriorityAction(name, blueprint.learningCompass.data)
  const followOns: ActionItem[] = []
  const seen = new Set<string>()
  if (priorityAction) seen.add(normalizeText(priorityAction))

  const continuedChallenge = blueprint.academicRecord.status === 'available' && blueprint.academicRecord.data
    ? describeContinuedChallenge(name, blueprint.academicRecord.data)
    : null
  pushUnique(followOns, seen, continuedChallenge ? { title: 'Continued challenge', detail: continuedChallenge } : null)

  if (blueprint.teacherReflection.status === 'available' && blueprint.teacherReflection.data) {
    pushUnique(followOns, seen, { title: 'Teacher support', detail: blueprint.teacherReflection.data.recommendedSupport })
    if (blueprint.teacherReflection.data.holidayFocus) {
      pushUnique(followOns, seen, { title: 'Holiday focus', detail: blueprint.teacherReflection.data.holidayFocus })
    }
  }

  if (attendanceAsConcern && blueprint.attendance.status === 'available' && blueprint.attendance.data?.attendancePercentage !== null) {
    pushUnique(followOns, seen, {
      title: 'Attendance',
      detail: `A little more consistency in attendance (currently ${blueprint.attendance.data.attendancePercentage}%) would help protect the progress already showing.`,
    })
  }

  const careerActionText = blueprint.recommendedNextSteps.status === 'available' && blueprint.recommendedNextSteps.data
    ? describeCareerAction(name, blueprint.career.data, blueprint.recommendedNextSteps.data.actions)
    : describeCareerAction(name, blueprint.career.data, [])
  pushUnique(followOns, seen, careerActionText ? { title: 'Career exploration', detail: careerActionText } : null)

  // Fallback recommendations (only used when Compass has no current focus at all)
  if (!priorityAction && blueprint.recommendedNextSteps.status === 'available' && blueprint.recommendedNextSteps.data) {
    for (const action of blueprint.recommendedNextSteps.data.actions) {
      if (action.actionType === 'explore_career_journey') continue
      pushUnique(followOns, seen, actionFromParentAction(action))
    }
  }

  const risk = describeRiskForReader(blueprint.risk.status === 'available' ? blueprint.risk.data : null, tier)

  // Reuses the same already-real, context-correct destination Page 3's
  // career follow-on is built from — never an invented URL.
  const careerJourneyLink = blueprint.recommendedNextSteps.status === 'available' && blueprint.recommendedNextSteps.data
    ? blueprint.recommendedNextSteps.data.actions.find((a) => a.actionType === 'explore_career_journey')?.destination ?? null
    : null

  const futureFraming =
    gradeBand === 'grade_7_8'
      ? 'It’s still early to narrow things down — the priority now is trying things out and noticing what stands out.'
      : gradeBand === 'grade_9'
        ? 'At this transition point, it’s worth testing readiness for different pathways and being honest about what still needs to grow.'
        : gradeBand === 'grade_10_12'
          ? 'At this senior stage, real evidence can start pointing toward further education, technical training, entrepreneurship, or work — when the record supports it.'
          : 'It’s still early to draw firm conclusions about direction — that sharpens as more evidence builds up.'

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
              ? `As it stood on ${generatedAtLabel} — kept exactly as it was, never recalculated.`
              : `Prepared ${generatedAtLabel}`}
          </p>
          {/* Structural validation failed — say so plainly and tell the reader
              what to do. The individual errors are internal field/status
              diagnostics ("identity is required and must be 'available', got
              'unavailable'"); a parent or learner can act on none of them, and
              BlueprintStateMessage's own copy already sets the house standard
              of never exposing internals. The detail belongs in logs, not on
              a parent's screen. */}
          {!validation.valid && (
            <div role="alert" className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-700">Some of this Blueprint could not be prepared</p>
              <p className="mt-0.5 text-[11px] text-amber-600">
                Parts of this report are incomplete. Everything shown below is accurate — nothing has been
                estimated or filled in. Please ask the school to check this learner&apos;s record.
              </p>
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

      {/* PAGE 1 — Where We Stand Today */}
      <PageShell
        pageNumber={1}
        title="Where We Stand Today"
        question="A snapshot of where things stand right now."
        transition="The next page looks at why this picture looks the way it does."
        {...shellProps}
      >
        {blueprint.academicRecord.status === 'available' && blueprint.academicRecord.data && blueprint.academicRecord.data.bySubject.length > 0 ? (
          <>
            <Prose paragraphs={describeAcademicPicture(name, blueprint.academicRecord.data)} />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {blueprint.academicRecord.data.bySubject.map((subject) => (
                <div key={subject.subject} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-bold text-slate-900">{subjectLabel(subject.subject)}</p>
                  <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-black ${CBC_LEVEL_ACCENT[subject.latestLevel]}`}>
                    {CBC_LEVEL_LABEL[subject.latestLevel]}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : hasNoLegacyBridge(blueprint.academicRecord.unavailableReason) ? (
          <p className="text-sm text-slate-500">{`We don’t yet have enough set up to build ${name}'s academic picture.`}</p>
        ) : (
          <p className="text-sm text-slate-500">{`There isn’t yet enough recorded evidence to describe ${name}'s current academic picture — that will change as new assessments are added.`}</p>
        )}

        {blueprint.learningCompass.status === 'available' && blueprint.learningCompass.data?.currentLearningFocus && (
          <p className="text-sm text-slate-600">
            Right now, {name}'s active learning focus is <span className="font-semibold text-slate-900">{subjectLabel(blueprint.learningCompass.data.currentLearningFocus.subject)}</span>.
          </p>
        )}
      </PageShell>

      {/* PAGE 2 — What the Evidence Suggests */}
      <PageShell
        pageNumber={2}
        title="What the Evidence Suggests"
        question="What this first record suggests — and what it doesn’t yet."
        transition="The next page turns this into a clear next step."
        {...shellProps}
      >
        {blueprint.academicRecord.status === 'available' && blueprint.academicRecord.data && blueprint.academicRecord.data.bySubject.length > 0 ? (
          <Prose paragraphs={describeVariation(name, blueprint.academicRecord.data)} />
        ) : (
          <p className="text-sm text-slate-500">{`It’s too early to describe a pattern for ${name} yet — that becomes possible once assessment evidence starts to build up.`}</p>
        )}

        {blueprint.growthTimeline.status === 'available' && blueprint.growthTimeline.data && blueprint.growthTimeline.data.length > 0 && (
          <EvidenceBox title="Movement over time">
            {blueprint.growthTimeline.data.map((entry, index) => (
              <p key={index}>{entry.trajectory}</p>
            ))}
          </EvidenceBox>
        )}

        {blueprint.teacherReflection.status === 'available' && blueprint.teacherReflection.data && (
          <EvidenceBox title="What the teacher has noticed" tone="gold">
            <p>{blueprint.teacherReflection.data.strengths}</p>
            <p>{blueprint.teacherReflection.data.growthArea}</p>
          </EvidenceBox>
        )}
      </PageShell>

      {/* PAGE 3 — How We Help Next */}
      <PageShell
        pageNumber={3}
        title="How We Help Next"
        question="The next steps that matter most."
        transition="The final page looks at where this journey could lead."
        {...shellProps}
      >
        {priorityAction ? (
          <EvidenceBox title="The one thing that matters most right now" tone="navy">
            <p className="text-base font-semibold text-slate-900">{priorityAction}</p>
          </EvidenceBox>
        ) : (
          <p className="text-sm text-slate-500">There isn’t yet a specific next step identified — check back as more evidence arrives this term.</p>
        )}

        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Then, in order</p>
          <OrderedActions items={followOns} empty="No further steps are clearly supported by evidence yet — this will grow as the term continues." />
        </div>

        <EvidenceBox title="What we're watching">
          <p className="font-semibold text-slate-900">{risk.headline}</p>
          {risk.details.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </EvidenceBox>
      </PageShell>

      {/* PAGE 4 — What May Be Emerging */}
      <PageShell
        pageNumber={4}
        title="What May Be Emerging"
        question="An early look at where this could lead."
        transition={describeClosing(name, futureEvidence.length > 0)}
        {...shellProps}
      >
        <EvidenceBox title="An early direction" tone="navy">
          <p>{futureFraming}</p>
          <Prose paragraphs={describeCareerDirection(name, blueprint.career.status === 'available' ? blueprint.career.data : null)} />
        </EvidenceBox>

        {/* Tighter internal spacing than the page's default space-y-5 —
            Page 4 only, so density stays high without touching Pages 1-3
            or PageShell's shared layout. */}
        <div className="space-y-3">
          {blueprint.career.status === 'available' && blueprint.career.data?.doorsPreview && (
            <div>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">Four ways this direction could open</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {blueprint.career.data.doorsPreview.map((door) => (
                  <EvidenceBox key={door.type} title={DOOR_LABEL[door.type]} dense>
                    <p>{door.summary}</p>
                  </EvidenceBox>
                ))}
              </div>
            </div>
          )}

          {blueprint.career.status === 'available' && blueprint.career.data?.aiChangeSummary && (
            <EvidenceBox title="How this field is changing" tone="gold" dense>
              <p>{blueprint.career.data.aiChangeSummary}</p>
            </EvidenceBox>
          )}

          {blueprint.career.status === 'available' && describeExplorationSuggestions(blueprint.career.data?.explorationSuggestions ?? null) && (
            <p className="text-sm text-slate-600">{describeExplorationSuggestions(blueprint.career.data?.explorationSuggestions ?? null)}</p>
          )}

          {careerJourneyLink && (
            <p className="text-sm">
              <Link href={careerJourneyLink} className="font-semibold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
                Explore career pathways and next steps →
              </Link>
            </p>
          )}
        </div>

        {futureEvidence.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {futureEvidence.map((item, index) => (
              <EvidenceBox key={`${item.title}-${index}`} title={item.title} tone="gold">
                <p>{item.detail}</p>
              </EvidenceBox>
            ))}
          </div>
        )}
      </PageShell>
    </div>
  )
}
