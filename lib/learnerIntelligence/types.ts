// lib/learnerIntelligence/types.ts
// Learner Intelligence Report — "Who is this learner becoming?"
// Distinct from Academic Clinic (clinical/prescription) — this is identity + future-focused.

// ─── Shared Primitives ────────────────────────────────────────────────────────

export type GrowthStage =
  | 'Early Foundations'
  | 'Building Foundations'
  | 'Active Growth'
  | 'Strong Momentum'
  | 'Leading Edge'

export type BehaviourLabel = 'Strong' | 'Developing' | 'Emerging' | 'Needs Support'

export type PathwayKey = 'STEM' | 'Social Sciences' | 'Arts & Sports Science'

// ─── Page 1: Learner Snapshot ─────────────────────────────────────────────────

export interface StrengthCard {
  subjectName: string
  level: 1 | 2 | 3 | 4
  levelLabel: string
  observation: string
}

export interface GrowthAreaCard {
  subjectName: string
  level: 1 | 2 | 3 | 4
  whyItMatters: string
  unlockStatement: string
}

export interface PathwayDirection {
  pathway: PathwayKey
  readinessScore: number
  readinessLabel: string
  directionStatement: string
  isRecommended: boolean
}

export interface LearnerSnapshot {
  name: string
  grade: number
  school?: string | null
  term: number
  year: number
  level: 'Junior School' | 'Senior School'
  growthStage: GrowthStage
  futureReadinessScore: number
  futureReadinessLabel: 'Leading' | 'Strong' | 'Growing' | 'Emerging' | 'Building'
  topStrengths: StrengthCard[]
  biggestGrowthArea: GrowthAreaCard
  pathwayDirection: PathwayDirection
  emergingOpportunities: string[]
  learnerStory: string
}

// ─── Page 2: Learning Intelligence ───────────────────────────────────────────

export interface AcademicStrengthInsight {
  subjectName: string
  level: 1 | 2 | 3 | 4
  competencyNote: string
  trendNote?: string
}

export interface GrowthAreaInsight {
  subjectName: string
  level: 1 | 2 | 3 | 4
  gapExplanation: string
  unlockMessage: string
}

export interface BehaviourDimension {
  label: BehaviourLabel
  title: string
  description: string
}

export interface LearningBehaviourProfile {
  consistency: BehaviourDimension
  engagement: BehaviourDimension
  persistence: BehaviourDimension
  confidence: BehaviourDimension
  velocity: BehaviourDimension
  behaviourSummary: string
}

export interface ParentAction {
  timeframe: 'THIS WEEK' | 'THIS MONTH' | 'THIS TERM'
  action: string
  rationale: string
}

export interface LearningIntelligence {
  academicStrengths: AcademicStrengthInsight[]
  growthAreas: GrowthAreaInsight[]
  learningBehaviour: LearningBehaviourProfile
  parentActionPlan: ParentAction[]
}

// ─── Page 3: Future Readiness & Career Intelligence ───────────────────────────

export interface PathwayReadinessInsight {
  pathway: PathwayKey
  score: number
  readinessLabel: string
  readinessColor: string
  explanation: string
  isRecommended: boolean
}

export interface CareerDirection {
  rank: 1 | 2 | 3
  name: string
  alignmentPct: number
  whyItMatches: string
  supportingStrengths: string[]
  gapToImprove: string
}

export interface OpportunityInsight {
  subjectToImprove: string
  currentLevel: number
  ifImprovesMessage: string
  unlockedOpportunities: string[]
}

export interface FutureReadiness {
  pathwayReadiness: PathwayReadinessInsight[]
  careerDirections: CareerDirection[]
  opportunityInsight: OpportunityInsight
}

// ─── Root Report ──────────────────────────────────────────────────────────────

export interface LearnerIntelligenceReport {
  reportId: string
  generatedAt: string
  snapshot: LearnerSnapshot
  intelligence: LearningIntelligence
  futureReadiness: FutureReadiness
}
