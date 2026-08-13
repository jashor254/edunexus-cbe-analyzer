// lib/learnerBlueprint/composePathwayReadiness.ts
//
// Where this learner stands against the senior-school pathway decision.
//
// The gap this closes
// -------------------
// `lib/pathwayCalculator.ts` has computed KJSEA composites, pathway affinity
// and single-subject "key lever" gap analysis for a long time. Nothing in
// lib/learnerBlueprint/, components/blueprint/ or components/parent/ imported
// any of it — confirmed by search. So the Blueprint told a Grade 9 learner,
// in the term they must choose a national pathway, about a "career cluster,"
// while the engine that could answer the actual question sat unused one import
// away. This composer is that import. It adds no new intelligence.
//
// Why the section changes shape by grade band
// -------------------------------------------
// `gradeBand.ts` already establishes the asymmetry this must obey: for a junior
// learner a pathway is a FORECAST with a gap still worth closing; for a senior
// learner it is a SETTLED FACT. Showing a Grade 11 a pathway-readiness gap
// implies they are in the wrong school about something they cannot change.
//
//   grade_7_8    No forecast. Grade 7-8 School-Based Assessment already counts
//                toward placement and families routinely do not know that, so
//                the honest and useful message is "this work is already being
//                banked" — not a projection off two terms of evidence.
//   grade_9      The decision year. Full forecast: composite, what it currently
//                qualifies for, and the single subject improvement that would
//                open the next pathway.
//   grade_10+    Unavailable BY DESIGN, with a reason saying so. Not a failure.
//
// The honesty constraints this section is under
// ---------------------------------------------
// The active KJSEA rule set is PROVISIONAL (lib/config/kjseaRules.ts): its
// gates come from secondary reporting, not a primary KNEC circular. That file's
// verification contract is explicit — no learner-facing surface may present a
// placement projection derived from a provisional rule set as a statement of
// fact. So every field here travels with `ruleSetVerified` and the disclaimer,
// and the renderer is required to show them.
//
// Two further honesty flags come from the calculator itself and are carried
// rather than smoothed over: `isPartialComposite` (fewer than 9 KJSEA subject
// groups have evidence, so the composite is a floor, not a score) and
// `compositeUnderstated` (levels alone cannot separate EE1 from EE2, so the
// true composite may be higher than the one shown).

import {
  calculatePathwayGapAnalysis,
  buildPathwayDisclaimer,
  isCompositeUnderestimated,
  countKJSEASubjectsEntered,
  type PathwayNextDoor,
} from '@/lib/pathwayCalculator'
import { getActiveKjseaRuleSet, isKjseaRuleSetVerified } from '@/lib/config/kjseaRules'
import { isSeniorBand, type BlueprintGradeBand } from './gradeBand'
import type { BlueprintSection, PathwayReadinessData, SubjectRecord } from './types'

const OWNER = 'lib/pathwayCalculator.calculatePathwayGapAnalysis'

/**
 * Below this many KJSEA subject groups, a composite says more about how much
 * evidence we happen to hold than about the learner. Three is the point at
 * which a floor becomes worth showing at all — under it the section stays
 * unavailable rather than publishing a number that will move sharply with the
 * next assessment.
 */
const MIN_SUBJECT_GROUPS_FOR_FORECAST = 3

/**
 * Projection reports subjects by display name; the pathway calculator keys on
 * canonical KJSEA subject keys. `normalizeSubjectScores` inside the calculator
 * handles alias mapping, but it cannot map "Integrated Science" with a space
 * and a capital, so the shape is lowered here first.
 */
function toSubjectScores(bySubject: SubjectRecord[]): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const record of bySubject) {
    const key = record.subject.trim().toLowerCase().replace(/[\s&]+/g, '_')
    // A learner can hold evidence for the same subject under two spellings;
    // the stronger level wins rather than whichever happened to be last.
    scores[key] = Math.max(scores[key] ?? 0, record.latestLevel)
  }
  return scores
}

export function composePathwayReadiness(
  gradeBand: BlueprintGradeBand,
  bySubject: SubjectRecord[],
): BlueprintSection<PathwayReadinessData> {
  // Senior learners are already placed. This is the ADR-0007-style "correctly
  // absent" case: the section is unavailable because the question is closed,
  // not because composition failed.
  if (isSeniorBand(gradeBand)) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: 'This learner has already been placed into a senior school pathway. Pathway readiness is a junior-school question, and showing a gap here would imply a decision they can no longer make.',
    }
  }

  if (gradeBand === 'unknown') {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: 'This learner\'s grade could not be determined, so we cannot tell whether the pathway question is still open for them.',
    }
  }

  const scores = toSubjectScores(bySubject)
  const subjectsEntered = countKJSEASubjectsEntered(scores)

  if (subjectsEntered < MIN_SUBJECT_GROUPS_FOR_FORECAST) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: `Pathway readiness needs evidence across at least ${MIN_SUBJECT_GROUPS_FOR_FORECAST} of the 9 KJSEA subject groups; this learner currently has ${subjectsEntered}. A composite built on less would describe our records, not the learner.`,
    }
  }

  const ruleSet = getActiveKjseaRuleSet()
  const analysis = calculatePathwayGapAnalysis(scores)
  const disclaimer = buildPathwayDisclaimer(ruleSet)

  // Grade 7-8: the composite is real and worth banking, but a pathway forecast
  // off this much evidence is a guess wearing a number. Withhold the
  // recommendation, keep the "this already counts" message.
  const forecastOpen = gradeBand === 'grade_9'

  const data: PathwayReadinessData = {
    gradeBand,
    stage: forecastOpen ? 'decision_year' : 'accumulating',
    compositeScore: analysis.compositeScore,
    kjseaMaxScore: analysis.kjseaMaxScore,
    subjectsEntered: analysis.subjectsEntered,
    subjectGroupsTotal: 9,
    isPartialComposite: analysis.isPartialComposite,
    compositeUnderstated: isCompositeUnderestimated(scores),
    recommendedPathway: forecastOpen ? analysis.recommendedPathway : null,
    qualifiesFor: forecastOpen ? analysis.qualifiesFor : [],
    nextDoor: forecastOpen ? toNextDoor(analysis.nextPathway) : null,
    ruleSetCycle: ruleSet.cycle,
    ruleSetVerified: isKjseaRuleSetVerified(ruleSet),
    disclaimer: disclaimer.short,
    disclaimerFull: disclaimer.full,
    source: disclaimer.source,
    stageMessage: forecastOpen
      ? 'This is the year the senior school pathway is decided. The figures below are a planning aid, not a placement result.'
      : 'It is too early to project a pathway, and we are not going to guess one. What matters at this stage is that the assessment recorded in Grades 7 and 8 already counts toward placement — families often do not realise this until Grade 9.',
    notes: buildNotes(analysis.isPartialComposite, isCompositeUnderestimated(scores), isKjseaRuleSetVerified(ruleSet)),
  }

  return { status: 'available', owner: OWNER, freshness: 'live', data }
}

function toNextDoor(next: PathwayNextDoor | null): PathwayReadinessData['nextDoor'] {
  if (!next) return null
  return {
    pathway: next.name,
    pointsShort: next.currentGap,
    unlockMessage: next.unlockMessage,
    keyLever: {
      subject: next.keyLever.subject,
      currentLevel: next.keyLever.currentLevel,
      targetLevel: next.keyLever.targetLevel,
      pointsGained: next.keyLever.pointsGained,
      wouldUnlock: next.keyLever.wouldUnlock,
    },
  }
}

function buildNotes(partial: boolean, understated: boolean, verified: boolean): string[] {
  const notes: string[] = []
  if (partial) {
    notes.push('Not every KJSEA subject has evidence yet, so this composite is a floor — it can only go up as more subjects are assessed.')
  }
  if (understated) {
    notes.push('Some subjects are recorded as a level rather than a mark, and a level cannot separate the top of a band from the bottom. The true composite may be higher than the figure shown.')
  }
  if (!verified) {
    notes.push('The placement thresholds used here come from reported KJSEA criteria that we have not yet confirmed against an official KNEC publication.')
  }
  return notes
}
