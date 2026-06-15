import { createServiceClient } from '@/utils/supabase/service'

export type GradeLevel = 'EE' | 'ME' | 'AE' | 'BE'
type GradeDist = Record<GradeLevel, number>

export type ClassOverview = {
  classId: string
  className: string
  grade: number
  stream: string | null
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
  totalMarks: number
  meanScore: number
  meanGrade: string
  position: number | null
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

const SUBJECT_ORDER = [
  'Mathematics', 'English', 'Kiswahili', 'Integrated Science',
  'Pre-Technical Studies', 'Creative Arts', 'Social Studies',
  'CRE', 'Agriculture & Nutrition',
]

function subjectSortKey(s: string): number {
  const i = SUBJECT_ORDER.indexOf(s)
  return i === -1 ? 999 : i
}

function scoreToLevel(score: number): GradeLevel {
  if (score >= 75) return 'EE'
  if (score >= 50) return 'ME'
  if (score >= 25) return 'AE'
  return 'BE'
}

function average(nums: number[]): number {
  if (!nums.length) return 0
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

export async function getAssessmentAnalytics(
  teacherId: string,
  filters: { term?: string; year?: number } = {}
): Promise<AnalyticsData | null> {
  const db = createServiceClient()

  // 1. Fetch assessments
  let q = db
    .from('class_assessments')
    .select('id, title, term, year, class_id')
    .eq('teacher_id', teacherId)

  if (filters.term) q = q.eq('term', filters.term)
  if (filters.year) q = q.eq('year', filters.year)

  const { data: assessments, error: aErr } = await q
  if (aErr || !assessments?.length) return null

  const classIds   = [...new Set(assessments.map(a => a.class_id))]
  const assessmentIds = assessments.map(a => a.id)

  // 2. Fetch class metadata (separate query — avoids join type complexity)
  const { data: classRows } = await db
    .from('teacher_classes')
    .select('id, name, grade, stream')
    .in('id', classIds)

  const classMap = new Map(
    (classRows ?? []).map(c => [
      c.id as string,
      c as { id: string; name: string; grade: number; stream: string | null },
    ])
  )

  // assessmentId → classId
  const assessmentToClass = new Map(assessments.map(a => [a.id, a.class_id]))

  // 3. Fetch all marks in one query
  const { data: rawMarks, error: mErr } = await db
    .from('learner_marks')
    .select('assessment_id, student_name, subject_scores, total_marks, mean_score, mean_grade, position')
    .in('assessment_id', assessmentIds)

  if (mErr) throw new Error('Failed to fetch marks')

  // 4. Group marks by class
  type MarkBucket = {
    studentName: string
    totalMarks: number
    meanScore: number
    meanGrade: string
    position: number | null
    subjectScores: Record<string, number>
  }

  const byClass = new Map<string, MarkBucket[]>()

  for (const m of rawMarks ?? []) {
    const classId = assessmentToClass.get(m.assessment_id as string) ?? ''
    if (!classId) continue
    const bucket = byClass.get(classId) ?? []
    bucket.push({
      studentName:   m.student_name as string,
      totalMarks:    (m.total_marks as number) ?? 0,
      meanScore:     Number(m.mean_score ?? 0),
      meanGrade:     (m.mean_grade as string) ?? 'BE',
      position:      m.position as number | null,
      subjectScores: (m.subject_scores as Record<string, number>) ?? {},
    })
    byClass.set(classId, bucket)
  }

  const { title, term, year } = assessments[0]

  // 5. Class overviews
  const classOverviews: ClassOverview[] = []

  for (const [classId, marks] of byClass) {
    const info = classMap.get(classId)
    if (!info) continue

    const dist: GradeDist = { EE: 0, ME: 0, AE: 0, BE: 0 }
    let highest = 0
    let lowest  = Infinity

    for (const m of marks) {
      const g = m.meanGrade as GradeLevel
      if (g in dist) dist[g]++
      if (m.totalMarks > highest) highest = m.totalMarks
      if (m.totalMarks < lowest)  lowest  = m.totalMarks
    }

    const assessmentId = assessments.find(a => a.class_id === classId)?.id ?? ''

    classOverviews.push({
      classId,
      className:         info.name,
      grade:             info.grade,
      stream:            info.stream,
      assessmentId,
      studentCount:      marks.length,
      meanScore:         average(marks.map(m => m.meanScore)),
      gradeDistribution: dist,
      highestTotal:      highest,
      lowestTotal:       lowest === Infinity ? 0 : lowest,
    })
  }

  // 6. Subject analysis
  const allSubjects = new Set<string>()
  const scoresByClassSubject = new Map<string, Map<string, number[]>>()

  for (const [classId, marks] of byClass) {
    const subjMap = new Map<string, number[]>()
    for (const m of marks) {
      for (const [subj, score] of Object.entries(m.subjectScores)) {
        allSubjects.add(subj)
        const arr = subjMap.get(subj) ?? []
        arr.push(score)
        subjMap.set(subj, arr)
      }
    }
    scoresByClassSubject.set(classId, subjMap)
  }

  const sortedSubjects = [...allSubjects].sort(
    (a, b) => subjectSortKey(a) - subjectSortKey(b)
  )

  const classIdList = Array.from(byClass.keys())
  const subjectRows: SubjectRow[] = []
  const subjectDist: SubjectDistributionEntry[] = []

  for (const subject of sortedSubjects) {
    const classMeans: Record<string, number> = {}
    const allScores: number[] = []
    const distribution: Record<string, GradeDist> = {}

    for (const classId of classIdList) {
      const scores = scoresByClassSubject.get(classId)?.get(subject) ?? []
      if (!scores.length) continue

      classMeans[classId] = average(scores)
      allScores.push(...scores)

      const dist: GradeDist = { EE: 0, ME: 0, AE: 0, BE: 0 }
      for (const s of scores) dist[scoreToLevel(s)]++
      distribution[classId] = dist
    }

    const combinedMean = average(allScores)
    subjectRows.push({ subject, classMeans, combinedMean, combinedGrade: scoreToLevel(combinedMean) })
    subjectDist.push({ subject, distribution })
  }

  // 7. Learner rows (all classes combined)
  const learnerRows: LearnerRow[] = []
  for (const [classId, marks] of byClass) {
    const info = classMap.get(classId)
    if (!info) continue
    for (const m of marks) {
      learnerRows.push({
        studentName: m.studentName,
        classId,
        className:   info.name,
        totalMarks:  m.totalMarks,
        meanScore:   m.meanScore,
        meanGrade:   m.meanGrade,
        position:    m.position,
      })
    }
  }

  return {
    title,
    term,
    year,
    classes:             classOverviews.sort((a, b) => a.className.localeCompare(b.className)),
    subjects:            subjectRows,
    learners:            learnerRows,
    subjectDistribution: subjectDist,
  }
}
