import { repos } from '@/lib/repositories'
import { calculateMeanGrade, calculateMeanScore, gradeBandKey } from './gradeCalculator'
import type { LearnerMark, ClassAssessment } from './types'
import type { CurriculumType } from './gradeCalculator'

export type StreamSummary = {
  classId:      string
  className:    string
  stream:       string | null
  assessment:   ClassAssessment | null
  marks:        LearnerMark[]
  subjectMeans: Record<string, number>
  overallMean:  number
  meanGrade:    string
  bandCounts:   { EE: number; ME: number; AE: number; BE: number }
  learnerCount: number
}

export type CombinedRankRow = {
  rank:       number
  studentName:string
  stream:     string | null
  className:  string
  total:      number
  meanScore:  number
  meanGrade:  string
}

export type CohortResult = {
  grade:        number
  gradeCohort:  string
  term:         string
  year:         number
  streams:      StreamSummary[]
  subjects:     string[]
  subjectStats: {
    subject:    string
    perStream:  Record<string, number>
    cohortMean: number
    meanGrade:  string
    bandCounts: { EE: number; ME: number; AE: number; BE: number }
  }[]
  cohortMean:   number
  cohortGrade:  string
  topLearners:  CombinedRankRow[]
  lowLearners:  CombinedRankRow[]
  totalLearners:number
  curriculum:   CurriculumType
}

export async function getCohortData(
  teacherId: string,
  grade: number,
  term: string,
  year: number,
  gradeBoundaries: Record<string, { min: number }> = {}
): Promise<CohortResult | null> {
  return repos.assessments.getCohortData(teacherId, grade, term, year, gradeBoundaries)
}

/** Returns grade cohorts where teacher has 2+ streams with marks entered */
export async function getTeacherCohorts(teacherId: string): Promise<
  { grade: number; gradeCohort: string; streamCount: number; classNames: string[] }[]
> {
  return repos.assessments.getTeacherCohorts(teacherId)
}
