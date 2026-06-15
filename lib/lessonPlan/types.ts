export interface LessonPlanContext {
  // From SOW
  teacherName: string
  tscNumber: string
  school: string
  learningArea: string
  grade: string
  term: number
  year: number
  weekNumber: number
  lessonNumber: number
  strand: string
  subStrand: string
  learningOutcomes: string[]
  learningExperiences: string[]
  keyInquiryQuestions: string[]
  learningResources: string[]
  assessmentMethods: string[]
  // Optional teacher-filled fields
  date?: string
  time?: string
  roll?: string
  organisationOfLearning?: string
  introduction?: string
  step1?: string
  step2?: string
  step3?: string
  conclusion?: string
  extendedActivities?: string
  reflection?: string
}

export interface GeneratedLessonPlan {
  context: LessonPlanContext
  organisationOfLearning: string
  introduction: string
  step1: string
  step2: string
  step3: string
  conclusion: string
  extendedActivities: string
  reflection: string
  generatedAt: string
}

export interface LessonPlanRecord {
  id: string
  sow_id: string
  teacher_id: string
  week_number: number
  lesson_number: number
  strand: string
  sub_strand: string
  learning_outcomes: string[]
  key_inquiry_questions: string[]
  learning_resources: string[]
  organisation_of_learning: string | null
  introduction: string | null
  step_1: string | null
  step_2: string | null
  step_3: string | null
  conclusion: string | null
  extended_activities: string | null
  reflection: string | null
  status: 'generated' | 'edited' | 'taught'
  taught_date: string | null
  generated_at: string
  created_at: string
}

export interface WeeklyGenerationResult {
  generated: number
  week?: number
  subject?: string
  reason?: 'break_week'
  nextTeachingWeek?: number
}
