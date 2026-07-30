// components/blueprint/blueprintNarrative.ts
//
// Presentation-only interpretive copy for the four-page Blueprint
// (BlueprintView.tsx). Every function here is a pure string transform over
// data composeBlueprint() already returned — no new computation, no new
// database reads, no change to the meaning of any source field.
//
// Core rule (non-negotiable, per the four-page redesign brief): one genuine
// assessment is enough for an honest interpretation. `trend:
// "insufficient_data"` means the DIRECTION of change isn't known yet — the
// level itself is real and known. These functions never translate that
// into "no data"/"insufficient data"/"unavailable"/"N/A", and never expose
// a raw confidence percentage, composer name, owner, or evidence ID to the
// reader. Confidence/maturity is communicated by how a sentence is
// written, not by a badge or a number.

import type {
  AcademicRecordData,
  CareerData,
  CareerDoorPreview,
  LearningCompassData,
  RiskData,
  SubjectRecord,
} from '@/lib/learnerBlueprint/types'
import type { ParentAction } from '@/lib/parentExperience/actions'

export type EvidenceMaturityTier = 'first-snapshot' | 'growing' | 'well-supported' | 'long-term'

/**
 * Some legacy `students.name` rows were entered fully in caps ("TUCYLA
 * NYAWIRA") — printed verbatim into prose that reads as shouting ("TUCYLA's
 * current picture..."). Only intervenes when the source is genuinely
 * all-caps; a name with real mixed-case capitalization (e.g. "O'Brien",
 * "McDonald") is never touched, so this can't corrupt an already-correct
 * name.
 */
export function toDisplayName(rawName: string | null): string | null {
  if (!rawName) return null
  if (rawName !== rawName.toUpperCase()) return rawName
  return rawName
    .toLowerCase()
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}

export function firstName(fullName: string | null): string {
  if (!fullName) return 'Your learner'
  return fullName.trim().split(/\s+/)[0] || fullName
}

// Known irregular CBC subject labels — acronyms and multi-word names the
// generic slug->label title-caser would otherwise get wrong ("Cre" instead
// of "CRE", "Agriculture Nutrition" instead of "Agriculture & Nutrition").
// Sourced from lib/curriculum/subjects.ts's CBC_JUNIOR_CORE/CBC_JUNIOR_RELIGION
// naming, not invented here.
const SUBJECT_LABEL_OVERRIDES: Record<string, string> = {
  cre: 'CRE',
  ire: 'IRE',
  hre: 'HRE',
  agriculture_nutrition: 'Agriculture & Nutrition',
  pre_technical_studies: 'Pre-Technical Studies',
  creative_arts_sports: 'Creative Arts & Sports',
}

export function subjectLabel(slug: string): string {
  const override = SUBJECT_LABEL_OVERRIDES[slug.toLowerCase()]
  if (override) return override
  return slug
    .split('_')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}

function joinNatural(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// CBC's own 1-4 rubric, described in plain educational meaning rather than
// a bare number — Level 3 is "secure," never framed as a deficit next to a
// Level 4 subject.
export const CBC_LEVEL_PHRASE: Record<1 | 2 | 3 | 4, string> = {
  4: 'strong, already exceeding what’s expected at this stage',
  3: 'secure, meeting what’s expected at this stage',
  2: 'approaching what’s expected, with support closing the gap',
  1: 'still building the basics expected at this stage',
}

export function groupSubjectsByLevel(bySubject: SubjectRecord[]): Record<1 | 2 | 3 | 4, string[]> {
  const groups: Record<1 | 2 | 3 | 4, string[]> = { 4: [], 3: [], 2: [], 1: [] }
  for (const subject of bySubject) {
    groups[subject.latestLevel].push(subjectLabel(subject.subject))
  }
  return groups
}

/**
 * How established the current picture is, derived only from the evidence
 * counts Projection already computed per subject — a labeling function,
 * not a new intelligence computation. Thresholds are presentation
 * defaults, tunable without touching any composer.
 */
export function evidenceMaturityTier(bySubject: SubjectRecord[]): EvidenceMaturityTier {
  const maxCount = bySubject.reduce((max, s) => Math.max(max, s.evidenceCount), 0)
  if (maxCount <= 1) return 'first-snapshot'
  if (maxCount === 2) return 'growing'
  if (maxCount === 3) return 'well-supported'
  return 'long-term'
}

export function maturitySentence(tier: EvidenceMaturityTier, subjectCount: number): string {
  const subjects = subjectCount === 1 ? 'one subject' : `${subjectCount} subjects`
  switch (tier) {
    case 'first-snapshot':
      return `This is an early snapshot, based on one assessment across ${subjects}. Future assessments will show how this picture changes over time.`
    case 'growing':
      return `This picture is starting to take shape, built from two rounds of evidence across ${subjects} — enough to notice a direction forming, though not yet a settled pattern.`
    case 'well-supported':
      return `This picture now rests on a broader, more consistent body of evidence across ${subjects}.`
    case 'long-term':
      return `This reflects a well-established learning record, built up over several rounds of evidence across ${subjects}.`
  }
}

/** Page 1 — the opening academic picture, strengths named first, never a table-first read. */
export function describeAcademicPicture(name: string, data: AcademicRecordData): string[] {
  const groups = groupSubjectsByLevel(data.bySubject)
  const subjectCount = data.bySubject.length
  if (subjectCount === 0) return []

  const paragraphs: string[] = []

  if (groups[4].length > 0) {
    paragraphs.push(`${name}'s current picture shows real strength in ${joinNatural(groups[4])} — ${CBC_LEVEL_PHRASE[4]}.`)
  }

  const secureGroups = [...groups[3], ...groups[2]]
  if (secureGroups.length > 0) {
    const label = groups[3].length > 0 && groups[2].length === 0 ? CBC_LEVEL_PHRASE[3] : 'secure or building steadily toward what’s expected'
    paragraphs.push(
      groups[4].length > 0
        ? `${name} is working securely in ${joinNatural(secureGroups)} — ${label}, with more room still to stretch.`
        : `${name} is currently working across ${joinNatural(secureGroups)}, ${label}.`,
    )
  }

  if (groups[1].length > 0) {
    paragraphs.push(`${joinNatural(groups[1])} ${groups[1].length === 1 ? 'is' : 'are'} still building the basics expected at this stage — the right kind of focus, not a setback.`)
  }

  paragraphs.push(maturitySentence(evidenceMaturityTier(data.bySubject), subjectCount))

  return paragraphs
}

/** Page 2 — variation across subjects, explained honestly without a trend claim the evidence can't yet support. */
export function describeVariation(name: string, data: AcademicRecordData): string[] {
  const groups = groupSubjectsByLevel(data.bySubject)
  const tier = evidenceMaturityTier(data.bySubject)
  const paragraphs: string[] = []

  if (data.overallTrend && data.overallTrend !== 'insufficient_data' && data.overallTrend !== 'mixed') {
    const trendWord = data.overallTrend === 'improving' ? 'steady improvement' : data.overallTrend === 'declining' ? 'an area that now needs closer attention' : 'a steady, settled pattern'
    paragraphs.push(`The pattern across this record is one of ${trendWord}.`)
  } else if (data.overallTrend === 'mixed') {
    paragraphs.push(`The current pattern is mixed — moving forward in some subjects, needing closer attention in others.`)
  } else if (tier === 'first-snapshot') {
    paragraphs.push(`${name}'s first assessment shows some variation across subjects.`)
  } else {
    paragraphs.push(`${name}'s record so far shows some variation across subjects, without yet enough rounds of evidence to call it a settled direction.`)
  }

  if (groups[4].length > 0 && (groups[3].length > 0 || groups[2].length > 0)) {
    const secondary = [...groups[3], ...groups[2]]
    paragraphs.push(
      `${joinNatural(secondary)} ${secondary.length === 1 ? 'reads' : 'read'} lower than ${joinNatural(groups[4])} in the current evidence, but ${secondary.length === 1 ? 'stays' : 'stay'} just as real and capable — this is an enrichment opportunity in the stronger subjects, or continued challenge in the others, never a gap to worry about.`,
    )
  }

  paragraphs.push(
    tier === 'first-snapshot'
      ? 'No reliable trend can be described yet — that becomes possible once at least two rounds of assessment exist to compare.'
      : 'This picture will keep sharpening as more rounds of evidence arrive.',
  )

  return paragraphs
}

export function describeRiskForReader(risk: RiskData | null, tier: EvidenceMaturityTier): { headline: string; details: string[] } {
  const earlyQualifier = tier === 'first-snapshot' || tier === 'growing'
    ? 'This is an early picture, not a permanent conclusion — we’ll keep watching as more evidence arrives.'
    : 'We’ll keep watching as new evidence arrives, and update this if anything changes.'

  if (!risk || risk.flags.length === 0) {
    return { headline: 'No current concern pattern is visible in this first snapshot.', details: [earlyQualifier] }
  }

  return {
    headline: 'A couple of areas are worth watching closely alongside everything going well.',
    details: [
      ...risk.flags.map((flag) => `${flag.subject ?? 'One area'} — ${flag.reason}`),
      earlyQualifier,
    ],
  }
}

/**
 * Page 4 — an early exploration signal, never a career verdict. One
 * compact sentence, not two — the uncertainty framing ("early," "may
 * change") is stated once here and must not be repeated elsewhere on the
 * page (the page's closing transition covers the forward-looking half of
 * that idea instead of restating it).
 */
export function describeCareerDirection(name: string, career: CareerData | null): string[] {
  if (!career || !career.careerCluster) {
    return [`${name}'s interests and strengths are still coming into focus — there isn’t yet a clear early direction to name, and that’s completely normal this early.`]
  }
  return [
    `${name}'s current record suggests ${career.careerCluster} as one direction worth exploring. It is an early signal that future assessments, projects and experiences may sharpen or change.`,
  ]
}

export const DOOR_LABEL: Record<CareerDoorPreview['type'], string> = {
  employment: 'Employment',
  self_employment: 'Self-employment',
  entrepreneurship: 'Entrepreneurship',
  ai_era: 'AI-augmented work',
}

/** Real subjects worth strengthening, from the matched career's own required_subjects — never derived from a gap/weakness judgment. */
export function describeExplorationSuggestions(subjects: string[] | null): string | null {
  if (!subjects || subjects.length === 0) return null
  return `Worth exploring next: ${joinNatural(subjects)}.`
}

/**
 * Page 4's closing line — replaces two previously separate sentences (a
 * "wider strengths will become clearer" fallback shown only when there's
 * no published future evidence yet, and a generic "this picture will keep
 * growing" line shown always) with one, rendered once in the page's own
 * transition slot rather than as a third paragraph. When real future
 * evidence already exists (portfolio/achievement/etc.), the "wider
 * strengths" clause would be redundant with what's already on the page, so
 * a shorter generic line is used instead.
 */
export function describeClosing(name: string, hasFutureEvidence: boolean): string {
  return hasFutureEvidence
    ? 'This picture will keep growing — new evidence will sharpen and expand it over time.'
    : `As ${name} adds projects, interests and experiences, this direction — and the wider strengths behind it — will become clearer.`
}

/** Page 3 — the one priority action, always grounded in the current learning focus. */
export function describePriorityAction(name: string, compass: LearningCompassData | null): string | null {
  if (compass?.currentLearningFocus?.subject) {
    return `Continue ${name}'s ${subjectLabel(compass.currentLearningFocus.subject)} learning focus with targeted practice and feedback.`
  }
  return null
}

export function describeContinuedChallenge(name: string, data: AcademicRecordData): string | null {
  const strengths = groupSubjectsByLevel(data.bySubject)[4]
  if (strengths.length === 0) return null
  return `Continued challenge in ${joinNatural(strengths)} may follow, to keep building on real strength.`
}

export function describeCareerAction(name: string, career: CareerData | null, actions: ParentAction[]): string | null {
  const hasCareerAction = actions.some((a) => a.actionType === 'explore_career_journey')
  if (!hasCareerAction && !career?.careerCluster) return null
  const cluster = career?.careerCluster ?? 'this early direction'
  return `Career exploration — ${cluster} — is worth exploring together, but only as one early, non-binding signal among many.`
}
