// lib/learnerBlueprint/progressReport.ts
//
// The Learner Progress Report's four questions, built once for one audience
// from the Blueprint composeBlueprint() (or a stored snapshot) already
// produced:
//
//   1. Where are we now?
//   2. What's going well, and what needs help?
//   3. What do we do next?
//   4. Where is this leading?
//   + a printed School & Family Action Agreement.
//
// Pure presentation: no database read, no AI call, no new score, threshold or
// learner-level calculation. Every value is either a field the owning domain
// already composed or a sentence from narrative.ts describing one. The same
// function serves the learner, the parent and the teacher, so the three
// readers get one educational account — the same subjects, the same levels,
// the same priority — and differ only in voice and in what each audience is
// allowed to see (plan steps carry per-audience projections; this module
// shows each audience only its own).
//
// Evidence discipline (the product rule): interpretation starts from the
// first recorded assessment, never waits for a minimum count, and never says
// more than the evidence supports. "No assessment recorded" is described as
// exactly that — never as progress, never as a concern.
//
// Historical snapshots render through here too. Everything is read from the
// payload itself, and "now" is the payload's own `generatedAt`, so an old
// report is never reinterpreted against today's date or today's data.

import type { ApprovedPlanStep, CareerDoorPreview, LearnerBlueprint, PathwayReadinessData, SubjectRecord } from './types'
import { readSection } from './readSection'
import {
  futurePageQuestion,
  futurePageTitle,
  gradeBandFraming,
  isSeniorBand,
  resolveGradeBand,
  type BlueprintGradeBand,
} from './gradeBand'
import { resolveCurriculumVoice, transitionNote } from './curriculumVoice'
import { ATTENDANCE_ATTENTION_THRESHOLD_PERCENT } from './composeParentSummary'
import {
  describeAcademicPicture,
  describeCareerAction,
  describeCareerDirection,
  describeClosing,
  describeContinuedChallenge,
  describeExplorationSuggestions,
  describePathwayDirection,
  describePriorityAction,
  describeRiskForReader,
  describeVariation,
  evidenceMaturityTier,
  firstName,
  subjectLabel,
  toDisplayName,
  DOOR_LABEL,
  type EvidenceMaturityTier,
} from './narrative'
import {
  isActionDestinationValidForViewer,
  isSafeInternalDestination,
  type BlueprintViewer,
  type ParentAction,
} from '@/lib/parentExperience/actions'
import { t } from '@/lib/i18n/translations'

// ── Structure ────────────────────────────────────────────────────────────────

export type ReportAudience = 'learner' | 'parent' | 'teacher'

/** Stable section ids — the `data-blueprint-section` hooks the PDF export waits on, independent of visible heading wording. */
export const PROGRESS_REPORT_SECTIONS = ['where-now', 'going-well', 'next-steps', 'leading', 'agreement'] as const
export type ProgressReportSectionId = typeof PROGRESS_REPORT_SECTIONS[number]
export type QuestionId = Exclude<ProgressReportSectionId, 'agreement'>

const QUESTION_KEY: Record<QuestionId, string> = {
  'where-now': 'progressReport.questions.whereNow',
  'going-well': 'progressReport.questions.goingWell',
  'next-steps': 'progressReport.questions.nextSteps',
  leading: 'progressReport.questions.leading',
}

/** English heading plus the sw-KE working wording (lib/i18n/locales/sw.ts — pending review by a Kiswahili teacher). */
export function questionHeading(id: QuestionId): { en: string; sw: string } {
  return { en: t(QUESTION_KEY[id], 'en-KE'), sw: t(QUESTION_KEY[id], 'sw-KE') }
}

export function audienceForViewer(viewer: BlueprintViewer): ReportAudience {
  if (viewer === 'student') return 'learner'
  return viewer
}

/** Absence of any assessed subject is its own state — never folded into the thinnest evidence tier. */
export type EvidenceState = 'none' | EvidenceMaturityTier

export type ReportLink = { label: string; href: string }
export type ReportItem = { title: string; detail: string; href: string | null }

export type LevelGroup = { levelLabel: string; subjects: string[] }

export type RoleStep = {
  role: 'learner' | 'teacher' | 'home'
  label: string
  text: string | null
  /** Where `text` came from, in reader language — null when `text` is null. */
  sourceLabel: string | null
  /** Shown instead of `text` when nothing has been set — never a fabricated step. */
  emptyText: string
}

export type ProgressReport = {
  audience: ReportAudience
  name: string
  gradeBand: BlueprintGradeBand
  evidence: {
    state: EvidenceState
    subjectCount: number
    /** Highest per-subject assessment count, the same figure the maturity sentence already states. */
    assessmentCount: number
    latestEvidenceLabel: string | null
  }
  whereNow: {
    intro: string
    paragraphs: string[]
    subjects: Array<{ subject: string; label: string; level: 1 | 2 | 3 | 4; levelLabel: string }>
    scaleNote: string | null
    transitionLine: string | null
    latestEvidenceLine: string | null
    compassFocusLine: string | null
  }
  goingWell: {
    intro: string
    paragraphs: string[]
    /** Subjects grouped by their recorded level, highest first — one line per level, so a 12-subject timetable stays compact. */
    goingWell: LevelGroup[]
    needsHelp: LevelGroup[]
    /** One sentence qualifying the two lists by how much evidence stands behind them. */
    listCaveat: string | null
    movement: string[]
    watching: { headline: string; details: string[] }
    teacher: { title: string; strengths: string; growthArea: string; attribution: string } | null
  }
  nextSteps: {
    intro: string
    priority: { text: string; detail: string | null; sourceLabel: string; reviewNote: string | null } | null
    priorityEmpty: string
    roles: RoleStep[]
    followOns: ReportItem[]
    followOnsEmpty: string
  }
  leading: {
    stageTitle: string
    question: string
    framing: string
    directionTitle: string
    direction: string[]
    doors: Array<{ label: string; summary: string }>
    doorsTitle: string | null
    aiChange: string | null
    exploration: string | null
    pathwayReadiness: PathwayReadinessData | null
    link: ReportLink | null
    futureEvidence: ReportItem[]
    closing: string
  }
  agreement: {
    notice: string
    proposedLearnerStep: string | null
    proposedTeacherSupport: string | null
    /** Null for a learner reader — teacher/home support are parent-visible plan fields, never the learner's own projection. */
    proposedHomeSupport: string | null
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DATE_FORMAT = new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeZone: 'Africa/Nairobi' })

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : DATE_FORMAT.format(d)
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function pushUnique(bucket: ReportItem[], seen: Set<string>, item: ReportItem | null): void {
  if (!item) return
  const key = normalizeText(item.detail)
  if (!key || seen.has(key)) return
  seen.add(key)
  bucket.push(item)
}

function latestOf(bySubject: SubjectRecord[]): string | null {
  return bySubject.reduce<string | null>((latest, s) => {
    if (!s.latestEvidenceAt) return latest
    return latest === null || s.latestEvidenceAt > latest ? s.latestEvidenceAt : latest
  }, null)
}

/** A plan step this audience may see — the projection carried in the payload decides, never this module. */
function visibleTo(step: ApprovedPlanStep, audience: ReportAudience): boolean {
  if (audience === 'learner') return step.learnerView !== null
  if (audience === 'parent') return step.parentView !== null
  return true
}

function isOverdue(step: ApprovedPlanStep, asOf: string): boolean {
  return !!step.reviewDate && step.reviewDate < asOf.slice(0, 10)
}

// Parent Action Centre types that belong in a parent's "also worth doing"
// list. Excluded: the canonical plan item (already the priority/role steps),
// the career teaser (Q4 owns direction), "read the reflection" (it is on this
// page), and the empty-state placeholder (the role steps say that honestly).
const PARENT_FOLLOW_ON_TYPES: ParentAction['actionType'][] = [
  'continue_holiday_learning',
  'celebrate_achievement',
  'view_report_card',
  'review_attendance',
]

// ── Builder ──────────────────────────────────────────────────────────────────

export function buildProgressReport(blueprint: LearnerBlueprint, viewer: BlueprintViewer): ProgressReport {
  const audience = audienceForViewer(viewer)
  const asOf = blueprint.metadata.generatedAt
  const name = firstName(toDisplayName(blueprint.identity.data?.learnerName ?? null))
  const className = blueprint.identity.data?.currentClassName ?? null
  const gradeBand = resolveGradeBand(blueprint.metadata.gradeBand, className)
  const senior = isSeniorBand(gradeBand)
  const voice = resolveCurriculumVoice(className)

  const academic = blueprint.academicRecord.status === 'available' ? blueprint.academicRecord.data : null
  const bySubject = academic?.bySubject ?? []
  const evidenceRecorded = bySubject.length > 0
  const tier = evidenceMaturityTier(bySubject)
  const state: EvidenceState = evidenceRecorded ? tier : 'none'
  const assessmentCount = bySubject.reduce((max, s) => Math.max(max, s.evidenceCount), 0)
  const latestEvidenceLabel = formatDate(latestOf(bySubject))

  const compass = blueprint.learningCompass.status === 'available' ? blueprint.learningCompass.data : null
  const reflection = blueprint.teacherReflection.status === 'available' ? blueprint.teacherReflection.data : null
  const career = blueprint.career.status === 'available' ? blueprint.career.data : null
  const nextSteps = blueprint.recommendedNextSteps.status === 'available' ? blueprint.recommendedNextSteps.data : null
  const parentActions = nextSteps?.actions ?? []
  const parentSummary = blueprint.parentSummary.status === 'available' ? blueprint.parentSummary.data : null
  const risk = blueprint.risk.status === 'available' ? blueprint.risk.data : null
  const pathwaySection = readSection(blueprint.pathwayReadiness, 'pathway readiness')

  // ── Q1 · Where are we now? ────────────────────────────────────────────────
  const noBridge = !!blueprint.academicRecord.unavailableReason?.toLowerCase().includes('bridged')
  const whereNowParagraphs = evidenceRecorded && academic
    ? describeAcademicPicture(name, academic)
    : noBridge
      ? [`We don’t yet have enough set up to build ${name}'s academic picture.`, 'Once the school links this learner’s record and a first assessment is recorded, this section will describe it.']
      : [`There isn’t yet enough recorded evidence to describe ${name}'s current academic picture — that will change as new assessments are added.`, 'This is not a judgement about how the learner is doing; it means no assessment has been recorded for this report yet.']

  const whereNow: ProgressReport['whereNow'] = {
    intro: audience === 'learner'
      ? 'What your recorded assessments show so far.'
      : audience === 'parent'
        ? `What ${name}'s recorded assessments show so far.`
        : 'Current position, from recorded assessment evidence.',
    paragraphs: whereNowParagraphs,
    subjects: bySubject.map(s => ({ subject: s.subject, label: subjectLabel(s.subject), level: s.latestLevel, levelLabel: voice.levelLabel[s.latestLevel] })),
    scaleNote: evidenceRecorded ? voice.scaleNote : null,
    transitionLine: evidenceRecorded ? transitionNote(voice) : null,
    latestEvidenceLine: latestEvidenceLabel ? `Most recent assessment on record: ${latestEvidenceLabel}.` : null,
    compassFocusLine: compass?.currentLearningFocus
      ? `Right now, ${name}'s active learning focus is ${subjectLabel(compass.currentLearningFocus.subject)}.`
      : null,
  }

  // ── Q2 · What's going well, and what needs help? ──────────────────────────
  const groupLevels = (levels: Array<1 | 2 | 3 | 4>): LevelGroup[] => levels
    .map(level => ({ levelLabel: voice.levelLabel[level], subjects: bySubject.filter(s => s.latestLevel === level).map(s => subjectLabel(s.subject)) }))
    .filter(group => group.subjects.length > 0)
  const goingWellList = groupLevels([4, 3])
  const needsHelpList = groupLevels([2, 1])
  const growth = blueprint.growthTimeline.status === 'available' ? blueprint.growthTimeline.data ?? [] : []

  const goingWell: ProgressReport['goingWell'] = {
    intro: audience === 'learner'
      ? 'Where you are doing well, and where some help would make a difference.'
      : audience === 'parent'
        ? `Where ${name} is doing well, and where support would help most.`
        : 'Strengths and priority areas in the recorded evidence.',
    paragraphs: evidenceRecorded && academic
      ? describeVariation(name, academic)
      : [`Nothing can be said yet about strengths or areas that need help — no assessment has been recorded for ${name} so far.`],
    goingWell: goingWellList,
    needsHelp: needsHelpList,
    listCaveat: !evidenceRecorded
      ? null
      : tier === 'first-snapshot'
        ? 'These come from one assessment: they describe how that assessment went, not a fixed judgement about any subject.'
        : 'These describe the most recent level recorded in each subject.',
    movement: growth.map(entry => entry.trajectory),
    watching: describeRiskForReader(risk, tier, evidenceRecorded),
    teacher: reflection
      ? {
          title: audience === 'learner' ? 'What your teacher has noticed' : audience === 'parent' ? `What ${name}'s teacher has noticed` : 'Teacher reflection on record',
          strengths: reflection.strengths,
          growthArea: reflection.growthArea,
          attribution: `${reflection.teacherSignature ? `${reflection.teacherSignature}'s` : 'The teacher’s'} own observation, written ${formatDate(reflection.publishedAt ?? reflection.writtenAt) ?? 'on an unrecorded date'}.`,
        }
      : null,
  }

  // ── Q3 · What do we do next? ──────────────────────────────────────────────
  // A teacher-approved plan step outranks the Compass suggestion. Steps past
  // their review date are not hidden — the teacher approved them — but they
  // rank after current ones and say plainly that they were due for review.
  const plan = (nextSteps?.plan ?? []).filter(step => visibleTo(step, audience))
  const orderedPlan = [...plan.filter(s => !isOverdue(s, asOf)), ...plan.filter(s => isOverdue(s, asOf))]
  const lead = orderedPlan[0] ?? null
  const compassPriority = describePriorityAction(name, compass)

  const teacherPlanLabel = audience === 'learner' ? 'From the plan your teacher approved' : `From the plan approved by ${name}'s teacher`
  let priority: ProgressReport['nextSteps']['priority'] = null
  if (lead) {
    const detail = audience === 'learner'
      ? lead.learnerView?.nextGoal ?? null
      : lead.parentView?.observation ?? lead.learnerView?.whyItMatters ?? null
    priority = {
      text: lead.title,
      detail,
      sourceLabel: teacherPlanLabel,
      reviewNote: lead.reviewDate
        ? isOverdue(lead, asOf)
          ? `This was due for review on ${formatDate(lead.reviewDate)} — check with the teacher whether it still applies.`
          : `To be reviewed by ${formatDate(lead.reviewDate)}.`
        : null,
    }
  } else if (compassPriority) {
    priority = { text: compassPriority, detail: null, sourceLabel: 'Suggested by Learning Compass', reviewNote: null }
  }

  const roles: RoleStep[] = []
  const learnerPlanStep = lead?.learnerView?.assignedActivity ?? null
  const compassStep = compass?.currentLearningFocus ? `Keep practising ${subjectLabel(compass.currentLearningFocus.subject)} in Learning Compass.` : null
  roles.push({
    role: 'learner',
    label: audience === 'learner' ? 'Your next step' : audience === 'parent' ? `${name}'s next step` : 'Learner',
    text: learnerPlanStep ?? compassStep,
    sourceLabel: learnerPlanStep ? teacherPlanLabel : compassStep ? 'Suggested by Learning Compass' : null,
    emptyText: audience === 'learner' ? 'Not set yet — your teacher can help you choose one.' : 'Not set yet.',
  })

  const teacherPlanText = audience !== 'learner' ? lead?.parentView?.whatTheSchoolWillDo ?? null : null
  roles.push({
    role: 'teacher',
    label: audience === 'learner' ? 'Your teacher' : audience === 'parent' ? 'The school' : 'Teacher',
    text: teacherPlanText ?? reflection?.recommendedSupport ?? null,
    sourceLabel: teacherPlanText ? teacherPlanLabel : reflection ? 'From the teacher’s reflection' : null,
    emptyText: 'No teacher support has been recorded in this report yet.',
  })

  if (audience !== 'learner') {
    const homePlanText = lead?.parentView?.homeSupport ?? null
    roles.push({
      role: 'home',
      label: audience === 'parent' ? 'At home' : 'Parent/guardian',
      text: homePlanText ?? parentSummary?.action ?? null,
      sourceLabel: homePlanText ? teacherPlanLabel : parentSummary?.action ? 'A general suggestion from this report' : null,
      emptyText: `No home activity has been set yet — ${name}'s teacher can suggest what would help most.`,
    })
  }

  const followOns: ReportItem[] = []
  const seen = new Set<string>()
  if (priority) seen.add(normalizeText(priority.text))
  for (const role of roles) if (role.text) seen.add(normalizeText(role.text))

  if (lead && compassPriority) {
    pushUnique(followOns, seen, { title: 'Learning Compass', detail: `Learning Compass also suggests: ${compassPriority.charAt(0).toLowerCase()}${compassPriority.slice(1)}`, href: null })
  }
  const continuedChallenge = academic ? describeContinuedChallenge(name, academic) : null
  pushUnique(followOns, seen, continuedChallenge ? { title: 'Continued challenge', detail: continuedChallenge, href: null } : null)
  if (reflection?.holidayFocus) pushUnique(followOns, seen, { title: 'Holiday focus', detail: reflection.holidayFocus, href: null })

  const attendancePct = blueprint.attendance.status === 'available' ? blueprint.attendance.data?.attendancePercentage ?? null : null
  if (attendancePct !== null && attendancePct < ATTENDANCE_ATTENTION_THRESHOLD_PERCENT) {
    pushUnique(followOns, seen, { title: 'Attendance', detail: `A little more consistency in attendance (currently ${attendancePct}%) would help protect the progress already showing.`, href: null })
  }

  const careerAction = describeCareerAction(name, career, parentActions, gradeBand)
  pushUnique(followOns, seen, careerAction ? { title: 'Career exploration', detail: careerAction, href: null } : null)

  // Parent-addressed actions ("your child…") go to the parent only.
  if (audience === 'parent') {
    for (const action of parentActions) {
      if (!PARENT_FOLLOW_ON_TYPES.includes(action.actionType) || action.priority === 'completed') continue
      const href = isActionDestinationValidForViewer(action.actionType, viewer) && isSafeInternalDestination(action.destination) ? action.destination : null
      pushUnique(followOns, seen, { title: action.title, detail: action.description, href })
    }
  }

  const nextStepsSection: ProgressReport['nextSteps'] = {
    intro: audience === 'learner'
      ? 'What you can do next, and how others will help.'
      : audience === 'parent'
        ? 'What happens next — at school and at home.'
        : 'Next steps for the learner, the teacher and the family.',
    priority,
    priorityEmpty: audience === 'learner'
      ? 'No specific next step has been set for you yet — your teacher can help you choose one from what your assessments show.'
      : `No specific next step has been set yet. The first step is for ${name}'s teacher to agree one, based on the evidence recorded so far.`,
    roles,
    followOns,
    followOnsEmpty: 'Nothing further is suggested yet — more will appear here as the term’s evidence builds up.',
  }

  // ── Q4 · Where is this leading? ───────────────────────────────────────────
  // Grades 7–9 (and an unknown grade) are never shown a career field: the
  // question at that stage is the Senior School pathway, not a career.
  const careerActionForLink = parentActions.find(a => a.actionType === 'explore_career_journey') ?? null
  const linkHref = careerActionForLink && isActionDestinationValidForViewer(careerActionForLink.actionType, viewer) && isSafeInternalDestination(careerActionForLink.destination)
    ? careerActionForLink.destination
    : null

  const doors: Array<{ label: string; summary: string }> = senior && career?.doorsPreview
    ? career.doorsPreview.map((door: CareerDoorPreview) => ({ label: DOOR_LABEL[door.type], summary: door.summary }))
    : []

  const futureEvidence: ReportItem[] = []
  if (blueprint.portfolio.status === 'available' && blueprint.portfolio.data) {
    const { publishedCount, featuredItem, latestItem } = blueprint.portfolio.data
    if (publishedCount > 0) {
      futureEvidence.push({
        title: 'Portfolio',
        detail: featuredItem
          ? `${publishedCount} published portfolio item${publishedCount === 1 ? '' : 's'}, with ${featuredItem.title} currently standing out.`
          : `${publishedCount} published portfolio item${publishedCount === 1 ? '' : 's'} already visible.`,
        href: null,
      })
    } else if (latestItem) {
      futureEvidence.push({ title: 'Portfolio', detail: `${latestItem.title} is the latest portfolio signal so far.`, href: null })
    }
  }
  if (blueprint.achievement.status === 'available' && blueprint.achievement.data) {
    const { achievementCount, highestLevelAchievement } = blueprint.achievement.data
    if (achievementCount > 0) {
      futureEvidence.push({
        title: 'Achievement',
        detail: highestLevelAchievement
          ? `${achievementCount} verified achievement${achievementCount === 1 ? '' : 's'}, including ${highestLevelAchievement.title}.`
          : `${achievementCount} verified achievement${achievementCount === 1 ? '' : 's'} so far.`,
        href: null,
      })
    }
  }

  const leading: ProgressReport['leading'] = {
    stageTitle: futurePageTitle(gradeBand),
    question: futurePageQuestion(gradeBand),
    framing: gradeBandFraming(gradeBand),
    directionTitle: senior ? 'Where the record points' : 'An early direction',
    direction: senior ? describeCareerDirection(name, career, gradeBand) : describePathwayDirection(name, bySubject, gradeBand),
    doors,
    doorsTitle: doors.length > 0 ? 'Four ways this could open after school' : null,
    aiChange: senior ? career?.aiChangeSummary ?? null : null,
    exploration: senior ? describeExplorationSuggestions(career?.explorationSuggestions ?? null) : null,
    pathwayReadiness: pathwaySection.status === 'available' ? pathwaySection.data : null,
    link: linkHref ? { href: linkHref, label: senior ? 'Explore career pathways and next steps →' : 'Explore Senior School pathways →' } : null,
    futureEvidence,
    closing: describeClosing(name, futureEvidence.length > 0, gradeBand),
  }

  // ── Printed School & Family Action Agreement ──────────────────────────────
  // Pre-filled only with what the teacher-approved plan step actually says,
  // and labelled as a proposal — nothing here is agreed until the meeting.
  const agreement: ProgressReport['agreement'] = {
    notice: 'Completed by hand during a meeting between the school and the family. Nothing on this page has been agreed until it is discussed there; any proposed step below comes from the teacher’s plan and can be changed or crossed out.',
    proposedLearnerStep: audience === 'parent' ? null : lead?.learnerView?.assignedActivity ?? null,
    proposedTeacherSupport: audience === 'learner' ? null : lead?.parentView?.whatTheSchoolWillDo ?? null,
    proposedHomeSupport: audience === 'learner' ? null : lead?.parentView?.homeSupport ?? null,
  }

  return {
    audience,
    name,
    gradeBand,
    evidence: { state, subjectCount: bySubject.length, assessmentCount, latestEvidenceLabel },
    whereNow,
    goingWell,
    nextSteps: nextStepsSection,
    leading,
    agreement,
  }
}
