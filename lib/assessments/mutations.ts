import { repos } from '@/lib/repositories'
import { calculateMeanScore, calculateMeanGrade, marksToLevel } from './gradeCalculator'
import { updateFromAssessment } from '@/lib/learnerModel/updater'
import { publishEvent } from '@/lib/events'
import { getDefaultPurposeCode } from '@/lib/assessments/assessmentTypeCatalog'
import { computeRankings } from '@/lib/ranking'
import { buildMarkLinker } from './markLinking'
import type { ClassAssessment, LearnerMark, MarkInput, CurriculumType } from './types'

function sumScores(scores: Record<string, number>): number {
  return Object.values(scores).reduce((s, v) => s + (Number(v) || 0), 0)
}

// Sprint 3B migration (docs/engineering/sprint-3-assessment-domain-audit.md §4,
// docs/engineering/implementation-log.md): delegates to the canonical Ranking
// Engine (lib/ranking) instead of hand-rolling sort + tie assignment. Same
// standard-competition-ranking algorithm as before — mechanical migration,
// no behaviour change.
function buildPositionMap(rows: { id: string; total: number }[]): Map<string, number> {
  const ranked = computeRankings(rows.map((r) => ({ id: r.id, score: r.total })))
  return new Map(ranked.map((r) => [r.id, r.position]))
}

/**
 * Phase B (docs/architecture/academic-evidence-layer.md §7, Rule 5): the
 * one place a submitted assessment-type name becomes a real,
 * teacher-scoped assessment_types row. Finds an exact (case-sensitive)
 * match first — every existing teacher already has the 6 previously-hardcoded
 * names seeded by the Phase B migration, so today's only real caller (the
 * teacher-facing dropdown) always resolves on the first lookup. A name not
 * yet seen from this teacher is created on the fly, `sort_order` appended
 * after their existing types — this is what makes the type genuinely
 * school/teacher-configurable rather than cosmetically so: the API layer
 * no longer hardcodes what a teacher is allowed to call an assessment.
 */
export async function resolveOrCreateAssessmentType(teacherId: string, name: string): Promise<string> {
  const existing = await repos.assessmentTypes.findByTeacherAndName(teacherId, name)
  if (existing) return existing.id

  const existingTypes = await repos.assessmentTypes.findAllForTeacher(teacherId)
  const nextSortOrder = existingTypes.length

  // Phase G's migration-time backfill only reached rows that existed when
  // it ran — any teacher whose assessment_types row is created afterward
  // needs the same canonical mapping applied here, or their evidence's
  // purpose_id silently stays null forever (Production Hardening Audit
  // finding: this was a live gap for every teacher onboarded after Phase G).
  const purposeCode = getDefaultPurposeCode(name)
  const defaultPurposeId = purposeCode ? (await repos.evidencePurposes.findByCode(purposeCode))?.id ?? null : null

  const created = await repos.assessmentTypes.create(teacherId, name, nextSortOrder, defaultPurposeId)
  return created.id
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
  const assessmentTypeId = await resolveOrCreateAssessmentType(teacherId, input.assessmentType)
  const assessment = await repos.assessments.createAssessment(teacherId, classId, { ...input, assessmentTypeId })

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

// Sprint 5E (docs/engineering/sprint-5d-assessment-type-audit.md §3): a
// PATCH that changes `assessment_type` must re-resolve `assessment_type_id`
// through the same canonical lookup createAssessment uses, or the two
// columns silently drift apart (the FK keeps pointing at the assessment's
// original type after the visible name has changed). No direct way to set
// assessment_type_id exists on this PATCH — it only ever moves as a
// consequence of the name changing, so this is the one place drift can be
// introduced, and the one place it needs to be closed.
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
  const repoUpdates = updates.assessment_type
    ? { ...updates, assessment_type_id: await resolveOrCreateAssessmentType(teacherId, updates.assessment_type) }
    : updates
  return repos.assessments.updateAssessment(id, teacherId, repoUpdates)
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

  // Link each mark to the learner it belongs to. `student_id` is what
  // recordAssessmentEvidence attributes Evidence by — a null here means the
  // mark reaches Projection, Blueprint and Career Intelligence for nobody.
  const linkLearner = buildMarkLinker(await repos.assessments.findClassRosterForMarkLinking(classId))

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
      student_id:       linkLearner(m),
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
  const [existingMarkNames, roster] = await Promise.all([
    repos.assessments.findExistingMarkNames(assessmentId, teacherId),
    repos.assessments.findClassRosterForMarkLinking(classId),
  ])
  const existingNames = new Set(existingMarkNames.map(r => r.student_name))

  // The CSV path previously set no `student_id` at all — same consequence as
  // the manual path's broken lookup: uploaded marks belonged to no learner and
  // produced no Evidence.
  const linkLearner = buildMarkLinker(roster)

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
      student_id:       linkLearner(m),
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

  // Note: strand_assessments is not written here. Its assessment_id FK points
  // at the legacy `assessments` table, not `class_assessments` — this
  // assessmentId belongs to a different id space, so a row can never actually
  // be inserted here. strand_assessments now gets real data exclusively from
  // topical checks (lib/assessments/topical.ts), which have genuine
  // strand/topic granularity that a general term assessment doesn't have.

  // subject_scores holds raw marks bounded by assessment.max_score (any
  // total — 20, 50, 70, 100, ...), not CBC levels. Normalize to a percentage
  // before deriving the CBC level, mirroring the already-correct pattern in
  // lib/assessments/evidence.ts (recordAssessmentEvidence), so the learner
  // model is grading-system agnostic regardless of what the exam was out of.
  const maxScore = assessment.max_score > 0 ? assessment.max_score : 100
  const updates: Promise<void>[] = []
  for (const m of filteredMarks) {
    const rawScores = m.subject_scores as Record<string, number>
    const subjectMarks: Record<string, number> = {}
    const subjectLevels: Record<string, number> = {}
    for (const [subject, rawMark] of Object.entries(rawScores)) {
      const percentScore = (Number(rawMark) / maxScore) * 100
      subjectMarks[subject] = percentScore
      subjectLevels[subject] = marksToLevel(Math.round(Math.min(100, Math.max(0, percentScore))))
    }

    // One call per subject so every subject in this assessment updates its
    // own knowledge_state entry, not just the class's first listed subject.
    for (const subject of Object.keys(rawScores)) {
      updates.push(
        updateFromAssessment({
          studentId:     m.student_id as string,
          studentName:   m.student_name as string,
          subjectScores: subjectLevels,
          subjectMarks,
          strand:        'general',
          subStrand:     'general',
          subject,
          term:          Number(assessment.term),
          year:          Number(assessment.year),
          assessedAt:    now,
        })
      )
    }
  }
  await Promise.allSettled(updates)
}
