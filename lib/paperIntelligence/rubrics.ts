// lib/paperIntelligence/rubrics.ts
//
// Server-only — DB access for open_response_rubrics. Self-contained
// service-role calls, matching lib/quiz/quiz.ts's own convention (not every
// table's access goes through the shared repos singleton) — deliberately
// avoids touching lib/repositories/index.ts for this prototype.

import { createServiceClient } from '@/utils/supabase/service'
import type { MarkingCriterion, RubricForMarking } from './types'

export type CreateRubricInput = {
  assignmentId: string
  questionNumber: number
  subStrandId: string | null
  questionText: string
  expectedAnswerSummary: string
  markingCriteria: MarkingCriterion[]
  maxMarks: number
  createdBy: string
}

export type RubricRow = {
  id: string
  assignment_id: string
  question_number: number
  sub_strand_id: string | null
  question_text: string
  expected_answer_summary: string
  marking_criteria: MarkingCriterion[]
  max_marks: number
  created_by: string
  created_at: string
  updated_at: string
}

const RUBRIC_COLS = 'id, assignment_id, question_number, sub_strand_id, question_text, expected_answer_summary, marking_criteria, max_marks, created_by, created_at, updated_at' as const

export async function createRubric(input: CreateRubricInput): Promise<RubricRow> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('open_response_rubrics')
    .insert({
      assignment_id: input.assignmentId,
      question_number: input.questionNumber,
      sub_strand_id: input.subStrandId,
      question_text: input.questionText,
      expected_answer_summary: input.expectedAnswerSummary,
      marking_criteria: input.markingCriteria,
      max_marks: input.maxMarks,
      created_by: input.createdBy,
    })
    .select(RUBRIC_COLS)
    .single()
  if (error) throw new Error(`createRubric: ${error.message}`)
  return data as unknown as RubricRow
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
