// lib/academicClinic/careerDatabase.ts

export type AIDisruptionRisk = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high'
export type JobGrowthOutlook = 'declining' | 'stable' | 'growing' | 'booming'

export type CareerData = {
  id: string
  name: string
  pathway: 'STEM' | 'Arts & Sports' | 'Social Sciences'
  matchRequirements: {
    primarySubjects: string[]
    minimumLevels: Record<string, number>
  }
  salary: {
    entry: { min: number; max: number }
    mid: { min: number; max: number }
    senior: { min: number; max: number }
    currency: 'KES'
  }
  cbeReadiness: {
    coreCompetencies: string[]
    recommendedSeniorPath: string
    universities: string[]
  }
  aiImpact: {
    disruptionRisk: AIDisruptionRisk
    disruptionPercentage: number
    growthOutlook: JobGrowthOutlook
    growthPercentage: number
    timeline: { shortTerm: string; midTerm: string; longTerm: string }
    survivalStrategy: string[]
  }
}

export const CAREER_DATABASE: CareerData[] = [
  {
    id: 'software_engineer',
    name: 'Software Engineer',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 3, integrated_science: 3 },
    },
    salary: {
      entry: { min: 80000, max: 150000 },
      mid: { min: 200000, max: 400000 },
      senior: { min: 500000, max: 1200000 },
      currency: 'KES',
    },
    cbeReadiness: {
      coreCompetencies: ['Critical Thinking', 'Digital Literacy', 'Problem Solving'],
      recommendedSeniorPath: 'STEM - Cyber-Physical Systems',
      universities: ['JKUAT', 'UoN', 'Strathmore'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 45,
      growthOutlook: 'booming',
      growthPercentage: 180,
      timeline: {
        shortTerm: 'AI tools like Copilot accelerate coding tasks.',
        midTerm: 'Shift toward AI system architecture and ethics.',
        longTerm: 'Human-centric complex problem solving remains vital.',
      },
      survivalStrategy: ['Learn AI Orchestration', 'Master UX Design'],
    },
  },
  {
    id: 'medical_doctor',
    name: 'Medical Doctor',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 3, integrated_science: 4 },
    },
    salary: {
      entry: { min: 120000, max: 200000 },
      mid: { min: 250000, max: 500000 },
      senior: { min: 600000, max: 1500000 },
      currency: 'KES',
    },
    cbeReadiness: {
      coreCompetencies: ['Empathy', 'Communication', 'Ethical Decision Making'],
      recommendedSeniorPath: 'STEM - Biological Sciences Circuit',
      universities: ['UoN', 'Moi', 'Aga Khan'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'growing',
      growthPercentage: 60,
      timeline: {
        shortTerm: 'High demand persists in rural and urban Kenya.',
        midTerm: 'AI enhances diagnostic precision and remote surgery.',
        longTerm: 'Human touch and bedside manner are non-automatable.',
      },
      survivalStrategy: ['Specialize in Surgical Tech', 'Public Health Leadership'],
    },
  },
]

/**
 * Returns careers matching the given pathway where the student meets
 * all minimum competency levels. Sorted by how many levels ABOVE the
 * minimum the student scores (best matches first).
 */
export function getMatchingCareers(pathway: string, scores: Record<string, number>): CareerData[] {
  if (!CAREER_DATABASE) return []

  return CAREER_DATABASE.filter((career) => {
    // Must match the pathway
    if (career.pathway !== pathway) return false

    // Must meet every minimum level for this career
    return Object.entries(career.matchRequirements.minimumLevels).every(
      ([subject, minLevel]) => (scores[subject] ?? 0) >= minLevel
    )
  })
    // Sort by total score surplus across required subjects — best match first
    .sort((a, b) => {
      const surplus = (career: CareerData) =>
        Object.entries(career.matchRequirements.minimumLevels).reduce(
          (sum, [subject, minLevel]) => sum + ((scores[subject] ?? 0) - minLevel),
          0
        )
      return surplus(b) - surplus(a)
    })
    .slice(0, 5)
}