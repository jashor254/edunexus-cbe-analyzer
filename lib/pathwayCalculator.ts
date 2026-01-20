// lib/pathwayCalculator.ts

export type SubjectScores = Record<string, number>

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