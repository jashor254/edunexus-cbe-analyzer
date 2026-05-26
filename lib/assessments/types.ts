import type { CurriculumType } from './gradeCalculator'

export type { CurriculumType }

export type AssessmentType = 'exam' | 'cat' | 'midterm' | 'endterm' | 'opener' | 'assignment'

export type ClassAssessment = {
  id: string
  class_id: string
  teacher_id: string
  title: string
  assessment_type: AssessmentType
  term: string
  year: number
  max_score: number
  subjects: string[]
  curriculum_type: CurriculumType
  grade_scale_id: string | null
  created_at: string
  updated_at: string
}

export type LearnerMark = {
  id: string
  assessment_id: string
  class_id: string
  teacher_id: string
  student_name: string
  admission_number: string | null
  subject_scores: Record<string, number>
  total_marks: number | null
  mean_score: number | null
  mean_grade: string | null
  position: number | null
  created_at: string
  updated_at: string
}

export type AssessmentWithStats = ClassAssessment & {
  learner_count: number
  class_average: number | null
}

export type AssessmentContext = {
  assessment: ClassAssessment
  marks: LearnerMark[]
  class: { id: string; name: string; grade: number; subject: string; stream: string | null; grade_cohort: string | null }
  teacher: { full_name: string; school: string }
}

export type MarkInput = {
  studentName: string
  admNo?: string
  subjectScores: Record<string, number>
}

export type SubjectAnalysis = {
  subject: string
  highest: { name: string; score: number } | null
  lowest: { name: string; score: number } | null
  average: number
  passRate: number
  distribution: {
    a: number
    b: number
    c: number
    d: number
  }
}
