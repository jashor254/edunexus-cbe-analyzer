import { createServiceClient } from '@/utils/supabase/service'
import { calculateMeanGrade, calculateMeanScore, gradeBandKey } from './gradeCalculator'
import type { LearnerMark, ClassAssessment } from './types'
import type { CurriculumType } from './gradeCalculator'

const MARK_COLS = 'id, assessment_id, class_id, teacher_id, student_name, admission_number, subject_scores, total_marks, mean_score, mean_grade, position, created_at, updated_at'

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

function bandCounts(
  marks: LearnerMark[],
  maxScore: number,
  curriculum: CurriculumType
): { EE: number; ME: number; AE: number; BE: number } {
  const counts = { EE: 0, ME: 0, AE: 0, BE: 0 }
  for (const m of marks) {
    if (!m.mean_score) continue
    const g = calculateMeanGrade(m.mean_score, maxScore, curriculum)
    counts[gradeBandKey(g)]++
  }
  return counts
}

export async function getCohortData(
  teacherId: string,
  grade: number,
  term: string,
  year: number
): Promise<CohortResult | null> {
  const db = createServiceClient()

  const gradeCohort = `Grade ${grade}`

  // 1. All classes in this cohort
  const { data: classes } = await db
    .from('teacher_classes')
    .select('id, name, grade, stream, grade_cohort')
    .eq('teacher_id', teacherId)
    .eq('grade_cohort', gradeCohort)

  if (!classes || classes.length === 0) return null

  const classIds = classes.map((c) => c.id)

  // 2. Latest assessment per class for the given term/year
  const { data: assessments } = await db
    .from('class_assessments')
    .select('id, class_id, title, assessment_type, term, year, max_score, subjects, curriculum_type, teacher_id, created_at, updated_at')
    .in('class_id', classIds)
    .eq('term', term)
    .eq('year', year)
    .order('created_at', { ascending: false })

  // pick one assessment per class (most recent)
  const assessmentByClass = new Map<string, ClassAssessment>()
  for (const a of assessments || []) {
    if (!assessmentByClass.has(a.class_id)) {
      assessmentByClass.set(a.class_id, a as unknown as ClassAssessment)
    }
  }

  // 3. Batch fetch marks for all assessments in one query
  const assessmentIds = [...assessmentByClass.values()].map((a) => a.id)
  const { data: rawMarks } = assessmentIds.length > 0
    ? await db
        .from('learner_marks')
        .select(MARK_COLS)
        .in('assessment_id', assessmentIds)
        .eq('teacher_id', teacherId)
    : { data: [] }

  const marksByAssessment = new Map<string, LearnerMark[]>()
  for (const m of rawMarks || []) {
    const bucket = marksByAssessment.get(m.assessment_id) ?? []
    bucket.push(m as LearnerMark)
    marksByAssessment.set(m.assessment_id, bucket)
  }

  const streamSummaries: StreamSummary[] = []
  const allMarks: (LearnerMark & { streamName: string | null; className: string })[] = []

  const curriculum: CurriculumType =
    [...assessmentByClass.values()][0]?.curriculum_type ?? 'cbc'

  for (const cls of classes) {
    const assessment = assessmentByClass.get(cls.id) ?? null
    const marks: LearnerMark[] = assessment
      ? (marksByAssessment.get(assessment.id) ?? [])
      : []

    const maxScore  = assessment?.max_score ?? 100
    const subjects  = assessment?.subjects  ?? []
    const curric    = (assessment?.curriculum_type as CurriculumType) ?? 'cbc'

    const subjectMeans: Record<string, number> = {}
    for (const subj of subjects) {
      const vals = marks.map((m) => Number(m.subject_scores[subj]) || 0)
      subjectMeans[subj] = vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : 0
    }

    const meanScores  = marks.map((m) => m.mean_score ?? calculateMeanScore(m.subject_scores))
    const overallMean = meanScores.length
      ? Math.round((meanScores.reduce((a, b) => a + b, 0) / meanScores.length) * 10) / 10
      : 0

    streamSummaries.push({
      classId:      cls.id,
      className:    cls.name,
      stream:       cls.stream,
      assessment,
      marks,
      subjectMeans,
      overallMean,
      meanGrade:    calculateMeanGrade(overallMean, maxScore, curric),
      bandCounts:   bandCounts(marks, maxScore, curric),
      learnerCount: marks.length,
    })

    for (const m of marks) {
      allMarks.push({ ...m, streamName: cls.stream, className: cls.name })
    }
  }

  if (streamSummaries.length === 0) return null

  // 4. Subject intersection for cohort stats
  const subjectSets = streamSummaries
    .filter((s) => s.assessment)
    .map((s) => new Set(s.assessment!.subjects))
  const sharedSubjects = subjectSets.length > 0
    ? [...subjectSets[0]].filter((s) => subjectSets.every((set) => set.has(s)))
    : []

  const allSubjects = [...new Set(streamSummaries.flatMap((s) => s.assessment?.subjects ?? []))]
  const subjects    = sharedSubjects.length > 0 ? sharedSubjects : allSubjects
  const maxScore    = streamSummaries.find((s) => s.assessment)?.assessment?.max_score ?? 100

  // 5. Per-subject cohort stats
  const subjectStats = subjects.map((subj) => {
    const perStream: Record<string, number> = {}
    let cohortTotal = 0
    let cohortCount = 0
    const bandC = { EE: 0, ME: 0, AE: 0, BE: 0 }

    for (const stream of streamSummaries) {
      const key = stream.stream ?? stream.className
      perStream[key] = stream.subjectMeans[subj] ?? 0
      const vals = stream.marks.map((m) => Number(m.subject_scores[subj]) || 0)
      cohortTotal += vals.reduce((a, b) => a + b, 0)
      cohortCount += vals.length

      for (const m of stream.marks) {
        const score = Number(m.subject_scores[subj]) || 0
        const mg    = calculateMeanGrade(score, maxScore, curriculum)
        bandC[gradeBandKey(mg)]++
      }
    }

    const cohortMean = cohortCount > 0
      ? Math.round((cohortTotal / cohortCount) * 10) / 10
      : 0

    return {
      subject: subj,
      perStream,
      cohortMean,
      meanGrade: calculateMeanGrade(cohortMean, maxScore, curriculum),
      bandCounts: bandC,
    }
  })

  // 6. Combined ranking across all streams
  const combined: CombinedRankRow[] = allMarks
    .filter((m) => (m.total_marks ?? 0) > 0)
    .map((m) => ({
      rank:        0,
      studentName: m.student_name,
      stream:      m.streamName,
      className:   m.className,
      total:       m.total_marks ?? 0,
      meanScore:   m.mean_score ?? calculateMeanScore(m.subject_scores),
      meanGrade:   m.mean_grade ?? calculateMeanGrade(
        m.mean_score ?? calculateMeanScore(m.subject_scores),
        maxScore,
        curriculum
      ),
    }))
    .sort((a, b) => b.total - a.total)

  let rank = 1
  combined.forEach((r, i) => {
    if (i > 0 && r.total < combined[i - 1].total) rank = i + 1
    r.rank = rank
  })

  // 7. Overall cohort mean
  const allMeans = allMarks.map((m) => m.mean_score ?? calculateMeanScore(m.subject_scores))
  const cohortMean = allMeans.length
    ? Math.round((allMeans.reduce((a, b) => a + b, 0) / allMeans.length) * 10) / 10
    : 0

  return {
    grade,
    gradeCohort,
    term,
    year,
    streams:       streamSummaries,
    subjects,
    subjectStats,
    cohortMean,
    cohortGrade:   calculateMeanGrade(cohortMean, maxScore, curriculum),
    topLearners:   combined.slice(0, 20),
    lowLearners:   combined.slice(-10).reverse(),
    totalLearners: allMarks.length,
    curriculum,
  }
}

/** Returns grade cohorts where teacher has 2+ streams with marks entered */
export async function getTeacherCohorts(teacherId: string): Promise<
  { grade: number; gradeCohort: string; streamCount: number; classNames: string[] }[]
> {
  const db = createServiceClient()

  const { data: classes } = await db
    .from('teacher_classes')
    .select('id, grade, grade_cohort, name, stream')
    .eq('teacher_id', teacherId)

  if (!classes) return []

  const byGrade = new Map<string, typeof classes>()
  for (const cls of classes) {
    const key = cls.grade_cohort ?? `Grade ${cls.grade}`
    byGrade.set(key, [...(byGrade.get(key) ?? []), cls])
  }

  return [...byGrade.entries()]
    .filter(([, arr]) => arr.length >= 2)
    .map(([cohort, arr]) => ({
      grade:       arr[0].grade,
      gradeCohort: cohort,
      streamCount: arr.length,
      classNames:  arr.map((c) => c.name),
    }))
}
