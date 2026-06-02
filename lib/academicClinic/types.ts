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

// ─── Clinical Overview (Page 2) ──────────────────────────────────────────────

export interface ClinicalOverview {
  overallCompetencyLevel: 1 | 2 | 3 | 4
  overallCompetencyLabel: string
  clinicalParagraph: string
  clinicalStrengths: SubjectProgress[]   // top subjects level 3-4
  priorityAreas: SubjectProgress[]       // bottom subjects level 1-2
  trajectory: 'IMPROVING' | 'STABLE' | 'NEEDS ATTENTION' | 'CRITICAL'
}

// ─── Pathway Analysis (Junior — Page 4A) ─────────────────────────────────────

export interface PathwayScore {
  name: 'STEM' | 'Social Sciences' | 'Arts & Sports Science'
  score: number   // 0–100
  color: string
}

export interface PathwayAnalysis {
  pathwayScores: PathwayScore[]
  recommendedPathway: 'STEM' | 'Social Sciences' | 'Arts & Sports Science'
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'DEVELOPING'
  reasons: string[]
  subjectsToStrengthen: string[]
  futureMessage: string
  stem_viable?:      boolean
  stem_gap_subjects?: string[]
}

// ─── Career Match (Senior — Page 4B) ─────────────────────────────────────────

export interface CareerMatch {
  name: string
  description: string              // kept for web UI backward compat
  matchPercentage: number          // kept for web UI backward compat
  requiredSubjects?: string[]
  matchStrength?: 'STRONG' | 'GOOD' | 'POSSIBLE'
  whyItFits?: string
  keyGap?: string
  kenyanPathway?: string
}

// ─── Junior / Senior Guidance (kept for backward compat with web UI) ─────────

export interface JuniorGuidance {
  recommendedPathway: 'STEM' | 'Social Sciences' | 'Arts & Sports Science'
  reasoning: string
  strengths: string[]
  areasToImprove: string[]
}

export interface SeniorGuidance {
  topCareers: CareerMatch[]
  reasoning: string
  nextSteps: string[]
  honestAssessment?: string
}

// ─── Holiday Action Plan (Page 5) ────────────────────────────────────────────

export interface WeekPlan {
  weekNumber: 1 | 2 | 3
  title: string
  theme: string
  focusSubjects: string[]
  dailyMinutes: number
  goal: string
  activities: string[]
}

export interface HolidayActionPlan {
  weeks: [WeekPlan, WeekPlan, WeekPlan]
  morningRoutine: string
  afternoonRoutine: string
  eveningRoutine: string
}

// ─── Learning Compass Recommendations (Page 6) ───────────────────────────────

export interface LearningCompassRec {
  firstSessionSubject: string
  sessionFrequency: string
  topicsToAsk: string[]
  sessionGoal: string
}

// ─── Graph Data ───────────────────────────────────────────────────────────────

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

// ─── Main Report ─────────────────────────────────────────────────────────────

export interface AcademicClinicReport {
  studentProfile: StudentProfile
  subjectBreakdown: SubjectProgress[]
  vitals: Vitals
  actionPlan: ActionPlan
  clinicalOverview: ClinicalOverview           // NEW — Page 2
  pathwayAnalysis?: PathwayAnalysis            // NEW — Page 4A (Junior)
  holidayPlan: HolidayActionPlan               // NEW — Page 5
  learningCompassRec: LearningCompassRec       // NEW — Page 6
  juniorGuidance?: JuniorGuidance              // kept for web UI
  seniorGuidance?: SeniorGuidance              // kept for web UI (enriched)
  graphData: GraphData
  reportId: string
  generatedAt: string
}
