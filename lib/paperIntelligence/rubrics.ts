// lib/paperIntelligence/rubrics.ts
//
// Server-only — DB access for open_response_rubrics. Self-contained
// service-role calls, matching lib/quiz/quiz.ts's own convention (not every
// table's access goes through the shared repos singleton) — deliberately
// avoids touching lib/repositories/index.ts for this prototype.

import { createServiceClient } from '@/utils/supabase/service'
import type { AcceptedAnswer, ExtractedRubric, MarkingCriterion, RubricForMarking, RubricMode } from './types'

export type CreateRubricInput = {
  assignmentId: string
  questionNumber: number
  subStrandId: string | null
  questionText: string
  expectedAnswerSummary: string
  markingCriteria: MarkingCriterion[]
  maxMarks: number
  createdBy: string
  // Phase 1 fields — optional so Prototype 01 callers keep compiling; each
  // falls back to the column's own DB default when omitted.
  questionLabel?: string | null
  mode?: RubricMode
  pointsRequired?: number | null
  marksPerPoint?: number | null
  acceptedAnswers?: AcceptedAnswer[]
}

export type RubricRow = {
  id: string
  assignment_id: string
  question_number: number
  question_label: string | null
  sub_strand_id: string | null
  question_text: string
  expected_answer_summary: string
  marking_criteria: MarkingCriterion[]
  max_marks: number
  mode: RubricMode
  points_required: number | null
  marks_per_point: number | null
  accepted_answers: AcceptedAnswer[]
  created_by: string
  created_at: string
  updated_at: string
}

const RUBRIC_COLS = 'id, assignment_id, question_number, question_label, sub_strand_id, question_text, expected_answer_summary, marking_criteria, max_marks, mode, points_required, marks_per_point, accepted_answers, created_by, created_at, updated_at' as const

export async function createRubric(input: CreateRubricInput): Promise<RubricRow> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('open_response_rubrics')
    .insert({
      assignment_id: input.assignmentId,
      question_number: input.questionNumber,
      question_label: input.questionLabel ?? null,
      sub_strand_id: input.subStrandId,
      question_text: input.questionText,
      expected_answer_summary: input.expectedAnswerSummary,
      marking_criteria: input.markingCriteria,
      max_marks: input.maxMarks,
      mode: input.mode ?? 'accept_relevant',
      points_required: input.pointsRequired ?? null,
      marks_per_point: input.marksPerPoint ?? null,
      accepted_answers: input.acceptedAnswers ?? [],
      created_by: input.createdBy,
    })
    .select(RUBRIC_COLS)
    .single()
  if (error) throw new Error(`createRubric: ${error.message}`)
  return data as unknown as RubricRow
}

/**
 * Derive the structured marking criteria from a point's mark value — a
 * 1-mark point is awarded for naming; a 2-mark point needs the point named
 * (1) AND correctly explained (1), the exact rule Phase 0 proved teachers
 * apply on "Discuss/Explain" questions.
 */
export function markingCriteriaFor(marksPerPoint: number): MarkingCriterion[] {
  if (marksPerPoint === 1) return [{ criterion: 'States a correct point', points: 1 }]
  if (marksPerPoint === 2) {
    return [
      { criterion: 'Names a correct point', points: 1 },
      { criterion: 'Correctly explains it', points: 1 },
    ]
  }
  return [{ criterion: 'Each correct, fully-addressed point', points: marksPerPoint }]
}

/**
 * Map a teacher-confirmed extracted rubric to a persistable rubric row.
 * `questionNumber` is the caller-assigned ordinal (the table's int key);
 * the printed label ("1a") is preserved separately in `questionLabel`.
 */
export function extractedRubricToCreateInput(
  assignmentId: string,
  questionNumber: number,
  createdBy: string,
  r: ExtractedRubric,
): CreateRubricInput {
  const answerList = r.acceptedAnswers.map(a => a.text).join('; ')
  return {
    assignmentId,
    questionNumber,
    questionLabel: r.questionId,
    subStrandId: null,
    questionText: `${r.commandWord}: ${r.topic}`.trim(),
    expectedAnswerSummary: answerList
      ? `Any ${r.pointsRequired} of: ${answerList}`
      : r.topic,
    markingCriteria: markingCriteriaFor(r.marksPerPoint),
    maxMarks: r.maxMarks,
    mode: r.mode,
    pointsRequired: r.pointsRequired,
    marksPerPoint: r.marksPerPoint,
    acceptedAnswers: r.acceptedAnswers,
    createdBy,
  }
}

function toInsertRow(input: CreateRubricInput) {
  return {
    assignment_id: input.assignmentId,
    question_number: input.questionNumber,
    question_label: input.questionLabel ?? null,
    sub_strand_id: input.subStrandId,
    question_text: input.questionText,
    expected_answer_summary: input.expectedAnswerSummary,
    marking_criteria: input.markingCriteria,
    max_marks: input.maxMarks,
    mode: input.mode ?? 'accept_relevant',
    points_required: input.pointsRequired ?? null,
    marks_per_point: input.marksPerPoint ?? null,
    accepted_answers: input.acceptedAnswers ?? [],
    created_by: input.createdBy,
  }
}

/**
 * Persist the teacher-confirmed rubric set for an assignment. Delete-then-
 * insert so re-confirming a scheme is idempotent (the table's UNIQUE on
 * (assignment_id, question_number) would otherwise collide). question_number
 * is assigned as the 1-based ordinal of the confirmed list; the printed
 * label rides along in question_label. Only ever called from the persist
 * route, AFTER the teacher has reviewed and confirmed — the AI never reaches
 * this function on its own.
 */
export async function replaceRubricsForAssignment(
  assignmentId: string,
  createdBy: string,
  rubrics: ExtractedRubric[],
): Promise<RubricRow[]> {
  const db = createServiceClient()
  const { error: delErr } = await db
    .from('open_response_rubrics')
    .delete()
    .eq('assignment_id', assignmentId)
  if (delErr) throw new Error(`replaceRubricsForAssignment delete: ${delErr.message}`)

  if (rubrics.length === 0) return []

  const rows = rubrics.map((r, i) => toInsertRow(extractedRubricToCreateInput(assignmentId, i + 1, createdBy, r)))
  const { data, error } = await db
    .from('open_response_rubrics')
    .insert(rows)
    .select(RUBRIC_COLS)
  if (error) throw new Error(`replaceRubricsForAssignment insert: ${error.message}`)
  return (data ?? []) as unknown as RubricRow[]
}

/** Every rubric for one assignment, ordered by question_number — the shape recognizeAndMarkPage() needs. */
export async function findRubricsForAssignment(assignmentId: string): Promise<RubricRow[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('open_response_rubrics')
    .select(RUBRIC_COLS)
    .eq('assignment_id', assignmentId)
    .order('question_number', { ascending: true })
  if (error) throw new Error(`findRubricsForAssignment: ${error.message}`)
  return (data ?? []) as unknown as RubricRow[]
}

export function toRubricForMarking(row: RubricRow): RubricForMarking {
  return {
    rubricId: row.id,
    questionNumber: row.question_number,
    questionText: row.question_text,
    expectedAnswerSummary: row.expected_answer_summary,
    markingCriteria: row.marking_criteria,
    maxMarks: row.max_marks,
  }
}
