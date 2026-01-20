// lib/adaptiveLearning.ts

export type LearningTier = 'remedial' | 'reinforcement' | 'standard' | 'challenge'

export type SubjectRecommendation = {
  subject: string
  currentLevel: number
  tier: LearningTier
  tierLabel: string
  color: string
  icon: string
  description: string
  actionSteps: string[]
  resources: string[]
  estimatedTime: string
  targetLevel: number
}

export type LearningVelocity = {
  subject: string
  velocity: number // change per term
  trend: 'accelerating' | 'steady' | 'slowing' | 'insufficient_data'
  prediction: string
}

export type PerformanceAnalysis = {
  overallTier: LearningTier
  subjectsNeedingSupport: number
  subjectsExcelling: number
  averageVelocity: number
  recommendations: SubjectRecommendation[]
  velocities: LearningVelocity[]
}

/**
 * Determine learning tier based on CBC competency level
 */
export function getLearningTier(score: number): LearningTier {
  if (score === 1) return 'remedial'
  if (score === 2) return 'reinforcement'
  if (score === 3) return 'standard'
  if (score === 4) return 'challenge'
  return 'standard'
}

/**
 * Get tier configuration
 */
export function getTierConfig(tier: LearningTier) {
  const configs = {
    remedial: {
      label: 'Foundation Building',
      color: 'red',
      icon: '🔴',
      bgClass: 'bg-red-50',
      borderClass: 'border-red-300',
      textClass: 'text-red-900',
      badgeClass: 'bg-red-100 text-red-800'
    },
    reinforcement: {
      label: 'Gap Closing',
      color: 'yellow',
      icon: '🟡',
      bgClass: 'bg-yellow-50',
      borderClass: 'border-yellow-300',
      textClass: 'text-yellow-900',
      badgeClass: 'bg-yellow-100 text-yellow-800'
    },
    standard: {
      label: 'Maintaining Progress',
      color: 'green',
      icon: '🟢',
      bgClass: 'bg-green-50',
      borderClass: 'border-green-300',
      textClass: 'text-green-900',
      badgeClass: 'bg-green-100 text-green-800'
    },
    challenge: {
      label: 'Advanced Exploration',
      color: 'blue',
      icon: '🔵',
      bgClass: 'bg-blue-50',
      borderClass: 'border-blue-300',
      textClass: 'text-blue-900',
      badgeClass: 'bg-blue-100 text-blue-800'
    }
  }
  
  return configs[tier]
}

/**
 * Generate subject-specific recommendations
 */
export function generateSubjectRecommendation(
  subject: string,
  currentLevel: number,
  subjectKey: string
): SubjectRecommendation {
  const tier = getLearningTier(currentLevel)
  const config = getTierConfig(tier)
  
  const recommendations = {
    remedial: {
      description: "Let's build a strong foundation step by step. We'll break down concepts into simple, manageable pieces.",
      actionSteps: [
        'Focus on absolute basics - master one concept at a time',
        'Practice 10-15 minutes daily with simple, guided exercises',
        'Use visual aids, manipulatives, and hands-on activities',
        'Get one-on-one support from teacher, tutor, or parent',
        'Celebrate small wins to build confidence'
      ],
      resources: [
        'Khan Academy (Basic level videos)',
        'BBC Bitesize (Foundation tier)',
        'Simplified worksheets and practice books',
        'Educational games and apps for foundational skills'
      ],
      estimatedTime: '6-8 weeks with consistent practice',
      targetLevel: 2
    },
    reinforcement: {
      description: "You're on the right track! Let's close the gaps and build your confidence.",
      actionSteps: [
        'Review foundational concepts and identify specific gaps',
        'Practice 20-30 minutes daily with varied exercises',
        'Work through past mistakes to understand patterns',
        'Join peer study groups for collaborative learning',
        'Complete weekly mini-assessments to track progress'
      ],
      resources: [
        'Khan Academy (Standard level)',
        'Textbook practice problems',
        'Online practice quizzes',
        'Study group sessions with classmates'
      ],
      estimatedTime: '4-6 weeks of focused practice',
      targetLevel: 3
    },
    standard: {
      description: "Great work! Let's maintain this momentum and explore the subject more deeply.",
      actionSteps: [
        'Continue regular practice to maintain competency',
        'Explore real-world applications of concepts',
        'Help peers who are struggling (teaching reinforces learning)',
        'Try some challenge problems to test understanding',
        'Connect this subject to your interests and goals'
      ],
      resources: [
        'Standard curriculum materials',
        'Extension activities and projects',
        'Subject-specific clubs or competitions',
        'Online enrichment programs'
      ],
      estimatedTime: 'Ongoing - maintain current level',
      targetLevel: 4
    },
    challenge: {
      description: "Outstanding! Let's push boundaries and explore advanced concepts.",
      actionSteps: [
        'Tackle advanced problems and extension questions',
        'Join competitions and olympiads in this subject',
        'Explore university-level concepts and resources',
        'Mentor other students and share your knowledge',
        'Connect with experts or professionals in this field'
      ],
      resources: [
        'Advanced textbooks and academic journals',
        'Online courses (Coursera, edX)',
        'Subject-specific competitions and challenges',
        'Mentorship programs with professionals'
      ],
      estimatedTime: 'Ongoing - continue advancing',
      targetLevel: 4
    }
  }
  
  const rec = recommendations[tier]
  
  // Add subject-specific customization
  const customSteps = getSubjectSpecificSteps(subjectKey, tier)
  
  return {
    subject,
    currentLevel,
    tier,
    tierLabel: config.label,
    color: config.color,
    icon: config.icon,
    description: rec.description,
    actionSteps: customSteps.length > 0 ? customSteps : rec.actionSteps,
    resources: rec.resources,
    estimatedTime: rec.estimatedTime,
    targetLevel: rec.targetLevel
  }
}

/**
 * Get subject-specific action steps
 */
function getSubjectSpecificSteps(subjectKey: string, tier: LearningTier): string[] {
  const subjectSteps: Record<string, Record<LearningTier, string[]>> = {
    mathematics: {
      remedial: [
        'Master basic number operations (addition, subtraction, multiplication, division)',
        'Practice counting, place value, and number patterns daily',
        'Use concrete objects (blocks, counters) to visualize math concepts',
        'Work on times tables until automatic (5-10 min daily)',
        'Solve simple word problems with pictures and drawings'
      ],
      reinforcement: [
        'Review fractions, decimals, and percentages thoroughly',
        'Practice mental math strategies daily',
        'Work through problem-solving steps systematically',
        'Complete timed exercises to build speed and accuracy',
        'Apply math to real-life situations (shopping, cooking, sports)'
      ],
      standard: [
        'Explore different problem-solving approaches',
        'Practice multi-step word problems regularly',
        'Connect math to science and technology applications',
        'Try math puzzles and logic games',
        'Participate in math challenges or clubs'
      ],
      challenge: [
        'Tackle olympiad-level problems and competitions',
        'Explore advanced topics (algebra, geometry proofs)',
        'Learn programming to apply mathematical thinking',
        'Study mathematical patterns and number theory',
        'Join Kenya Mathematics Olympiad or similar programs'
      ]
    },
    integrated_science: {
      remedial: [
        'Review basic scientific concepts with videos and diagrams',
        'Conduct simple home experiments with adult supervision',
        'Create visual notes with pictures and labels',
        'Focus on one topic at a time (plants, animals, materials)',
        'Use science games and interactive apps'
      ],
      reinforcement: [
        'Practice the scientific method with simple investigations',
        'Keep a science journal documenting observations',
        'Watch educational documentaries and videos',
        'Complete hands-on experiments and projects',
        'Review key vocabulary and definitions regularly'
      ],
      standard: [
        'Design and conduct your own science experiments',
        'Join science club or environmental groups',
        'Explore STEM career options and role models',
        'Read popular science books and magazines',
        'Connect science to current events and issues'
      ],
      challenge: [
        'Participate in Kenya Science & Engineering Fair',
        'Explore advanced topics beyond curriculum',
        'Conduct independent research projects',
        'Shadow scientists or visit research facilities',
        'Study for science olympiads and competitions'
      ]
    },
    english: {
      remedial: [
        'Read simple books at your level for 15 minutes daily',
        'Practice basic grammar rules with worksheets',
        'Build vocabulary with flashcards (10 new words/week)',
        'Write simple sentences and short paragraphs',
        'Listen to English stories and audiobooks'
      ],
      reinforcement: [
        'Read grade-level books and discuss them',
        'Practice different types of writing (narrative, descriptive)',
        'Improve grammar through targeted exercises',
        'Expand vocabulary through context and word games',
        'Watch English programs with subtitles'
      ],
      standard: [
        'Read diverse genres and authors regularly',
        'Write creative stories, essays, and reports',
        'Join debate club or drama group',
        'Practice public speaking and presentations',
        'Analyze literature and discuss themes'
      ],
      challenge: [
        'Read classic literature and contemporary works',
        'Write for school newspaper or literary magazine',
        'Participate in writing competitions and debates',
        'Study advanced literary techniques and analysis',
        'Explore creative writing workshops'
      ]
    }
  }
  
  return subjectSteps[subjectKey]?.[tier] || []
}

/**
 * Calculate learning velocity (rate of improvement)
 */
export function calculateLearningVelocity(
  subjectKey: string,
  assessments: Array<{ term: number; score: number }>
): LearningVelocity {
  if (assessments.length < 2) {
    return {
      subject: subjectKey,
      velocity: 0,
      trend: 'insufficient_data',
      prediction: 'Need at least 2 assessments to calculate velocity'
    }
  }
  
  // Calculate average change per term
  let totalChange = 0
  for (let i = 1; i < assessments.length; i++) {
    totalChange += assessments[i].score - assessments[i - 1].score
  }
  
  const velocity = totalChange / (assessments.length - 1)
  
  // Determine trend
  let trend: 'accelerating' | 'steady' | 'slowing' | 'insufficient_data'
  if (assessments.length >= 3) {
    const recentChange = assessments[assessments.length - 1].score - assessments[assessments.length - 2].score
    const earlierChange = assessments[1].score - assessments[0].score
    
    if (recentChange > earlierChange + 0.3) trend = 'accelerating'
    else if (recentChange < earlierChange - 0.3) trend = 'slowing'
    else trend = 'steady'
  } else {
    trend = 'steady'
  }
  
  // Generate prediction
  let prediction = ''
  const currentScore = assessments[assessments.length - 1].score
  
  if (velocity > 0.5) {
    const termsToNext = Math.ceil((Math.floor(currentScore) + 1 - currentScore) / velocity)
    prediction = `At current pace, will reach level ${Math.floor(currentScore) + 1} in ${termsToNext} term(s)`
  } else if (velocity > 0.1) {
    prediction = 'Slow but steady improvement - keep practicing!'
  } else if (velocity < -0.1) {
    prediction = 'Declining - needs immediate intervention and support'
  } else {
    prediction = 'Stable performance - maintain current effort'
  }
  
  return {
    subject: subjectKey,
    velocity: Math.round(velocity * 100) / 100,
    trend,
    prediction
  }
}

/**
 * Analyze overall performance and generate comprehensive recommendations
 */
export function analyzePerformance(
  subjectScores: Record<string, number>,
  historicalData?: Record<string, Array<{ term: number; score: number }>>
): PerformanceAnalysis {
  const recommendations: SubjectRecommendation[] = []
  const velocities: LearningVelocity[] = []
  
  let totalScore = 0
  let subjectsNeedingSupport = 0
  let subjectsExcelling = 0
  
  // Analyze each subject
  Object.entries(subjectScores).forEach(([subject, score]) => {
    totalScore += score
    
    if (score <= 2) subjectsNeedingSupport++
    if (score >= 4) subjectsExcelling++
    
    // Generate recommendation
    const rec = generateSubjectRecommendation(subject, score, subject)
    recommendations.push(rec)
    
    // Calculate velocity if historical data available
    if (historicalData && historicalData[subject]) {
      const velocity = calculateLearningVelocity(subject, historicalData[subject])
      velocities.push(velocity)
    }
  })
  
  const avgScore = totalScore / Object.keys(subjectScores).length
  const overallTier = getLearningTier(Math.round(avgScore))
  
  // Calculate average velocity
  const avgVelocity = velocities.length > 0
    ? velocities.reduce((sum, v) => sum + v.velocity, 0) / velocities.length
    : 0
  
  return {
    overallTier,
    subjectsNeedingSupport,
    subjectsExcelling,
    averageVelocity: Math.round(avgVelocity * 100) / 100,
    recommendations: recommendations.sort((a, b) => a.currentLevel - b.currentLevel), // Prioritize struggling subjects
    velocities: velocities.sort((a, b) => a.velocity - b.velocity) // Prioritize declining subjects
  }
}