// lib/pathwayCalculator.ts

import {
  getActiveKjseaRuleSet,
  cbcLevelToKjseaPointsFloor,
  isKjseaPointsAmbiguousForLevel,
  isKjseaRuleSetVerified,
  kjseaPointsFromScore,
  getPathwayMinimum,
  type KjseaRuleSet,
  type KjseaPathway,
} from '@/lib/config/kjseaRules'

export type SubjectScores = Record<string, number>

// ─── Subject key normalisation ────────────────────────────────────────────────
// Essential Mathematics (emat) is DISTINCT from Core Mathematics:
//   Core Maths  → qualifies for STEM gate + STEM pathway weights
//   Essential Maths → does NOT count toward STEM; contributes to Arts & Sports
//
// Shortcodes (emat, geo, csl, hisc) are normalised to canonical keys so all
// downstream pathway logic is consistent regardless of how the school entered them.

const SUBJECT_KEY_ALIASES: Record<string, string> = {
  // Mathematics variants
  emat:               'essential_mathematics',
  essential_maths:    'essential_mathematics',
  'essential maths':  'essential_mathematics',
  core_mathematics:   'mathematics',           // core = mathematics for STEM gate
  // Subject shortcodes used by some schools
  geo:                'geography',
  csl:                'community_service_learning',
  hisc:               'home_science',
  // Religion abbreviations
  ire:                'islamic_religious_education',
  // Technical / Arts aliases
  pre_technical:      'pre_technical_studies',
  creative_arts:      'creative_arts_sports',
  agriculture:        'agriculture_nutrition',
  // 8-4-4/KCSE subject variants — normalised to one canonical key each so
  // punctuation/spacing entered by different schools doesn't fragment the
  // capability evidence for the same subject.
  'business studies':          'business_studies',
  'history & government':      'history_and_government',
  'history and government':    'history_and_government',
  'history_&_government':      'history_and_government',
}

export function normalizeSubjectKey(key: string): string {
  return SUBJECT_KEY_ALIASES[key.toLowerCase()] ?? key.toLowerCase()
}

export function normalizeSubjectScores(scores: SubjectScores): SubjectScores {
  const out: SubjectScores = {}
  for (const [k, v] of Object.entries(scores)) {
    const canon = normalizeSubjectKey(k)
    // On key collision, keep the higher value (belt-and-suspenders for messy imports)
    if (out[canon] === undefined || v > out[canon]) out[canon] = v
  }
  return out
}

// ─── Pathway disclaimer ───────────────────────────────────────────────────────
//
// Built from the active rule set rather than written out, for two reasons.
// First, it previously quoted the gates as prose ("STEM requires 20+") in a
// second place, so a cycle change would have silently left the disclaimer
// contradicting the arithmetic. Second, it asserted these were "the official
// KNEC ... criteria" when no primary KNEC document has been checked — the
// wording now tracks the rule set's real verification status instead of
// claiming an authority the platform hasn't earned.

export type PathwayDisclaimer = { short: string; full: string; source: string }

export function buildPathwayDisclaimer(ruleSet: KjseaRuleSet = getActiveKjseaRuleSet()): PathwayDisclaimer {
  const verified = isKjseaRuleSetVerified(ruleSet)
  const gates = (['STEM', 'Social Sciences', 'Arts'] as const)
    .map(p => {
      const min = getPathwayMinimum(p, ruleSet)
      return min === null ? null : `${p} ${min}+ points`
    })
    .filter((g): g is string => g !== null)
    .join('; ')

  const basis = verified
    ? `the official KNEC KJSEA ${ruleSet.cycle} placement criteria`
    : `reported KNEC KJSEA ${ruleSet.cycle} placement criteria, not yet confirmed against an official KNEC publication`

  return {
    short: verified
      ? `Based on KNEC KJSEA ${ruleSet.cycle} criteria. Subject to change between cycles.`
      : `Based on reported KJSEA ${ruleSet.cycle} criteria — not yet officially confirmed. Subject to change between cycles.`,

    full:
      `This pathway guidance is based on ${basis}. ` +
      (gates ? `Composite minimums: ${gates}. ` : '') +
      'Placement rules change from one assessment cycle to the next, and EduNexus updates them as KNEC publishes changes. ' +
      'Eligibility gates are not placement guarantees — actual placement also applies capacity formulas this guidance does not model. ' +
      'This is a planning aid: final pathway decisions should rest with the learner, their family and their teachers.',

    source: verified
      ? `Source: KNEC KJSEA ${ruleSet.cycle} placement criteria.`
      : `Source: secondary reporting on KJSEA ${ruleSet.cycle}; awaiting verification against a primary KNEC publication.`,
  }
}

/** @deprecated Prefer `buildPathwayDisclaimer(ruleSet)` so the copy tracks the cycle actually in use. */
export const PATHWAY_DISCLAIMER: PathwayDisclaimer = buildPathwayDisclaimer()

// ─── Pathway Rules & Weights ──────────────────────────────────────────────────

// Subject-level guidance thresholds only. The per-pathway KJSEA composite
// minimums that used to live here were a second copy of the gates in
// lib/config/kjseaRules.ts and have been removed — read them via
// `getPathwayMinimum(pathway, ruleSet)` so there is exactly one source of truth
// per cycle. These remaining values are EduNexus's own advisory thresholds, not
// KNEC's, and are deliberately not presented as official anywhere.
export const PATHWAY_RULES = {
  STEM: {
    mathematics:        3,   // Level 3+ preferred
    integrated_science: 3,   // Level 3+ preferred
    language_avg:       2.5, // inclusive threshold, tuned against reported 2025 STEM qualification rates
  },
  SOCIAL_SCIENCES: {
    minimum_avg: 2.0,
  },
  ARTS: {
    // fallback — no hard subject requirements
  },
} as const

export const PATHWAY_WEIGHTS = {
  STEM: {
    mathematics:           0.35,
    integrated_science:    0.35,
    english:               0.15,
    kiswahili:             0.05,
    pre_technical_studies: 0.10,
  },
  SOCIAL_SCIENCES: {
    english:               0.25,
    kiswahili:             0.20,
    social_studies:        0.30,
    cre:                   0.15,
    agriculture_nutrition: 0.10,
  },
  ARTS: {
    creative_arts_sports:  0.40,
    agriculture_nutrition: 0.20,
    english:               0.15,
    kiswahili:             0.10,
    social_studies:        0.15,
  },
} as const

// ─── IGCSE types ──────────────────────────────────────────────────────────────

export type IGCSEGradeString = 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'U'

export type IGCSEPathway = 'Sciences' | 'Humanities' | 'Languages' | 'Mathematics' | 'Technology'

export type IGCSESubjectRating = 'strongly_recommended' | 'recommended' | 'consider' | 'not_recommended'

export interface IGCSEPathwayStrength {
  pathway: IGCSEPathway
  score: number          // 0–100
  label: string
  emoji: string
  description: string
  universityOptions: string[]
  aLevelSubjects: string[]
}

export interface IGCSESubjectRecommendation {
  subject: string
  rating: IGCSESubjectRating
  numericScore: number
  gradeLabel: IGCSEGradeString | null
}

export interface IGCSERecommendation {
  pathwayStrengths: IGCSEPathwayStrength[]
  topPathway: IGCSEPathway
  subjectRecommendations: IGCSESubjectRecommendation[]
  iceAwardNote: string | null
  calculated_at: string
}

// Grade → numeric (A*=9, A=8 … U=1)
const IGCSE_GRADE_NUMERIC: Record<string, number> = {
  'A*': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'E': 4, 'F': 3, 'G': 2, 'U': 1,
}

// Subject → pathway group(s)
const IGCSE_SUBJECT_GROUPS: Record<string, IGCSEPathway[]> = {
  // Sciences
  biology:           ['Sciences'],
  chemistry:         ['Sciences'],
  physics:           ['Sciences'],
  combined_science:  ['Sciences'],
  environmental_management: ['Sciences'],
  // Humanities
  history:           ['Humanities'],
  geography:         ['Humanities'],
  literature_english:['Humanities'],
  global_perspectives:['Humanities'],
  sociology:         ['Humanities'],
  // Languages
  english_language:  ['Languages'],
  kiswahili:         ['Languages'],
  french:            ['Languages'],
  arabic:            ['Languages'],
  // Mathematics
  mathematics:       ['Mathematics'],
  additional_mathematics: ['Mathematics'],
  // Technology
  computer_science:  ['Technology'],
  ict:               ['Technology'],
  design_technology: ['Technology'],
  // Cross-group subjects
  economics:         ['Humanities', 'Mathematics'],
  business_studies:  ['Humanities', 'Technology'],
  accounting:        ['Mathematics', 'Humanities'],
}

const PATHWAY_META: Record<IGCSEPathway, { label: string; emoji: string; description: string; universityOptions: string[]; aLevelSubjects: string[] }> = {
  Sciences: {
    label: 'Science & Medicine',
    emoji: '🔬',
    description: 'Strong foundation for Medicine, Engineering, and Research',
    universityOptions: ['University of Nairobi (Medicine)', 'JKUAT (Engineering)', 'UK Russell Group', 'International medical schools'],
    aLevelSubjects: ['Biology', 'Chemistry', 'Physics', 'Mathematics'],
  },
  Humanities: {
    label: 'Humanities & Social Sciences',
    emoji: '📚',
    description: 'Ideal for Law, International Relations, Journalism, and Teaching',
    universityOptions: ['University of Nairobi (Law)', 'Strathmore University', 'UK universities', 'African Leadership University'],
    aLevelSubjects: ['History', 'Geography', 'English Literature', 'Economics'],
  },
  Languages: {
    label: 'Languages & Communication',
    emoji: '🗣️',
    description: 'Opens doors in Diplomacy, Translation, Media, and Global Business',
    universityOptions: ['University of Nairobi (Languages)', 'USIU-Africa', 'European universities', 'AU multilateral institutions'],
    aLevelSubjects: ['English Language', 'French', 'Spanish', 'Global Perspectives'],
  },
  Mathematics: {
    label: 'Mathematics & Economics',
    emoji: '📐',
    description: 'Pathway to Finance, Data Science, Actuarial Science, and Economics',
    universityOptions: ['Strathmore University (Finance)', 'University of Nairobi (Economics)', 'LSE', 'Top US universities'],
    aLevelSubjects: ['Mathematics', 'Further Mathematics', 'Economics', 'Physics'],
  },
  Technology: {
    label: 'Technology & Computing',
    emoji: '💻',
    description: 'Leads to Software Engineering, Cybersecurity, and Tech entrepreneurship',
    universityOptions: ['JKUAT (ICT)', 'Strathmore (iLab Africa)', 'Carnegie Mellon Africa', 'Global tech bootcamps'],
    aLevelSubjects: ['Computer Science', 'Mathematics', 'Physics', 'Further Mathematics'],
  },
}

/**
 * Calculate pathway strengths and subject recommendations for IGCSE students
 */
export function calculateIGCSESubjectRecommendation(
  scores: Record<string, string | number>,
  yearLevel: number = 10
): IGCSERecommendation {
  // Convert all scores to numeric (string grades → number, numeric pass-through)
  const numeric: Record<string, number> = {}
  for (const [subj, val] of Object.entries(scores)) {
    if (typeof val === 'number') {
      numeric[subj] = val
    } else {
      numeric[subj] = IGCSE_GRADE_NUMERIC[val] ?? 0
    }
  }

  // Calculate average score per pathway
  const pathwayTotals: Record<IGCSEPathway, { total: number; count: number }> = {
    Sciences:    { total: 0, count: 0 },
    Humanities:  { total: 0, count: 0 },
    Languages:   { total: 0, count: 0 },
    Mathematics: { total: 0, count: 0 },
    Technology:  { total: 0, count: 0 },
  }

  for (const [subj, num] of Object.entries(numeric)) {
    const groups = IGCSE_SUBJECT_GROUPS[subj] || []
    for (const g of groups) {
      pathwayTotals[g].total += num
      pathwayTotals[g].count += 1
    }
  }

  // Convert to 0–100 scores (max numeric is 9 = A*)
  const pathwayStrengths: IGCSEPathwayStrength[] = (Object.keys(pathwayTotals) as IGCSEPathway[])
    .map(pathway => {
      const { total, count } = pathwayTotals[pathway]
      const avg = count > 0 ? total / count : 0
      const score = Math.round((avg / 9) * 100)
      return { pathway, score, ...PATHWAY_META[pathway] }
    })
    .sort((a, b) => b.score - a.score)

  const topPathway = pathwayStrengths[0]?.pathway ?? 'Sciences'

  // Per-subject recommendations
  const subjectRecommendations: IGCSESubjectRecommendation[] = Object.entries(numeric).map(([subj, num]) => {
    let rating: IGCSESubjectRating
    if (num >= 8)      rating = 'strongly_recommended'
    else if (num >= 6) rating = 'recommended'
    else if (num >= 4) rating = 'consider'
    else               rating = 'not_recommended'

    const gradeEntry = Object.entries(IGCSE_GRADE_NUMERIC).find(([, v]) => v === num)
    const gradeLabel = (gradeEntry?.[0] as IGCSEGradeString | undefined) ?? null

    return { subject: subj, rating, numericScore: num, gradeLabel }
  }).sort((a, b) => b.numericScore - a.numericScore)

  // ICE Award note (only Upper Secondary Year 10-11)
  const iceAwardNote = yearLevel >= 10
    ? 'Cambridge ICE Award: Pass requires 7 subjects across 5 groups. Distinction = majority A*/A grades.'
    : null

  return {
    pathwayStrengths,
    topPathway,
    subjectRecommendations,
    iceAwardNote,
    calculated_at: new Date().toISOString(),
  }
}

// ─── Pathway helpers ──────────────────────────────────────────────────────────

function cbcToPercent(level: number): number {
  return Math.round(((level - 1) / 3) * 100)
}

function calculateWeightedScore(
  scores:  SubjectScores,
  weights: Record<string, number>,
): number {
  let total     = 0
  let weightSum = 0
  for (const [subject, weight] of Object.entries(weights)) {
    const level = scores[subject]
    if (level !== undefined && level > 0) {
      total     += cbcToPercent(level) * weight
      weightSum += weight
    }
  }
  return weightSum > 0 ? Math.round(total / weightSum) : 0
}

function calculateConfidence(
  topScore:    number,
  secondScore: number,
): 'high' | 'medium' | 'low' {
  const gap = topScore - secondScore
  if (gap >= 20) return 'high'
  if (gap >= 10) return 'medium'
  return 'low'
}

// Ensure the recommended pathway bar is always visually longest.
// Does NOT affect gate logic — display only.
function normalizeReadinessDisplay(
  readiness: { stem: number; social_sciences: number; arts: number },
  topPathway: string,
): { stem: number; social_sciences: number; arts: number } {
  const key =
    topPathway === 'STEM'              ? 'stem'
    : topPathway === 'Social Sciences' ? 'social_sciences'
    : 'arts'

  const recScore = readiness[key]
  const result   = { ...readiness }

  for (const k of Object.keys(result) as (keyof typeof result)[]) {
    if (k !== key && result[k] >= recScore) {
      result[k] = recScore - 4
    }
  }

  return result
}

// ─── PathwayRecommendation type ───────────────────────────────────────────────

export type PathwayRecommendation = {
  stem_score:            number
  arts_sports_score:     number
  social_sciences_score: number
  top_pathway:           string
  confidence:            'high' | 'medium' | 'low'
  strengths:             string[]
  development_areas:     string[]
  guidance_message:      string
  calculated_at:         string
  performance_tier:      'high' | 'mid' | 'low'
  stem_viable:           boolean
  stem_gap_subjects?:    string[]
  // Pathway Readiness display (0–100 weighted scores)
  pathway_readiness: {
    stem:            number
    social_sciences: number
    arts:            number
  }
  // Actionable guidance
  to_unlock_stem:           string[]
  to_unlock_social:         string[]
  to_maintain_recommended:  string[]
  alternative_pathway:      string
  // KJSEA 2025 composite data
  kjsea_composite?:         number
  kjsea_stem_threshold?:    number
  kjsea_qualifies_stem?:    boolean
  kjsea_qualifies_social?:  boolean
  // Pilot Gate Fix (zero-evidence pathway fabrication, 2026-08-25): true only
  // when this learner has NO usable subject evidence at all (no subject with
  // a real CBC level > 0 was supplied). CBC levels are 1-4 — there is no
  // legitimate "0" score, so `level > 0` is the correct usable-evidence test
  // and never mistakes a real (if low) Level 1 for absence. When true,
  // `top_pathway` is the sentinel 'Insufficient Evidence' (never one of the
  // three real pathway names) and every score/guidance field is a neutral,
  // non-committal default — callers must gate any "RECOMMENDED"/confident
  // presentation on this flag rather than inferring it from a zero score.
  insufficientEvidence:     boolean
}

// ─── KJSEA points and composites ──────────────────────────────────────────────
//
// Every number below now comes from a versioned rule set
// (lib/config/kjseaRules.ts) rather than a literal in this file. KJSEA is a
// new assessment whose bands, gates and weighting have already moved once and
// will move again; a hardcoded "STEM needs 20" is a claim about one cycle that
// quietly becomes wrong in the next. Callers that need a specific year pass
// its rule set; callers that don't get the active one.
//
// Read the verification contract at the top of lib/config/kjseaRules.ts before
// putting any of these figures in front of a parent or learner — the current
// rule set is PROVISIONAL.

/**
 * Points for a CBC 1-4 level when no raw mark is available.
 *
 * Deliberately a lower bound, not a conversion — see
 * `cbcLevelToKjseaPointsFloor`. Retained under its original name because
 * several Academic Clinic callers depend on it; new code should prefer
 * `kjseaPointsFromScore()` whenever a real percentage exists, because the
 * level alone cannot distinguish EE1 from EE2 (8 points from 7).
 */
export function cbcToKJSEAPoints(level: number, ruleSet: KjseaRuleSet = getActiveKjseaRuleSet()): number {
  return cbcLevelToKjseaPointsFloor(level, ruleSet)
}

/**
 * Composite across a learner's subjects.
 *
 * `scores` carries CBC 1-4 levels, and a level of 0 still means "no evidence
 * for this subject" (unchanged). `percentages`, when supplied, carries the
 * real marks behind those same subjects and is used in preference wherever a
 * subject has one — that is the difference between scoring a 95% learner at 8
 * points and floor-guessing them at 7. Subjects absent from `percentages`
 * fall back to the conservative level-only estimate, so a partial set is fine.
 */
export function calculateKJSEAComposite(
  scores: SubjectScores,
  percentages?: SubjectScores,
  ruleSet: KjseaRuleSet = getActiveKjseaRuleSet(),
): number {
  const levels = normalizeSubjectScores(scores)
  const marks  = percentages ? normalizeSubjectScores(percentages) : null

  return Object.entries(levels)
    .filter(([, level]) => level > 0)
    .reduce((sum, [subject, level]) => {
      const mark = marks?.[subject]
      const points = mark !== undefined && Number.isFinite(mark) && mark >= 0 && mark <= 100
        ? kjseaPointsFromScore(mark, ruleSet)
        : cbcToKJSEAPoints(level, ruleSet)
      return sum + points
    }, 0)
}

/**
 * Whether a composite built from levels alone could understate this learner —
 * true when any subject sits at a level spanning two point values. Lets a
 * caller say "at least N points" instead of implying an exact figure.
 */
export function isCompositeUnderestimated(
  scores: SubjectScores,
  percentages?: SubjectScores,
  ruleSet: KjseaRuleSet = getActiveKjseaRuleSet(),
): boolean {
  const levels = normalizeSubjectScores(scores)
  const marks  = percentages ? normalizeSubjectScores(percentages) : null

  return Object.entries(levels).some(([subject, level]) =>
    level > 0 &&
    marks?.[subject] === undefined &&
    isKjseaPointsAmbiguousForLevel(level, ruleSet),
  )
}

/**
 * Composite minimum for a pathway. Returns null when the active cycle
 * published no gate for it — never a guessed number.
 */
export function getPathwayCompositeMinimum(
  pathway: KjseaPathway,
  ruleSet: KjseaRuleSet = getActiveKjseaRuleSet(),
): number | null {
  return getPathwayMinimum(pathway, ruleSet)
}

/**
 * Calculate pathway affinity for Junior School students (Grade 7–9).
 *
 * Philosophy:
 *   HIGH performers (CBC avg ≥ 3.0) → push toward STEM first, Social Sciences second.
 *   MID  performers (CBC avg 2.0–2.9) → balanced with slight STEM preference.
 *   LOW  performers (CBC avg < 2.0)  → Arts & Sports Science (practical, confidence-building).
 *
 * Scores arrive as CBC 1–4 from the assessment pipeline.
 */
export function calculateJuniorPathwayAffinity(scores: SubjectScores): PathwayRecommendation {
  // Normalise first — essential_mathematics stays distinct from mathematics,
  // so the STEM gate below correctly ignores students with Essential Maths only.
  scores = normalizeSubjectScores(scores)

  // ── Gate subject levels ───────────────────────────────────────────────────────
  const mathLevel = scores.mathematics        ?? 0  // core maths only — essential_mathematics excluded
  const sciLevel  = scores.integrated_science ?? 0
  const engLevel  = scores.english            ?? 0
  const kisLevel  = scores.kiswahili          ?? 0
  const langAvg   = (engLevel + kisLevel) / 2

  // ── KJSEA composite score ─────────────────────────────────────────────────────
  // Gates come from the active rule set, never a literal — KJSEA's thresholds
  // are per-cycle and have already changed once. A cycle that publishes no gate
  // for a pathway yields `null`, and an absent gate is treated as "not
  // demonstrable" rather than "passed": we never claim eligibility we cannot
  // evidence.
  const ruleSet          = getActiveKjseaRuleSet()
  const kjseaComposite   = calculateKJSEAComposite(scores, undefined, ruleSet)
  const stemMinimum      = getPathwayMinimum('STEM', ruleSet)
  const socialMinimum    = getPathwayMinimum('Social Sciences', ruleSet)
  const stemCompositeOk  = stemMinimum   !== null && kjseaComposite >= stemMinimum
  const socialCompositeOk = socialMinimum !== null && kjseaComposite >= socialMinimum

  // ── Weighted readiness scores (0–100) ────────────────────────────────────────
  const stemWeighted   = calculateWeightedScore(scores, PATHWAY_WEIGHTS.STEM as unknown as Record<string, number>)
  const socialWeighted = calculateWeightedScore(scores, PATHWAY_WEIGHTS.SOCIAL_SCIENCES as unknown as Record<string, number>)
  const artsWeighted   = calculateWeightedScore(scores, PATHWAY_WEIGHTS.ARTS as unknown as Record<string, number>)

  // ── Overall average (1–4 scale) ──────────────────────────────────────────────
  const allLevels = Object.values(scores).filter(v => v > 0)
  const cbcAvg    = allLevels.reduce((a, b) => a + b, 0) / allLevels.length

  // ── Zero usable evidence ──────────────────────────────────────────────────────
  // Pilot Gate Fix (2026-08-25): the three gates below were written assuming
  // at least one subject with a real level is always present. With an empty
  // `scores`, `allLevels` is `[]` and `majorityLevel1` (level1Count / 0) is
  // `NaN`, which is falsy for `> 0.5` — so GATE 2 (Social Sciences) silently
  // won, with confidence downgraded to 'low' but every downstream consumer
  // (Junior PDF "RECOMMENDED" badge, the web dashboard's Pathway
  // Recommendation card, the Blueprint pathway-gap-analysis adapter) still
  // rendered it as a confident, specific recommendation. This is the root
  // cause the Pilot Gate Fix phase closes: guard it here, at the one
  // canonical calculator every one of those callers goes through, rather
  // than patching each presentation layer separately.
  if (allLevels.length === 0) {
    return {
      stem_score:            0,
      social_sciences_score: 0,
      arts_sports_score:     0,
      top_pathway:           'Insufficient Evidence',
      confidence:            'low',
      strengths:              [],
      development_areas:      [],
      guidance_message:
        'Not enough evidence yet to recommend a pathway. Once at least one subject ' +
        'assessment is recorded for this learner, pathway readiness signals will appear here.',
      calculated_at:         new Date().toISOString(),
      performance_tier:      'low',
      stem_viable:           false,
      pathway_readiness: { stem: 0, social_sciences: 0, arts: 0 },
      to_unlock_stem:          [],
      to_unlock_social:        [],
      to_maintain_recommended: [],
      alternative_pathway:     'Insufficient Evidence',
      kjsea_composite:        0,
      kjsea_stem_threshold:   stemMinimum ?? undefined,
      kjsea_qualifies_stem:   false,
      kjsea_qualifies_social: false,
      insufficientEvidence:   true,
    }
  }

  // ── Strengths and development areas ──────────────────────────────────────────
  const strengths = Object.entries(scores)
    .filter(([, s]) => s >= 3)
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k)

  const developmentAreas = Object.entries(scores)
    .filter(([, s]) => s <= 2)
    .sort(([, a], [, b]) => a - b)
    .map(([k]) => k)

  // ── Unlock messages ───────────────────────────────────────────────────────────
  const toUnlockSTEM: string[] = []
  if (mathLevel < PATHWAY_RULES.STEM.mathematics)
    toUnlockSTEM.push(`Mathematics — currently Level ${mathLevel}, needs Level ${PATHWAY_RULES.STEM.mathematics}`)
  if (sciLevel < PATHWAY_RULES.STEM.integrated_science)
    toUnlockSTEM.push(`Integrated Science — currently Level ${sciLevel}, needs Level ${PATHWAY_RULES.STEM.integrated_science}`)
  if (langAvg < PATHWAY_RULES.STEM.language_avg)
    toUnlockSTEM.push(`Languages — average currently ${langAvg.toFixed(1)}, needs Level ${PATHWAY_RULES.STEM.language_avg}`)

  const toUnlockSocial: string[] =
    cbcAvg >= PATHWAY_RULES.SOCIAL_SCIENCES.minimum_avg
      ? []
      : ['Improve overall performance to Level 2 average']

  // ── STEM gate ─────────────────────────────────────────────────────────────────
  // OR for math/science: KNEC looks at composite, not both subjects in isolation.
  // A student strong in Math but weak in Science (or vice versa) can still qualify.
  const stemGateMet =
    (mathLevel >= PATHWAY_RULES.STEM.mathematics ||
     sciLevel  >= PATHWAY_RULES.STEM.integrated_science) &&
    langAvg   >= PATHWAY_RULES.STEM.language_avg &&
    stemCompositeOk

  // "Within reach" — composite is strong + at most ONE core STEM subject blocking.
  // No langAvg check here: composite >= 20 already reflects holistic performance.
  const stemBlockerCount = [
    mathLevel < PATHWAY_RULES.STEM.mathematics,
    sciLevel  < PATHWAY_RULES.STEM.integrated_science,
  ].filter(Boolean).length

  const stemViableNotGated =
    stemCompositeOk &&
    stemBlockerCount <= 1 &&
    (mathLevel >= 2 || sciLevel >= 3)

  // ── Arts gate ─────────────────────────────────────────────────────────────────
  const level1Count    = allLevels.filter(l => l <= 1).length
  const majorityLevel1 = level1Count / allLevels.length > 0.5

  // ══════════════════════════════════════════════════════════════════════════════
  // GATE 1 — STEM
  // ══════════════════════════════════════════════════════════════════════════════
  if (stemGateMet) {
    const pathway_readiness = normalizeReadinessDisplay(
      { stem: stemWeighted, social_sciences: socialWeighted, arts: artsWeighted },
      'STEM',
    )
    return {
      stem_score:            stemWeighted,
      social_sciences_score: socialWeighted,
      arts_sports_score:     artsWeighted,
      top_pathway:           'STEM',
      confidence:            calculateConfidence(stemWeighted, socialWeighted),
      strengths,
      development_areas:     developmentAreas,
      guidance_message:      buildGuidanceMessage('STEM', 'high', true, developmentAreas),
      calculated_at:         new Date().toISOString(),
      performance_tier:      'high',
      stem_viable:           true,
      pathway_readiness,
      to_unlock_stem:        [],
      to_unlock_social:      toUnlockSocial,
      to_maintain_recommended: [
        `Keep Mathematics at Level ${PATHWAY_RULES.STEM.mathematics}+`,
        `Keep Integrated Science at Level ${PATHWAY_RULES.STEM.integrated_science}+`,
      ],
      alternative_pathway:    'Social Sciences',
      kjsea_composite:        kjseaComposite,
      kjsea_stem_threshold:   stemMinimum ?? undefined,
      kjsea_qualifies_stem:   stemCompositeOk,
      kjsea_qualifies_social: socialCompositeOk,
      insufficientEvidence:   false,
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // GATE 2 — SOCIAL SCIENCES
  // ══════════════════════════════════════════════════════════════════════════════
  if (!majorityLevel1) {
    const stemBlockers: string[] = []
    if (mathLevel < PATHWAY_RULES.STEM.mathematics)        stemBlockers.push('mathematics')
    if (sciLevel  < PATHWAY_RULES.STEM.integrated_science) stemBlockers.push('integrated_science')
    if (langAvg   < PATHWAY_RULES.STEM.language_avg)       stemBlockers.push('english')

    // Cap STEM score when gate is unmet so Social Sciences always renders higher
    const stemDisplay = Math.min(stemWeighted, 89)
    const pathway_readiness = normalizeReadinessDisplay(
      { stem: stemDisplay, social_sciences: socialWeighted, arts: artsWeighted },
      'Social Sciences',
    )

    return {
      stem_score:            stemDisplay,
      social_sciences_score: socialWeighted,
      arts_sports_score:     artsWeighted,
      top_pathway:           'Social Sciences',
      confidence:            calculateConfidence(socialWeighted, stemDisplay),
      strengths,
      development_areas:     developmentAreas,
      guidance_message:      buildGuidanceMessage(
        'Social Sciences', 'mid', false, developmentAreas,
        stemViableNotGated ? stemBlockers : undefined,
      ),
      calculated_at:     new Date().toISOString(),
      performance_tier:  cbcAvg >= 3.0 ? 'high' : 'mid',
      stem_viable:       stemViableNotGated,
      stem_gap_subjects: stemViableNotGated
        ? stemBlockers.map(b => `${formatSubjectName(b)} needs Level 3`)
        : undefined,
      pathway_readiness,
      to_unlock_stem:    toUnlockSTEM,
      to_unlock_social:  [],
      to_maintain_recommended: [
        `Keep English at Level ${Math.round(PATHWAY_RULES.SOCIAL_SCIENCES.minimum_avg * 1.5)}+`,
        `Keep Kiswahili at Level ${Math.round(PATHWAY_RULES.SOCIAL_SCIENCES.minimum_avg * 1.5)}+`,
      ],
      alternative_pathway:    stemViableNotGated ? 'STEM' : 'Arts & Sports Science',
      kjsea_composite:        kjseaComposite,
      kjsea_stem_threshold:   stemMinimum ?? undefined,
      kjsea_qualifies_stem:   stemCompositeOk,
      kjsea_qualifies_social: socialCompositeOk,
      insufficientEvidence:   false,
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // GATE 3 — ARTS & SPORTS SCIENCE
  // ══════════════════════════════════════════════════════════════════════════════
  const pathway_readiness = normalizeReadinessDisplay(
    { stem: stemWeighted, social_sciences: socialWeighted, arts: artsWeighted },
    'Arts & Sports Science',
  )
  return {
    stem_score:            stemWeighted,
    social_sciences_score: socialWeighted,
    arts_sports_score:     artsWeighted,
    top_pathway:           'Arts & Sports Science',
    confidence:            calculateConfidence(artsWeighted, socialWeighted),
    strengths,
    development_areas:     developmentAreas,
    guidance_message:      buildGuidanceMessage('Arts & Sports Science', 'low', false, developmentAreas),
    calculated_at:         new Date().toISOString(),
    performance_tier:      'low',
    stem_viable:           false,
    pathway_readiness,
    to_unlock_stem:        toUnlockSTEM,
    to_unlock_social:      toUnlockSocial,
    to_maintain_recommended: [
      'Continue developing Creative Arts and Sports skills',
      'Build confidence through practical subjects',
    ],
    alternative_pathway:    'Social Sciences',
    kjsea_composite:        kjseaComposite,
    kjsea_stem_threshold:   stemMinimum ?? undefined,
    kjsea_qualifies_stem:   stemCompositeOk,
    kjsea_qualifies_social: socialCompositeOk,
    insufficientEvidence:   false,
  }
}

function buildGuidanceMessage(
  pathway:          string,
  tier:             'high' | 'mid' | 'low',
  stemViable:       boolean,
  developmentAreas: string[],
  stemBlockers?:    string[],
): string {
  let message: string

  if (tier === 'high') {
    if (pathway === 'STEM') {
      message =
        'This student shows strong capability across all subjects. Their science and mathematics ' +
        'foundation qualifies them for the STEM pathway — the most in-demand career route in Kenya. ' +
        'With focused work on Mathematics, they can excel in Engineering, Medicine, or Technology.\n\n' +
        'Next steps: Science competitions, coding clubs, maths enrichment.'
    } else if (pathway === 'Social Sciences') {
      message =
        'This is a high-achieving student with strong language and humanities performance. ' +
        'The Social Sciences pathway leads to Law, Business, Education, and Public Service.' +
        (stemViable
          ? ' Their science scores also keep the STEM pathway as a viable alternative.'
          : '') +
        '\n\nNext steps: Debate club, essay writing, reading widely across subjects.'
    } else {
      // High performer going Arts — language/creative scores dominate
      message =
        'This student excels across the board with a clear strength in creative and expressive subjects. ' +
        'The Arts & Sports Science pathway leads to Design, Media, Journalism, Sports Management, and the Creative Industries.\n\n' +
        'Next steps: Competitions in arts, drama, or sports. Explore digital design and media production.'
    }
  } else if (tier === 'mid') {
    if (pathway === 'STEM') {
      message =
        'This student has developing STEM ability with room to grow. With consistent effort in Mathematics ' +
        'and Science, the STEM pathway is achievable and worth pursuing.\n\n' +
        'Next steps: Khan Academy for Maths, BBC Bitesize for Science, regular practice problems.'
    } else if (pathway === 'Social Sciences') {
      message =
        'This student shows solid language and humanities ability. The Social Sciences pathway is a strong fit, ' +
        'leading to Law, Teaching, Business, and Public Service careers.\n\n' +
        'Next steps: Reading habit, writing practice, debate and discussion activities.'
      if (stemBlockers && stemBlockers.length > 0) {
        message +=
          `\n\nSTEM is within reach: improve ${
            stemBlockers.map(b => formatSubjectName(b)).join(' and ')
          } from Level 2 to Level 3.`
      }
    } else {
      message =
        'This student performs best in creative and practical subjects. The Arts & Sports Science pathway ' +
        'offers hands-on, project-based learning that suits their strengths.\n\n' +
        'Next steps: School arts club, agriculture projects, sports teams, and creative hobbies.'
    }
  } else {
    // Low performer — always Arts regardless of pathway (Arts always wins with +15 boost for low)
    message =
      'This student is still developing foundational skills. The Arts & Sports Science pathway offers ' +
      'practical, hands-on learning that builds confidence. Focus on Agriculture, Creative Arts, and ' +
      'Physical Education this term. With consistent effort, other pathways open up.\n\n' +
      'Priority: Attend every class, complete assignments, ask the teacher for help on missed work.'
  }

  message +=
    '\n\nPlacement note: This recommendation ' +
    'follows KNEC KJSEA 2025 criteria ' +
    '(STEM: 20+ composite points). ' +
    PATHWAY_DISCLAIMER.short

  // Development areas
  if (developmentAreas.length > 0) {
    const top3 = developmentAreas.slice(0, 3).map(a => formatSubjectName(a)).join(', ')
    message += `\n\nNeeds attention: ${top3}.`
  }

  message +=
    '\n\nNote: All subjects remain essential in Junior School. This recommendation helps with planning — ' +
    'final pathway decisions should consider the student\'s own interests and teacher guidance.'

  return message
}

/**
 * Format subject key to readable name
 */
export function formatSubjectName(key: string): string {
  const specialNames: Record<string, string> = {
    'creative_arts_sports':         'Creative Arts and Sports',
    'pre_technical_studies':        'Pre-Technical Studies',
    'integrated_science':           'Integrated Science',
    'agriculture_nutrition':        'Agriculture and Nutrition',
    'christian_religious_education':'Christian Religious Education',
    'islamic_religious_education':  'Islamic Religious Education',
    'social_studies':               'Social Studies',
    'kiswahili_ksl':                'Kiswahili/KSL',
    'community_service_learning':   'Community Service Learning',
    'core_mathematics':             'Core Mathematics',
    'essential_mathematics':        'Essential Mathematics',
    'physical_education':           'Physical Education',
    'home_science':                 'Home Science',
    'ict':                          'ICT',
    'christian_education':          'Christian Religious Education',
    'islamic_education':            'Islamic Religious Education',
    'hindu_education':              'Hindu Religious Education',
    // shortcodes
    'emat':  'Essential Mathematics',
    'geo':   'Geography',
    'csl':   'Community Service Learning',
    'hisc':  'Home Science',
  }

  if (specialNames[key]) return specialNames[key]

  return key.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

/**
 * Get color class for confidence level
 */
export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high': return 'text-green-600'
    case 'medium': return 'text-yellow-600'
    case 'low': return 'text-gray-600'
    default: return 'text-gray-600'
  }
}

/**
 * Get badge color for confidence level
 */
export function getConfidenceBadge(confidence: string): string {
  switch (confidence) {
    case 'high': return 'bg-green-100 text-green-800 border-green-300'
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'low': return 'bg-gray-100 text-gray-800 border-gray-300'
    default: return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

// ─── Pathway Gap Analysis (Junior reports) ────────────────────────────────────

export type PathwayKeyLever = {
  subject: string       // e.g. "Mathematics"
  currentLevel: number  // e.g. 2
  targetLevel: number   // e.g. 3
  pointsGained: number  // composite points gained by this one-level improvement
  wouldUnlock: boolean  // does this single improvement satisfy ALL STEM gates?
}

export type PathwayNextDoor = {
  name: string          // next pathway up, e.g. "STEM"
  threshold: number     // composite threshold for that pathway
  currentGap: number    // composite points short (0 if already above threshold)
  keyLever: PathwayKeyLever
  unlockMessage: string // plain-English summary for the report
}

export type PathwayResult = {
  recommendedPathway: 'STEM' | 'Social Sciences' | 'Arts & Sports'
  compositeScore: number
  kjseaMaxScore: number
  subjectsEntered: number
  isPartialComposite: boolean   // true when fewer than 9 KJSEA subjects have scores
  qualifiesFor: string[]
  nextPathway: PathwayNextDoor | null  // null if already at STEM
  disclaimer: string
}

// The 9 canonical KJSEA subject groups — canonical keys only (aliases are normalised before use)
const KJSEA_SUBJECT_GROUPS: readonly (readonly string[])[] = [
  ['english'],
  ['kiswahili', 'kiswahili_ksl'],
  ['mathematics', 'essential_mathematics'],   // one or the other per student
  ['integrated_science'],
  ['social_studies'],
  ['agriculture_nutrition'],
  ['christian_religious_education', 'islamic_religious_education', 'hindu_education'],
  ['creative_arts_sports'],
  ['pre_technical_studies'],
] as const

/** Count how many of the 9 KJSEA subject groups have at least one score > 0. */
export function countKJSEASubjectsEntered(scores: SubjectScores): number {
  scores = normalizeSubjectScores(scores)
  return KJSEA_SUBJECT_GROUPS.filter(group =>
    group.some(key => (scores[key] ?? 0) > 0)
  ).length
}

/**
 * Calculate full pathway gap analysis for a junior student.
 * Returns recommended pathway, composite, what they currently qualify for,
 * and the single subject improvement that would open the next pathway.
 */
export function calculatePathwayGapAnalysis(
  scores: SubjectScores,
  recommendedPathway?: string | null,
): PathwayResult {
  scores = normalizeSubjectScores(scores)
  const composite        = calculateKJSEAComposite(scores)
  const KJSEA_MAX        = 72
  const KJSEA_TOTAL      = 9
  const subjectsEntered  = countKJSEASubjectsEntered(scores)
  const isPartialComposite = subjectsEntered < KJSEA_TOTAL

  const mathLevel = scores.mathematics        ?? 0
  const sciLevel  = scores.integrated_science ?? 0

  // Derive recommended pathway if not supplied
  const derivedRaw = recommendedPathway ?? calculateJuniorPathwayAffinity(scores).top_pathway
  const recPathway: 'STEM' | 'Social Sciences' | 'Arts & Sports' =
    derivedRaw === 'STEM'             ? 'STEM'
    : derivedRaw === 'Social Sciences' ? 'Social Sciences'
    : 'Arts & Sports'

  // qualifiesFor — check all three pathway thresholds
  const qualifiesFor: string[] = []
  if (recPathway === 'STEM' || (composite >= 20 && mathLevel >= 3 && sciLevel >= 3)) {
    qualifiesFor.push('STEM')
  }
  if (composite >= 25) {
    qualifiesFor.push('Social Sciences')
    qualifiesFor.push('Arts & Sports')
  }
  // Guarantee recommended pathway is always present
  if (!qualifiesFor.includes(recPathway)) {
    qualifiesFor.unshift(recPathway)
  }

  // Deduplicate while preserving order (recommended first)
  const seen = new Set<string>()
  const qualifiesForDeduped: string[] = []
  for (const p of qualifiesFor) {
    if (!seen.has(p)) { seen.add(p); qualifiesForDeduped.push(p) }
  }

  const disclaimer =
    'Based on KNEC KJSEA 2025 criteria. Subject to change as CBC evolves. ' +
    'Final placement determined by KNEC.'

  // STEM is the top pathway — nothing higher to unlock
  if (recPathway === 'STEM') {
    return {
      recommendedPathway: 'STEM',
      compositeScore:     composite,
      kjseaMaxScore:      KJSEA_MAX,
      subjectsEntered,
      isPartialComposite,
      qualifiesFor:       qualifiesForDeduped,
      nextPathway:        null,
      disclaimer,
    }
  }

  // ── Social Sciences or Arts & Sports → next door is STEM ─────────────────────
  const stemThreshold = 20
  const compositeGap  = Math.max(0, stemThreshold - composite)

  const mathNeeded = Math.max(0, 3 - mathLevel)
  const sciNeeded  = Math.max(0, 3 - sciLevel)

  // If composite is already above threshold AND both subjects meet gate — shouldn't happen
  // (student would have been placed in STEM), but handle defensively
  if (compositeGap === 0 && mathNeeded === 0 && sciNeeded === 0) {
    return {
      recommendedPathway: recPathway,
      compositeScore:     composite,
      kjseaMaxScore:      KJSEA_MAX,
      subjectsEntered,
      isPartialComposite,
      qualifiesFor:       qualifiesForDeduped,
      nextPathway:        null,
      disclaimer,
    }
  }

  // Build lever candidates for STEM subject gates
  const leverCandidates: Array<{ subject: string; currentLevel: number; pointsGained: number }> = []

  if (mathNeeded > 0) {
    const gained = cbcToKJSEAPoints(Math.min(4, mathLevel + 1)) - cbcToKJSEAPoints(mathLevel)
    leverCandidates.push({ subject: 'mathematics', currentLevel: mathLevel, pointsGained: gained })
  }
  if (sciNeeded > 0) {
    const gained = cbcToKJSEAPoints(Math.min(4, sciLevel + 1)) - cbcToKJSEAPoints(sciLevel)
    leverCandidates.push({ subject: 'integrated_science', currentLevel: sciLevel, pointsGained: gained })
  }

  // If only composite is missing (subject gates already met), use any low-scoring subject
  if (leverCandidates.length === 0 && compositeGap > 0) {
    const bestSubj = Object.entries(scores)
      .filter(([, v]) => v > 0 && v < 4)
      .sort(([, a], [, b]) => b - a)[0]
    if (bestSubj) {
      const gained = cbcToKJSEAPoints(Math.min(4, bestSubj[1] + 1)) - cbcToKJSEAPoints(bestSubj[1])
      leverCandidates.push({ subject: bestSubj[0], currentLevel: bestSubj[1], pointsGained: gained })
    }
  }

  if (leverCandidates.length === 0) {
    return {
      recommendedPathway: recPathway,
      compositeScore:     composite,
      kjseaMaxScore:      KJSEA_MAX,
      subjectsEntered,
      isPartialComposite,
      qualifiesFor:       qualifiesForDeduped,
      nextPathway:        null,
      disclaimer,
    }
  }

  // Sort by pointsGained desc; prefer mathematics on tie
  leverCandidates.sort((a, b) => {
    if (b.pointsGained !== a.pointsGained) return b.pointsGained - a.pointsGained
    return a.subject === 'mathematics' ? -1 : 1
  })

  const lever       = leverCandidates[0]
  const targetLevel = lever.subject === 'mathematics' || lever.subject === 'integrated_science' ? 3 : Math.min(4, lever.currentLevel + 1)
  const subjectLabel = lever.subject === 'mathematics' ? 'Mathematics' : lever.subject === 'integrated_science' ? 'Integrated Science' : formatSubjectName(lever.subject)

  // Would this single improvement cause ALL STEM gates to pass?
  const mathAfter = lever.subject === 'mathematics' ? Math.min(4, lever.currentLevel + 1) : mathLevel
  const sciAfter  = lever.subject === 'integrated_science' ? Math.min(4, lever.currentLevel + 1) : sciLevel
  const wouldUnlock = mathAfter >= 3 && sciAfter >= 3 && (composite + lever.pointsGained) >= stemThreshold

  // Build unlock message
  const bothBlocked = mathNeeded > 0 && sciNeeded > 0
  let unlockMessage: string
  if (bothBlocked) {
    unlockMessage =
      'Mathematics and Integrated Science both need to reach Level 3 to open the STEM pathway. ' +
      `${subjectLabel} is the stronger lever — start there.`
  } else if (wouldUnlock) {
    unlockMessage =
      `${subjectLabel} from Level ${lever.currentLevel} → Level ${targetLevel} ` +
      `adds ${lever.pointsGained} points and opens the STEM pathway at Grade 10.`
  } else {
    unlockMessage =
      `${subjectLabel} from Level ${lever.currentLevel} → Level ${targetLevel} ` +
      `is the key step toward the STEM pathway.`
  }

  return {
    recommendedPathway: recPathway,
    compositeScore:     composite,
    kjseaMaxScore:      KJSEA_MAX,
    subjectsEntered,
    isPartialComposite,
    qualifiesFor:       qualifiesForDeduped,
    nextPathway: {
      name:        'STEM',
      threshold:   stemThreshold,
      currentGap:  compositeGap,
      keyLever: {
        subject:      subjectLabel,
        currentLevel: lever.currentLevel,
        targetLevel,
        pointsGained: lever.pointsGained,
        wouldUnlock,
      },
      unlockMessage,
    },
    disclaimer,
  }
}

/**
 * Get pathway color
 */
export function getPathwayColor(pathway: string): { bg: string, border: string, text: string } {
  switch (pathway) {
    case 'STEM':
      return { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-700' }
    case 'Arts & Sports Science':
    case 'Arts & Sports': // legacy alias
      return { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-700' }
    case 'Social Sciences':
      return { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700' }
    default:
      return { bg: 'bg-gray-50', border: 'border-gray-500', text: 'text-gray-700' }
  }
}