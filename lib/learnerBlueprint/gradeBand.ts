// lib/learnerBlueprint/gradeBand.ts
//
// Which stage of the Kenyan CBE journey a learner is at, and therefore which
// question their Blueprint is actually answering.
//
// Why this is a domain concern and not view copy
// ----------------------------------------------
// This used to be a private helper inside BlueprintView.tsx driving exactly
// one sentence. It now decides section CONTENT, not just wording, so it has to
// be resolved once, in the composer, and carried on the Blueprint — otherwise
// two renders of the same learner (teacher page, parent page, a stored
// snapshot) could disagree about what stage they are at.
//
// Why four bands and not two
// --------------------------
// "Junior vs senior" is too coarse at both ends, because the learner's
// relationship to the placement decision changes four times:
//
//   grade_7_8    Placement is distant, but School-Based Assessment from these
//                grades already counts toward it. Evidence is accumulating
//                with consequences the family is usually unaware of. Too early
//                to project a pathway; not too early to say the work counts.
//   grade_9      The decision year. KJSEA sits at the end of it and the
//                pathway question is live, gated and answerable.
//   grade_10     Already placed. Newly arrived in a pathway that may or may not
//                be the one they wanted. Fit is the question, and it is the
//                last point at which raising a genuine mismatch is useful.
//   grade_11_12  Pathway is closed. Performance within it, and the destination
//                after it, are the only live questions.
//
// The critical asymmetry this encodes: for a junior learner "pathway" is a
// FORECAST with a gap to close, and for a senior learner it is a SETTLED FACT.
// Showing a Grade 11 a pathway-readiness gap implies they are in the wrong
// school about something they largely cannot change — worse than useless.

export type BlueprintGradeBand = 'grade_7_8' | 'grade_9' | 'grade_10' | 'grade_11_12' | 'unknown'

/** Junior school under CBE — Grades 7-9, ending in KJSEA. */
const JUNIOR_BANDS: ReadonlySet<BlueprintGradeBand> = new Set<BlueprintGradeBand>(['grade_7_8', 'grade_9'])
/** Senior school — Grades 10-12, already placed into a pathway. */
const SENIOR_BANDS: ReadonlySet<BlueprintGradeBand> = new Set<BlueprintGradeBand>(['grade_10', 'grade_11_12'])

/**
 * Pulls a numeric grade out of a class name. Handles both CBE ("Grade 9",
 * "Grade 9Y") and the 8-4-4 vocabulary still in use in some senior schools
 * ("Form 3"), because a school mid-transition has both on its roll.
 *
 * Form 1-4 maps onto Grades 9-12 so that an 8-4-4 senior learner is not
 * treated as `unknown` and silently given junior framing.
 */
export function extractGradeLevel(className: string | null): number | null {
  if (!className) return null

  const grade = className.match(/grade\s*(\d{1,2})/i)
  if (grade) {
    const value = Number(grade[1])
    return value >= 1 && value <= 12 ? value : null
  }

  const form = className.match(/form\s*(\d{1,2})/i)
  if (form) {
    const value = Number(form[1])
    // Form 1 sits alongside Grade 9 as the pre-senior year; Form 4 alongside Grade 12.
    return value >= 1 && value <= 4 ? value + 8 : null
  }

  return null
}

export function getGradeBand(className: string | null): BlueprintGradeBand {
  const grade = extractGradeLevel(className)
  if (grade === null) return 'unknown'
  if (grade >= 7 && grade <= 8) return 'grade_7_8'
  if (grade === 9) return 'grade_9'
  if (grade === 10) return 'grade_10'
  if (grade >= 11 && grade <= 12) return 'grade_11_12'
  return 'unknown'
}

export function isJuniorBand(band: BlueprintGradeBand): boolean {
  return JUNIOR_BANDS.has(band)
}

export function isSeniorBand(band: BlueprintGradeBand): boolean {
  return SENIOR_BANDS.has(band)
}

/**
 * Whether a pathway claim may be framed as something still to be earned.
 *
 * True only in junior school. For a senior learner the pathway is already
 * decided, so any "readiness" framing is retrospective judgement on a
 * placement they cannot act on — never shown. `unknown` is deliberately false:
 * when we cannot tell what stage a learner is at, we do not speculate about
 * their placement.
 */
export function pathwayIsStillOpen(band: BlueprintGradeBand): boolean {
  return isJuniorBand(band)
}

/**
 * One line naming what this stage is actually about, shared by every render so
 * teacher, parent and learner views cannot drift apart on the framing.
 */
export function gradeBandFraming(band: BlueprintGradeBand): string {
  switch (band) {
    case 'grade_7_8':
      return 'It’s still early to narrow things down — the priority now is trying things out and noticing what stands out. The work recorded in these grades also forms part of the record used at placement, so it already counts.'
    case 'grade_9':
      return 'This is the year the senior school decision is made. What matters now is being honest about where the evidence stands, and what can still change before it.'
    case 'grade_10':
      return 'This learner has started senior school. The question now is how well this pathway is fitting, and what support makes it work.'
    case 'grade_11_12':
      return 'At this stage the record can start pointing toward what comes next — further education, technical training, entrepreneurship or work — where the evidence genuinely supports it.'
    case 'unknown':
      return 'It’s still early to draw firm conclusions about direction — that sharpens as more evidence builds up.'
  }
}

/** The heading Page 4 carries — a forward question in junior, a destination question in senior. */
export function futurePageTitle(band: BlueprintGradeBand): string {
  return isSeniorBand(band) ? 'Where This Could Lead' : 'What May Be Emerging'
}

export function futurePageQuestion(band: BlueprintGradeBand): string {
  switch (band) {
    case 'grade_7_8':
      return 'An early look at what’s starting to stand out.'
    case 'grade_9':
      return 'What the current record suggests as senior school approaches.'
    case 'grade_10':
      return 'How this pathway is fitting so far.'
    case 'grade_11_12':
      return 'What this record is starting to open up.'
    case 'unknown':
      return 'An early look at where this could lead.'
  }
}

/**
 * The band to use when rendering a Blueprint that may predate this field.
 *
 * Snapshots stored before `metadata.gradeBand` existed carry no band, and
 * their payloads are cast from JSON, so the field is `undefined` at runtime
 * despite the type. Rather than defaulting those to a stage — which would
 * silently give an archived senior learner junior framing — we re-derive from
 * the class name the snapshot did record, and fall back to `unknown` only when
 * even that is absent. `unknown` renders the neutral framing, never a guess.
 */
export function resolveGradeBand(
  metadataBand: BlueprintGradeBand | undefined,
  className: string | null,
): BlueprintGradeBand {
  if (metadataBand) return metadataBand
  return getGradeBand(className)
}
