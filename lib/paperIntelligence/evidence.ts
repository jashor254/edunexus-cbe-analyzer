// lib/paperIntelligence/evidence.ts
//
// Paper Intelligence Prototype 01 — Gates 3, 4, 7, 9, 10, 11. The one place
// a recognized-and-marked page becomes real learner_evidence. Mirrors
// lib/quiz/quizEvidence.ts's own shape exactly: reuses persistEvidenceBatch,
// computeConfidence, resolveReviewStatus, createIngestionRun — no new
// pipeline, no bypassed lifecycle, no direct write to learner state or
// Projection.
//
// Evidence source: reuses the ALREADY-RESERVED 'report_card_photo' value
// (tier 1) rather than adding a sibling — its own existing comment reads
// "requires extraction (future OCR) — inherently lower trust until
// reviewed," which is exactly this workflow, written by this team before
// this feature existed. Safe to reuse: tier 1's confidence ceiling (60,
// lib/intelligence/confidence.ts) is structurally below
// AUTO_CONFIRM_THRESHOLD (85) — resolveReviewStatus() CANNOT return
// 'auto_confirmed' for this source no matter what confidence value is
// computed. This producer additionally asserts that invariant explicitly
// (belt-and-suspenders) rather than relying on the ceiling alone.
//
// correctionKey is deliberately left null. lib/intelligence/correctionKey.ts
// closes NAMESPACE_SOURCES to a fixed, reviewed list of producers per
// namespace (e.g. 'assignment_mark' -> only 'teacher_upload') — widening
// that closed list is exactly the kind of canonical-lifecycle-adjacent edit
// this prototype's scope explicitly excludes. NULL is a first-class,
// already-used answer for a producer with no correction-chain identity yet
// (see that module's own header comment) — Prototype 01 accepts that a
// second AI pass over the same photo creates a second independent
// pending_review row rather than a supersession chain; a human teacher
// reviewing both is an acceptable prototype-scope tradeoff, not a silent
// data-integrity gap.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence, PaperIntelligenceMarkPayload } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus, AUTO_CONFIRM_THRESHOLD } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch, type PersistEvidenceResult } from '@/lib/intelligence/evidenceLifecycle'
import { normaliseScore, marksToLevelForSchool } from '@/lib/assessments/gradeCalculator'
import { mapSubject } from '@/lib/intelligence/subjectMapping'
import { logPaperIntelligenceFailure } from './failureLog'
import type { RecognizedQuestionAnswer } from './types'

const SOURCE = 'report_card_photo' as const

export type PaperIntelligenceEvidenceInput = {
  assignmentId: string
  studentId: string
  /**
   * The authorizing teacher's real auth.users.id — required by
   * ingestion_runs.initiated_by's FK constraint. Distinct from `studentId`
   * (a legacy students.id, a different identity space entirely) — mirrors
   * lib/assignments/evidence.ts's teacher-initiated shape exactly (this is
   * a teacher-triggered marking event, not a student self-service one like
   * quizEvidence.ts's).
   */
  teacherUserId: string
  schoolId: string | null
  subject: string
  academicYear: number
  term: number | null
  imageRef: string
  /** Per-rubric, resolved once by the caller — never re-resolved here (same discipline as every other producer). */
  subStrandIdByRubricId: Map<string, string | null>
  answers: RecognizedQuestionAnswer[]
}

export type PaperIntelligenceEvidenceResult = PersistEvidenceResult & { failedWrites: number }

/**
 * Never throws on an individual evidence-write failure — logs it durably
 * (Gate 6) and continues with the rest of the batch, so one bad row on a
 * page never silently drops the whole page's real evidence. DOES throw if
 * the invariant this whole function exists to guarantee — every row here
 * is pending_review, never auto_confirmed — is ever violated; that is a
 * bug in this producer, not a recoverable per-row condition.
 */
export async function recordPaperIntelligenceEvidence(
  input: PaperIntelligenceEvidenceInput,
): Promise<PaperIntelligenceEvidenceResult> {
  const { canonicalSubject } = mapSubject(input.subject)
  const importedAt = new Date().toISOString()

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: input.teacherUserId,
    teacherId: null,
    institution: null,
  })

  const evidenceRows: LearnerEvidence[] = []
  let failedWrites = 0

  for (const answer of input.answers) {
    const percentage = normaliseScore(answer.proposedMark, answer.maxMark)
    const cbcLevel = marksToLevelForSchool(percentage)

    const confidence = computeConfidence({
      identityConfidence: 100, // studentId is already resolved by the caller, matching quizEvidence.ts's own convention
      identityMatchType: 'external_id',
      fieldIssueCount: answer.uncertain ? 1 : 0,
      source: SOURCE,
    })
    const reviewStatus = resolveReviewStatus(confidence)

    // Non-negotiable invariant (Gate 4/7): this producer must never be able
    // to create confirmed evidence directly. Structurally guaranteed by
    // tier 1's confidence ceiling (60 < AUTO_CONFIRM_THRESHOLD 85) — this
    // assertion makes that guarantee explicit and would fail loudly if
    // confidence.ts's tier ceiling for tier 1 were ever raised without
    // this producer being re-reviewed.
    if (reviewStatus !== 'pending_review') {
      throw new Error(
        `recordPaperIntelligenceEvidence: computed reviewStatus '${reviewStatus}' for a tier-${EVIDENCE_SOURCE_TRUST_TIER[SOURCE]} source — Paper Intelligence evidence must ALWAYS be pending_review (confidence=${confidence}, threshold=${AUTO_CONFIRM_THRESHOLD}).`
      )
    }

    const subStrandId = input.subStrandIdByRubricId.get(answer.rubricId) ?? null

    const payload: PaperIntelligenceMarkPayload = {
      kind: 'paper_intelligence_mark',
      payloadVersion: 1,
      rubricId: answer.rubricId,
      questionNumber: answer.questionNumber,
      recognizedAnswer: answer.recognizedAnswer,
      recognitionConfidence: answer.recognitionConfidence,
      gradingConfidence: answer.gradingConfidence,
      rationale: answer.rationale,
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      imageRef: input.imageRef,
    }

    evidenceRows.push({
      learnerId: input.studentId,
      extractedName: '',
      extractedExternalId: null,
      subject: canonicalSubject,
      rawSubject: input.subject,
      score: percentage,
      cbcLevel,
      assessmentType: 'assignment',
      academicYear: input.academicYear,
      term: input.term,
      evidenceSource: SOURCE,
      trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
      evidenceConfidence: confidence,
      extractionMethod: 'paper_intelligence_gemini_vision_v1',
      reviewStatus,
      rawInputRef: `assignment:${input.assignmentId}:question=${answer.questionNumber}:image=${input.imageRef}`,
      importedAt,
      // Sub-strand requirement (Gate 9): populate whenever the source
      // question genuinely has one; never invent one when it doesn't.
      subStrandId,
      schoolId: input.schoolId,
      correctionKey: null, // see module header — deliberate, documented scope limit
      payload,
      issues: answer.uncertain ? ['recognition_uncertain'] : [],
    })
  }

  let result: PersistEvidenceResult
  try {
    result = await persistEvidenceBatch(evidenceRows, runId)
  } catch (err) {
    await logPaperIntelligenceFailure({
      schoolId: input.schoolId,
      assignmentId: input.assignmentId,
      studentId: input.studentId,
      imageRef: input.imageRef,
      operation: 'evidence_write',
      errorCategory: 'persist_evidence_batch_failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    failedWrites = evidenceRows.length
    result = { inserted: [], confirmedCount: 0, pendingReviewCount: 0, noOpCount: 0 }
  }

  await repos.evidence.completeIngestionRun(runId, {
    recordCount: evidenceRows.length,
    confirmedCount: result.confirmedCount,
    pendingReviewCount: result.pendingReviewCount,
    rejectedCount: failedWrites,
    processingDurationMs: 0,
  })

  return { ...result, failedWrites }
}
