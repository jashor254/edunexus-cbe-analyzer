// lib/pathwayRecommendations.ts

// ============================================
// TYPES (EXPORTED)
// ============================================

export interface SubjectScores {
  [key: string]: number
}

export type PathwayTier = 'excellence' | 'good' | 'moderate' | 'developing'

export type PathwayType = 'STEM' | 'Social Sciences' | 'Arts & Sports Science'

export interface ImprovementNeeded {
  subject: string
  current_score: number
  target_score: number
}

export interface PathwayRecommendation {
  recommended_pathway: PathwayType
  tier: PathwayTier
  average_score: number
  confidence_message: string
  encouraging_message: string
  alternative_pathway?: {
    pathway: PathwayType
    improvement_needed: ImprovementNeeded[]
    message: string
  }
  calculated_at: string
}

// ============================================
// MAIN EXPORTED FUNCTION
// ============================================

export function getPathwayRecommendation(scores: SubjectScores): PathwayRecommendation {
  const averageScore = calculateAverageScore(scores)
  const tier = determineTier(averageScore)
  
  const calculated_at = new Date().toISOString()

  // TIER 1 & 2: Excellence & Good (3.0 - 4.0) → STEM
  if (averageScore >= 3.0) {
    const isExcellence = averageScore >= 3.8
    
    return {
      recommended_pathway: 'STEM',
      tier: isExcellence ? 'excellence' : 'good',
      average_score: averageScore,
      confidence_message: isExcellence 
        ? '🌟 EXCELLENCE! Your child is a STAR in STEM!'
        : '✅ Strong STEM ability! Your child is doing great!',
      encouraging_message: generateSTEMMessage(isExcellence),
      calculated_at
    }
  }

  // TIER 3: Moderate (2.0 - 2.9) → Social Sciences
  if (averageScore >= 2.0) {
    const improvementSubjects = identifyImprovementAreas(scores)
    
    return {
      recommended_pathway: 'Social Sciences',
      tier: 'moderate',
      average_score: averageScore,
      confidence_message: '📚 Good fit for Social Sciences pathway!',
      encouraging_message: generateSocialSciencesMessage(),
      alternative_pathway: improvementSubjects.length > 0 ? {
        pathway: 'STEM',
        improvement_needed: improvementSubjects,
        message: generateAlternativeSTEMMessage(improvementSubjects)
      } : undefined,
      calculated_at
    }
  }

  // TIER 4: Developing (< 2.0) → Arts & Sports
  return {
    recommended_pathway: 'Arts & Sports Science',
    tier: 'developing',
    average_score: averageScore,
    confidence_message: '🎨⚽ Arts & Sports Science is the PERFECT fit!',
    encouraging_message: generateArtsAndSportsMessage(),
    calculated_at
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateAverageScore(scores: SubjectScores): number {
  const values = Object.values(scores).filter(v => v > 0)
  if (values.length === 0) return 0
  
  const sum = values.reduce((acc, val) => acc + val, 0)
  return Number((sum / values.length).toFixed(2))
}

function determineTier(average: number): PathwayTier {
  if (average >= 3.8) return 'excellence'
  if (average >= 3.0) return 'good'
  if (average >= 2.0) return 'moderate'
  return 'developing'
}

function identifyImprovementAreas(scores: SubjectScores): ImprovementNeeded[] {
  const stemSubjects = ['mathematics', 'integrated_science', 'pre_technical_studies']
  const improvements: ImprovementNeeded[] = []

  for (const subject of stemSubjects) {
    const score = scores[subject] || 0
    if (score < 3) {
      improvements.push({
        subject: formatSubjectName(subject),
        current_score: score,
        target_score: 3
      })
    }
  }

  return improvements.sort((a, b) => a.current_score - b.current_score).slice(0, 3)
}

function formatSubjectName(key: string): string {
  const specialNames: Record<string, string> = {
    'integrated_science': 'Integrated Science',
    'pre_technical_studies': 'Pre-Technical Studies',
    'mathematics': 'Mathematics',
    'social_studies': 'Social Studies',
    'creative_arts_sports': 'Creative Arts and Sports',
    'agriculture_nutrition': 'Agriculture and Nutrition',
    'english': 'English',
    'kiswahili': 'Kiswahili'
  }

  return specialNames[key] || key.split('_').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ')
}

function generateSTEMMessage(isExcellence: boolean): string {
  if (isExcellence) {
    return `🚀 Your child is EXCEPTIONAL in STEM!

This is where future innovators, engineers, doctors, and tech leaders come from!

💡 What This Means:
✅ Perfect for careers in Medicine, Engineering, Technology
✅ High demand in Kenya's growing tech sector
✅ International opportunities in innovation
✅ Strong foundation for university STEM programs

Keep encouraging their curiosity and problem-solving skills!`
  }

  return `💪 Your child has STRONG STEM potential!

They're on the right track for science and technology careers!

💡 What This Means:
✅ Great fit for Medicine, Engineering, IT, Research
✅ Kenya needs more STEM professionals
✅ Excellent career prospects locally & globally
✅ Building critical thinking & analytical skills

Encourage them to keep exploring and asking "why?"`
}

function generateSocialSciencesMessage(): string {
  return `📚 Social Sciences is a POWERFUL pathway!

Your child shows strong potential in humanities and communication!

💡 What This Means:
✅ Perfect for Law, Journalism, Education, Diplomacy
✅ Strong language and critical thinking skills
✅ Leadership and social awareness abilities
✅ Careers in policy, media, business, and more

🌟 Success Stories:
• Lawyers shape society and justice
• Journalists inform and influence nations
• Educators build the next generation
• Diplomats represent Kenya globally

This pathway builds thinkers and communicators!`
}

function generateAlternativeSTEMMessage(improvements: ImprovementNeeded[]): string {
  let message = `💡 GOOD NEWS! Your child can still do STEM!

They just need to improve in:\n`

  improvements.forEach(item => {
    message += `\n• ${item.subject}: Currently ${item.current_score} → Target ${item.target_score}+`
  })

  message += `\n\n🎯 Action Plan:
✅ Extra practice in these subjects
✅ Use online resources (Khan Academy, BBC Bitesize)
✅ Join study groups or get a tutor
✅ Regular homework completion
✅ Ask teachers for help

With focused effort, STEM is within reach! 💪`

  return message
}

function generateArtsAndSportsMessage(): string {
  return `🎨⚽ ARTS & SPORTS SCIENCE IS REAL GOLD! 🌟

Don't let ANYONE tell you this pathway is "less than" - it's where STARS are born!

💎 Why Arts & Sports is POWERFUL:

🌍 Kenyan Success Stories:
• Lupita Nyong'o - Oscar Winner, Hollywood Star
• Eliud Kipchoge - World Marathon Record Holder
• Wanuri Kahiu - International Award-Winning Filmmaker
• Sauti Sol - Grammy-Nominated Musicians
• Churchill - Comedy Empire Builder

💰 Real Money in This Pathway:
✅ Professional athletes earn MILLIONS
✅ Film & TV industry = billions globally
✅ Creative designers are highly paid
✅ Event planners run successful businesses
✅ Music producers shape culture

🚀 Career Opportunities:
• Film Director & Producer
• Professional Athlete & Coach  
• Graphic Designer & Animator
• Music Artist & Producer
• Fashion Designer
• Sports Management
• Event Planning & Marketing
• Content Creator & Influencer

💪 Special Skills Your Child is Building:
✅ Creativity (most valuable skill in AI age!)
✅ Discipline & hard work
✅ Performance under pressure
✅ Teamwork & collaboration
✅ Physical & mental strength

🌟 THE TRUTH: In 10 years, Kenya will NEED creative minds more than ever. AI can do calculations, but it can't create ART. It can't inspire through SPORTS. It can't move people with PERFORMANCE.

Your child is on a path to SUCCESS, IMPACT, and FULFILLMENT!

Keep supporting their talents - they are VALUABLE! 💯`
}

// ============================================
// STYLING FUNCTIONS (EXPORTED)
// ============================================

export function getPathwayBadge(pathway: PathwayType): {
  bg: string
  border: string
  text: string
  icon: string
} {
  switch (pathway) {
    case 'STEM':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-500',
        text: 'text-blue-700',
        icon: '🔬'
      }
    case 'Social Sciences':
      return {
        bg: 'bg-green-50',
        border: 'border-green-500',
        text: 'text-green-700',
        icon: '📚'
      }
    case 'Arts & Sports Science':
      return {
        bg: 'bg-purple-50',
        border: 'border-purple-500',
        text: 'text-purple-700',
        icon: '🎨'
      }
  }
}

export function getTierBadge(tier: PathwayTier): {
  bg: string
  text: string
  label: string
} {
  switch (tier) {
    case 'excellence':
      return {
        bg: 'bg-gradient-to-r from-amber-500 to-yellow-500',
        text: 'text-white',
        label: 'EXCELLENCE ⭐'
      }
    case 'good':
      return {
        bg: 'bg-gradient-to-r from-green-500 to-emerald-500',
        text: 'text-white',
        label: 'GOOD ✅'
      }
    case 'moderate':
      return {
        bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
        text: 'text-white',
        label: 'MODERATE 📈'
      }
    case 'developing':
      return {
        bg: 'bg-gradient-to-r from-purple-500 to-pink-500',
        text: 'text-white',
        label: 'DEVELOPING 🌱'
      }
  }
}