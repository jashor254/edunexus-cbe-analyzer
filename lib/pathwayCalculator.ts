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
  stem_score: number
  arts_sports_score: number
  social_sciences_score: number
  top_pathway: string
  confidence: 'high' | 'medium' | 'low'
  strengths: string[]
  development_areas: string[]
  guidance_message: string
  calculated_at: string
}

/**
 * Calculate pathway affinity for Junior School students (Grade 7-9)
 */
export function calculateJuniorPathwayAffinity(scores: SubjectScores): PathwayRecommendation {
  // STEM Indicators (weighted by importance)
  const stemSubjects = {
    'mathematics': 0.40,
    'integrated_science': 0.35,
    'pre_technical_studies': 0.25
  }
  
  const stemScore = calculateWeightedScore(scores, stemSubjects)

  // Arts & Sports Indicators
  const artsSubjects = {
    'creative_arts_sports': 0.60,
    'english': 0.20,
    'kiswahili': 0.20
  }
  
  const artsScore = calculateWeightedScore(scores, artsSubjects)

  // Social Sciences Indicators
  const socialSubjects = {
    'social_studies': 0.40,
    'english': 0.30,
    'kiswahili': 0.30
  }
  
  const socialScore = calculateWeightedScore(scores, socialSubjects)

  // Determine top pathway
  const pathways = [
    { name: 'STEM', score: stemScore },
    { name: 'Arts & Sports', score: artsScore },
    { name: 'Social Sciences', score: socialScore }
  ]
  pathways.sort((a, b) => b.score - a.score)
  const topPathway = pathways[0]

  // Calculate confidence level
  const scoreDiff = topPathway.score - pathways[1].score
  let confidence: 'high' | 'medium' | 'low'
  
  if (scoreDiff > 20) {
    confidence = 'high'
  } else if (scoreDiff > 10) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  // Identify strengths (subjects with score >= 3)
  const strengths = Object.entries(scores)
    .filter(([_, score]) => score >= 3)
    .map(([subject, _]) => subject)
    .sort((a, b) => (scores[b] || 0) - (scores[a] || 0))

  // Identify development areas (subjects with score <= 2)
  const developmentAreas = Object.entries(scores)
    .filter(([_, score]) => score <= 2)
    .map(([subject, _]) => subject)
    .sort((a, b) => (scores[a] || 0) - (scores[b] || 0))

  // Generate personalized guidance message
  const guidanceMessage = generateGuidanceMessage(
    topPathway.name, 
    topPathway.score, 
    confidence, 
    strengths,
    developmentAreas,
    scores
  )

  return {
    stem_score: Math.round(stemScore),
    arts_sports_score: Math.round(artsScore),
    social_sciences_score: Math.round(socialScore),
    top_pathway: topPathway.name,
    confidence,
    strengths,
    development_areas: developmentAreas,
    guidance_message: guidanceMessage,
    calculated_at: new Date().toISOString()
  }
}

/**
 * Calculate weighted score for a pathway
 */
function calculateWeightedScore(scores: SubjectScores, weights: Record<string, number>): number {
  let totalScore = 0
  let totalWeight = 0

  for (const [subject, weight] of Object.entries(weights)) {
    const score = scores[subject] || 0
    totalScore += (score / 4) * 100 * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0
}

/**
 * Generate personalized guidance message
 */
function generateGuidanceMessage(
  pathway: string, 
  score: number, 
  confidence: string,
  strengths: string[],
  developmentAreas: string[],
  allScores: SubjectScores
): string {
  const baseMessages = {
    'STEM': {
      high: `🌟 Exceptional STEM potential! Your child demonstrates outstanding analytical and technical abilities with a ${Math.round(score)}% pathway match.`,
      medium: `✅ Good STEM aptitude showing! Your child has solid foundations in science and mathematics with a ${Math.round(score)}% pathway match.`,
      low: `📊 Some STEM capability present. Your child shows potential in technical subjects with a ${Math.round(score)}% pathway match.`
    },
    'Arts & Sports': {
      high: `🎨 Outstanding creative and physical talents! Your child excels in artistic expression and sports with a ${Math.round(score)}% pathway match.`,
      medium: `✨ Good creative abilities emerging! Your child demonstrates solid artistic and athletic potential with a ${Math.round(score)}% pathway match.`,
      low: `🎭 Some creative potential showing. Your child has foundational arts and sports abilities with a ${Math.round(score)}% pathway match.`
    },
    'Social Sciences': {
      high: `📚 Excellent humanities and communication skills! Your child shines in languages and social studies with a ${Math.round(score)}% pathway match.`,
      medium: `📖 Good humanities aptitude! Your child shows strong language and social science abilities with a ${Math.round(score)}% pathway match.`,
      low: `📝 Some social sciences capability. Your child has developing humanities skills with a ${Math.round(score)}% pathway match.`
    }
  }

  let message = baseMessages[pathway as keyof typeof baseMessages][confidence] || ""

  // Add specific recommendations based on pathway
  if (pathway === 'STEM') {
    message += "\n\n💡 Recommendations:\n"
    if (allScores['mathematics'] >= 3 && allScores['integrated_science'] >= 3) {
      message += "• Enroll in science competitions (Kenya Science & Engineering Fair)\n"
      message += "• Join math clubs and coding programs\n"
      message += "• Explore STEM career talks and mentorship\n"
    } else {
      message += "• Strengthen foundation in math and science\n"
      message += "• Use online resources (Khan Academy, BBC Bitesize)\n"
      message += "• Practice problem-solving regularly\n"
    }
    message += "• Likely pathway in Grade 10: STEM"
  } else if (pathway === 'Arts & Sports') {
    message += "\n\n💡 Recommendations:\n"
    message += "• Join arts clubs, drama groups, or music ensembles\n"
    message += "• Participate in school sports teams and tournaments\n"
    message += "• Attend arts exhibitions and performances\n"
    message += "• Explore creative career options early\n"
    message += "• Likely pathway in Grade 10: Arts & Sports Science"
  } else {
    message += "\n\n💡 Recommendations:\n"
    message += "• Join debate clubs and Model UN\n"
    message += "• Increase reading (novels, newspapers, magazines)\n"
    message += "• Practice essay writing and presentations\n"
    message += "• Explore social sciences through documentaries\n"
    message += "• Likely pathway in Grade 10: Social Sciences"
  }

  // Add development area guidance
  if (developmentAreas.length > 0) {
    message += "\n\n⚠️ Areas for Improvement:\n"
    const topDevelopmentAreas = developmentAreas.slice(0, 3)
    topDevelopmentAreas.forEach(area => {
      message += `• ${formatSubjectName(area)}: Needs more attention and practice\n`
    })
  }

  // Add important disclaimer
  message += "\n\n📌 Important: All subjects remain essential in junior school. This guidance helps with planning, but students should continue developing skills across all learning areas. Final pathway decisions should consider the student's interests, teacher input, and long-term goals."

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
    case 'Arts & Sports':
      return { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-700' }
    case 'Social Sciences':
      return { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700' }
    default:
      return { bg: 'bg-gray-50', border: 'border-gray-500', text: 'text-gray-700' }
  }
}