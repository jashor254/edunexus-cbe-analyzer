// lib/quiz/quizEvidence.ts
// Emits Evidence for an auto-graded quiz submission — ADR-0024 Sprint C,
// closing the gap named in the original System Map audit: Quiz results
// generated zero learner Evidence, unlike manually-marked assignments.
//
// Reuses the canonical Evidence Domain infrastructure exactly like every
// other producer (persistEvidenceBatch, computeConfidence,
// resolveReviewStatus, createIngestionRun/completeIngestionRun) — no new
// pipeline, no bypassed auditing, no bypassed Projection events. Curriculum
// identity resolution is the exact same call as
// lib/assignments/evidence.ts's (Sprint B) — resolveCurriculumContext() —
// reused, not duplicated.
//
// Grading is student-triggered, not teacher-marked (that's the whole point
// of a quiz over a regular assignment) — `initiatedBy` is the student's own
// auth user id and `teacherId` is null, mirroring
// lib/compass/evidence.ts's identical student-triggered, automatic shape,
// not lib/assignments/evidence.ts's teacher-initiated one.
//
// quiz_auto_grade is its own EvidenceSource, Tier 2 — see
// lib/intelligence/evidence.ts's EVIDENCE_SOURCE_TRUST_TIER for the full
// reasoning. It is deliberately NOT teacher_upload (no teacher looked at
// this specific submission) and NOT compass_session (deterministic
// index-equality grading, not probabilistic AI inference) — the sprint's
// own non-negotiable invariant is that machine-scored evidence must stay
// distinguishable from teacher-verified evidence.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence, AdaptiveDeliveryPayload } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { quizAttemptKey } from '@/lib/intelligence/correctionKey'
import { normaliseScore, marksToLevelForSchool } from '@/lib/assessments/gradeCalculator'
import { resolveCurriculumContext } from '@/lib/curriculum/curriculumContext'

const SOURCE = 'quiz_auto_grade' as const

export type QuizEvidenceInput = {
  studentId:     string
  initiatedBy:   string   // the submitting student's own auth user id
  assignmentId:  string
  subject:       string
  // assignments.topic — the free-text fallback, used only when no
  // canonical substrandId exists, same rule as Sprint B.
  topic:         string | null
  substrandId:   string | null
  score:         number   // already scaled to maxScore by gradeQuiz()
  maxScore:      number
  academicYear:  number
  term:          number | null
  /**
   * Adaptive Remediation Phase 1, Stage 1 — instructional provenance, so
   * this outcome can later be attributed to the support that produced it.
   * Optional: a caller that cannot establish it must pass nothing rather
   * than guess. Never affects `score`, `cbcLevel`, confidence, or review
   * status — see AdaptiveDeliveryPayload's own doc comment.
   */
  adaptiveDelivery?: AdaptiveDeliveryPayload | null
}

export async function recordQuizAutoGradeEvidence(input: QuizEvidenceInput): Promise<void> {
  const percentage = normaliseScore(input.score, input.maxScore)
  const cbcLevel = marksToLevelForSchool(percentage)

  const confidence = computeConfidence({
    identityConfidence: 100, // studentId is already resolved by the caller
    identityMatchType: 'external_id',
    fieldIssueCount: 0,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)
  const importedAt = new Date().toISOString()

  // Prefer canonical curriculum identity (same resolver Sprint B uses for
  // manually-marked assignments — quiz-type assignments carry the exact
  // same assignments.substrand_id column, added once in Sprint A for all
  // assignments regardless of type).
  const curriculumContext = input.substrandId
    ? await resolveCurriculumContext(input.substrandId)
    : null

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: input.initiatedBy,
    teacherId: null,
    institution: null,
  })

  const evidence: LearnerEvidence = {
    learnerId: input.studentId,
    extractedName: '',
    extractedExternalId: null,
    subject: input.subject,
    rawSubject: input.subject,
    score: percentage,
    cbcLevel,
    assessmentType: 'assignment',
    academicYear: input.academicYear,
    term: input.term,
    evidenceSource: SOURCE,
    trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
    evidenceConfidence: confidence,
    extractionMethod: 'quiz_auto_grade_v1',
    reviewStatus,
    rawInputRef: `assignment:${input.assignmentId}:score=${input.score}/${input.maxScore}`,
    importedAt,
    issues: [],
    strand: curriculumContext?.strandTitle ?? null,
    subStrand: curriculumContext?.subStrandTitle ?? input.topic,
    subStrandId: curriculumContext?.subStrandId ?? null,
    // Phase E2 — a DIFFERENT namespace from assignment_mark even though both
    // key on `assignments.id`. That separation is the whole point: today's
    // `assignment:<id>` rawInputRef is identical across the two producers.
    correctionKey: quizAttemptKey({ assignmentId: input.assignmentId, studentId: input.studentId, source: SOURCE }),
    // Stage 1 — instructional provenance. Context only: the score above is
    // still the whole educational claim of this row.
    payload: input.adaptiveDelivery ?? null,
  }

  const result = await persistEvidenceBatch([evidence], runId)

  await repos.evidence.completeIngestionRun(runId, {
    recordCount: 1,
    confirmedCount: result.confirmedCount,
    pendingReviewCount: result.pendingReviewCount,
    rejectedCount: 0,
    processingDurationMs: 0,
  })
}
