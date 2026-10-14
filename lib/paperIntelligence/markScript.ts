// lib/paperIntelligence/markScript.ts
//
// Paper Intelligence Phase 1 — marks one learner's captured script: stored
// pages → one whole-script vision call → pending_review evidence → per-
// question proposals. The mark-script route is a thin wrapper around this.
//
// Re-marking (e.g. after a retaken page) is allowed until a teacher has
// reviewed any of the script's questions. The previous pass's pending evidence
// is rejected through evidenceLifecycle.rejectReview — never edited — and only
// AFTER the new pass succeeded, so a failed re-mark never loses the old
// proposal.

import { rejectReview } from '@/lib/intelligence/evidenceLifecycle'
import { findRubricsForAssignment, toRubricForScriptMarking } from './rubrics'
import { listScriptPages, loadScriptPages } from './scriptPages'
import { recognizeAndMarkScript, ScriptMarkingInputError, type ScriptMarkingResult } from './scriptMarking'
import { ScriptMarkingParseError } from './scriptValidation'
import { findScriptMarksForSubmission, replaceScriptMarks } from './scriptMarks'
import { recordPaperIntelligenceEvidence } from './evidence'
import { resolveEvidenceContext } from './evidenceContext'
import { logPaperIntelligenceFailure } from './failureLog'
import type { ScriptSubmission } from './auth'
import type { MarkedPoint } from './types'

export class ScriptAlreadyReviewedError extends Error {}
export class ScriptNotReadyError extends Error {}
export class ScriptMarkingFailedError extends Error {}

const EXTRACTION_METHOD = 'paper_intelligence_script_v1'

export type MarkedQuestionSummary = {
  rubricId: string
  questionLabel: string
  recognizedAnswer: string
  points: MarkedPoint[]
  proposedMark: number
  plausibleMark: number
  maxMark: number
  uncertain: boolean
  gradingConfidence: number
}

export type MarkScriptOutcome = {
  proposedTotal: number
  plausibleTotal: number
  maxTotal: number
  questions: MarkedQuestionSummary[]
  rejected: ScriptMarkingResult['rejected']
  unanswered: ScriptMarkingResult['unanswered']
  pendingReview: number
  failedWrites: number
  metadata: ScriptMarkingResult['metadata']
}

export async function markSubmissionScript(input: {
  assignmentId: string
  submission: ScriptSubmission
  teacherUserId: string
}): Promise<MarkScriptOutcome> {
  const { assignmentId, submission, teacherUserId } = input
  const correlationId = `${assignmentId}:${submission.id}`

  const existing = await findScriptMarksForSubmission(submission.id)
  if (existing.some(m => m.status !== 'proposed')) {
    throw new ScriptAlreadyReviewedError('This script has already been reviewed — its marks can no longer be replaced by a new AI pass.')
  }

  const [pageRows, rubricRows] = await Promise.all([listScriptPages(submission.id), findRubricsForAssignment(assignmentId)])
  if (pageRows.length === 0) throw new ScriptNotReadyError('No pages captured for this learner yet.')
  if (rubricRows.length === 0) throw new ScriptNotReadyError('No marking scheme confirmed for this assignment yet.')

  const imageRef = pageRows.map(p => p.file_path).join(',')

  let result: ScriptMarkingResult
  try {
    const pages = await loadScriptPages(pageRows)
    result = await recognizeAndMarkScript({ pages, rubrics: rubricRows.map(toRubricForScriptMarking), correlationId })
  } catch (err) {
    const errorCategory = err instanceof ScriptMarkingInputError ? 'invalid_input'
      : err instanceof ScriptMarkingParseError ? 'model_response_invalid'
      : 'vision_provider_error'
    await logPaperIntelligenceFailure({
      assignmentId, studentId: submission.student_id, imageRef,
      operation: 'vision_call', errorCategory,
      errorMessage: err instanceof Error ? err.message : String(err), correlationId,
    })
    throw new ScriptMarkingFailedError('The script could not be read. Check the photos and try again.')
  }

  const context = await resolveEvidenceContext(submission.student_id, assignmentId)

  // The new pass succeeded — retire the previous pass's pending evidence
  // through the canonical lifecycle before writing the new one.
  const superseded = existing.map(m => m.evidence_id).filter((id): id is string => !!id)
  await Promise.all(superseded.map(id => rejectReview(id, teacherUserId, 'Superseded: script re-marked by Paper Intelligence')))

  const evidence = await recordPaperIntelligenceEvidence({
    assignmentId,
    studentId: submission.student_id,
    teacherUserId,
    schoolId: context.schoolId,
    subject: context.subject,
    academicYear: new Date().getFullYear(),
    term: null,
    imageRef,
    subStrandIdByRubricId: new Map(rubricRows.map(r => [r.id, r.sub_strand_id])),
    answers: result.questions,
    model: result.metadata.model,
    extractionMethod: EXTRACTION_METHOD,
  })

  await replaceScriptMarks(assignmentId, submission.id, result.questions, evidence.evidenceIdByRubricId)

  return {
    proposedTotal: result.questions.reduce((s, q) => s + q.proposedMark, 0),
    plausibleTotal: result.questions.reduce((s, q) => s + q.plausibleMark, 0),
    maxTotal: rubricRows.reduce((s, r) => s + r.max_marks, 0),
    questions: result.questions.map(q => ({
      rubricId: q.rubricId,
      questionLabel: q.questionLabel ?? String(q.questionNumber),
      recognizedAnswer: q.recognizedAnswer,
      points: q.points,
      proposedMark: q.proposedMark,
      plausibleMark: q.plausibleMark,
      maxMark: q.maxMark,
      uncertain: q.uncertain,
      gradingConfidence: q.gradingConfidence,
    })),
    rejected: result.rejected,
    unanswered: result.unanswered,
    pendingReview: evidence.pendingReviewCount,
    failedWrites: evidence.failedWrites,
    metadata: result.metadata,
  }
}
