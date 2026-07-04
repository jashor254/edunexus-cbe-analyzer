import { repos } from '@/lib/repositories'
import { calculateMeanScore, calculateMeanGrade } from './gradeCalculator'
import { updateFromAssessment } from '@/lib/learnerModel/updater'
import { publishEvent } from '@/lib/events'
import type { ClassAssessment, LearnerMark, MarkInput, CurriculumType } from './types'

function sumScores(scores: Record<string, number>): number {
  return Object.values(scores).reduce((s, v) => s + (Number(v) || 0), 0)
}

function buildPositionMap(rows: { id: string; total: number }[]): Map<string, number> {
  const sorted = [...rows].sort((a, b) => b.total - a.total)
  const map = new Map<string, number>()
  let pos = 1
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].total < sorted[i - 1].total) pos = i + 1
    map.set(sorted[i].id, pos)
  }
  return map
}

export async function createAssessment(
  teacherId: string,
  classId: string,
  input: {
    title: string
    assessmentType: string
    term: string
    year: number
    maxScore: number
    subjects: string[]
    curriculumType?: CurriculumType
    gradeScaleId?: string | null
  }
): Promise<ClassAssessment> {
  const assessment = await repos.assessments.createAssessment(teacherId, classId, input)

  void publishEvent({
    event_type:      'teacher.assessment.created',
    resource_type:   'assessment',
    resource_id:     assessment.id,
    actor_id:        teacherId,
    payload: {
      assessment_id:   assessment.id,
      class_id:        classId,
      title:           input.title,
      assessment_type: input.assessmentType,
      term:            input.term,
      year:            input.year,
      subjects:        input.subjects,
      curriculum_type: input.curriculumType ?? 'cbc',
    },
    idempotency_key: `teacher.assessment.created:${assessment.id}`,
  }).catch(err => console.error('[events] teacher.assessment.created:', err instanceof Error ? err.message : String(err)))

  return assessment
}

export async function updateAssessment(
  id: string,
  teacherId: string,
  updates: {
    title?: string
    assessment_type?: string
    term?: string
    year?: number
    max_score?: number
    subjects?: string[]
  }
): Promise<ClassAssessment> {
  return repos.assessments.updateAssessment(id, teacherId, updates)
}

export async function bulkSaveMarks(
  assessmentId: string,
  classId: string,
  teacherId: string,
  marks: MarkInput[],
  curriculumType: CurriculumType = 'cbc',
  maxScore: number = 100
): Promise<LearnerMark[]> {
  await repos.assessments.deleteMarksByAssessment(assessmentId, teacherId)

  if (marks.length === 0) return []

  const admNos = marks.map(m => m.admNo).filter(Boolean) as string[]
  const studentMap = new Map<string, string>()
  if (admNos.length > 0) {
    const students = await repos.assessments.findStudentsByAdmissionNumbers(admNos, teacherId)
    students.forEach(s => {
      if (s.admission_number) studentMap.set(s.admission_number, s.id)
    })
  }

  const rows = marks.map((m) => {
    const ms = calculateMeanScore(m.subjectScores)
    return {
      assessment_id:    assessmentId,
      class_id:         classId,
      teacher_id:       teacherId,
      student_name:     m.studentName,
      admission_number: m.admNo || null,
      subject_scores:   m.subjectScores,
      total_marks:      sumScores(m.subjectScores),
      mean_score:       ms,
      mean_grade:       calculateMeanGrade(ms, maxScore, curriculumType),
      student_id:       m.admNo ? (studentMap.get(m.admNo) ?? null) : null,
    }
  })

  const inserted = await repos.assessments.insertMarks(rows)

  const posMap = buildPositionMap(
    inserted.map((r) => ({ id: r.id, total: r.total_marks || 0 }))
  )

  await Promise.all(
    Array.from(posMap.entries()).map(([id, position]) =>
      repos.assessments.updateMarkPosition(id, position)
    )
  )

  void publishEvent({
    event_type:    'teacher.assessment.graded',
    resource_type: 'assessment',
    resource_id:   assessmentId,
    actor_id:      teacherId,
    payload: {
      assessment_id: assessmentId,
      class_id:      classId,
      marks_count:   inserted.length,
    },
  }).catch(err => console.error('[events] teacher.assessment.graded:', err instanceof Error ? err.message : String(err)))

  return repos.assessments.findMarksByAssessment(assessmentId, teacherId)
}

export async function upsertMarksCSV(
  assessmentId: string,
  classId: string,
  teacherId: string,
  marks: MarkInput[],
  curriculumType: CurriculumType = 'cbc',
  maxScore: number = 100
): Promise<{ inserted: number; updated: number; marks: LearnerMark[] }> {
  const existingNames = new Set(
    (await repos.assessments.findExistingMarkNames(assessmentId, teacherId)).map(r => r.student_name)
  )

  const rows = marks.map((m) => {
    const ms = calculateMeanScore(m.subjectScores)
    return {
      assessment_id:    assessmentId,
      class_id:         classId,
      teacher_id:       teacherId,
      student_name:     m.studentName,
      admission_number: m.admNo || null,
      subject_scores:   m.subjectScores,
      total_marks:      sumScores(m.subjectScores),
      mean_score:       ms,
      mean_grade:       calculateMeanGrade(ms, maxScore, curriculumType),
      updated_at:       new Date().toISOString(),
    }
  })

  const inserted = rows.filter((r) => !existingNames.has(r.student_name)).length
  const updated  = rows.filter((r) => existingNames.has(r.student_name)).length

  await repos.assessments.upsertMarks(rows)

  const allMarks = await repos.assessments.findMarkTotalsForAssessment(assessmentId, teacherId)

  const posMap = buildPositionMap(
    allMarks.map((r) => ({ id: r.id, total: r.total_marks || 0 }))
  )

  await Promise.all(
    Array.from(posMap.entries()).map(([id, position]) =>
      repos.assessments.updateMarkPosition(id, position)
    )
  )

  const final = await repos.assessments.findMarksByAssessment(assessmentId, teacherId)

  void publishEvent({
    event_type:    'teacher.assessment.graded',
    resource_type: 'assessment',
    resource_id:   assessmentId,
    actor_id:      teacherId,
    payload: {
      assessment_id: assessmentId,
      class_id:      classId,
      marks_count:   inserted + updated,
    },
  }).catch(err => console.error('[events] teacher.assessment.graded:', err instanceof Error ? err.message : String(err)))

  return { inserted, updated, marks: final }
}

export async function triggerLearnerModelUpdates(
  assessmentId: string,
  teacherId:    string,
): Promise<void> {
  const [assessment, marks] = await Promise.all([
    repos.assessments.findAssessmentById(assessmentId, teacherId),
    repos.assessments.findMarksByAssessment(assessmentId, teacherId),
  ])

  if (!assessment || !marks?.length) return

  // Cast to include student_id which is present in DB but not in the base LearnerMark type
  type MarkWithStudentId = (typeof marks[number]) & { student_id: string | null }
  const marksWithId = marks as MarkWithStudentId[]
  const filteredMarks = marksWithId.filter(m => m.student_id != null)
  if (!filteredMarks.length) return

  const now = new Date().toISOString()

  await repos.assessments.upsertStrandAssessments(
    filteredMarks.map(m => ({
      assessment_id:  assessmentId,
      student_id:     m.student_id,
      subject_scores: m.subject_scores as Record<string, number>,
    }))
  )

  await Promise.allSettled(
    filteredMarks.map(m =>
      updateFromAssessment({
        studentId:     m.student_id as string,
        studentName:   m.student_name as string,
        subjectScores: m.subject_scores as Record<string, number>,
        subjectMarks:  m.subject_scores as Record<string, number>,
        strand:        '',
        subStrand:     '',
        subject:       (assessment.subjects as string[])?.[0] ?? '',
        term:          Number(assessment.term),
        year:          Number(assessment.year),
        assessedAt:    now,
      })
    )
  )
}
