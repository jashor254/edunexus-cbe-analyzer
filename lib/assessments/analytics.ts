import { repos } from '@/lib/repositories'

export type GradeLevel = 'EE' | 'ME' | 'AE' | 'BE'
type GradeDist = Record<GradeLevel, number>

export type ClassOverview = {
  classId: string
  className: string
  grade: number
  stream: string | null
  gradeCohort: string
  assessmentId: string
  studentCount: number
  meanScore: number
  gradeDistribution: GradeDist
  highestTotal: number
  lowestTotal: number
}

export type SubjectRow = {
  subject: string
  classMeans: Record<string, number>  // classId → mean score
  combinedMean: number
  combinedGrade: GradeLevel
}

export type LearnerRow = {
  studentName: string
  classId: string
  className: string
  stream: string | null
  totalMarks: number
  meanScore: number
  meanGrade: string
  position: number | null
  subjectScores: Record<string, number>
}

export type SubjectDistributionEntry = {
  subject: string
  distribution: Record<string, GradeDist>  // classId → GradeDist
}

export type AnalyticsData = {
  title: string
  term: string
  year: number
  classes: ClassOverview[]
  subjects: SubjectRow[]
  learners: LearnerRow[]
  subjectDistribution: SubjectDistributionEntry[]
}

export async function getAssessmentAnalytics(
  teacherId: string,
  filters: { term?: string; year?: number; assessmentType?: string } = {}
): Promise<AnalyticsData | null> {
  return repos.assessments.getAssessmentAnalytics(teacherId, filters)
}
