// lib/academicClinic/types.ts

export interface StudentProfile {
  id: string
  name: string
  grade: number
  level: 'Junior School' | 'Senior School'
  term: number
  year: number
  pathway?: string | null
  school?: string | null
}

export interface SubjectProgress {
  subject: string
  displayName: string
  level: 1 | 2 | 3 | 4
  trend: 'improving' | 'declining' | 'stable'
  velocity: number
  previousScores: number[]
}

export interface Vitals {
  overallAverage: number
  strengths: number
  needsWork: number
  urgent: number
}

export interface ActionPlan {
  immediate: string[]
  shortTerm: string[]
  longTerm: string[]
}

export interface JuniorGuidance {
  recommendedPathway: 'STEM' | 'Social Sciences' | 'Arts & Sports Science'
  reasoning: string
  strengths: string[]
  areasToImprove: string[]
}

export interface CareerMatch {
  name: string
  description: string
  matchPercentage: number
  requiredSubjects?: string[]
}

export interface SeniorGuidance {
  topCareers: CareerMatch[]
  reasoning: string
  nextSteps: string[]
}

export interface GraphData {
  competencyDistribution: {
    level1: number
    level2: number
    level3: number
    level4: number
  }
  subjectTrends: Array<{
    subject: string
    data: Array<{ term: string; score: number }>
  }>
}

export interface AcademicClinicReport {
  studentProfile: StudentProfile
  subjectBreakdown: SubjectProgress[]
  vitals: Vitals
  actionPlan: ActionPlan
  juniorGuidance?: JuniorGuidance
  seniorGuidance?: SeniorGuidance
  graphData: GraphData
  reportId: string
  generatedAt: string
}