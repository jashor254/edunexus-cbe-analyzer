export type LessonOutcome = {
  id: string
  subject: string
  concept: string
  substrand: string
  masteryStatement: string
  masteryEvidence: string[]
  milestones: {
    step: number
    description: string
    checkQuestion: string
    achieved: boolean
    achievedAt?: Date
  }[]
  status: 'not_started' | 'in_progress' | 'achieved' | 'consolidated'
  sessionsSpent: number
  lastAttempted?: Date
  achievedAt?: Date
  setBy: 'teacher' | 'system' | 'learner'
  teacherNote?: string
}

export type WeakTopic = {
  subject: string
  concept: string
  substrand: string
  displayName: string
  currentLevel: number
  whyItMatters: string
}

export type LearnerOutcomeState = {
  studentId: string
  currentOutcome: LessonOutcome | null
  completedOutcomes: LessonOutcome[]
  availableTopics: WeakTopic[]
}
