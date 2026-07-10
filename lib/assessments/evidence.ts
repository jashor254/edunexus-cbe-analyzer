// lib/assessments/evidence.ts
// Connects the real teacher gradebook (class_assessments + learner_marks —
// CATs/exams/assignments entered via CSV upload or manual bulk-save) to the
// Evidence Domain. Per the pilot-readiness audit: this pipeline previously
// fed only the legacy learner model (updateFromAssessment, via
// triggerLearnerModelUpdates in mutations.ts) and never produced a single
// row in learner_evidence — meaning Blueprint/Career Intelligence/Adaptive
// Learning (all Projection-driven) never moved from a teacher's own
// assessment marks, only from Compass sessions. This is additive: it does
// not change triggerLearnerModelUpdates or the legacy write path, which
// stays in place per the same migration-ledger reasoning as
// lib/compass/evidence.ts.
//
// Mirrors lib/compass/evidence.ts's shape exactly (ingestion run -> batch of
// LearnerEvidence -> persistEvidenceBatch -> complete run) but for a source
// whose identity is already exactly resolved (a real learner_marks.student_id
// FK, not name-matched) and whose scores are raw marks, not a chat session —
// so it reuses mapSubject/marksToLevel from the CSV pipeline stages rather
// than Compass's claim-type split.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { mapSubject } from '@/lib/intelligence/subjectMapping'
import { marksToLevel } from '@/lib/assessments/gradeCalculator'
import type { AssessmentType } from '@/lib/assessments/types'

const SOURCE = 'teacher_upload' as const
const EXTRACTION_METHOD = 'teacher_gradebook_v1'

// LearnerEvidence's assessmentType is narrower than class_assessments' full
// AssessmentType check constraint — map the rest onto the closest fit.
function toEvidenceAssessmentType(t: AssessmentType): 'term_exam' | 'cat' | 'assignment' {
  if (t === 'cat') return 'cat'
  if (t === 'assignment') return 'assignment'
  return 'term_exam' // exam | midterm | endterm | opener
}

/**
 * Emits Evidence for every scored subject on an already-graded assessment.
 * Fire-and-forget from the caller, same as triggerLearnerModelUpdates —
 * never blocks or fails the marks-save request.
 *
 * teacherId is the legacy `teachers.id` (class_assessments/learner_marks are
 * scoped by it); initiatedByUserId is the auth.users id that
 * ingestion_runs.initiated_by actually FKs to — these are two different
 * identity spaces and ingestion_runs rejects a teachers.id there.
 */
export async function recordAssessmentEvidence(
  assessmentId: string,
  teacherId: string,
  initiatedByUserId: string,
): Promise<void> {
  const startedAt = new Date()

  const [assessment, marks] = await Promise.all([
    repos.assessments.findAssessmentById(assessmentId, teacherId),
    repos.assessments.findMarksByAssessment(assessmentId, teacherId),
  ])
  if (!assessment || !marks.length) return

  // student_id is selected by the repository but not on the LearnerMark type
  // (same gap triggerLearnerModelUpdates already works around).
  type MarkWithStudentId = (typeof marks[number]) & { student_id: string | null }
  const gradedMarks = (marks as MarkWithStudentId[]).filter(m => m.student_id != null)
  if (!gradedMarks.length) return

  const assessmentType = toEvidenceAssessmentType(assessment.assessment_type)
  const academicYear = assessment.year
  const term = Number(assessment.term)
  const importedAt = startedAt.toISOString()

  const confidence = computeConfidence({
    identityConfidence: 100, // student_id is a real FK, not name/fuzzy-matched
    identityMatchType: 'external_id',
    fieldIssueCount: 0,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)

  const evidenceBatch: LearnerEvidence[] = []
  for (const mark of gradedMarks) {
    const subjectScores = mark.subject_scores as Record<string, number>
    for (const [rawSubject, rawScore] of Object.entries(subjectScores)) {
      const score = Number(rawScore)
      if (Number.isNaN(score)) continue
      const { canonicalSubject } = mapSubject(rawSubject)
      const percentScore = assessment.max_score > 0 ? (score / assessment.max_score) * 100 : score

      evidenceBatch.push({
        learnerId: mark.student_id,
        extractedName: mark.student_name,
        extractedExternalId: mark.admission_number,
        subject: canonicalSubject,
        rawSubject,
        score,
        cbcLevel: marksToLevel(Math.round(percentScore)),
        assessmentType,
        academicYear,
        term,
        evidenceSource: SOURCE,
        trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
        evidenceConfidence: confidence,
        extractionMethod: EXTRACTION_METHOD,
        reviewStatus,
        rawInputRef: `class_assessments:${assessmentId}:${rawSubject}:${mark.student_id}`,
        importedAt,
        issues: [],
      })
    }
  }
  if (!evidenceBatch.length) return

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: initiatedByUserId,
    teacherId,
    institution: null,
  })

  const result = await persistEvidenceBatch(evidenceBatch, runId)

  await repos.evidence.completeIngestionRun(runId, {
    recordCount: evidenceBatch.length,
    confirmedCount: result.confirmedCount,
    pendingReviewCount: result.pendingReviewCount,
    rejectedCount: 0,
    processingDurationMs: Date.now() - startedAt.getTime(),
  })
}
