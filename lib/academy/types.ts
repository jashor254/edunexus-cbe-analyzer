export type AcademyModule = {
  id: string
  title: string
  slug: string
  phase: number
  order: number
  description: string | null
  estimated_mins: number | null
  color: string | null
  published: boolean
  created_at: string
}

export type AcademyLesson = {
  id: string
  module_id: string
  title: string
  order: number
  content: string
  practice_prompt: string | null
  created_at: string
}

export type AcademyProgress = {
  id: string
  teacher_id: string
  lesson_id: string
  completed_at: string
}

export type LessonStub = {
  id: string
  module_id: string
  title: string
  order: number
  created_at: string
}

export type ModuleWithProgress = AcademyModule & {
  lessons: LessonStub[]
  completedCount: number
}

export type LessonWithCompletion = AcademyLesson & {
  completed: boolean
  completed_at: string | null
}

export type ModuleWithLessons = AcademyModule & {
  lessons: LessonWithCompletion[]
  completedCount: number
}

export type AcademyStats = {
  totalLessons: number
  completedLessons: number
  allComplete: boolean
}
