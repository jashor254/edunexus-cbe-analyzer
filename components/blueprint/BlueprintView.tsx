// components/blueprint/BlueprintView.tsx
//
// Learner Progress Report renderer (internal name: Blueprint). Four
// questions plus a printed School & Family Action Agreement, over the one
// canonical Blueprint composition passed in as a prop:
//
//   1. Where are we now?                       — data-blueprint-section="where-now"
//   2. What's going well, and what needs help? — "going-well"
//   3. What do we do next?                     — "next-steps"
//   4. Where is this leading?                  — "leading"
//   5. School & Family Action Agreement        — "agreement"
//
// Presentation only. What each question says — for this viewer's audience —
// is decided once in lib/learnerBlueprint/progressReport.ts
// (buildProgressReport); this file only lays it out. The same component
// renders for the learner, the parent (ParentBlueprintView puts it first) and
// the teacher, so all three read one educational account. It never composes
// Blueprint data itself, never queries, and never exposes a raw percentage,
// confidence score, owner, freshness label, enum value or evidence ID.

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { BlueprintViewer } from '@/lib/parentExperience/actions'
import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import type { BlueprintValidationResult } from '@/lib/learnerBlueprint/validation'
import { toDisplayName } from '@/lib/learnerBlueprint/narrative'
import {
  buildProgressReport,
  questionHeading,
  type LevelGroup,
  type ProgressReportSectionId,
  type ReportItem,
} from '@/lib/learnerBlueprint/progressReport'
import HistoricalBanner, { type HistoricalMeta } from './HistoricalBanner'

const TOTAL_PAGES = 5

/**
 * What this document calls itself to a reader.
 *
 * "Blueprint" is the internal domain name and stays that way throughout the
 * code. It is not a name a Kenyan school has a mental slot for — a school has
 * report forms, progress reports and records — and the 2026-08-03 Kenyan
 * evolution audit named this the single highest-leverage change it found,
 * because it shapes the reader's impression before they have read one fact.
 */
const DOCUMENT_NAME = 'Learner Progress Report'

// Level accent colours are shared across curricula — only the WORDS differ,
// and those come from `resolveCurriculumVoice()` (via progressReport.ts) so an
// 8-4-4 learner is never described in CBC rubric language their school does
// not use. The word is always printed; colour is never the only signal.
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
      <div className="flex min-w-0 items-center gap-3">
        {schoolLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- printed into a PDF via headless Chromium, not served through next/image's optimizer
          <img src={schoolLogoUrl} alt={`${schoolName ?? 'School'} crest`} className="h-8 w-8 rounded-md object-cover" />
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">
            {schoolName ? `${schoolName} · ${DOCUMENT_NAME}` : DOCUMENT_NAME}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-white/70">{learnerName ?? DOCUMENT_NAME}</p>
        </div>
      </div>
      <p className="shrink-0 text-xs font-bold text-white/60">Page {pageNumber} of {TOTAL_PAGES}</p>
    </div>
  )
}

function ReportFooter({ reportId, generatedAtLabel }: { reportId: string; generatedAtLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-6 py-2 text-[10px] text-slate-400 print:px-8">
      <p>{DOCUMENT_NAME} · Prepared {generatedAtLabel}</p>
      <p>{reportId} · CONFIDENTIAL</p>
    </div>
  )
}

function PageShell({
  pageNumber,
  sectionId,
  title,
  titleSw,
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
  sectionId: ProgressReportSectionId
  title: string
  /** Kiswahili wording of the question (lib/i18n/locales/sw.ts), shown beneath the English heading. */
  titleSw?: string
  question: string
  children: ReactNode
  transition?: string
  learnerName: string | null
  reportId: string
  generatedAtLabel: string
  schoolName?: string | null
  schoolLogoUrl?: string | null
}) {
  return (
    <section
      data-blueprint-page-shell="true"
      data-blueprint-section={sectionId}
      data-blueprint-print-break="before"
      aria-labelledby={`blueprint-${sectionId}-title`}
      className="overflow-hidden rounded-3xl border border-gray-100 bg-white print:rounded-none print:border-0"
    >
      <ReportHeader pageNumber={pageNumber} learnerName={learnerName} schoolName={schoolName} schoolLogoUrl={schoolLogoUrl} />

      {/* print: variants tighten density on paper only, so each question fits one A4 page in the common case. */}
      <div className="space-y-5 px-5 py-6 sm:px-6 print:space-y-3 print:px-8 print:py-4">
        <div className="space-y-1 border-b border-slate-100 pb-4 print:pb-2">
          <h2 id={`blueprint-${sectionId}-title`} className="text-lg font-black text-[#0b1530]">{title}</h2>
          {titleSw && (
            <p lang="sw" data-blueprint-heading-sw="true" className="text-sm font-semibold italic text-slate-500">{titleSw}</p>
          )}
          <p className="text-sm font-medium text-slate-500">{question}</p>
        </div>

        <div className="space-y-5 text-[15px] leading-7 text-slate-800 print:space-y-3 print:text-[13px] print:leading-6">{children}</div>

        {transition && (
          <div className="border-t border-slate-100 pt-4 print:pt-2">
            <p className="text-sm italic text-slate-500">{transition}</p>
          </div>
        )}
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
  /** Page 4-only density reduction (moderately smaller padding/gap). */
  dense?: boolean
}) {
  const toneClass =
    tone === 'gold'
      ? 'border-amber-100 bg-amber-50/60'
      : tone === 'navy'
        ? 'border-[#0b1530]/10 bg-[#0b1530]/[0.03]'
        : 'border-slate-100 bg-slate-50'

  return (
    <div className={`break-inside-avoid rounded-2xl border ${dense ? 'p-3' : 'p-4'} ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{title}</p>
      <div className={`${dense ? 'mt-1 space-y-1' : 'mt-2 space-y-2'} text-sm text-slate-700`}>{children}</div>
    </div>
  )
}

function OrderedActions({ items, empty }: { items: ReportItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <span className="text-sm font-black text-amber-600">{index + 1}</span>
          <div className="space-y-1">
            <p className="text-sm text-slate-700">{item.detail}</p>
            {item.href && (
              <Link href={item.href} className="text-sm font-semibold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
                Take this action →
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function SubjectList({ title, groups, tone }: { title: string; groups: LevelGroup[]; tone: 'good' | 'help' }) {
  if (groups.length === 0) return null
  return (
    <div className={`break-inside-avoid rounded-2xl border px-4 py-3 ${tone === 'good' ? 'border-emerald-100 bg-emerald-50/50' : 'border-amber-100 bg-amber-50/60'}`}>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{title}</p>
      <dl className="mt-1 space-y-1 text-sm text-slate-700">
        {groups.map(group => (
          <div key={group.levelLabel}>
            <dt className="inline font-semibold text-slate-900">{group.levelLabel}: </dt>
            <dd className="inline">{group.subjects.join(', ')}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** A printed write-in line. Visible on screen too, so a teacher printing from the browser gets the same page. */
function WriteInLine({ label, proposed, lines = 2 }: { label: string; proposed?: string | null; lines?: 1 | 2 }) {
  return (
    <div className="break-inside-avoid">
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      {proposed && (
        <p className="text-xs italic text-slate-500">Proposed in the teacher’s plan, for discussion: {proposed}</p>
      )}
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} aria-hidden="true" className="h-6 border-b border-dashed border-slate-400" />
      ))}
    </div>
  )
}

function Acknowledgement({ label }: { label: string }) {
  return (
    <div className="break-inside-avoid">
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <div className="grid grid-cols-3 gap-3">
        {['Name', 'Signature', 'Date'].map(field => (
          <div key={field}>
            <div aria-hidden="true" className="h-6 border-b border-dashed border-slate-400" />
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{field}</p>
          </div>
        ))}
      </div>
    </div>
  )
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
  // Defaults to 'student' — the historical assumption every existing
  // caller/test implicitly made before viewer-aware destinations existed.
  // Callers that know their actual viewer (the page-level `primary` role)
  // pass it explicitly; it also decides the report's audience voice.
  viewer = 'student',
  historyHref,
}: {
  blueprint: LearnerBlueprint
  validation: BlueprintValidationResult
  learnerId: string
  historicalMeta?: HistoricalMeta
  exportMode?: 'screen' | 'pdf'
  viewer?: BlueprintViewer
  /** Where "View History" / "Back to History" points — the parent portal passes its own history route. */
  historyHref?: string
}) {
  const report = buildProgressReport(blueprint, viewer)
  const generatedAt = blueprint.metadata.generatedAt
  const generatedAtLabel = new Date(generatedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nairobi' })
  const reportId = buildReportId(learnerId, generatedAt)
  const learnerName = toDisplayName(blueprint.identity.data?.learnerName ?? null)
  const historyLink = historyHref ?? `/student/blueprint/${learnerId}/history`

  const shellProps = {
    learnerName,
    reportId,
    generatedAtLabel,
    schoolName: blueprint.identity.data?.schoolName ?? null,
    schoolLogoUrl: blueprint.identity.data?.schoolLogoUrl ?? null,
  }

  const q1 = questionHeading('where-now')
  const q2 = questionHeading('going-well')
  const q3 = questionHeading('next-steps')
  const q4 = questionHeading('leading')
  const { whereNow, goingWell, nextSteps, leading, agreement } = report

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
              {historicalMeta ? `${DOCUMENT_NAME} — Historical Record` : DOCUMENT_NAME}
            </h1>
            {!historicalMeta && (
              <span aria-label="This is the current, live report" className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
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
              what to do. The individual errors are internal diagnostics a
              parent or learner can act on none of; they belong in logs. */}
          {!validation.valid && (
            <div role="alert" className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-700">Some of this report could not be prepared</p>
              <p className="mt-0.5 text-[11px] text-amber-600">
                Parts of this report are incomplete. Everything shown below is accurate — nothing has been
                estimated or filled in. Please ask the school to check this learner&apos;s record.
              </p>
            </div>
          )}
          <nav aria-label="Report history navigation" data-blueprint-nav="true" className="mt-3">
            <Link href={historyLink} className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
              {historicalMeta ? '← Back to History' : 'View History →'}
            </Link>
          </nav>
        </div>
      )}

      {/* 1 — Where are we now? */}
      <PageShell
        pageNumber={1}
        sectionId="where-now"
        title={q1.en}
        titleSw={q1.sw}
        question={whereNow.intro}
        transition="Next: what’s going well, and what needs help."
        {...shellProps}
      >
        <Prose paragraphs={whereNow.paragraphs} />

        {whereNow.subjects.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {whereNow.subjects.map((subject) => (
              <div key={subject.subject} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-xs font-bold text-slate-900">{subject.label}</p>
                <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-black ${CBC_LEVEL_ACCENT[subject.level]}`}>
                  {subject.levelLabel}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* An 8-4-4 learner is told what these bands are and what they are
            not. A CBE learner sees nothing extra — the KICD rubric words are
            already the vocabulary of their classroom. */}
        {whereNow.scaleNote && <p className="text-[11px] text-slate-500">{whereNow.scaleNote}</p>}
        {whereNow.transitionLine && <p className="text-[11px] text-slate-500">{whereNow.transitionLine}</p>}
        {whereNow.latestEvidenceLine && <p className="text-[11px] text-slate-500">{whereNow.latestEvidenceLine}</p>}
        {whereNow.compassFocusLine && <p className="text-sm text-slate-600">{whereNow.compassFocusLine}</p>}
      </PageShell>

      {/* 2 — What's going well, and what needs help? */}
      <PageShell
        pageNumber={2}
        sectionId="going-well"
        title={q2.en}
        titleSw={q2.sw}
        question={goingWell.intro}
        transition="Next: turning this into clear next steps."
        {...shellProps}
      >
        <Prose paragraphs={goingWell.paragraphs} />

        {(goingWell.goingWell.length > 0 || goingWell.needsHelp.length > 0) && (
          <div className="space-y-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <SubjectList title="Going well" groups={goingWell.goingWell} tone="good" />
              <SubjectList title="Needs help" groups={goingWell.needsHelp} tone="help" />
            </div>
            {goingWell.listCaveat && <p className="text-[11px] text-slate-500">{goingWell.listCaveat}</p>}
          </div>
        )}

        {goingWell.movement.length > 0 && (
          <EvidenceBox title="Movement over time">
            {goingWell.movement.map((line, index) => <p key={index}>{line}</p>)}
          </EvidenceBox>
        )}

        <EvidenceBox title="What we're watching">
          <p className="font-semibold text-slate-900">{goingWell.watching.headline}</p>
          {goingWell.watching.details.map((line, index) => <p key={index}>{line}</p>)}
        </EvidenceBox>

        {goingWell.teacher && (
          <EvidenceBox title={goingWell.teacher.title} tone="gold">
            <p>{goingWell.teacher.strengths}</p>
            <p>{goingWell.teacher.growthArea}</p>
            <p className="text-[11px] text-slate-500">{goingWell.teacher.attribution}</p>
          </EvidenceBox>
        )}
      </PageShell>

      {/* 3 — What do we do next? */}
      <PageShell
        pageNumber={3}
        sectionId="next-steps"
        title={q3.en}
        titleSw={q3.sw}
        question={nextSteps.intro}
        transition="Next: where this journey could lead."
        {...shellProps}
      >
        {nextSteps.priority ? (
          <EvidenceBox title="The one thing that matters most right now" tone="navy">
            <p className="text-base font-semibold text-slate-900">{nextSteps.priority.text}</p>
            {nextSteps.priority.detail && <p>{nextSteps.priority.detail}</p>}
            <p className="text-[11px] text-slate-500">{nextSteps.priority.sourceLabel}</p>
            {nextSteps.priority.reviewNote && <p className="text-[11px] text-slate-500">{nextSteps.priority.reviewNote}</p>}
          </EvidenceBox>
        ) : (
          <p className="text-sm text-slate-500">{nextSteps.priorityEmpty}</p>
        )}

        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Who does what</p>
          <dl className="grid gap-2 sm:grid-cols-3">
            {nextSteps.roles.map(role => (
              <div key={role.role} data-blueprint-role={role.role} className="break-inside-avoid rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">{role.label}</dt>
                <dd className="mt-1 space-y-1 text-sm text-slate-700">
                  {role.text ? (
                    <>
                      <p>{role.text}</p>
                      {role.sourceLabel && <p className="text-[11px] text-slate-500">{role.sourceLabel}</p>}
                    </>
                  ) : (
                    <p className="text-slate-500">{role.emptyText}</p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Also worth doing</p>
          <OrderedActions items={nextSteps.followOns} empty={nextSteps.followOnsEmpty} />
        </div>
      </PageShell>

      {/* 4 — Where is this leading? Its framing inverts between stages: for a
          junior learner the pathway is still open and no career field is
          named; for a senior learner the record already points somewhere. */}
      <PageShell
        pageNumber={4}
        sectionId="leading"
        title={q4.en}
        titleSw={q4.sw}
        question={leading.question}
        transition={leading.closing}
        {...shellProps}
      >
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500" data-blueprint-stage-title="true">{leading.stageTitle}</p>

        <EvidenceBox title={leading.directionTitle} tone="navy">
          <p>{leading.framing}</p>
          <Prose paragraphs={leading.direction} />
        </EvidenceBox>

        <div className="space-y-3">
          {leading.doors.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">{leading.doorsTitle}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {leading.doors.map((door) => (
                  <EvidenceBox key={door.label} title={door.label} dense>
                    <p>{door.summary}</p>
                  </EvidenceBox>
                ))}
              </div>
            </div>
          )}

          {leading.aiChange && (
            <EvidenceBox title="How this field is changing" tone="gold" dense>
              <p>{leading.aiChange}</p>
            </EvidenceBox>
          )}

          {/* Pathway readiness — junior only, by construction (composePathwayReadiness
              returns unavailable for senior bands, where the decision is already made).
              For a Grade 9 family it names one subject and one level rather than
              "work harder". The disclaimer is always rendered because the KJSEA rule
              set behind these thresholds is provisional — see lib/config/kjseaRules.ts. */}
          {leading.pathwayReadiness && (
            <EvidenceBox title="Senior school pathway" tone="navy" dense>
              <p>{leading.pathwayReadiness.stageMessage}</p>

              {leading.pathwayReadiness.stage === 'decision_year' && (
                <>
                  <p className="mt-2">
                    Current composite:{' '}
                    <span className="font-bold">
                      {leading.pathwayReadiness.isPartialComposite ? 'at least ' : ''}
                      {leading.pathwayReadiness.compositeScore}
                    </span>{' '}
                    of {leading.pathwayReadiness.kjseaMaxScore}, from{' '}
                    {leading.pathwayReadiness.subjectsEntered} of{' '}
                    {leading.pathwayReadiness.subjectGroupsTotal} subject groups.
                  </p>

                  {leading.pathwayReadiness.qualifiesFor.length > 0 && (
                    <p className="mt-1">
                      On the record so far, this reaches the threshold for:{' '}
                      <span className="font-bold">{leading.pathwayReadiness.qualifiesFor.join(', ')}</span>.
                    </p>
                  )}

                  {leading.pathwayReadiness.nextDoor && (
                    <p className="mt-2">
                      <span className="font-bold">The one thing that would open {leading.pathwayReadiness.nextDoor.pathway}:</span>{' '}
                      moving {leading.pathwayReadiness.nextDoor.keyLever.subject} from level{' '}
                      {leading.pathwayReadiness.nextDoor.keyLever.currentLevel} to level{' '}
                      {leading.pathwayReadiness.nextDoor.keyLever.targetLevel}
                      {leading.pathwayReadiness.nextDoor.keyLever.wouldUnlock
                        ? ' would be enough on its own.'
                        : ` would close ${leading.pathwayReadiness.nextDoor.keyLever.pointsGained} of the ${leading.pathwayReadiness.nextDoor.pointsShort} points still needed.`}
                    </p>
                  )}
                </>
              )}

              {leading.pathwayReadiness.notes.map((note, i) => (
                <p key={i} className="mt-1 text-[11px] text-slate-500">{note}</p>
              ))}

              <p className="mt-2 text-[11px] text-slate-500">{leading.pathwayReadiness.disclaimer}</p>
            </EvidenceBox>
          )}

          {leading.exploration && <p className="text-sm text-slate-600">{leading.exploration}</p>}

          {leading.link && (
            <p className="text-sm">
              <Link href={leading.link.href} className="font-semibold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
                {leading.link.label}
              </Link>
            </p>
          )}
        </div>

        {leading.futureEvidence.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {leading.futureEvidence.map((item, index) => (
              <EvidenceBox key={`${item.title}-${index}`} title={item.title} tone="gold">
                <p>{item.detail}</p>
              </EvidenceBox>
            ))}
          </div>
        )}
      </PageShell>

      {/* 5 — Printed School & Family Action Agreement. A blank, write-in form:
          no signature, date or commitment is stored or pre-filled as agreed. */}
      <PageShell
        pageNumber={5}
        sectionId="agreement"
        title="School & Family Action Agreement"
        question="For use at a school–family meeting."
        {...shellProps}
      >
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600" data-blueprint-agreement-notice="true">
          {agreement.notice}
        </p>

        <WriteInLine label="Meeting date" lines={1} />
        <WriteInLine label="Learner’s next step" proposed={agreement.proposedLearnerStep} />
        <WriteInLine label="Teacher’s planned support" proposed={agreement.proposedTeacherSupport} />
        <WriteInLine label="Parent/guardian’s support" proposed={agreement.proposedHomeSupport} />

        <div className="space-y-3 pt-1">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Acknowledgement — all optional</p>
          <Acknowledgement label="Learner (optional)" />
          <Acknowledgement label="Teacher" />
          <Acknowledgement label="Parent/guardian" />
        </div>
      </PageShell>
    </div>
  )
}
