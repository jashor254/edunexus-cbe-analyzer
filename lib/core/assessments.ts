import { repos } from '@/lib/repositories'
import { publishEvent } from '@/lib/events'
import { computeRankings } from '@/lib/ranking'
import { gradeScore } from '@/lib/grading'
import type { GradeScale } from '@/lib/grading'
import type { TermSubjectSummary, CbcLevel } from '@/types/core'
import { resolveTeacher } from '@/lib/core/identity'
import { resolveOrCreateAssessmentType } from '@/lib/assessments/mutations'

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
  // Sprint 10A: class_assessments.class_id FKs to legacy teacher_classes,
  // never Core `classes` (same finding as computeTermSummaries) — a
  // caller passing a Core classId here (every real caller: runEndOfTerm's
  // lock check, the GET /api/core/assessments list view) would otherwise
  // always see zero assessments, silently. Resolve through the bridge first.
  const legacyClassIds = await repos.teachers.findLegacyClassIdsByExternalId(classId)
  if (!legacyClassIds.length) return []
  const data = await repos.assessments.listAssessmentsByClassIds(legacyClassIds, filters)
  return data as unknown as AssessmentConfig[]
}

// Sprint 5F (docs/architecture/adr/0002-canonical-teacher-identity.md,
// implementation-log.md): ADR-0002 ratified `teachers.id` as the canonical
// Teacher-domain business identity — this function's caller previously
// passed `school_users.id` (a Permissions-domain identity, per the RAS)
// where `teachers.id` was required, which both left `assessment_type_id`
// unresolved (no valid id to resolve/create an `assessment_types` row
// against) and failed the `class_assessments.teacher_id`/`teachers(id)` FK
// outright on every real insert. Repaired by resolving the real teacher via
// the existing `resolveTeacher()` (identical to what `requireClassTeacher`
// already does for authorization) and reusing the existing
// `resolveOrCreateAssessmentType()` — no new identity logic, no duplicated
// lookup, both already exported for exactly this purpose.
//
// Admin edge case, deliberately NOT solved here (ADR-0002 Part 7's stated
// scope boundary): a school_admin/headteacher/deputy_headteacher caller
// with no `teachers` row (9 live users today, 0 with one) makes
// resolveTeacher() return null. This throws a clear, descriptive error
// instead of an opaque FK violation — the *outcome* (creation fails for
// this caller) is unchanged from before this fix; only the failure's
// clarity improved. Recorded as its own, separate technical-debt item —
// seeing this comment is the intended way to rediscover it, not a signal
// to solve it inline.
export async function createAssessment(input: {
  class_id: string
  userId: string
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
  const { userId, ...rest } = input
  const teacher = await resolveTeacher(userId)
  if (!teacher) {
    // Known tech debt (ADR-0002 Part 7, admin edge case): no teachers row
    // for this user. Every current admin-tier school_users row has none —
    // this is not solved here, only surfaced clearly.
    throw new Error('createAssessment: no teacher record found for this user — admin-created assessments are a known, unresolved gap (see ADR-0002)')
  }

  const assessmentTypeId = await resolveOrCreateAssessmentType(teacher.id, input.assessment_type)
  const data = await repos.assessments.createCoreAssessment({
    ...rest,
    teacher_id: teacher.id,
    assessment_type_id: assessmentTypeId,
  })
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
  // Sprint 12 Wave 2 (High 2, Release Blocker Remediation) — this is the
  // Core-bridge marks-save path (lib/core/academicBridge.ts's
  // recordBridgedMarks); the sibling legacy-teacher routes
  // (app/api/teacher/assessments/[assessmentId]/marks and .../upload) got
  // the same guard directly in their own route handlers, reusing an
  // already-fetched assessment row. Here, no caller has already fetched
  // the assessment row, so one cheap read is added — same "refuse, don't
  // silently overwrite" posture as the report-cards publish-guard.
  const assessment = await repos.assessments.findAssessmentById(assessmentId, teacherId)
  if (assessment?.is_published) {
    throw new Error('saveScores refused: this assessment is locked (published) — marks cannot be edited. Unpublish it first if a correction is genuinely needed.')
  }
  return repos.assessments.saveScores(assessmentId, classId, teacherId, scores)
}

// ── Term summaries ────────────────────────────────────────────────────────────

export async function computeTermSummaries(
  schoolId: string,
  classId: string,
  termId: string,
  gradeBoundaries: Record<string, { min: number }>
): Promise<void> {
  // Sprint 10A: class_assessments.class_id FKs to legacy teacher_classes,
  // never Core `classes` (confirmed live) — but this function's own writes
  // below (term_subject_summaries.class_id) FK to `classes`, so `classId`
  // here must stay the Core id. Resolve it to whatever legacy class(es) it
  // bridged to (lib/core/academicBridge.ts's external_id link) before
  // reading class_assessments. Zero bridged classes means zero assessments
  // recorded yet for this Core class — a legitimate early exit, not an error.
  const legacyClassIds = await repos.teachers.findLegacyClassIdsByExternalId(classId)
  if (!legacyClassIds.length) return

  const assessments = await repos.assessments.findPublishedAssessmentsByClassIds(legacyClassIds)

  if (!assessments.length) return

  const assessmentIds = assessments.map((a) => a.id)
  const marks = await repos.assessments.findMarksByAssessmentIds(assessmentIds)

  if (!marks.length) return

  const subjects = await repos.assessments.findSubjectsByCodeList()
  const subjectByCode = Object.fromEntries(subjects.map((s) => [s.code, s]))

  // Sprint 10A: learner_marks.student_id is a legacy `students.id` (Sprint
  // 9F's bridge writes it via saveScores), but term_subject_summaries.learner_id
  // has a real FK to `learners.id` — a different id space. Resolve every
  // mark's student_id back to the Core learner it bridges via the same
  // external_id link academicBridge.ts already uses in the other direction.
  // Batched, not queried per-row (CLAUDE.md's "never query inside a loop").
  const studentIds = Array.from(new Set(marks.map((m) => m.student_id).filter((id): id is string => id != null)))
  const bridgeRows = await repos.teachers.findExternalIdsByStudentIds(studentIds)
  const coreLearnerIdByStudentId = new Map(
    bridgeRows.filter((r) => r.external_id != null).map((r) => [r.id, r.external_id as string])
  )

  // Aggregate: weighted score per learner per subject
  const summaryMap: Record<string, { score: number; total_weight: number }> = {}

  for (const mark of marks) {
    const assessment = assessments.find((a) => a.id === mark.assessment_id)
    if (!assessment) continue
    // No bridge row (or no external_id yet) means this mark can't be
    // attributed to a Core learner — skip rather than writing a legacy
    // students.id into term_subject_summaries.learner_id (which would
    // violate that column's FK to `learners`).
    const coreLearnerId = mark.student_id ? coreLearnerIdByStudentId.get(mark.student_id) : undefined
    if (!coreLearnerId) continue
    const weight = assessment.weight_percent / 100
    const maxScore = assessment.max_score

    const scores = mark.subject_scores
    Object.entries(scores).forEach(([subjectCode, raw]) => {
      const key = `${coreLearnerId}:${subjectCode}`
      if (!summaryMap[key]) summaryMap[key] = { score: 0, total_weight: 0 }
      const normalised = maxScore > 0 ? (raw / maxScore) * 100 : 0
      summaryMap[key].score += normalised * weight
      summaryMap[key].total_weight += weight
    })
  }

  // Sprint 4C1 (docs/engineering/sprint-4c0-grading-policy-integration.md,
  // Option B, docs/engineering/implementation-log.md): activates the
  // dormant school_settings.grade_boundaries capability through the
  // canonical Grading Engine (lib/grading) instead of a local closure. The
  // boundary VALUES are unchanged — same gradeBoundaries parameter, same
  // 75/50/25 fallback defaults — only the computation now runs through
  // gradeScore(). BE's floor is always 0 (matching the deleted closure's
  // unconditional `return 'BE'` for anything below AE).
  const cbcScale: GradeScale = {
    name: 'CBC (school-configured, school_settings.grade_boundaries)',
    bands: [
      { label: 'EE', minPct: gradeBoundaries.EE?.min ?? 75 },
      { label: 'ME', minPct: gradeBoundaries.ME?.min ?? 50 },
      { label: 'AE', minPct: gradeBoundaries.AE?.min ?? 25 },
      { label: 'BE', minPct: 0 },
    ],
  }
  // Clamped defensively: weighted scores are mathematically bounded to
  // 0-100, but this guards against floating-point summation artifacts
  // (e.g. 100.00000000000001) that would otherwise trip gradeScore()'s
  // stricter range validation — the old closure had no such validation to
  // trip. Not a behaviour change to any real grading outcome.
  const toCbcLevel = (score: number): CbcLevel =>
    gradeScore(Math.min(100, Math.max(0, score)), 100, cbcScale).grade as CbcLevel

  const rows: Omit<TermSubjectSummary, 'id' | 'created_at' | 'updated_at' | 'position_in_class' | 'teacher_comment'>[] = []

  for (const [key, agg] of Object.entries(summaryMap)) {
    const [learnerId, subjectCode] = key.split(':')
    const subject = subjectByCode[subjectCode]
    if (!subject) continue
    const { score, total_weight } = agg
    const weighted = total_weight > 0 ? score / total_weight : 0
    rows.push({
      school_id: schoolId,
      learner_id: learnerId,
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

  // Sprint 3C migration (docs/engineering/sprint-3-assessment-domain-audit.md
  // §4, docs/architecture/deprecation-registry.md #4, docs/engineering/
  // implementation-log.md): delegates to the canonical Ranking Engine
  // (lib/ranking) instead of `i+1` sequential assignment, which never
  // handled ties. This is an intentional behaviour change — tied
  // weighted_scores within a subject now share a position, where they
  // previously received arbitrary, database-row-order-dependent distinct
  // positions. Rows with a non-finite weighted_score (not expected from the
  // sole writer, computeTermSummaries, but the column is nullable) are
  // skipped rather than crashing the recompute or fabricating a position.
  for (const rows of Object.values(bySubject)) {
    const rankable = rows.filter(
      (r): r is typeof r & { weighted_score: number } =>
        typeof r.weighted_score === 'number' && Number.isFinite(r.weighted_score)
    )
    const ranked = computeRankings(rankable.map((r) => ({ id: r.id, score: r.weighted_score })))
    for (const r of ranked) {
      await repos.assessments.updateTermSummaryPosition(r.id, r.position)
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
