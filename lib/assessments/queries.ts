import { createServiceClient } from '@/utils/supabase/service'
import { calculateMeanScore, calculateMeanGrade } from './gradeCalculator'
import type {
  ClassAssessment,
  LearnerMark,
  AssessmentWithStats,
  AssessmentContext,
  MarkInput,
  SubjectAnalysis,
  CurriculumType,
} from './types'

const ASSESSMENT_COLS = 'id, class_id, teacher_id, title, assessment_type, term, year, max_score, subjects, curriculum_type, grade_scale_id, created_at, updated_at'
const MARK_COLS       = 'id, assessment_id, class_id, teacher_id, student_name, admission_number, subject_scores, total_marks, mean_score, mean_grade, position, created_at, updated_at'

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

async function attachStats(
  assessments: ClassAssessment[],
  db: ReturnType<typeof createServiceClient>
): Promise<AssessmentWithStats[]> {
  if (assessments.length === 0) return []

  const ids = assessments.map((a) => a.id)
  const { data: allMarks } = await db
    .from('learner_marks')
    .select('assessment_id, total_marks')
    .in('assessment_id', ids)

  const byAssessment = new Map<string, { total_marks: number | null }[]>()
  for (const m of allMarks || []) {
    const bucket = byAssessment.get(m.assessment_id) ?? []
    bucket.push(m)
    byAssessment.set(m.assessment_id, bucket)
  }

  return assessments.map((a) => {
    const marks = byAssessment.get(a.id) ?? []
    const valid = marks.filter((m) => m.total_marks !== null)
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

export async function getClassAssessments(
  classId: string,
  teacherId: string
): Promise<AssessmentWithStats[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('class_assessments')
    .select(ASSESSMENT_COLS)
    .eq('class_id', classId)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw new Error('Failed to fetch class assessments')
  return attachStats(data || [], db)
}

export async function getTeacherAssessments(teacherId: string): Promise<AssessmentWithStats[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('class_assessments')
    .select(ASSESSMENT_COLS)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw new Error('Failed to fetch assessments')
  return attachStats(data || [], db)
}

export async function getPendingAssessments(
  teacherId: string
): Promise<(AssessmentWithStats & { class_name: string })[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('class_assessments')
    .select(`${ASSESSMENT_COLS}, teacher_classes(name)`)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw new Error('Failed to fetch pending assessments')
  const all = data || []

  const withStats = await attachStats(all as ClassAssessment[], db)
  return withStats
    .filter((a) => a.learner_count === 0)
    .map((a, i) => ({
      ...a,
      class_name: (all[i] as any)?.teacher_classes?.name || '',
    }))
    .slice(0, 5)
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
  const db = createServiceClient()
  const { data, error } = await db
    .from('class_assessments')
    .insert({
      teacher_id:      teacherId,
      class_id:        classId,
      title:           input.title,
      assessment_type: input.assessmentType,
      term:            input.term,
      year:            input.year,
      max_score:       input.maxScore,
      subjects:        input.subjects,
      curriculum_type: input.curriculumType ?? 'cbc',
      grade_scale_id:  input.gradeScaleId ?? null,
    })
    .select(ASSESSMENT_COLS)
    .single()

  if (error) throw new Error('Failed to create assessment')
  return data
}

export async function getAssessmentById(
  id: string,
  teacherId: string
): Promise<ClassAssessment | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('class_assessments')
    .select(ASSESSMENT_COLS)
    .eq('id', id)
    .eq('teacher_id', teacherId)
    .single()

  return data || null
}

export async function getAssessmentContext(
  assessmentId: string,
  teacherId: string
): Promise<AssessmentContext | null> {
  const db = createServiceClient()

  const [assessmentRes, teacherRes] = await Promise.all([
    db
      .from('class_assessments')
      .select(`${ASSESSMENT_COLS}, teacher_classes(id, name, grade, subject, stream, grade_cohort)`)
      .eq('id', assessmentId)
      .eq('teacher_id', teacherId)
      .single(),
    db
      .from('teachers')
      .select('full_name, school')
      .eq('id', teacherId)
      .single(),
  ])

  if (!assessmentRes.data || !teacherRes.data) return null

  const raw = assessmentRes.data as ClassAssessment & { teacher_classes: any }
  const cls = raw.teacher_classes

  const { data: marks } = await db
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
      term:            raw.term,
      year:            raw.year,
      max_score:       raw.max_score,
      subjects:        raw.subjects,
      curriculum_type: (raw.curriculum_type as CurriculumType) ?? 'cbc',
      grade_scale_id:  (raw as any).grade_scale_id ?? null,
      created_at:      raw.created_at,
      updated_at:      raw.updated_at,
    },
    marks:    marks || [],
    class:    cls,
    teacher:  teacherRes.data,
  }
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
  const db = createServiceClient()
  const { data, error } = await db
    .from('class_assessments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('teacher_id', teacherId)
    .select(ASSESSMENT_COLS)
    .single()

  if (error) throw new Error('Failed to update assessment')
  return data
}

export async function getLearnerMarks(
  assessmentId: string,
  teacherId: string
): Promise<LearnerMark[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('learner_marks')
    .select(MARK_COLS)
    .eq('assessment_id', assessmentId)
    .eq('teacher_id', teacherId)
    .order('position', { ascending: true, nullsFirst: false })

  if (error) throw new Error('Failed to fetch marks')
  return data || []
}

export async function bulkSaveMarks(
  assessmentId: string,
  classId: string,
  teacherId: string,
  marks: MarkInput[],
  curriculumType: CurriculumType = 'cbc',
  maxScore: number = 100
): Promise<LearnerMark[]> {
  const db = createServiceClient()

  await db
    .from('learner_marks')
    .delete()
    .eq('assessment_id', assessmentId)
    .eq('teacher_id', teacherId)

  if (marks.length === 0) return []

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
    }
  })

  const { data: inserted, error } = await db
    .from('learner_marks')
    .insert(rows)
    .select(MARK_COLS)

  if (error) throw new Error('Failed to save marks')

  const posMap = buildPositionMap(
    (inserted || []).map((r) => ({ id: r.id, total: r.total_marks || 0 }))
  )

  await Promise.all(
    Array.from(posMap.entries()).map(([id, position]) =>
      db.from('learner_marks').update({ position, updated_at: new Date().toISOString() }).eq('id', id)
    )
  )

  const { data: final } = await db
    .from('learner_marks')
    .select(MARK_COLS)
    .eq('assessment_id', assessmentId)
    .eq('teacher_id', teacherId)
    .order('position', { ascending: true, nullsFirst: false })

  return final || []
}

export async function upsertMarksCSV(
  assessmentId: string,
  classId: string,
  teacherId: string,
  marks: MarkInput[],
  curriculumType: CurriculumType = 'cbc',
  maxScore: number = 100
): Promise<{ inserted: number; updated: number; marks: LearnerMark[] }> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from('learner_marks')
    .select('student_name')
    .eq('assessment_id', assessmentId)
    .eq('teacher_id', teacherId)

  const existingNames = new Set((existing || []).map((r) => r.student_name as string))

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

  const { error } = await db
    .from('learner_marks')
    .upsert(rows, { onConflict: 'assessment_id,student_name' })

  if (error) throw new Error(`Failed to upsert marks: ${error.message}`)

  // Recalculate positions for ALL marks in this assessment
  const { data: allMarks } = await db
    .from('learner_marks')
    .select('id, total_marks')
    .eq('assessment_id', assessmentId)
    .eq('teacher_id', teacherId)

  const posMap = buildPositionMap(
    (allMarks || []).map((r) => ({ id: r.id, total: r.total_marks || 0 }))
  )

  await Promise.all(
    Array.from(posMap.entries()).map(([id, position]) =>
      db.from('learner_marks').update({ position, updated_at: new Date().toISOString() }).eq('id', id)
    )
  )

  const { data: final } = await db
    .from('learner_marks')
    .select(MARK_COLS)
    .eq('assessment_id', assessmentId)
    .eq('teacher_id', teacherId)
    .order('position', { ascending: true, nullsFirst: false })

  return { inserted, updated, marks: final || [] }
}

export function analyzeSubjects(
  marks: LearnerMark[],
  subjects: string[],
  maxScore: number
): SubjectAnalysis[] {
  return subjects.map((subject) => {
    const scores = marks
      .filter((m) => m.subject_scores[subject] !== undefined)
      .map((m) => ({
        name:  m.student_name,
        score: Number(m.subject_scores[subject]) || 0,
      }))

    if (scores.length === 0) {
      return {
        subject,
        highest:      null,
        lowest:       null,
        average:      0,
        passRate:     0,
        distribution: { a: 0, b: 0, c: 0, d: 0 },
      }
    }

    const sorted   = [...scores].sort((a, b) => b.score - a.score)
    const avg       = scores.reduce((s, x) => s + x.score, 0) / scores.length
    const threshold = maxScore * 0.5
    const passRate  = (scores.filter((x) => x.score >= threshold).length / scores.length) * 100

    const pct = (s: number) => (s / maxScore) * 100
    return {
      subject,
      highest:  sorted[0],
      lowest:   sorted[sorted.length - 1],
      average:  Math.round(avg * 10) / 10,
      passRate: Math.round(passRate),
      distribution: {
        a: scores.filter((x) => pct(x.score) >= 80).length,
        b: scores.filter((x) => pct(x.score) >= 60 && pct(x.score) < 80).length,
        c: scores.filter((x) => pct(x.score) >= 40 && pct(x.score) < 60).length,
        d: scores.filter((x) => pct(x.score) < 40).length,
      },
    }
  })
}
