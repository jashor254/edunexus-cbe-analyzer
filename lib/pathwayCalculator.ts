// lib/pathwayCalculator.ts

export type SubjectScores = Record<string, number>

// ─── KJSEA 2025 Disclaimer ────────────────────────────────────────────────────

export const PATHWAY_DISCLAIMER = {
  short:
    'Based on KNEC KJSEA 2025 criteria. ' +
    'Subject to change as CBC evolves.',

  full:
    'This pathway recommendation is based on ' +
    'the official KNEC Kenya Junior Secondary ' +
    'Education Assessment (KJSEA) 2025 placement ' +
    'criteria released December 2025. ' +
    'STEM requires a composite score of 20+ points; ' +
    'Social Sciences and Arts & Sports Science ' +
    'require 25+ points (out of 72 total). ' +
    'As Kenya\'s CBC system continues to evolve, ' +
    'these criteria may be updated. EduNexus will ' +
    'reflect any official changes from KNEC. ' +
    'This is a guide to support planning — final ' +
    'pathway decisions should consider the ' +
    'learner\'s own interests and teacher guidance.',

  source:
    'Source: KNEC KJSEA 2025 Results & Placement ' +
    'Criteria, December 2025.',
}

// ─── Pathway Rules & Weights ──────────────────────────────────────────────────

export const PATHWAY_RULES = {
  STEM: {
    mathematics:        3,   // Level 3+ preferred
    integrated_science: 3,   // Level 3+ preferred
    language_avg:       2.5, // KJSEA 2025: inclusive threshold (59% qualified for STEM)
    // KJSEA 2025: composite minimum
    kjsea_composite_min: 20,
  },
  SOCIAL_SCIENCES: {
    minimum_avg: 2.0,
    kjsea_composite_min: 25,
  },
  ARTS: {
    kjsea_composite_min: 25,
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
}

/**
 * Convert CBC 1-4 scores to KJSEA-equivalent points
 * Official mapping from KNEC KJSEA 2025
 * EE = Exceeding Expectations, ME = Meeting, etc.
 */
export function cbcToKJSEAPoints(level: number): number {
  switch (Math.round(level)) {
    case 4: return 7  // EE  (Exceeding Expectations)
    case 3: return 5  // ME2 (Meeting Expectations)
    case 2: return 3  // AE  (Approaching Expectations)
    case 1: return 1  // BE  (Below Expectations)
    default: return 0
  }
}

export function calculateKJSEAComposite(
  scores: SubjectScores
): number {
  // Sum KJSEA points across all subjects
  return Object.values(scores)
    .filter(v => v > 0)
    .reduce((sum, level) => sum + cbcToKJSEAPoints(level), 0)
}

export function getPathwayCompositeMinimum(
  pathway: 'STEM' | 'Social Sciences' | 'Arts'
): number {
  // Official KNEC KJSEA 2025 thresholds
  switch (pathway) {
    case 'STEM':            return 20
    case 'Social Sciences': return 25
    case 'Arts':            return 25
  }
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

  // ── Gate subject levels ───────────────────────────────────────────────────────
  const mathLevel = scores.mathematics        ?? 0
  const sciLevel  = scores.integrated_science ?? 0
  const engLevel  = scores.english            ?? 0
  const kisLevel  = scores.kiswahili          ?? 0
  const langAvg   = (engLevel + kisLevel) / 2

  // ── KJSEA composite score ─────────────────────────────────────────────────────
  const kjseaComposite   = calculateKJSEAComposite(scores)
  const stemCompositeOk  = kjseaComposite >= 20
  const socialCompositeOk = kjseaComposite >= 25

  // ── Weighted readiness scores (0–100) ────────────────────────────────────────
  const stemWeighted   = calculateWeightedScore(scores, PATHWAY_WEIGHTS.STEM as unknown as Record<string, number>)
  const socialWeighted = calculateWeightedScore(scores, PATHWAY_WEIGHTS.SOCIAL_SCIENCES as unknown as Record<string, number>)
  const artsWeighted   = calculateWeightedScore(scores, PATHWAY_WEIGHTS.ARTS as unknown as Record<string, number>)

  // ── Overall average (1–4 scale) ──────────────────────────────────────────────
  const allLevels = Object.values(scores).filter(v => v > 0)
  const cbcAvg    = allLevels.reduce((a, b) => a + b, 0) / allLevels.length

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
      kjsea_stem_threshold:   20,
      kjsea_qualifies_stem:   stemCompositeOk,
      kjsea_qualifies_social: socialCompositeOk,
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
      kjsea_stem_threshold:   20,
      kjsea_qualifies_stem:   stemCompositeOk,
      kjsea_qualifies_social: socialCompositeOk,
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
    kjsea_stem_threshold:   20,
    kjsea_qualifies_stem:   stemCompositeOk,
    kjsea_qualifies_social: socialCompositeOk,
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
    'creative_arts_sports': 'Creative Arts and Sports',
    'pre_technical_studies': 'Pre-Technical Studies',
    'integrated_science': 'Integrated Science',
    'agriculture_nutrition': 'Agriculture and Nutrition',
    'christian_religious_education': 'Christian Religious Education',
    'islamic_religious_education': 'Islamic Religious Education',
    'social_studies': 'Social Studies',
    'kiswahili_ksl': 'Kiswahili/KSL',
    'community_service_learning': 'Community Service Learning',
    'core_mathematics': 'Core Mathematics',
    'essential_mathematics': 'Essential Mathematics',
    'physical_education': 'Physical Education',
    'ict': 'ICT',
    'christian_education': 'Christian Religious Education',
    'islamic_education': 'Islamic Religious Education',
    'hindu_education': 'Hindu Religious Education'
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