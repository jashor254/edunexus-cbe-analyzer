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
  stem_viable?:           boolean
  stem_gap_subjects?:     string[]
  pathway_readiness?: {
    stem:            number
    social_sciences: number
    arts:            number
  }
  to_unlock_stem?:          string[]
  to_unlock_social?:        string[]
  to_maintain_recommended?: string[]
  alternative_pathway?:     string
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

// ─── Junior Clinic Redesign (3-page) ─────────────────────────────────────────

export interface PathwayGapRow {
  subjectKey: string
  displayName: string
  currentLevel: number
  requiredLevel: number
  gap: number
  status: 'met' | 'one_step' | 'two_steps'
}

export interface PathwayReadinessCard {
  pathway: 'STEM' | 'Social Sciences' | 'Arts & Sports Science'
  score: number
  statusLabel: 'Strongly Ready' | 'Within Reach' | 'Requires Improvement' | 'Significant Preparation Needed'
  statusColor: string
  diagnosis: string
  gapRows: PathwayGapRow[]
}

export interface PathwayRoadmap {
  targetPathway: string
  steps: Array<{ subject: string; fromLevel: number; toLevel: number }>
  timeline: string
  currentScore: number
  projectedScore: number
}

export interface TermPlanAction {
  action: string
}

export interface TermActionPlan {
  thisWeek: TermPlanAction[]
  thisMonth: TermPlanAction[]
  beforeGrade10: TermPlanAction[]
}

export interface JuniorFutureOpportunity {
  pathway: string
  examples: string[]
  whyItFits: string
}

// ─── Junior Redesign v2 Types ─────────────────────────────────────────────────

export interface JuniorImprovementCascade {
  targetPathway: string
  subjectKey: string
  displayName: string
  currentLevel: number
  targetLevel: number
  gap: number
  estimatedTimeline: string
  probability: 'High' | 'Medium' | 'Possible'
  unlocks: string[]
}

export interface JuniorActionPriority {
  rank: 1 | 2 | 3
  subject: string
  currentLevel: number
  targetLevel: number
  whyItMatters: string
  compassReason: string
  intervention: string
  estimatedSessions: number
  timeline: string
}

export interface ParentAction {
  action: string
}

// ─── Senior Redesign v2 Types ─────────────────────────────────────────────────

export interface SeniorReadinessIndicators {
  pathwayReadinessScore: number
  universityReadiness: 'Strong' | 'Developing' | 'Emerging' | 'Needs Work'
  universityReadinessDetail: string
  careerReadiness: 'Strong' | 'Developing' | 'Emerging' | 'Needs Work'
  careerReadinessDetail: string
  pathwayProgress: 'On Track' | 'Needs Attention' | 'Critical'
  pathwayProgressDetail: string
}

export interface CareerInsightCard {
  name: string
  alignment: number
  futureOutlook: string
  aiImpact: string
  selfEmploymentPotential: string
  selfEmploymentExamples: string[]
}

export interface FutureScenario {
  subject: string
  currentLevel: number
  improvedLevel: number
  currentTrajectory: string
  improvedImpacts: string[]
}

export interface SeniorActionPriority {
  rank: 1 | 2 | 3
  subject: string
  currentLevel: number
  targetLevel: number
  whyItMatters: string
  expectedBenefit: string
  compassSubject: string
  compassReason: string
  estimatedSessions: number
  timeline: string
}

// ─── Main Report ─────────────────────────────────────────────────────────────

import type { DreamCareerAnalysis } from './careerEngine'

export interface AcademicClinicReport {
  studentProfile: StudentProfile
  subjectBreakdown: SubjectProgress[]
  vitals: Vitals
  actionPlan: ActionPlan
  clinicalOverview: ClinicalOverview
  pathwayAnalysis?: PathwayAnalysis
  holidayPlan: HolidayActionPlan
  learningCompassRec: LearningCompassRec
  juniorGuidance?: JuniorGuidance
  seniorGuidance?: SeniorGuidance
  dreamCareerAnalysis?: DreamCareerAnalysis | null
  graphData: GraphData
  reportId: string
  generatedAt: string
  // ── Junior 3-page redesign v1 fields (kept for compat)
  academicStatusLabel?: string
  pathwayReadinessCards?: PathwayReadinessCard[]
  pathwayRoadmap?: PathwayRoadmap
  termActionPlan?: TermActionPlan
  juniorFutureOpportunities?: JuniorFutureOpportunity[]
  // ── Junior redesign v2 fields
  juniorImprovementCascade?: JuniorImprovementCascade | null
  juniorActionPriorities?: JuniorActionPriority[]
  parentAction?: ParentAction
  // ── Senior redesign v2 fields
  seniorReadinessIndicators?: SeniorReadinessIndicators
  careerInsightCards?: CareerInsightCard[]
  futureScenario?: FutureScenario | null
  seniorActionPriorities?: SeniorActionPriority[]
}
