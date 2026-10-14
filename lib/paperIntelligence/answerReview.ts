// lib/paperIntelligence/answerReview.ts
//
// Paper Intelligence Phase 1, Commit 6 — a class-wide decision on one answer
// the AI marked "plausible, not in the scheme".
//   accept → appended to the rubric's answer bank (so every later marking
//            pass treats it as a scheme answer), audited for SBA (who, what,
//            when, how many learners re-marked), and every unreviewed
//            proposal containing it is re-scored.
//   reject → every unreviewed proposal containing it is re-scored with the
//            answer as incorrect. The scheme itself is unchanged.
// Reviewed proposals are the teacher's settled decision and are not reopened.
//
// Evidence: a re-scored proposal no longer matches the mark its pending
// evidence row carries, so that row is retired through the lifecycle
// (rejectReview, reason names the decision) and unlinked — never edited. The
// teacher's final mark reaches the learner record through the finalized
// assignment score, as for every reviewed script.

import { rejectReview } from '@/lib/intelligence/evidenceLifecycle'
import { findRubricById, appendAcceptedAnswer, recordRubricAudit } from './rubrics'
import { findProposedMarksForRubric, saveRescoredProposals, type ScriptMarkRow } from './scriptMarks'
import { applyAnswerDecision, collectPlausibleAnswers, normalizeAnswer, type AnswerDecision } from './answerDecisions'

export class AnswerDecisionError extends Error {}

export type AnswerDecisionOutcome = {
  decision: AnswerDecision
  answer: string
  learnersAffected: number
}

export async function decidePlausibleAnswer(input: {
  assignmentId: string
  rubricId: string
  answerKey: string
  decision: AnswerDecision
  /** teachers.id — audit actor. */
  teacherId: string
  /** auth.users.id — evidence lifecycle actor. */
  teacherUserId: string
}): Promise<AnswerDecisionOutcome> {
  const rubric = await findRubricById(input.rubricId)
  if (!rubric || rubric.assignment_id !== input.assignmentId) throw new AnswerDecisionError('That question is not part of this assignment.')

  const proposals = await findProposedMarksForRubric(input.rubricId)
  const group = collectPlausibleAnswers(proposals).find(g => g.key === input.answerKey)
  if (!group) throw new AnswerDecisionError('No unreviewed learner has that answer any more — it may already have been decided.')

  const structure = { maxMarks: rubric.max_marks, pointsRequired: rubric.points_required, marksPerPoint: rubric.marks_per_point }
  const rescored: ScriptMarkRow[] = []
  const retire: string[] = []
  for (const row of proposals) {
    const r = applyAnswerDecision(row.points, input.answerKey, input.decision, group.text, structure)
    if (!r.changed) continue
    if (row.evidence_id) retire.push(row.evidence_id)
    rescored.push({ ...row, points: r.points, proposed_mark: r.proposedMark, plausible_mark: r.plausibleMark, evidence_id: null })
  }

  await saveRescoredProposals(rescored)

  if (input.decision === 'accept') {
    await appendAcceptedAnswer(rubric, { text: group.text, synonyms: group.variants.filter(v => v !== group.text) }, normalizeAnswer)
    await recordRubricAudit({
      rubricId: rubric.id,
      assignmentId: input.assignmentId,
      actorTeacherId: input.teacherId,
      action: 'append_accepted_answer',
      answerAdded: { text: group.text, synonyms: group.variants.filter(v => v !== group.text), addedAt: new Date().toISOString() },
      learnersReaffected: rescored.length,
    })
  }

  const reason = input.decision === 'accept'
    ? `Superseded: teacher accepted "${group.text}" into the scheme; mark re-derived`
    : `Superseded: teacher ruled "${group.text}" does not earn marks; mark re-derived`
  // One lifecycle call per evidence row — the lifecycle has no batch form.
  await Promise.all(retire.map(id => rejectReview(id, input.teacherUserId, reason)))

  return { decision: input.decision, answer: group.text, learnersAffected: rescored.length }
}
