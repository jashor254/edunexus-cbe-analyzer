import { createServiceClient } from '@/utils/supabase/service'
import type { TermSubjectSummary, CbcLevel } from '@/types/core'

// class_assessments is the shared table (extended by Core) — we read/write it here
// learner_marks stores per-student scores as jsonb subject_scores

type AssessmentConfig = {
  id: string
  class_id: string
  teacher_id: string
  title: string
  assessment_type: string
  term: string
  year: number
  max_score: number
  subjects: string[]
  curriculum_type: string
  grade_scale_id: string | null
  weight_percent: number
  grading_type: string
  is_published: boolean
  grade_id: string | null
  created_at: string
  updated_at: string
}

type LearnerScore = {
  learner_id: string
  admission_number: string
  subject_scores: Record<string, number>
  cbc_levels?: Record<string, CbcLevel>
  teacher_comments?: Record<string, string>
  total_marks: number
  mean_score: number
  position?: number
}

const ASSESSMENT_COLS = 'id, class_id, teacher_id, title, assessment_type, term, year, max_score, subjects, curriculum_type, grade_scale_id, weight_percent, grading_type, is_published, grade_id, created_at, updated_at'

export async function listAssessments(
  classId: string,
  filters?: { term?: string; year?: number }
): Promise<AssessmentConfig[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('class_assessments')
    .select(ASSESSMENT_COLS)
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
  if (filters?.term) query = query.eq('term', filters.term)
  if (filters?.year) query = query.eq('year', filters.year)
  const { data, error } = await query
  if (error) throw new Error(`listAssessments: ${error.message}`)
  return data
}

export async function createAssessment(input: {
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
}): Promise<AssessmentConfig> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('class_assessments')
    .insert({
      ...input,
      weight_percent: input.weight_percent ?? 100,
      grading_type: input.grading_type ?? 'both',
      is_published: false,
    })
    .select(ASSESSMENT_COLS)
    .single()
  if (error) throw new Error(`createAssessment: ${error.message}`)
  return data
}

export async function publishAssessment(assessmentId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('class_assessments')
    .update({ is_published: true })
    .eq('id', assessmentId)
  if (error) throw new Error(`publishAssessment: ${error.message}`)
}

// ── Scores ────────────────────────────────────────────────────────────────────

export async function getAssessmentScores(assessmentId: string): Promise<LearnerScore[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('learner_marks')
    .select('student_id, admission_number, subject_scores, total_marks, mean_score, mean_grade, position, student_name')
    .eq('assessment_id', assessmentId)
    .order('position')
  if (error) throw new Error(`getAssessmentScores: ${error.message}`)
  return (data ?? []).map((r) => ({
    learner_id: r.student_id ?? '',
    admission_number: r.admission_number ?? '',
    subject_scores: (r.subject_scores as Record<string, number>) ?? {},
    total_marks: r.total_marks ?? 0,
    mean_score: Number(r.mean_score ?? 0),
    position: r.position ?? undefined,
  }))
}

export async function saveScores(
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
  }>
): Promise<void> {
  const supabase = createServiceClient()
  const rows = scores.map((s, i) => ({
    assessment_id: assessmentId,
    class_id: classId,
    teacher_id: teacherId,
    student_id: s.learner_id,
    admission_number: s.admission_number,
    student_name: s.student_name,
    subject_scores: s.subject_scores,
    total_marks: s.total_marks,
    mean_score: s.mean_score,
    mean_grade: s.mean_grade ?? null,
    position: i + 1,
  }))
  const { error } = await supabase
    .from('learner_marks')
    .upsert(rows, { onConflict: 'assessment_id,student_id' })
  if (error) throw new Error(`saveScores: ${error.message}`)
}

// ── Term summaries ────────────────────────────────────────────────────────────

export async function computeTermSummaries(
  schoolId: string,
  classId: string,
  termId: string,
  gradeBoundaries: Record<string, { min: number }>
): Promise<void> {
  const supabase = createServiceClient()

  // Pull all assessments for this class and term
  const { data: assessments } = await supabase
    .from('class_assessments')
    .select('id, subjects, max_score, weight_percent')
    .eq('class_id', classId)
    .eq('is_published', true)

  if (!assessments?.length) return

  // Pull all scores
  const assessmentIds = assessments.map((a) => a.id)
  const { data: marks } = await supabase
    .from('learner_marks')
    .select('assessment_id, student_id, subject_scores, total_marks')
    .in('assessment_id', assessmentIds)

  if (!marks?.length) return

  // Get subject ids from subjects table by code
  const { data: subjects } = await supabase.from('subjects').select('id, code, name')
  const subjectByCode = Object.fromEntries((subjects ?? []).map((s) => [s.code, s]))

  // Aggregate: weighted score per learner per subject
  const summaryMap: Record<string, Record<string, { score: number; total_weight: number }>> = {}
  // key: `${student_id}:${subject_code}`

  for (const mark of marks) {
    const assessment = assessments.find((a) => a.id === mark.assessment_id)
    if (!assessment) continue
    const weight = assessment.weight_percent / 100
    const maxScore = assessment.max_score

    const scores = mark.subject_scores as Record<string, number>
    Object.entries(scores).forEach(([subjectCode, raw]) => {
      const key = `${mark.student_id}:${subjectCode}`
      if (!summaryMap[key]) summaryMap[key] = { score: 0, total_weight: 0 } as unknown as Record<string, { score: number; total_weight: number }>
      const normalised = maxScore > 0 ? (raw / maxScore) * 100 : 0
      ;(summaryMap[key] as unknown as { score: number; total_weight: number }).score += normalised * weight
      ;(summaryMap[key] as unknown as { score: number; total_weight: number }).total_weight += weight
    })
  }

  const toCbcLevel = (score: number): CbcLevel => {
    if (score >= (gradeBoundaries.EE?.min ?? 75)) return 'EE'
    if (score >= (gradeBoundaries.ME?.min ?? 50)) return 'ME'
    if (score >= (gradeBoundaries.AE?.min ?? 25)) return 'AE'
    return 'BE'
  }

  const rows: Omit<TermSubjectSummary, 'id' | 'created_at' | 'updated_at' | 'position_in_class' | 'teacher_comment'>[] = []

  for (const [key, agg] of Object.entries(summaryMap)) {
    const [studentId, subjectCode] = key.split(':')
    const subject = subjectByCode[subjectCode]
    if (!subject) continue
    const { score, total_weight } = agg as unknown as { score: number; total_weight: number }
    const weighted = total_weight > 0 ? score / total_weight : 0
    rows.push({
      school_id: schoolId,
      learner_id: studentId,
      term_id: termId,
      class_id: classId,
      subject_id: subject.id,
      weighted_score: Math.round(weighted * 100) / 100,
      cbc_level: toCbcLevel(weighted),
      computed_at: new Date().toISOString(),
    })
  }

  if (!rows.length) return

  const { error } = await supabase
    .from('term_subject_summaries')
    .upsert(rows, { onConflict: 'learner_id,term_id,subject_id' })
  if (error) throw new Error(`computeTermSummaries: ${error.message}`)

  // Update positions per subject
  await updateClassPositions(supabase, classId, termId)
}

async function updateClassPositions(
  supabase: ReturnType<typeof createServiceClient>,
  classId: string,
  termId: string
): Promise<void> {
  const { data } = await supabase
    .from('term_subject_summaries')
    .select('id, subject_id, weighted_score')
    .eq('class_id', classId)
    .eq('term_id', termId)
    .order('subject_id')
    .order('weighted_score', { ascending: false })

  if (!data?.length) return

  // Group by subject and rank
  const bySubject: Record<string, typeof data> = {}
  data.forEach((r) => {
    if (!bySubject[r.subject_id]) bySubject[r.subject_id] = []
    bySubject[r.subject_id].push(r)
  })

  for (const rows of Object.values(bySubject)) {
    for (let i = 0; i < rows.length; i++) {
      await supabase
        .from('term_subject_summaries')
        .update({ position_in_class: i + 1 })
        .eq('id', rows[i].id)
    }
  }
}

export async function getClassPerformanceSummary(
  classId: string,
  termId: string
): Promise<Array<{ subject_id: string; subject_name: string; avg_score: number; cbc_distribution: Record<CbcLevel, number>; learner_count: number }>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('term_subject_summaries')
    .select('subject_id, weighted_score, cbc_level, subjects (name)')
    .eq('class_id', classId)
    .eq('term_id', termId)
  if (error) throw new Error(`getClassPerformanceSummary: ${error.message}`)

  const grouped: Record<string, { name: string; scores: number[]; levels: CbcLevel[] }> = {}
  for (const r of data ?? []) {
    if (!grouped[r.subject_id]) grouped[r.subject_id] = { name: (r.subjects as unknown as { name: string })?.name ?? '', scores: [], levels: [] }
    if (r.weighted_score != null) grouped[r.subject_id].scores.push(r.weighted_score)
    if (r.cbc_level) grouped[r.subject_id].levels.push(r.cbc_level as CbcLevel)
  }

  return Object.entries(grouped).map(([subjectId, g]) => {
    const dist: Record<CbcLevel, number> = { EE: 0, ME: 0, AE: 0, BE: 0 }
    g.levels.forEach((l) => dist[l]++)
    const avg = g.scores.length ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length : 0
    return { subject_id: subjectId, subject_name: g.name, avg_score: Math.round(avg * 100) / 100, cbc_distribution: dist, learner_count: g.scores.length }
  })
}
