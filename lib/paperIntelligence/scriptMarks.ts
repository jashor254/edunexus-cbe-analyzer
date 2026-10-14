// lib/paperIntelligence/scriptMarks.ts
//
// Server-only — paper_intelligence_script_marks: the AI's per-question
// proposals for one learner's script, Paper Intelligence's own record (see the
// table's migration). Review-by-question and accept-answer re-apply read this
// table, never learner_evidence. Self-contained service-role access, matching
// rubrics.ts; callers authorize first.

import { createServiceClient } from '@/utils/supabase/service'
import { PAPER_INTELLIGENCE_LIMITS } from '@/lib/config/paperIntelligence'
import type { MarkedPoint, ScriptQuestionMark } from './types'

export type ScriptMarkStatus = 'proposed' | 'confirmed' | 'overridden'

export type ScriptMarkRow = {
  id: string
  submission_id: string
  assignment_id: string
  rubric_id: string
  evidence_id: string | null
  recognized_answer: string
  points: MarkedPoint[]
  proposed_mark: number
  plausible_mark: number
  max_mark: number
  recognition_confidence: number | null
  grading_confidence: number | null
  uncertain: boolean
  rationale: string | null
  page_numbers: number[]
  status: ScriptMarkStatus
  final_mark: number | null
  created_at: string
}

const MARK_COLS = 'id, submission_id, assignment_id, rubric_id, evidence_id, recognized_answer, points, proposed_mark, plausible_mark, max_mark, recognition_confidence, grading_confidence, uncertain, rationale, page_numbers, status, final_mark, created_at' as const

export async function findScriptMarksForSubmission(submissionId: string): Promise<ScriptMarkRow[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('paper_intelligence_script_marks')
    .select(MARK_COLS)
    .eq('submission_id', submissionId)
  if (error) throw new Error(`findScriptMarksForSubmission: ${error.message}`)
  return (data ?? []) as unknown as ScriptMarkRow[]
}

/**
 * Replace a submission's proposals with a fresh marking pass. Only ever called
 * after the caller has confirmed none of the existing rows were reviewed.
 */
export async function replaceScriptMarks(
  assignmentId: string,
  submissionId: string,
  marks: ScriptQuestionMark[],
  evidenceIdByRubricId: Map<string, string>,
): Promise<ScriptMarkRow[]> {
  const db = createServiceClient()
  const { error: delErr } = await db
    .from('paper_intelligence_script_marks')
    .delete()
    .eq('submission_id', submissionId)
    .eq('status', 'proposed')
  if (delErr) throw new Error(`replaceScriptMarks delete: ${delErr.message}`)
  if (marks.length === 0) return []

  const { data, error } = await db
    .from('paper_intelligence_script_marks')
    .insert(marks.map(m => ({
      submission_id: submissionId,
      assignment_id: assignmentId,
      rubric_id: m.rubricId,
      evidence_id: evidenceIdByRubricId.get(m.rubricId) ?? null,
      recognized_answer: m.recognizedAnswer,
      points: m.points,
      proposed_mark: m.proposedMark,
      plausible_mark: m.plausibleMark,
      max_mark: m.maxMark,
      recognition_confidence: m.recognitionConfidence,
      grading_confidence: m.gradingConfidence,
      uncertain: m.uncertain,
      rationale: m.rationale,
      page_numbers: m.pageNumbers,
    })))
    .select(MARK_COLS)
  if (error) throw new Error(`replaceScriptMarks insert: ${error.message}`)
  return (data ?? []) as unknown as ScriptMarkRow[]
}

export type ScriptMarkTotals = {
  questionsMarked: number
  proposedTotal: number
  plausibleTotal: number
  maxTotal: number
  /** Questions the AI was unsure how to read or mark — the ones a teacher must look at. */
  needsAttention: number
  reviewed: boolean
}

/** Per-submission totals for a whole class in one query — the capture roster's status column. */
export async function findScriptMarkTotalsForAssignment(assignmentId: string): Promise<Map<string, ScriptMarkTotals>> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('paper_intelligence_script_marks')
    .select('submission_id, proposed_mark, plausible_mark, max_mark, uncertain, grading_confidence, status')
    .eq('assignment_id', assignmentId)
  if (error) throw new Error(`findScriptMarkTotalsForAssignment: ${error.message}`)

  const totals = new Map<string, ScriptMarkTotals>()
  for (const row of data ?? []) {
    const t = totals.get(row.submission_id as string) ?? { questionsMarked: 0, proposedTotal: 0, plausibleTotal: 0, maxTotal: 0, needsAttention: 0, reviewed: false }
    t.questionsMarked++
    t.proposedTotal += row.proposed_mark as number
    t.plausibleTotal += row.plausible_mark as number
    t.maxTotal += row.max_mark as number
    if (needsAttention({ uncertain: row.uncertain as boolean, grading_confidence: row.grading_confidence as number | null, proposed_mark: row.proposed_mark as number, plausible_mark: row.plausible_mark as number })) t.needsAttention++
    if (row.status !== 'proposed') t.reviewed = true
    totals.set(row.submission_id as string, t)
  }
  return totals
}

/**
 * A proposal a teacher should look at rather than wave through: the AI could
 * not read it, was unsure of its own marking, or found answers the scheme does
 * not list (the teacher decides whether they earn). Phase 0: the AI's own
 * uncertainty flags covered 3 of the 4 questions where it and the teacher
 * disagreed.
 */
export function needsAttention(m: { uncertain: boolean; grading_confidence: number | null; proposed_mark: number; plausible_mark: number }): boolean {
  return m.uncertain || (m.grading_confidence ?? 0) < PAPER_INTELLIGENCE_LIMITS.reviewBelowGradingConfidence || m.plausible_mark > m.proposed_mark
}
