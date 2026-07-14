// lib/repositories/assessment.repository.ts
// All DB access for the assessments domain.

import { BaseRepository } from './base'
import type {
  ClassAssessment,
  LearnerMark,
  AssessmentWithStats,
  AssessmentContext,
  CurriculumType,
  MarkInput,
} from '@/lib/assessments/types'
import type {
  GradeLevel,
  ClassOverview,
  SubjectRow,
  LearnerRow,
  SubjectDistributionEntry,
  AnalyticsData,
} from '@/lib/assessments/analytics'
import type { DbGradeScale } from '@/lib/assessments/gradeScales'
import type { GradeBand } from '@/lib/assessments/gradeCalculator'
import { gradeToPoints } from '@/lib/assessments/gradeCalculator'
import { median, mode } from '@/lib/assessments/analyticsStats'
import type {
  CohortResult,
  StreamSummary,
  CombinedRankRow,
} from '@/lib/assessments/cohortQueries'

// ── Column constants ───────────────────────────────────────────────────────────

const ASSESSMENT_COLS =
  'id, class_id, teacher_id, title, assessment_type, assessment_type_id, term, year, max_score, subjects, curriculum_type, grade_scale_id, created_at, updated_at'

const MARK_COLS =
  'id, assessment_id, class_id, teacher_id, student_name, admission_number, student_id, subject_scores, total_marks, mean_score, mean_grade, position, created_at, updated_at'

const SCALE_COLS =
  'id, teacher_id, name, curriculum_hint, bands, is_default, created_at, updated_at'

// ── Helpers ────────────────────────────────────────────────────────────────────

function gradeLevelFromScore(score: number): GradeLevel {
  if (score >= 75) return 'EE'
  if (score >= 50) return 'ME'
  if (score >= 25) return 'AE'
  return 'BE'
}

function average(nums: number[]): number {
  if (!nums.length) return 0
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

export class AssessmentRepository extends BaseRepository {
  // ── Assessments ─────────────────────────────────────────────────────────────

  async createAssessment(
    teacherId: string,
    classId: string,
    input: {
      title: string
      assessmentType: string
      assessmentTypeId?: string | null
      term: string
      year: number
      maxScore: number
      subjects: string[]
      curriculumType?: CurriculumType
      gradeScaleId?: string | null
    },
  ): Promise<ClassAssessment> {
    const { data, error } = await this.db
      .from('class_assessments')
      .insert({
        teacher_id:         teacherId,
        class_id:           classId,
        title:              input.title,
        assessment_type:    input.assessmentType,
        assessment_type_id: input.assessmentTypeId ?? null,
        term:               input.term,
        year:               input.year,
        max_score:          input.maxScore,
        subjects:           input.subjects,
        curriculum_type:    input.curriculumType ?? 'cbc',
        grade_scale_id:     input.gradeScaleId ?? null,
      })
      .select(ASSESSMENT_COLS)
      .single()

    if (error) throw new Error('Failed to create assessment')
    return data
  }

  async updateAssessment(
    id: string,
    teacherId: string,
    updates: {
      title?: string
      assessment_type?: string
      term?: string
      year?: number
      max_score?: number
      subjects?: string[]
    },
  ): Promise<ClassAssessment> {
    const { data, error } = await this.db
      .from('class_assessments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('teacher_id', teacherId)
      .select(ASSESSMENT_COLS)
      .single()

    if (error) throw new Error('Failed to update assessment')
    return data
  }

  async findAssessmentById(
    id: string,
    teacherId: string,
  ): Promise<ClassAssessment | null> {
    const { data } = await this.db
      .from('class_assessments')
      .select(ASSESSMENT_COLS)
      .eq('id', id)
      .eq('teacher_id', teacherId)
      .single()

    return data ?? null
  }

  async findAssessmentsByTeacher(
    teacherId: string,
    filters: { term?: string; year?: number } = {},
  ): Promise<AssessmentWithStats[]> {
    let q = this.db
      .from('class_assessments')
      .select(ASSESSMENT_COLS)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })

    if (filters.term) q = q.eq('term', filters.term)
    if (filters.year) q = q.eq('year', filters.year)

    const { data, error } = await q
    if (error) throw new Error('Failed to fetch assessments')
    return this._attachStats(data ?? [])
  }

  async findAssessmentsByClass(
    classId: string,
    teacherId: string,
  ): Promise<AssessmentWithStats[]> {
    const { data, error } = await this.db
      .from('class_assessments')
      .select(ASSESSMENT_COLS)
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })

    if (error) throw new Error('Failed to fetch class assessments')
    return this._attachStats(data ?? [])
  }

  async findAssessmentContext(
    assessmentId: string,
    teacherId: string,
  ): Promise<AssessmentContext | null> {
    const [assessmentRes, teacherRes] = await Promise.all([
      this.db
        .from('class_assessments')
        .select(`${ASSESSMENT_COLS}, teacher_classes(id, name, grade, subject, stream, grade_cohort)`)
        .eq('id', assessmentId)
        .eq('teacher_id', teacherId)
        .single(),
      this.db
        .from('teachers')
        .select('full_name, school')
        .eq('id', teacherId)
        .single(),
    ])

    if (!assessmentRes.data || !teacherRes.data) return null

    type TeacherClassJoin = {
      id: string
      name: string
      grade: number
      subject: string
      stream: string | null
      grade_cohort: string | null
    }
    const raw = assessmentRes.data as unknown as ClassAssessment & { teacher_classes: TeacherClassJoin }
    const cls = raw.teacher_classes

    const { data: marks } = await this.db
      .from('learner_marks')
      .select(MARK_COLS)
      .eq('assessment_id', assessmentId)
      .eq('teacher_id', teacherId)
      .order('position', { ascending: true, nullsFirst: false })

    return {
      assessment: {
        id:              raw.id,
        class_id:        raw.class_id,
        teacher_id:      raw.teacher_id,
        title:           raw.title,
        assessment_type: raw.assessment_type,
        assessment_type_id: raw.assessment_type_id ?? null,
        term:            raw.term,
        year:            raw.year,
        max_score:       raw.max_score,
        subjects:        raw.subjects,
        curriculum_type: (raw.curriculum_type as CurriculumType) ?? 'cbc',
        grade_scale_id:  (raw as unknown as { grade_scale_id?: string | null }).grade_scale_id ?? null,
        created_at:      raw.created_at,
        updated_at:      raw.updated_at,
      },
      marks:   marks ?? [],
      class:   cls,
      teacher: teacherRes.data,
    }
  }

  // ── Marks ────────────────────────────────────────────────────────────────────

  async deleteMarksByAssessment(
    assessmentId: string,
    teacherId: string,
  ): Promise<void> {
    await this.db
      .from('learner_marks')
      .delete()
      .eq('assessment_id', assessmentId)
      .eq('teacher_id', teacherId)
  }

  async findStudentsByAdmissionNumbers(
    admNos: string[],
    teacherId: string,
  ): Promise<Array<{ id: string; admission_number: string | null }>> {
    if (admNos.length === 0) return []
    const { data } = await this.db
      .from('students')
      .select('id, admission_number')
      .in('admission_number', admNos)
      .eq('teacher_id', teacherId)
    return data ?? []
  }

  async insertMarks(
    rows: Array<{
      assessment_id: string
      class_id: string
      teacher_id: string
      student_name: string
      admission_number: string | null
      subject_scores: Record<string, number>
      total_marks: number
      mean_score: number
      mean_grade: string
      student_id: string | null
    }>,
  ): Promise<LearnerMark[]> {
    const { data, error } = await this.db
      .from('learner_marks')
      .insert(rows)
      .select(MARK_COLS)

    if (error) throw new Error('Failed to save marks')
    return data ?? []
  }

  async updateMarkPosition(
    id: string,
    position: number,
  ): Promise<void> {
    await this.db
      .from('learner_marks')
      .update({ position, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  async findMarksByAssessment(
    assessmentId: string,
    teacherId: string,
  ): Promise<LearnerMark[]> {
    const { data, error } = await this.db
      .from('learner_marks')
      .select(MARK_COLS)
      .eq('assessment_id', assessmentId)
      .eq('teacher_id', teacherId)
      .order('position', { ascending: true, nullsFirst: false })

    if (error) throw new Error('Failed to fetch marks')
    return data ?? []
  }

  async findMarkTotalsForAssessment(
    assessmentId: string,
    teacherId: string,
  ): Promise<Array<{ id: string; total_marks: number | null }>> {
    const { data } = await this.db
      .from('learner_marks')
      .select('id, total_marks')
      .eq('assessment_id', assessmentId)
      .eq('teacher_id', teacherId)
    return data ?? []
  }

  async findExistingMarkNames(
    assessmentId: string,
    teacherId: string,
  ): Promise<Array<{ student_name: string }>> {
    const { data } = await this.db
      .from('learner_marks')
      .select('student_name')
      .eq('assessment_id', assessmentId)
      .eq('teacher_id', teacherId)
    return data ?? []
  }

  async upsertMarks(
    rows: Array<{
      assessment_id: string
      class_id: string
      teacher_id: string
      student_name: string
      admission_number: string | null
      subject_scores: Record<string, number>
      total_marks: number
      mean_score: number
      mean_grade: string
      updated_at: string
    }>,
  ): Promise<void> {
    const { error } = await this.db
      .from('learner_marks')
      .upsert(rows, { onConflict: 'assessment_id,student_name' })

    if (error) throw new Error(`Failed to upsert marks: ${error.message}`)
  }

  async findStudentNamesByIds(studentIds: string[]): Promise<Map<string, string>> {
    if (studentIds.length === 0) return new Map()

    const { data, error } = await this.db
      .from('students')
      .select('id, name')
      .in('id', studentIds)

    if (error) throw new Error(`Failed to fetch student names: ${error.message}`)

    return new Map((data ?? []).map(s => [s.id as string, s.name as string]))
  }

  async insertTopicalAssessments(
    rows: Array<{
      class_id:   string
      teacher_id: string
      student_id: string
      subject:    string
      strand:     string
      topic:      string
      rating:     number
      marks:      number
      term:       number
      year:       number
    }>,
  ): Promise<void> {
    const { error } = await this.db
      .from('strand_assessments')
      .insert(rows.map(r => ({ ...r, source: 'topical_check' as const })))

    if (error) throw new Error(`Failed to insert topical assessments: ${error.message}`)
  }

  async findPendingAssessments(
    teacherId: string,
  ): Promise<Array<AssessmentWithStats & { class_name: string }>> {
    const { data, error } = await this.db
      .from('class_assessments')
      .select(`${ASSESSMENT_COLS}, teacher_classes(name)`)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })

    if (error) throw new Error('Failed to fetch pending assessments')
    const all = data ?? []

    const withStats = await this._attachStats(all as ClassAssessment[])
    return withStats
      .filter((a) => a.learner_count === 0)
      .map((a, i) => ({
        ...a,
        class_name: (all[i] as unknown as { teacher_classes?: { name: string } })?.teacher_classes?.name ?? '',
      }))
      .slice(0, 5)
  }

  // ── Grade Scales ─────────────────────────────────────────────────────────────

  async findGradeScalesByTeacher(teacherId: string): Promise<DbGradeScale[]> {
    const { data } = await this.db
      .from('teacher_grade_scales')
      .select(SCALE_COLS)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: true })
    return data ?? []
  }

  async upsertGradeScale(
    teacherId: string,
    input: {
      name: string
      curriculumHint: CurriculumType | 'custom'
      bands: GradeBand[]
      isDefault?: boolean
    },
  ): Promise<DbGradeScale> {
    if (input.isDefault) {
      await this.db
        .from('teacher_grade_scales')
        .update({ is_default: false })
        .eq('teacher_id', teacherId)
    }

    const { data, error } = await this.db
      .from('teacher_grade_scales')
      .insert({
        teacher_id:      teacherId,
        name:            input.name,
        curriculum_hint: input.curriculumHint,
        bands:           input.bands,
        is_default:      input.isDefault ?? false,
      })
      .select(SCALE_COLS)
      .single()

    if (error) throw new Error('Failed to create grade scale')
    return data
  }

  async updateGradeScaleRecord(
    id: string,
    teacherId: string,
    input: {
      name?: string
      curriculumHint?: CurriculumType | 'custom'
      bands?: GradeBand[]
      isDefault?: boolean
    },
  ): Promise<DbGradeScale> {
    if (input.isDefault) {
      await this.db
        .from('teacher_grade_scales')
        .update({ is_default: false })
        .eq('teacher_id', teacherId)
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.name !== undefined)           updates.name = input.name
    if (input.curriculumHint !== undefined) updates.curriculum_hint = input.curriculumHint
    if (input.bands !== undefined)          updates.bands = input.bands
    if (input.isDefault !== undefined)      updates.is_default = input.isDefault

    const { data, error } = await this.db
      .from('teacher_grade_scales')
      .update(updates)
      .eq('id', id)
      .eq('teacher_id', teacherId)
      .select(SCALE_COLS)
      .single()

    if (error) throw new Error('Failed to update grade scale')
    return data
  }

  async deleteGradeScale(id: string, teacherId: string): Promise<void> {
    const { error } = await this.db
      .from('teacher_grade_scales')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacherId)
    if (error) throw new Error('Failed to delete grade scale')
  }

  // ── Analytics ────────────────────────────────────────────────────────────────

  async getAssessmentAnalytics(
    teacherId: string,
    filters: { term?: string; year?: number; assessmentType?: string } = {},
  ): Promise<AnalyticsData | null> {
    let q = this.db
      .from('class_assessments')
      .select('id, title, assessment_type, term, year, class_id')
      .eq('teacher_id', teacherId)

    if (filters.term)           q = q.eq('term', filters.term)
    if (filters.year)           q = q.eq('year', filters.year)
    if (filters.assessmentType) q = q.eq('assessment_type', filters.assessmentType)

    const { data: assessments, error: aErr } = await q
    if (aErr || !assessments?.length) return null

    const classIds      = [...new Set(assessments.map(a => a.class_id))]
    const assessmentIds = assessments.map(a => a.id)

    const { data: classRows } = await this.db
      .from('teacher_classes')
      .select('id, name, grade, stream, grade_cohort')
      .in('id', classIds)

    const classMap = new Map(
      (classRows ?? []).map(c => [
        c.id as string,
        c as { id: string; name: string; grade: number; stream: string | null; grade_cohort: string | null },
      ]),
    )

    const assessmentToClass = new Map(assessments.map(a => [a.id, a.class_id]))

    const { data: rawMarks, error: mErr } = await this.db
      .from('learner_marks')
      .select('assessment_id, student_name, subject_scores, total_marks, mean_score, mean_grade, position')
      .in('assessment_id', assessmentIds)

    if (mErr) throw new Error('Failed to fetch marks')

    type MarkBucket = {
      studentName:   string
      totalMarks:    number
      meanScore:     number
      meanGrade:     string
      position:      number | null
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

    const { assessment_type, term, year } = assessments[0]
    const TYPE_LABEL: Record<string, string> = {
      opener: 'Opener', cat: 'CAT', midterm: 'Mid-Term',
      endterm: 'End-Term', exam: 'Exam', assignment: 'Assignment',
    }
    const title = `Term ${term} ${TYPE_LABEL[assessment_type as string] ?? assessment_type} ${year}`

    const classOverviews: ClassOverview[] = []
    for (const [classId, marks] of byClass) {
      const info = classMap.get(classId)
      if (!info) continue

      const dist: Record<GradeLevel, number> = { EE: 0, ME: 0, AE: 0, BE: 0 }
      let highest = 0
      let lowest  = Infinity

      for (const m of marks) {
        const g = m.meanGrade as GradeLevel
        if (g in dist) dist[g]++
        if (m.totalMarks > highest) highest = m.totalMarks
        if (m.totalMarks < lowest)  lowest  = m.totalMarks
      }

      const assessmentId = assessments.find(a => a.class_id === classId)?.id ?? ''

      const grades = marks.map(m => m.meanGrade)
      const points = grades.map(g => gradeToPoints(g)).filter((p): p is number => p !== null)

      classOverviews.push({
        classId,
        className:         info.name,
        grade:             info.grade,
        stream:            info.stream,
        gradeCohort:       info.grade_cohort ?? `Grade ${info.grade}`,
        assessmentId,
        studentCount:      marks.length,
        meanScore:         average(marks.map(m => m.meanScore)),
        gradeDistribution: dist,
        highestTotal:      highest,
        lowestTotal:       lowest === Infinity ? 0 : lowest,
        medianScore:       median(marks.map(m => m.meanScore)),
        modalGrade:        mode(grades),
        meanPoints:        points.length > 0 ? average(points) : null,
      })
    }

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

    const SUBJECT_ORDER = [
      'Mathematics', 'English', 'Kiswahili', 'Integrated Science',
      'Pre-Technical Studies', 'Creative Arts', 'Social Studies',
      'CRE', 'Agriculture & Nutrition',
    ]
    const subjectSortKey = (s: string) => {
      const i = SUBJECT_ORDER.indexOf(s)
      return i === -1 ? 999 : i
    }
    const sortedSubjects = [...allSubjects].sort((a, b) => subjectSortKey(a) - subjectSortKey(b))

    const classIdList = Array.from(byClass.keys())
    const subjectRows: SubjectRow[] = []
    const subjectDist: SubjectDistributionEntry[] = []

    for (const subject of sortedSubjects) {
      const classMeans: Record<string, number> = {}
      const allScores: number[] = []
      const distribution: Record<string, Record<GradeLevel, number>> = {}

      for (const classId of classIdList) {
        const scores = scoresByClassSubject.get(classId)?.get(subject) ?? []
        if (!scores.length) continue

        classMeans[classId] = average(scores)
        allScores.push(...scores)

        const dist: Record<GradeLevel, number> = { EE: 0, ME: 0, AE: 0, BE: 0 }
        for (const s of scores) dist[gradeLevelFromScore(s)]++
        distribution[classId] = dist
      }

      const combinedMean = average(allScores)
      subjectRows.push({ subject, classMeans, combinedMean, combinedGrade: gradeLevelFromScore(combinedMean) })
      subjectDist.push({ subject, distribution })
    }

    const learnerRows: LearnerRow[] = []
    for (const [classId, marks] of byClass) {
      const info = classMap.get(classId)
      if (!info) continue
      for (const m of marks) {
        learnerRows.push({
          studentName:   m.studentName,
          classId,
          className:     info.name,
          stream:        info.stream,
          totalMarks:    m.totalMarks,
          meanScore:     m.meanScore,
          meanGrade:     m.meanGrade,
          position:      m.position,
          subjectScores: m.subjectScores,
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

  // ── Cohort Queries ───────────────────────────────────────────────────────────

  async getCohortData(
    teacherId: string,
    grade: number,
    term: string,
    year: number,
  ): Promise<CohortResult | null> {
    const gradeCohort = `Grade ${grade}`

    // grade_cohort is the sole, deliberate signal for cohort membership — a
    // class sharing the same `grade` number is NOT automatically part of the
    // same cohort (e.g. a standalone pilot class shouldn't merge with real
    // grade streams just because it happens to share a grade number).
    const { data: classes } = await this.db
      .from('teacher_classes')
      .select('id, name, grade, stream, grade_cohort')
      .eq('teacher_id', teacherId)
      .eq('grade_cohort', gradeCohort)

    if (!classes || classes.length === 0) return null

    const classIds = classes.map(c => c.id)

    const { data: assessments } = await this.db
      .from('class_assessments')
      .select('id, class_id, title, assessment_type, term, year, max_score, subjects, curriculum_type, teacher_id, created_at, updated_at')
      .in('class_id', classIds)
      .eq('term', term)
      .eq('year', year)
      .order('created_at', { ascending: false })

    const assessmentByClass = new Map<string, ClassAssessment>()
    for (const a of assessments ?? []) {
      if (!assessmentByClass.has(a.class_id)) {
        assessmentByClass.set(a.class_id, a as unknown as ClassAssessment)
      }
    }

    const assessmentIds = [...assessmentByClass.values()].map(a => a.id)
    const { data: rawMarks } = assessmentIds.length > 0
      ? await this.db
          .from('learner_marks')
          .select(MARK_COLS)
          .in('assessment_id', assessmentIds)
          .eq('teacher_id', teacherId)
      : { data: [] as LearnerMark[] }

    const marksByAssessment = new Map<string, LearnerMark[]>()
    for (const m of rawMarks ?? []) {
      const bucket = marksByAssessment.get(m.assessment_id) ?? []
      bucket.push(m as LearnerMark)
      marksByAssessment.set(m.assessment_id, bucket)
    }

    const curriculum: CurriculumType =
      ([...assessmentByClass.values()][0]?.curriculum_type as CurriculumType) ?? 'cbc'

    const streamSummaries: StreamSummary[] = []
    const allMarks: Array<LearnerMark & { streamName: string | null; className: string }> = []

    for (const cls of classes) {
      const assessment = assessmentByClass.get(cls.id) ?? null
      const marks: LearnerMark[] = assessment
        ? (marksByAssessment.get(assessment.id) ?? [])
        : []

      const subjects = assessment?.subjects ?? []

      const subjectMeans: Record<string, number> = {}
      for (const subj of subjects) {
        const vals = marks.map(m => Number(m.subject_scores[subj]) || 0)
        subjectMeans[subj] = vals.length
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
          : 0
      }

      const meanScores = marks.map(m =>
        m.mean_score != null
          ? m.mean_score
          : Object.values(m.subject_scores as Record<string, number>).reduce((s, v) => s + v, 0) / Math.max(Object.keys(m.subject_scores).length, 1),
      )
      const overallMean = meanScores.length
        ? Math.round((meanScores.reduce((a, b) => a + b, 0) / meanScores.length) * 10) / 10
        : 0

      const bandCounts = { EE: 0, ME: 0, AE: 0, BE: 0 }
      for (const m of marks) {
        if (m.mean_score == null) continue
        const g = m.mean_grade as GradeLevel | null
        if (g && g in bandCounts) bandCounts[g]++
      }

      streamSummaries.push({
        classId:      cls.id,
        className:    cls.name,
        stream:       cls.stream,
        assessment,
        marks,
        subjectMeans,
        overallMean,
        meanGrade:    gradeLevelFromScore(overallMean),
        bandCounts,
        learnerCount: marks.length,
      })

      for (const m of marks) {
        allMarks.push({ ...m, streamName: cls.stream, className: cls.name })
      }
    }

    if (streamSummaries.length === 0) return null

    const subjectSets = streamSummaries
      .filter(s => s.assessment)
      .map(s => new Set(s.assessment!.subjects))
    const sharedSubjects = subjectSets.length > 0
      ? [...subjectSets[0]].filter(s => subjectSets.every(set => set.has(s)))
      : []

    const allSubjectsUnion = [...new Set(streamSummaries.flatMap(s => s.assessment?.subjects ?? []))]
    const subjects = sharedSubjects.length > 0 ? sharedSubjects : allSubjectsUnion
    const maxScore = streamSummaries.find(s => s.assessment)?.assessment?.max_score ?? 100

    const subjectStats = subjects.map(subj => {
      const perStream: Record<string, number> = {}
      let cohortTotal = 0
      let cohortCount = 0
      const bandC = { EE: 0, ME: 0, AE: 0, BE: 0 }

      for (const stream of streamSummaries) {
        const key = stream.stream ?? stream.className
        perStream[key] = stream.subjectMeans[subj] ?? 0
        const vals = stream.marks.map(m => Number(m.subject_scores[subj]) || 0)
        cohortTotal += vals.reduce((a, b) => a + b, 0)
        cohortCount += vals.length

        for (const m of stream.marks) {
          const score = Number(m.subject_scores[subj]) || 0
          const g = gradeLevelFromScore(score)
          bandC[g]++
        }
      }

      const cohortMean = cohortCount > 0
        ? Math.round((cohortTotal / cohortCount) * 10) / 10
        : 0

      return {
        subject: subj,
        perStream,
        cohortMean,
        meanGrade: gradeLevelFromScore(cohortMean),
        bandCounts: bandC,
      }
    })

    const combined: CombinedRankRow[] = allMarks
      .filter(m => (m.total_marks ?? 0) > 0)
      .map(m => ({
        rank:        0,
        studentName: m.student_name,
        stream:      m.streamName,
        className:   m.className,
        total:       m.total_marks ?? 0,
        meanScore:   m.mean_score ?? 0,
        meanGrade:   m.mean_grade ?? gradeLevelFromScore(m.mean_score ?? 0),
      }))
      .sort((a, b) => b.total - a.total)

    let rank = 1
    combined.forEach((r, i) => {
      if (i > 0 && r.total < combined[i - 1].total) rank = i + 1
      r.rank = rank
    })

    const allMeans = allMarks.map(m => m.mean_score ?? 0)
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
      cohortGrade:   gradeLevelFromScore(cohortMean),
      topLearners:   combined.slice(0, 20),
      lowLearners:   combined.slice(-10).reverse(),
      totalLearners: allMarks.length,
      curriculum,
    }
  }

  async getTeacherCohorts(
    teacherId: string,
  ): Promise<Array<{ grade: number; gradeCohort: string; streamCount: number; classNames: string[] }>> {
    const { data: classes } = await this.db
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
        classNames:  arr.map(c => c.name),
      }))
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async _attachStats(
    assessments: ClassAssessment[],
  ): Promise<AssessmentWithStats[]> {
    if (assessments.length === 0) return []

    const ids = assessments.map(a => a.id)
    const { data: allMarks } = await this.db
      .from('learner_marks')
      .select('assessment_id, total_marks')
      .in('assessment_id', ids)

    const byAssessment = new Map<string, { total_marks: number | null }[]>()
    for (const m of allMarks ?? []) {
      const bucket = byAssessment.get(m.assessment_id) ?? []
      bucket.push(m)
      byAssessment.set(m.assessment_id, bucket)
    }

    return assessments.map(a => {
      const marks = byAssessment.get(a.id) ?? []
      const valid = marks.filter(m => m.total_marks !== null)
      const avg =
        valid.length > 0
          ? valid.reduce((s, m) => s + (m.total_marks || 0), 0) / valid.length
          : null
      return {
        ...a,
        learner_count: marks.length,
        class_average: avg !== null ? Math.round(avg * 10) / 10 : null,
      }
    })
  }

  // ── Core assessments (extended columns) ──────────────────────────────────────

  private readonly CORE_ASSESSMENT_COLS =
    'id, class_id, teacher_id, title, assessment_type, term, year, max_score, subjects, curriculum_type, grade_scale_id, weight_percent, grading_type, is_published, grade_id, created_at, updated_at'

  async listAssessmentsByClass(
    classId: string,
    filters?: { term?: string; year?: number },
  ): Promise<Record<string, unknown>[]> {
    let query = this.db
      .from('class_assessments')
      .select(this.CORE_ASSESSMENT_COLS)
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
    if (filters?.term) query = query.eq('term', filters.term)
    if (filters?.year) query = query.eq('year', filters.year)
    const { data, error } = await query
    if (error) throw new Error(`listAssessments: ${error.message}`)
    return data ?? []
  }

  async createCoreAssessment(input: {
    class_id: string
    teacher_id: string
    title: string
    assessment_type: string
    term: string
    year: number
    max_score: number
    subjects: string[]
    curriculum_type: string
    weight_percent?: number
    grading_type?: string
    grade_id?: string
  }): Promise<Record<string, unknown>> {
    const { data, error } = await this.db
      .from('class_assessments')
      .insert({
        ...input,
        weight_percent: input.weight_percent ?? 100,
        grading_type: input.grading_type ?? 'both',
        is_published: false,
      })
      .select(this.CORE_ASSESSMENT_COLS)
      .single()
    if (error) throw new Error(`createAssessment: ${error.message}`)
    return data
  }

  async publishAssessmentById(assessmentId: string): Promise<void> {
    const { error } = await this.db
      .from('class_assessments')
      .update({ is_published: true })
      .eq('id', assessmentId)
    if (error) throw new Error(`publishAssessment: ${error.message}`)
  }

  async findMarksByAssessmentForScores(assessmentId: string): Promise<Array<{
    student_id: string | null
    admission_number: string | null
    subject_scores: Record<string, number>
    total_marks: number | null
    mean_score: number | null
    mean_grade: string | null
    position: number | null
    student_name: string
  }>> {
    const { data, error } = await this.db
      .from('learner_marks')
      .select('student_id, admission_number, subject_scores, total_marks, mean_score, mean_grade, position, student_name')
      .eq('assessment_id', assessmentId)
      .order('position')
    if (error) throw new Error(`getAssessmentScores: ${error.message}`)
    return (data ?? []) as Array<{
      student_id: string | null
      admission_number: string | null
      subject_scores: Record<string, number>
      total_marks: number | null
      mean_score: number | null
      mean_grade: string | null
      position: number | null
      student_name: string
    }>
  }

  async saveScores(
    assessmentId: string,
    classId: string,
    teacherId: string,
    scores: Array<{
      learner_id: string
      admission_number: string
      student_name: string
      subject_scores: Record<string, number>
      total_marks: number
      mean_score: number
      mean_grade?: string
    }>,
  ): Promise<void> {
    const rows = scores.map((s, i) => ({
      assessment_id:    assessmentId,
      class_id:         classId,
      teacher_id:       teacherId,
      student_id:       s.learner_id,
      admission_number: s.admission_number,
      student_name:     s.student_name,
      subject_scores:   s.subject_scores,
      total_marks:      s.total_marks,
      mean_score:       s.mean_score,
      mean_grade:       s.mean_grade ?? null,
      position:         i + 1,
    }))
    const { error } = await this.db
      .from('learner_marks')
      .upsert(rows, { onConflict: 'assessment_id,student_id' })
    if (error) throw new Error(`saveScores: ${error.message}`)
  }

  async findPublishedAssessmentsByClass(classId: string): Promise<Array<{
    id: string
    subjects: unknown
    max_score: number
    weight_percent: number
  }>> {
    const { data } = await this.db
      .from('class_assessments')
      .select('id, subjects, max_score, weight_percent')
      .eq('class_id', classId)
      .eq('is_published', true)
    return (data ?? []) as Array<{ id: string; subjects: unknown; max_score: number; weight_percent: number }>
  }

  async findMarksByAssessmentIds(assessmentIds: string[]): Promise<Array<{
    assessment_id: string
    student_id: string | null
    subject_scores: Record<string, number>
    total_marks: number | null
  }>> {
    const { data } = await this.db
      .from('learner_marks')
      .select('assessment_id, student_id, subject_scores, total_marks')
      .in('assessment_id', assessmentIds)
    return (data ?? []) as Array<{
      assessment_id: string
      student_id: string | null
      subject_scores: Record<string, number>
      total_marks: number | null
    }>
  }

  async findSubjectsByCodeList(): Promise<Array<{ id: string; code: string; name: string }>> {
    const { data } = await this.db.from('subjects').select('id, code, name')
    return (data ?? []) as Array<{ id: string; code: string; name: string }>
  }

  async upsertTermSubjectSummaries(rows: Array<{
    school_id: string
    learner_id: string
    term_id: string
    class_id: string
    subject_id: string
    weighted_score: number
    cbc_level: string
    computed_at: string
  }>): Promise<void> {
    const { error } = await this.db
      .from('term_subject_summaries')
      .upsert(rows, { onConflict: 'learner_id,term_id,subject_id' })
    if (error) throw new Error(`computeTermSummaries: ${error.message}`)
  }

  async findTermSummariesForPositionUpdate(classId: string, termId: string): Promise<Array<{
    id: string
    subject_id: string
    weighted_score: number | null
  }>> {
    const { data } = await this.db
      .from('term_subject_summaries')
      .select('id, subject_id, weighted_score')
      .eq('class_id', classId)
      .eq('term_id', termId)
      .order('subject_id')
      .order('weighted_score', { ascending: false })
    return (data ?? []) as Array<{ id: string; subject_id: string; weighted_score: number | null }>
  }

  async updateTermSummaryPosition(id: string, position: number): Promise<void> {
    await this.db
      .from('term_subject_summaries')
      .update({ position_in_class: position })
      .eq('id', id)
  }

  async findTermSummariesWithSubjects(classId: string, termId: string): Promise<Array<{
    subject_id: string
    weighted_score: number | null
    cbc_level: string | null
    subjects: unknown
  }>> {
    const { data, error } = await this.db
      .from('term_subject_summaries')
      .select('subject_id, weighted_score, cbc_level, subjects (name)')
      .eq('class_id', classId)
      .eq('term_id', termId)
    if (error) throw new Error(`getClassPerformanceSummary: ${error.message}`)
    return (data ?? []) as Array<{
      subject_id: string
      weighted_score: number | null
      cbc_level: string | null
      subjects: unknown
    }>
  }

  // ── Remedial actions ──────────────────────────────────────────────────────────

  async insertRemedialAction(data: {
    sow_id:              string
    teacher_id:          string
    substrand_health_id: string
    week_of:             string
    strand:              string
    sub_strand:          string
    root_cause:          string | null
    suggested_activity:  string
    questions:           string[]
    generated_at:        string
  }): Promise<{ id: string }> {
    const { data: inserted, error } = await this.db
      .from('remedial_actions')
      .insert(data)
      .select('id')
      .single()
    if (error || !inserted) throw new Error(`Failed to save remedial action: ${error?.message ?? 'unknown'}`)
    return { id: (inserted as { id: string }).id }
  }

  async findRemedialActionsByHealthIds(
    teacherId:  string,
    healthIds:  string[],
  ): Promise<Array<{ id: string; substrand_health_id: string | null; suggested_activity: string; questions: string[]; generated_at: string }>> {
    if (healthIds.length === 0) return []
    const { data, error } = await this.db
      .from('remedial_actions')
      .select('id, substrand_health_id, suggested_activity, questions, generated_at')
      .eq('teacher_id', teacherId)
      .in('substrand_health_id', healthIds)
    if (error) throw new Error(`Failed to fetch remedial actions: ${error.message}`)
    return (data ?? []).map(r => ({
      id:                  r.id as string,
      substrand_health_id: r.substrand_health_id as string | null,
      suggested_activity:  r.suggested_activity as string,
      questions:           (r.questions as string[]) ?? [],
      generated_at:        r.generated_at as string,
    }))
  }

  async findLatestAssessmentForClass(
    teacherId: string,
    classId:   string,
  ): Promise<{ id: string; max_score: number } | null> {
    const { data } = await this.db
      .from('class_assessments')
      .select('id, max_score')
      .eq('teacher_id', teacherId)
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return { id: data.id as string, max_score: (data.max_score as number) ?? 100 }
  }

  async findMarksByAssessmentForRemedial(
    assessmentId: string,
    teacherId:    string,
  ): Promise<Array<{ student_name: string; student_id: string | null; subject_scores: Record<string, number> }>> {
    const { data, error } = await this.db
      .from('learner_marks')
      .select('student_name, student_id, subject_scores')
      .eq('assessment_id', assessmentId)
      .eq('teacher_id', teacherId)
    if (error) throw new Error(`Failed to fetch learner marks: ${error.message}`)
    return (data ?? []).map(r => ({
      student_name:   r.student_name as string,
      student_id:     r.student_id as string | null,
      subject_scores: (r.subject_scores as Record<string, number>) ?? {},
    }))
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  async searchAssessmentsByQuery(
    q:         string,
    teacherId: string,
  ): Promise<Array<{ id: string; title: string; assessment_type: string; term: number; year: number }>> {
    const { data } = await this.db
      .from('class_assessments')
      .select('id, title, assessment_type, term, year')
      .eq('teacher_id', teacherId)
      .ilike('title', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10)
    return (data ?? []) as Array<{ id: string; title: string; assessment_type: string; term: number; year: number }>
  }

  async findAssessmentForPipeline(
    assessmentId: string,
    studentId:    string,
  ): Promise<{ id: string; subject_scores: Record<string, number>; term: number; year: number } | null> {
    const { data } = await this.db
      .from('assessments')
      .select('id, subject_scores, term, year')
      .eq('id', assessmentId)
      .eq('student_id', studentId)
      .maybeSingle()
    if (!data) return null
    return {
      id:             data.id as string,
      subject_scores: (data.subject_scores as Record<string, number>) ?? {},
      term:           data.term as number,
      year:           data.year as number,
    }
  }
}

export const assessmentRepository = new AssessmentRepository()
