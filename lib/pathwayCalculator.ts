// lib/pathwayCalculator.ts

export type SubjectScores = Record<string, number>

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
  // Performance context
  performance_tier:      'high' | 'mid' | 'low'
  stem_viable:           boolean
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
  // Step 1 — Convert CBC 1–4 to 0–100 percentage for precision
  // ((score - 1) / 3) × 100  →  1→0, 2→33.3, 3→66.7, 4→100
  const pct: Record<string, number> = {}
  for (const [subject, score] of Object.entries(scores)) {
    pct[subject] = ((score - 1) / 3) * 100
  }

  // Step 2 — Raw pathway averages
  // STEM: Maths carries double weight (primary STEM indicator)
  const stemRaw = (
    (pct.mathematics             ?? 0) * 2 +
    (pct.integrated_science      ?? 0) +
    (pct.pre_technical_studies   ?? 0)
  ) / 4

  // Social Sciences: languages + humanities
  const socialRaw = (
    (pct.english        ?? 0) +
    (pct.kiswahili      ?? 0) +
    (pct.social_studies ?? 0) +
    (pct.cre            ?? 0)
  ) / 4

  // Arts & Sports Science: creative + practical
  const artsRaw = (
    (pct.creative_arts_sports  ?? 0) +
    (pct.agriculture_nutrition ?? 0)
  ) / 2

  // Step 3 — CBC average for tier detection (uses original 1–4 scale)
  const allCBC         = Object.values(scores)
  const cbcAvg         = allCBC.reduce((a, b) => a + b, 0) / allCBC.length
  const performanceTier: 'high' | 'mid' | 'low' =
    cbcAvg >= 3.0 ? 'high' : cbcAvg >= 2.0 ? 'mid' : 'low'

  // Step 4 — Apply performance-tier bias
  let stemFinal:   number
  let socialFinal: number
  let artsFinal:   number

  if (performanceTier === 'high') {
    // Capable students should aim for high-demand pathways
    stemFinal   = stemRaw   + 15
    socialFinal = socialRaw + 5
    artsFinal   = artsRaw   - 10
  } else if (performanceTier === 'mid') {
    // Balanced with slight STEM preference
    stemFinal   = stemRaw   + 5
    socialFinal = socialRaw
    artsFinal   = artsRaw
  } else {
    // Low performers: practical pathway builds confidence
    // Never boost STEM for a struggling student — sets them up to fail
    stemFinal   = stemRaw
    socialFinal = socialRaw
    artsFinal   = artsRaw   + 15
  }

  // Step 5 — Top pathway and confidence
  const pathways = [
    { name: 'STEM',                  score: stemFinal,   raw: stemRaw   },
    { name: 'Social Sciences',       score: socialFinal, raw: socialRaw },
    { name: 'Arts & Sports Science', score: artsFinal,   raw: artsRaw   },
  ].sort((a, b) => b.score - a.score)

  const topPathway = pathways[0].name
  const gap        = pathways[0].score - pathways[1].score
  // >= 15 (not >) so that all-Level-1 students hit HIGH confidence for Arts
  const confidence: 'high' | 'medium' | 'low' =
    gap >= 15 ? 'high' : gap >= 8 ? 'medium' : 'low'

  // Step 6 — STEM viability (Maths + Sci both ≥ 55% on CBC scale)
  const mathsPct   = (scores.mathematics        ?? 0) / 4 * 100
  const sciPct     = (scores.integrated_science ?? 0) / 4 * 100
  const stemViable = mathsPct >= 55 && sciPct >= 55

  // Strengths / development areas
  const strengths = Object.entries(scores)
    .filter(([, s]) => s >= 3)
    .map(([k]) => k)
    .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))

  const developmentAreas = Object.entries(scores)
    .filter(([, s]) => s <= 2)
    .map(([k]) => k)
    .sort((a, b) => (scores[a] ?? 0) - (scores[b] ?? 0))

  // Step 7 — Guidance message
  const guidanceMessage = buildGuidanceMessage(topPathway, performanceTier, stemViable, developmentAreas)

  return {
    stem_score:            Math.round(stemRaw),
    arts_sports_score:     Math.round(artsRaw),
    social_sciences_score: Math.round(socialRaw),
    top_pathway:           topPathway,
    confidence,
    strengths,
    development_areas:     developmentAreas,
    guidance_message:      guidanceMessage,
    calculated_at:         new Date().toISOString(),
    performance_tier:      performanceTier,
    stem_viable:           stemViable,
  }
}

function buildGuidanceMessage(
  pathway:         string,
  tier:            'high' | 'mid' | 'low',
  stemViable:      boolean,
  developmentAreas: string[],
): string {
  let message: string

  if (tier === 'high') {
    if (pathway === 'STEM') {
      message =
        'This student shows strong capability across all subjects. Their science and mathematics ' +
        'foundation qualifies them for the STEM pathway — the most in-demand career route in Kenya. ' +
        'With focused work on Mathematics, they can excel in Engineering, Medicine, or Technology.\n\n' +
        '💡 Next steps: Science competitions, coding clubs, maths enrichment.'
    } else if (pathway === 'Social Sciences') {
      message =
        'This is a high-achieving student with strong language and humanities performance. ' +
        'The Social Sciences pathway leads to Law, Business, Education, and Public Service.' +
        (stemViable
          ? ' Their science scores also keep the STEM pathway as a viable alternative.'
          : '') +
        '\n\n💡 Next steps: Debate club, essay writing, reading widely across subjects.'
    } else {
      // High performer going Arts — language/creative scores dominate
      message =
        'This student excels across the board with a clear strength in creative and expressive subjects. ' +
        'The Arts & Sports Science pathway leads to Design, Media, Journalism, Sports Management, and the Creative Industries.\n\n' +
        '💡 Next steps: Competitions in arts, drama, or sports. Explore digital design and media production.'
    }
  } else if (tier === 'mid') {
    if (pathway === 'STEM') {
      message =
        'This student has developing STEM ability with room to grow. With consistent effort in Mathematics ' +
        'and Science, the STEM pathway is achievable and worth pursuing.\n\n' +
        '💡 Next steps: Khan Academy for Maths, BBC Bitesize for Science, regular practice problems.'
    } else if (pathway === 'Social Sciences') {
      message =
        'This student shows solid language and humanities ability. The Social Sciences pathway is a strong fit, ' +
        'leading to Law, Teaching, Business, and Public Service careers.\n\n' +
        '💡 Next steps: Reading habit, writing practice, debate and discussion activities.'
    } else {
      message =
        'This student performs best in creative and practical subjects. The Arts & Sports Science pathway ' +
        'offers hands-on, project-based learning that suits their strengths.\n\n' +
        '💡 Next steps: School arts club, agriculture projects, sports teams, and creative hobbies.'
    }
  } else {
    // Low performer — always Arts regardless of pathway (Arts always wins with +15 boost for low)
    message =
      'This student is still developing foundational skills. The Arts & Sports Science pathway offers ' +
      'practical, hands-on learning that builds confidence. Focus on Agriculture, Creative Arts, and ' +
      'Physical Education this term. With consistent effort, other pathways open up.\n\n' +
      '💡 Priority: Attend every class, complete assignments, ask the teacher for help on missed work.'
  }

  // Development areas
  if (developmentAreas.length > 0) {
    const top3 = developmentAreas.slice(0, 3).map(a => formatSubjectName(a)).join(', ')
    message += `\n\n⚠️ Needs attention: ${top3}.`
  }

  message +=
    '\n\n📌 All subjects remain essential in Junior School. This recommendation helps with planning — ' +
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