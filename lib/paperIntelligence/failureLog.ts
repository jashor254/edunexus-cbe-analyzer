// lib/paperIntelligence/failureLog.ts
//
// Gate 6 — durable failure logging. A photographed learner page is not
// re-derivable the way a re-gradable quiz is, so "vision succeeded,
// evidence write failed" must not disappear into a bare console.error the
// way the existing grading routes' evidence emission does (pre-build audit
// §6 — an accepted tradeoff there because that evidence IS re-derivable by
// re-grading; not an acceptable one to inherit here).
//
// No job queue, no retry engine — a durable record a human or a future
// script can act on. Never logs image bytes, secrets, or more learner PII
// than a storage path reference.

import { createServiceClient } from '@/utils/supabase/service'

export type FailureOperation = 'vision_call' | 'evidence_write'

export type LogPaperIntelligenceFailureInput = {
  schoolId?: string | null
  assignmentId?: string | null
  studentId?: string | null
  questionNumber?: number | null
  /** Storage path, never image bytes. */
  imageRef?: string | null
  operation: FailureOperation
  errorCategory: string
  errorMessage?: string | null
  correlationId?: string | null
}

/**
 * Never throws — a logging failure must not mask the original failure it
 * was trying to record, and must not crash a caller already in an error
 * path. Logs to console as a last resort if the DB write itself fails.
 */
export async function logPaperIntelligenceFailure(input: LogPaperIntelligenceFailureInput): Promise<void> {
  try {
    const db = createServiceClient()
    const { error } = await db.from('paper_intelligence_failures').insert({
      school_id: input.schoolId ?? null,
      assignment_id: input.assignmentId ?? null,
      student_id: input.studentId ?? null,
      question_number: input.questionNumber ?? null,
      image_ref: input.imageRef ?? null,
      operation: input.operation,
      error_category: input.errorCategory,
      error_message: input.errorMessage ?? null,
      correlation_id: input.correlationId ?? null,
    })
    if (error) {
      console.error('[paperIntelligence/failureLog] durable write failed, falling back to console:', error.message, input)
    }
  } catch (err) {
    console.error('[paperIntelligence/failureLog] durable write threw, falling back to console:', err instanceof Error ? err.message : String(err), input)
  }
}
