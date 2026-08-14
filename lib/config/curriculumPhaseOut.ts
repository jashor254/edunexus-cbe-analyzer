// lib/config/curriculumPhaseOut.ts
//
// Kenya's 8-4-4 phase-out, as a dated and sourced rule set rather than as
// assumptions scattered through the code.
//
// Why this file exists
// --------------------
// In 2026 a Kenyan secondary school genuinely holds two curricula at once:
// Form 3 and Form 4 finishing under 8-4-4, and Grade 10 beginning under CBE.
// That is not a migration artefact to be cleaned up — it is the real situation
// in real schools, and it has a known end date. Any code that treats "the
// curriculum" as one global setting will be wrong for one of those cohorts.
//
// Equally, anything that hardcodes "8-4-4 exists" becomes wrong in 2028, and
// anything that hardcodes "everything is CBE" is wrong for a Form 4 learner
// sitting KCSE this year. Both failures are avoided by stating the timeline
// once, with its source, and asking it.
//
// The commitment this encodes
// ---------------------------
// 8-4-4 learners are served properly until their last exam, not deprecated
// early for the convenience of the newer curriculum. A Form 4 learner has one
// year left and it is the most consequential year of their schooling; the
// product owes them the same quality as a Grade 10 learner with three years
// ahead. What this file prevents is the opposite error too — building new
// long-term 8-4-4 capability for a system with a fixed end date.
//
// Verification contract
// ---------------------
// Same discipline as lib/config/kjseaRules.ts: `status` says whether these
// dates were confirmed against a primary KNEC/Ministry publication or come
// from secondary reporting. Nothing here may be presented to a family as
// certain while it is `provisional`.

export type PhaseOutStatus = 'provisional' | 'verified' | 'superseded'

/** Which curriculum a learner is actually studying under. */
export type EducationSystem = 'cbe' | '844'

export type CurriculumPhaseOutRules = {
  status: PhaseOutStatus
  /** The final year 8-4-4's terminal exam (KCSE) is sat, including resits. */
  finalKcseYear: number
  /** First year of CBE's terminal exam (KCBE), for the Grade 10 pioneer cohort. */
  firstKcbeYear: number
  /**
   * Forms still expected to hold learners, by calendar year. A form absent
   * from this list should no longer exist — seeing one is a data problem worth
   * surfacing, not a state to support.
   */
  remainingFormsByYear: Record<number, number[]>
  sources: string[]
  notes: string
}

/**
 * The phase-out as publicly reported. **Provisional** — assembled from press
 * reporting on KNEC statements, not from a primary KNEC circular. The dates
 * are consistent across several outlets but have not been checked against an
 * official publication.
 */
export const CURRICULUM_PHASE_OUT: CurriculumPhaseOutRules = {
  status: 'provisional',
  finalKcseYear: 2027,
  firstKcbeYear: 2028,
  remainingFormsByYear: {
    2026: [3, 4],
    2027: [4],
    // 2028 onward: no 8-4-4 learners remain. Deliberately absent rather than
    // listed as an empty array, so `formsRemainingIn()` answers "none" from
    // the same code path for 2028 and for 2035.
  },
  sources: [
    'Daily Nation — "Countdown to the last KCSE: only two years left under 8-4-4"',
    'Eastleigh Voice — "KNEC gives Kenyans until 2027 to resit KCSE exams before end of 8-4-4 system"',
    'The Star — "EXPLAINER: From KCSE to KCBE"',
  ],
  notes:
    'The last 8-4-4 cohort was in Form 3 during 2026 and sits the final KCSE in 2027. '
    + '2027 is also the last opportunity to repeat or complete KCSE. The first KCBE follows in 2028, '
    + 'for the learners who began Senior School as Grade 10 in 2026.',
}

/** Which forms should still hold learners in a given calendar year. */
export function formsRemainingIn(
  year: number,
  rules: CurriculumPhaseOutRules = CURRICULUM_PHASE_OUT,
): number[] {
  return rules.remainingFormsByYear[year] ?? []
}

/** Whether any 8-4-4 learner is still in school in a given year. */
export function eightFourFourStillRunning(
  year: number,
  rules: CurriculumPhaseOutRules = CURRICULUM_PHASE_OUT,
): boolean {
  return formsRemainingIn(year, rules).length > 0
}

/**
 * Whether a form is one the phase-out still expects to exist.
 *
 * A Form 1 or Form 2 in 2026 is not a supported state — no new 8-4-4 intake
 * has happened for years — so this returns false and the caller should treat
 * it as a roster problem rather than quietly rendering an 8-4-4 document for a
 * learner who cannot be one.
 */
export function isExpectedForm(
  form: number,
  year: number,
  rules: CurriculumPhaseOutRules = CURRICULUM_PHASE_OUT,
): boolean {
  return formsRemainingIn(year, rules).includes(form)
}

/**
 * How many more years this learner has under 8-4-4, counting the year they
 * sit KCSE. Null once the system has ended.
 */
export function yearsLeftUnder844(
  year: number,
  rules: CurriculumPhaseOutRules = CURRICULUM_PHASE_OUT,
): number | null {
  if (!eightFourFourStillRunning(year, rules)) return null
  return Math.max(0, rules.finalKcseYear - year)
}
