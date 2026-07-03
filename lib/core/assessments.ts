import { repos } from '@/lib/repositories'
import { publishEvent } from '@/lib/events'
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

export async function listAssessments(
  classId: string,
  filters?: { term?: string; year?: number }
): Promise<AssessmentConfig[]> {
  const data = await repos.assessments.listAssessmentsByClass(classId, filters)
  return data as unknown as AssessmentConfig[]
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
  const data = await repos.assessments.createCoreAssessment(input)
  return data as unknown as AssessmentConfig
}

export async function publishAssessment(assessmentId: string): Promise<void> {
  await repos.assessments.publishAssessmentById(assessmentId)

  void publishEvent({
    event_type:      'teacher.assessment.published',
    resource_type:   'assessment',
    resource_id:     assessmentId,
    payload:         { assessment_id: assessmentId },
    idempotency_key: `teacher.assessment.published:${assessmentId}`,
  }).catch(err => console.error('[events] teacher.assessment.published:', err instanceof Error ? err.message : String(err)))
}

// ── Scores ────────────────────────────────────────────────────────────────────

export async function getAssessmentScores(assessmentId: string): Promise<LearnerScore[]> {
  const data = await repos.assessments.findMarksByAssessmentForScores(assessmentId)
  return data.map((r) => ({
    learner_id: r.student_id ?? '',
    admission_number: r.admission_number ?? '',
    subject_scores: r.subject_scores ?? {},
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
  return repos.assessments.saveScores(assessmentId, classId, teacherId, scores)
}

// ── Term summaries ────────────────────────────────────────────────────────────

export async function computeTermSummaries(
  schoolId: string,
  classId: string,
  termId: string,
  gradeBoundaries: Record<string, { min: number }>
): Promise<void> {
  const assessments = await repos.assessments.findPublishedAssessmentsByClass(classId)

  if (!assessments.length) return

  const assessmentIds = assessments.map((a) => a.id)
  const marks = await repos.assessments.findMarksByAssessmentIds(assessmentIds)

  if (!marks.length) return

  const subjects = await repos.assessments.findSubjectsByCodeList()
  const subjectByCode = Object.fromEntries(subjects.map((s) => [s.code, s]))

  // Aggregate: weighted score per learner per subject
  const summaryMap: Record<string, { score: number; total_weight: number }> = {}

  for (const mark of marks) {
    const assessment = assessments.find((a) => a.id === mark.assessment_id)
    if (!assessment) continue
    const weight = assessment.weight_percent / 100
    const maxScore = assessment.max_score

    const scores = mark.subject_scores
    Object.entries(scores).forEach(([subjectCode, raw]) => {
      const key = `${mark.student_id}:${subjectCode}`
      if (!summaryMap[key]) summaryMap[key] = { score: 0, total_weight: 0 }
      const normalised = maxScore > 0 ? (raw / maxScore) * 100 : 0
      summaryMap[key].score += normalised * weight
      summaryMap[key].total_weight += weight
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
    const { score, total_weight } = agg
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

  await repos.assessments.upsertTermSubjectSummaries(rows)
  await updateClassPositions(classId, termId)
}

async function updateClassPositions(classId: string, termId: string): Promise<void> {
  const data = await repos.assessments.findTermSummariesForPositionUpdate(classId, termId)

  if (!data.length) return

  // Group by subject and rank
  const bySubject: Record<string, typeof data> = {}
  data.forEach((r) => {
    if (!bySubject[r.subject_id]) bySubject[r.subject_id] = []
    bySubject[r.subject_id].push(r)
  })

  for (const rows of Object.values(bySubject)) {
    for (let i = 0; i < rows.length; i++) {
      await repos.assessments.updateTermSummaryPosition(rows[i].id, i + 1)
    }
  }
}

export async function getClassPerformanceSummary(
  classId: string,
  termId: string
): Promise<Array<{ subject_id: string; subject_name: string; avg_score: number; cbc_distribution: Record<CbcLevel, number>; learner_count: number }>> {
  const data = await repos.assessments.findTermSummariesWithSubjects(classId, termId)

  const grouped: Record<string, { name: string; scores: number[]; levels: CbcLevel[] }> = {}
  for (const r of data) {
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
