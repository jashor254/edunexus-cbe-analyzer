// lib/learnerBlueprint/curriculumVoice.ts
//
// Which vocabulary this learner's report should speak.
//
// The problem
// -----------
// The Academic Record labelled every learner's level with CBC's four rubric
// words — "Exceeding Expectations", "Meeting Expectations", and so on. Those
// are exactly right for a CBE learner: they are KICD's own words, the same
// ones used in that learner's classroom. They are wrong for a Form 3 learner
// under 8-4-4, whose school has never used them. A document that describes a
// child in vocabulary their school does not use is not a small style problem;
// it is the reader's first signal that this was written for somebody else.
//
// Why the class name decides it, and not a school setting
// -------------------------------------------------------
// A Kenyan secondary school in 2026 genuinely holds both systems at once —
// Form 3 and Form 4 finishing under 8-4-4, Grade 10 starting under CBE, on the
// same roll. So "which curriculum" is not a property of the school; it is a
// property of the learner, and the roster already records it in the only place
// that is reliably true: whether the class is called a Grade or a Form.
//
// `extractGradeLevel()` in gradeBand.ts deliberately maps Form 1-4 onto Grades
// 9-12 so an 8-4-4 senior is not treated as `unknown`. That mapping is right
// for deciding STAGE, and it necessarily discards WHICH WORD the school used —
// which is the one thing needed here. So this module reads the class name
// again for that single fact rather than changing what gradeBand returns.
//
// What we will not claim
// ----------------------
// We do not print a KCSE mean grade. Converting a mark into A/B+/C requires
// the school's own grade scale, and `teacher_grade_scales` holds two rows in
// the entire database — so for practically every school we would be inventing
// the boundaries. A parent shown "B+" would reasonably believe their school
// said so. Instead an 8-4-4 learner sees the real mark, which is unambiguous
// and ours to report, described in four bands using words their school does
// use, with an explicit line saying this is not their KCSE grade.

import {
  CURRICULUM_PHASE_OUT,
  eightFourFourStillRunning,
  isExpectedForm,
  yearsLeftUnder844,
  type EducationSystem,
} from '@/lib/config/curriculumPhaseOut'

export type CurriculumVoice = {
  system: EducationSystem
  /** The four level labels this learner's school actually uses. */
  levelLabel: Record<1 | 2 | 3 | 4, string>
  /**
   * One line naming the scale, so a reader is never left guessing what a level
   * means. Null for CBE, where the rubric words are self-explanatory and
   * already familiar from the classroom.
   */
  scaleNote: string | null
  /**
   * Set only for 8-4-4 learners: how many years remain before the final KCSE.
   * Lets a report acknowledge the transition without alarming anyone.
   */
  yearsToFinalKcse: number | null
  /**
   * True when the roster says something the phase-out says cannot be true —
   * a Form 1 or Form 2 in a year when no such cohort exists. The report still
   * renders; this flags the data, not the learner.
   */
  rosterLooksWrong: boolean
}

/** KICD's own rubric wording. Correct and familiar for a CBE learner. */
const CBE_LEVEL_LABEL: Record<1 | 2 | 3 | 4, string> = {
  4: 'Exceeding Expectations',
  3: 'Meeting Expectations',
  2: 'Approaching Expectations',
  1: 'Below Expectations',
}

/**
 * Plain performance words an 8-4-4 school already uses. Taken from the same
 * vocabulary `GRADE_META` (lib/assessments/gradeCalculator.ts) attaches to
 * KCSE letter grades, so the register matches — without asserting the letter
 * itself, which we cannot know.
 */
const EIGHT_FOUR_FOUR_LEVEL_LABEL: Record<1 | 2 | 3 | 4, string> = {
  4: 'Excellent',
  3: 'Good',
  2: 'Average',
  1: 'Below Average',
}

const EIGHT_FOUR_FOUR_SCALE_NOTE =
  'These are four performance bands based on the marks recorded this term. They are not a KCSE grade — '
  + 'that comes from the national examination, not from this report.'

/**
 * Which system a class name belongs to.
 *
 * "Form 3" is 8-4-4; "Grade 10" is CBE. Anything unreadable falls back to CBE,
 * which is the correct default from 2028 onward and the majority case well
 * before that — and, unlike guessing 8-4-4, it degrades toward the system the
 * country is actually moving to.
 */
export function systemFromClassName(className: string | null): EducationSystem {
  if (!className) return 'cbe'
  if (/form\s*\d/i.test(className)) return '844'
  return 'cbe'
}

/** The form number in a class name, or null when it is not a Form class. */
export function formNumberFromClassName(className: string | null): number | null {
  if (!className) return null
  const match = className.match(/form\s*(\d{1,2})/i)
  if (!match) return null
  const value = Number(match[1])
  return value >= 1 && value <= 4 ? value : null
}

/**
 * Resolve the vocabulary for a learner.
 *
 * `year` is injectable so a stored snapshot can be re-read against the year it
 * was written — a Form 4 report from 2026 must keep making sense in 2029, when
 * 8-4-4 no longer exists.
 */
export function resolveCurriculumVoice(
  className: string | null,
  year: number = new Date().getFullYear(),
): CurriculumVoice {
  const system = systemFromClassName(className)

  if (system === 'cbe') {
    return {
      system: 'cbe',
      levelLabel: CBE_LEVEL_LABEL,
      scaleNote: null,
      yearsToFinalKcse: null,
      rosterLooksWrong: false,
    }
  }

  const form = formNumberFromClassName(className)
  // A Form class in a year where 8-4-4 has ended, or a Form 1/2 that no longer
  // has an intake, is a roster problem. We still speak 8-4-4 to them — the
  // class name is what the school itself wrote, and overriding it would be
  // telling a school it is wrong about its own learner — but we mark it.
  const rosterLooksWrong =
    !eightFourFourStillRunning(year) || (form !== null && !isExpectedForm(form, year))

  return {
    system: '844',
    levelLabel: EIGHT_FOUR_FOUR_LEVEL_LABEL,
    scaleNote: EIGHT_FOUR_FOUR_SCALE_NOTE,
    yearsToFinalKcse: yearsLeftUnder844(year),
    rosterLooksWrong,
  }
}

/**
 * One sentence acknowledging the transition, for an 8-4-4 learner's report.
 *
 * Deliberately calm and free of any suggestion that this learner is on a
 * lesser path. They are finishing a system on its published timetable, which
 * is an ordinary fact about a date, not a judgement about them. Returns null
 * for CBE learners and once the phase-out is over.
 */
export function transitionNote(voice: CurriculumVoice): string | null {
  if (voice.system !== '844' || voice.yearsToFinalKcse === null) return null

  if (voice.yearsToFinalKcse <= 0) {
    return `This learner sits KCSE this year, in the final ${CURRICULUM_PHASE_OUT.finalKcseYear} examination under 8-4-4.`
  }
  const years = voice.yearsToFinalKcse
  return `This learner is completing 8-4-4, with KCSE in ${CURRICULUM_PHASE_OUT.finalKcseYear} — ${years} year${years === 1 ? '' : 's'} from now. Their report uses the marks and bands their school works with.`
}
