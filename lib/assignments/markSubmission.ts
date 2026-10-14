// lib/assignments/markSubmission.ts
//
// The one path that writes a teacher's mark onto an assignment submission:
// status → marked, score, marked_at, optional feedback, then the follow-ups
// (learner notification + the assignment-mark Evidence observation).
// Extracted from app/api/teacher/assignments/[id]/mark/route.ts so Paper
// Intelligence's finalize step writes a reviewed script total through exactly
// the same code a hand-entered mark does — same bounds, same evidence, same
// correction key (a re-mark supersedes, never duplicates).
//
// No authorization here — callers authorize first. The follow-ups are
// returned rather than run, so a route can register them with after() (they
// never block or fail the response).

import { createServiceClient } from '@/utils/supabase/service'
import { notifyAssignmentMarked } from '@/lib/notifications/notify'
import { recordAssignmentMarkEvidence } from './evidence'
import { buildAdaptiveProvenance } from './adaptiveProvenance'

export class ScoreOutOfRangeError extends Error {}
export class SubmissionToMarkNotFoundError extends Error {}

export type MarkableAssignment = {
  id: string
  max_score: number | null
  subject: string
  topic: string | null
  substrand_id: string | null
}

export type RecordSubmissionMarkInput = {
  assignment: MarkableAssignment
  /** Exactly one: the submission row, or the learner's submission on this assignment. */
  target: { submissionId: string } | { studentId: string }
  score: number | null
  /** undefined leaves existing feedback untouched; null clears it. */
  feedback?: string | null
  /** teachers.id */
  teacherId: string
  /** auth.users.id */
  teacherUserId: string
}

export type RecordSubmissionMarkResult = {
  submission: Record<string, unknown> & { id: string; student_id: string }
  /** Notification + evidence emission — run after the response (after()); never throws. */
  followUp: () => Promise<void>
}

export async function recordSubmissionMark(input: RecordSubmissionMarkInput): Promise<RecordSubmissionMarkResult> {
  const { assignment, score } = input
  const maxScore = assignment.max_score ?? 100
  if (score !== null && (score < 0 || score > maxScore)) {
    throw new ScoreOutOfRangeError(`Score must be between 0 and ${maxScore}`)
  }

  const markedAt = new Date().toISOString()
  const update: Record<string, unknown> = { status: 'marked', score, marked_at: markedAt }
  if (input.feedback !== undefined) update.teacher_feedback = input.feedback

  const db = createServiceClient()
  let query = db.from('assignment_submissions').update(update).eq('assignment_id', assignment.id)
  query = 'submissionId' in input.target
    ? query.eq('id', input.target.submissionId)
    : query.eq('student_id', input.target.studentId)

  const { data: submission, error } = await query.select().single()
  if (error || !submission) throw new SubmissionToMarkNotFoundError('Submission not found')

  const studentId = submission.student_id as string
  const followUp = async (): Promise<void> => {
    try {
      await notifyAssignmentMarked(submission.id as string, assignment.id)
    } catch (err) {
      console.error('[notify] mark:', err instanceof Error ? err.message : String(err))
    }
    // Only a numeric score is evidence; a status-only update has nothing to convert.
    if (score === null) return
    // Instructional provenance, resolved from already-persisted delivery
    // facts. Degrades to null rather than costing us the evidence row.
    let adaptiveDelivery = null
    try {
      adaptiveDelivery = await buildAdaptiveProvenance({ assignmentId: assignment.id, studentId })
    } catch (err) {
      console.error('[assignments/mark] adaptive provenance failed:', err instanceof Error ? err.message : String(err))
    }
    try {
      await recordAssignmentMarkEvidence({
        studentId,
        teacherId: input.teacherId,
        teacherUserId: input.teacherUserId,
        assignmentId: assignment.id,
        subject: assignment.subject,
        topic: assignment.topic,
        substrandId: assignment.substrand_id,
        score,
        maxScore,
        academicYear: new Date().getFullYear(),
        term: null,
        markedAt,
        adaptiveDelivery,
      })
    } catch (err) {
      console.error('[assignments/mark] evidence emission failed:', err instanceof Error ? err.message : String(err))
    }
  }

  return { submission: submission as RecordSubmissionMarkResult['submission'], followUp }
}
