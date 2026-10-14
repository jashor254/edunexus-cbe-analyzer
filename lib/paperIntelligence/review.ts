// lib/paperIntelligence/review.ts
//
// Paper Intelligence Phase 1, Commit 5 — the teacher's review of AI proposals,
// question by question across the class, and finalizing reviewed scripts into
// the learner's real assignment score.
//
// Evidence is moved only through the canonical lifecycle functions:
//   - teacher agrees with the AI's proposal  → confirmReview
//   - teacher gives a different mark         → rejectReview (reason records both)
//   - a confirmed proposal later changed     → retractEvidence
// The teacher's actual marks reach the learner record through the finalized
// assignment score (recordSubmissionMark → assignment-mark evidence, whose
// correction key supersedes on any later change) — the same path a
// hand-entered mark takes.
//
// A finalized total that exceeds the paper's "marked out of" is NOT written:
// it is returned for the teacher to resolve (e.g. a learner who answered more
// optional questions than allowed). Never clamped.

import { confirmReview, rejectReview, retractEvidence } from '@/lib/intelligence/evidenceLifecycle'
import { recordSubmissionMark } from '@/lib/assignments/markSubmission'
import { findRubricsForAssignment } from './rubrics'
import {
  findScriptMarksForAssignment,
  findScriptMarksForSubmissions,
  applyReviewDecision,
  insertTeacherEnteredMarks,
  type ScriptMarkRow,
  type TeacherEnteredMark,
} from './scriptMarks'
import { findReviewSubmissions, findMarkableAssignment } from './reviewContext'
import { buildQuestionReviews, scriptCompletion, type QuestionReview } from './reviewGrouping'

export class ReviewDecisionError extends Error {}

export type MarkDecision = { submissionId: string; rubricId: string; finalMark: number }

export type AssignmentReview = {
  markedOutOf: number | null
  questions: QuestionReview[]
  scripts: { marked: number; complete: number }
}

export async function getAssignmentReview(assignmentId: string): Promise<AssignmentReview> {
  const [rubricRows, marks, submissions, assignment] = await Promise.all([
    findRubricsForAssignment(assignmentId),
    findScriptMarksForAssignment(assignmentId),
    findReviewSubmissions(assignmentId),
    findMarkableAssignment(assignmentId),
  ])
  const rubricIds = rubricRows.map(r => r.id)
  const marksBySubmission = groupBySubmission(marks)

  return {
    markedOutOf: assignment.max_score,
    questions: buildQuestionReviews(
      rubricRows.map(r => ({
        id: r.id,
        questionNumber: r.question_number,
        label: r.question_label ?? String(r.question_number),
        questionText: r.question_text,
        maxMarks: r.max_marks,
        acceptedAnswers: (r.accepted_answers ?? []).map(a => a.text),
      })),
      marks,
      submissions.map(s => ({ submissionId: s.submissionId, name: s.name })),
    ),
    scripts: {
      marked: marksBySubmission.size,
      complete: [...marksBySubmission.values()].filter(m => scriptCompletion(rubricIds, m).complete).length,
    },
  }
}

export type ConfirmOutcome = {
  saved: number
  finalized: Array<{ submissionId: string; learnerName: string; total: number }>
  overMarkedOutOf: Array<{ submissionId: string; learnerName: string; total: number; markedOutOf: number }>
  /** Notification + assignment-mark evidence for each finalized script — run after the response. */
  followUps: Array<() => Promise<void>>
}

export async function confirmQuestionMarks(input: {
  assignmentId: string
  /** The assignment's class — every decision's submission must belong to it. */
  classId: string
  teacherId: string
  teacherUserId: string
  decisions: MarkDecision[]
}): Promise<ConfirmOutcome> {
  const { assignmentId, decisions } = input
  if (decisions.length === 0) throw new ReviewDecisionError('Nothing to confirm.')

  const [rubricRows, submissions, assignment] = await Promise.all([
    findRubricsForAssignment(assignmentId),
    findReviewSubmissions(assignmentId),
    findMarkableAssignment(assignmentId),
  ])
  const maxByRubric = new Map(rubricRows.map(r => [r.id, r.max_marks]))
  const submissionById = new Map(submissions.map(s => [s.submissionId, s]))

  // ── Validate every decision before anything is written ────────────────
  const seen = new Set<string>()
  for (const d of decisions) {
    const key = `${d.submissionId}:${d.rubricId}`
    if (seen.has(key)) throw new ReviewDecisionError('The same learner and question appear twice.')
    seen.add(key)
    const max = maxByRubric.get(d.rubricId)
    if (max === undefined) throw new ReviewDecisionError('A question is not part of this assignment’s scheme.')
    if (!Number.isInteger(d.finalMark) || d.finalMark < 0 || d.finalMark > max) {
      throw new ReviewDecisionError(`A mark must be a whole number from 0 to ${max}.`)
    }
    const sub = submissionById.get(d.submissionId)
    if (!sub || sub.classId !== input.classId) throw new ReviewDecisionError('A learner is not on this assignment.')
  }

  const affected = [...new Set(decisions.map(d => d.submissionId))]
  const existing = await findScriptMarksForSubmissions(affected)
  const markByKey = new Map(existing.map(m => [`${m.submission_id}:${m.rubric_id}`, m]))

  // ── Evidence lifecycle first: if it fails, no review row has moved ────
  const evidenceOps: Array<Promise<unknown>> = []
  const updates = new Map<string, { status: 'confirmed' | 'overridden'; finalMark: number; ids: string[] }>()
  const entered: TeacherEnteredMark[] = []

  for (const d of decisions) {
    const row = markByKey.get(`${d.submissionId}:${d.rubricId}`)
    if (!row) {
      entered.push({ submissionId: d.submissionId, assignmentId, rubricId: d.rubricId, maxMark: maxByRubric.get(d.rubricId) as number, finalMark: d.finalMark, reviewedBy: input.teacherId })
      continue
    }
    const status = d.finalMark === row.proposed_mark ? 'confirmed' : 'overridden'
    const op = evidenceOpFor(row, status, d.finalMark, input.teacherUserId)
    if (op) evidenceOps.push(op)
    const groupKey = `${status}:${d.finalMark}`
    const group = updates.get(groupKey) ?? { status, finalMark: d.finalMark, ids: [] }
    group.ids.push(row.id)
    updates.set(groupKey, group)
  }

  // One lifecycle call per evidence row — the lifecycle has no batch form.
  await Promise.all(evidenceOps)
  await Promise.all([
    ...[...updates.values()].map(u => applyReviewDecision(u.ids, { status: u.status, finalMark: u.finalMark, reviewedBy: input.teacherId })),
    insertTeacherEnteredMarks(entered),
  ])

  // ── Finalize every script this call completed ─────────────────────────
  const rubricIds = rubricRows.map(r => r.id)
  const fresh = groupBySubmission(await findScriptMarksForSubmissions(affected))
  const markedOutOf = assignment.max_score ?? 100
  const outcome: ConfirmOutcome = { saved: decisions.length, finalized: [], overMarkedOutOf: [], followUps: [] }

  const toFinalize: Array<{ submissionId: string; learnerName: string; total: number }> = []
  for (const submissionId of affected) {
    const completion = scriptCompletion(rubricIds, fresh.get(submissionId) ?? [])
    if (!completion.complete) continue
    const learnerName = submissionById.get(submissionId)?.name ?? 'Unnamed learner'
    if (completion.total > markedOutOf) outcome.overMarkedOutOf.push({ submissionId, learnerName, total: completion.total, markedOutOf })
    else toFinalize.push({ submissionId, learnerName, total: completion.total })
  }

  // One shared-mark-path write per finalized learner — each total differs.
  const results = await Promise.all(toFinalize.map(f => recordSubmissionMark({
    assignment,
    target: { submissionId: f.submissionId },
    score: f.total,
    teacherId: input.teacherId,
    teacherUserId: input.teacherUserId,
  })))
  outcome.finalized = toFinalize
  outcome.followUps = results.map(r => r.followUp)
  return outcome
}

function evidenceOpFor(row: ScriptMarkRow, status: 'confirmed' | 'overridden', finalMark: number, actor: string): Promise<unknown> | null {
  if (!row.evidence_id) return null
  if (row.status === 'proposed') {
    return status === 'confirmed'
      ? confirmReview(row.evidence_id, actor, 'Teacher confirmed the Paper Intelligence proposal')
      : rejectReview(row.evidence_id, actor, `Teacher marked ${finalMark}/${row.max_mark}; Paper Intelligence proposed ${row.proposed_mark}`)
  }
  if (row.status === 'confirmed' && status === 'overridden') {
    return retractEvidence(row.evidence_id, actor, `Teacher changed the mark to ${finalMark}/${row.max_mark} after confirming ${row.proposed_mark}`)
  }
  return null
}

function groupBySubmission<T extends Pick<ScriptMarkRow, 'submission_id'>>(marks: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const m of marks) out.set(m.submission_id, [...(out.get(m.submission_id) ?? []), m])
  return out
}
