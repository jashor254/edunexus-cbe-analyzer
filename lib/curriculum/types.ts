export type CurriculumType =
  'cbc' | 'igcse' | 'ib' | 'other'

export type GradingSystem =
  'levels' | 'grades'

export interface SubjectConfig {
  id: string
  name: string
  displayName: string
  isCompulsory: boolean
  group?: string
}

export interface CurriculumPhase {
  name: string
  yearRange: string
  ageRange: string
  subjects: SubjectConfig[]
  nextPhaseGoal: string
  hasPathwayRecommendation: boolean
  phaseType: 'junior' | 'senior'
}

export interface GradeLabel {
  value: string | number
  label: string
  color: string
  numericEquivalent: number // 0-100 for comparison
}

export interface CurriculumConfig {
  id: CurriculumType
  name: string
  fullName: string
  country: string
  ageRange: string
  gradingSystem: GradingSystem
  gradeLabels: GradeLabel[]
  phases: CurriculumPhase[]
  assessmentStyle: 'continuous' | 'exam_based' | 'mixed'
  examBoard?: string
  description: string
}
