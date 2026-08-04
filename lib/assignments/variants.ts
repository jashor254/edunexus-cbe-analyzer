// lib/assignments/variants.ts
// Sprint 9 Slice 1 — the Variant Repository (ADR-0025 / Sprint 4B design).
// Owns assignment_question_variants CRUD and its lifecycle transitions
// (draft -> approved/rejected -> archived). No AI generation lives here —
// this module only persists and transitions rows a future generation slice
// will create; it composes with, and never re-implements, the Assignment
// Repository's canonical-question functions (lib/quiz/quiz.ts).

import { createServiceClient } from '@/utils/supabase/service'

export type VariantType = 'foundation' | 'supported_practice' | 'extension'
export type VariantStatus = 'draft' | 'approved' | 'rejected' | 'archived'

export type VariantInput = {
  questionId:  string
  variantType: VariantType
  questionText: string
  choices: string[]
  correctIndex: number
  cognitiveIntent?: string | null
  difficultyRationale?: string | null
  expectedMisconceptions?: string[]
  teacherExplanation?: string | null
  learnerExplanation?: string | null
  generatedBy?: 'ai' | 'teacher_edited'
  subStrandId?: string | null
  learningOutcome?: string | null
}

export type VariantRow = {
  id: string
  question_id: string
  variant_type: VariantType
  question_text: string
  choices: string[]
  correct_index: number
  cognitive_intent: string | null
  difficulty_rationale: string | null
  expected_misconceptions: string[]
  teacher_explanation: string | null
  learner_explanation: string | null
  status: VariantStatus
  generated_by: 'ai' | 'teacher_edited'
  sub_strand_id: string | null
  learning_outcome: string | null
  supersedes: string | null
  superseded_by: string | null
  created_at: string
  updated_at: string
  approved_at: string | null
  archived_at: string | null
}

const VARIANT_COLUMNS = 'id, question_id, variant_type, question_text, choices, correct_index, cognitive_intent, difficulty_rationale, expected_misconceptions, teacher_explanation, learner_explanation, status, generated_by, sub_strand_id, learning_outcome, supersedes, superseded_by, created_at, updated_at, approved_at, archived_at' as const

function toRow(v: VariantInput) {
  return {
    question_id: v.questionId,
    variant_type: v.variantType,
    question_text: v.questionText,
    choices: v.choices,
    correct_index: v.correctIndex,
    cognitive_intent: v.cognitiveIntent ?? null,
    difficulty_rationale: v.difficultyRationale ?? null,
    expected_misconceptions: v.expectedMisconceptions ?? [],
    teacher_explanation: v.teacherExplanation ?? null,
    learner_explanation: v.learnerExplanation ?? null,
    generated_by: v.generatedBy ?? 'ai',
    sub_strand_id: v.subStrandId ?? null,
    learning_outcome: v.learningOutcome ?? null,
  }
}

/** Bulk-inserts draft variants — one row per (question, tier), status='draft' always. Never auto-approved. */
export async function createDraftVariants(inputs: VariantInput[]): Promise<VariantRow[]> {
  if (!inputs.length) return []
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_question_variants')
    .insert(inputs.map(toRow))
    .select(VARIANT_COLUMNS)
  if (error) throw new Error(`Failed to create draft variants: ${error.message}`)
  return (data ?? []) as VariantRow[]
}

/** Every variant (any status) for one canonical question — the teacher review screen's read path (a future slice). */
export async function findVariantsForQuestion(questionId: string): Promise<VariantRow[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_question_variants')
    .select(VARIANT_COLUMNS)
    .eq('question_id', questionId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to fetch variants: ${error.message}`)
  return (data ?? []) as VariantRow[]
}

/**
 * Every variant (any status) across multiple questions in one query —
 * Sprint 8 (Assessment Excellence), the Review Dashboard's batched read
 * path. Replaces the page's prior pattern of one findVariantsForQuestion()
 * call per question (an N-request round trip for an N-question quiz) with
 * a single `.in()` query. Same shape, same ordering rule as the
 * single-question version — callers group by `question_id` client-side.
 */
export async function findVariantsForQuestionIds(questionIds: string[]): Promise<VariantRow[]> {
  if (!questionIds.length) return []
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_question_variants')
    .select(VARIANT_COLUMNS)
    .in('question_id', questionIds)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to fetch variants: ${error.message}`)
  return (data ?? []) as VariantRow[]
}

/** The one row a serving/grading path (Sprint 4C, not built in this slice) may ever select fresh — approved only. */
export async function findApprovedVariant(questionId: string, variantType: VariantType): Promise<VariantRow | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_question_variants')
    .select(VARIANT_COLUMNS)
    .eq('question_id', questionId)
    .eq('variant_type', variantType)
    .eq('status', 'approved')
    .maybeSingle()
  if (error) throw new Error(`Failed to fetch approved variant: ${error.message}`)
  return (data as VariantRow | null) ?? null
}

/** Grading must be able to read a variant regardless of its current status (Sprint 4C) — an archived row must stay gradable for a learner already served it. Never filters on status. */
export async function findVariantById(variantId: string): Promise<VariantRow | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_question_variants')
    .select(VARIANT_COLUMNS)
    .eq('id', variantId)
    .maybeSingle()
  if (error) throw new Error(`Failed to fetch variant: ${error.message}`)
  return (data as VariantRow | null) ?? null
}

/**
 * A teacher's manual edit to a still-draft variant. Always flips
 * `generated_by` to 'teacher_edited' — provenance (the row's `id`,
 * `question_id`, `variant_type`, `sub_strand_id`, `learning_outcome`) is
 * untouched; only content and authorship change. The lifecycle trigger
 * (Sprint 9 Slice 1) only allows this while the row is still 'draft' — an
 * approved/rejected variant must go through regenerateVariant() instead.
 */
export async function editVariant(variantId: string, patch: {
  questionText?: string
  choices?: string[]
  correctIndex?: number
  teacherExplanation?: string | null
  learnerExplanation?: string | null
}): Promise<VariantRow> {
  const db = createServiceClient()
  const update: Record<string, unknown> = { generated_by: 'teacher_edited' }
  if (patch.questionText !== undefined) update.question_text = patch.questionText
  if (patch.choices !== undefined) update.choices = patch.choices
  if (patch.correctIndex !== undefined) update.correct_index = patch.correctIndex
  if (patch.teacherExplanation !== undefined) update.teacher_explanation = patch.teacherExplanation
  if (patch.learnerExplanation !== undefined) update.learner_explanation = patch.learnerExplanation

  const { data, error } = await db
    .from('assignment_question_variants')
    .update(update)
    .eq('id', variantId)
    .select(VARIANT_COLUMNS)
    .single()
  if (error) throw new Error(`Failed to edit variant: ${error.message}`)
  return data as VariantRow
}

export async function approveVariant(variantId: string): Promise<VariantRow> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_question_variants')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', variantId)
    .select(VARIANT_COLUMNS)
    .single()
  if (error) throw new Error(`Failed to approve variant: ${error.message}`)
  return data as VariantRow
}

export async function rejectVariant(variantId: string): Promise<VariantRow> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_question_variants')
    .update({ status: 'rejected' })
    .eq('id', variantId)
    .select(VARIANT_COLUMNS)
    .single()
  if (error) throw new Error(`Failed to reject variant: ${error.message}`)
  return data as VariantRow
}

/**
 * Regenerates one variant: archives the old row (superseded_by set) and
 * inserts a fresh draft in its place, atomically — via the
 * regenerate_assignment_question_variant() Postgres function, never as two
 * separate JS-side calls, so a learner already served the old (now
 * archived) row keeps a fully valid, gradable reference forever.
 */
export async function regenerateVariant(
  oldVariantId: string,
  replacement: Pick<VariantInput, 'questionText' | 'choices' | 'correctIndex' | 'cognitiveIntent' | 'difficultyRationale' | 'expectedMisconceptions' | 'teacherExplanation' | 'learnerExplanation'>,
): Promise<VariantRow> {
  const db = createServiceClient()
  const { data, error } = await db.rpc('regenerate_assignment_question_variant', {
    p_old_variant_id: oldVariantId,
    p_new_variant: {
      question_text: replacement.questionText,
      choices: replacement.choices,
      correct_index: replacement.correctIndex,
      cognitive_intent: replacement.cognitiveIntent ?? null,
      difficulty_rationale: replacement.difficultyRationale ?? null,
      expected_misconceptions: replacement.expectedMisconceptions ?? [],
      teacher_explanation: replacement.teacherExplanation ?? null,
      learner_explanation: replacement.learnerExplanation ?? null,
    },
  })
  if (error) throw new Error(`Failed to regenerate variant: ${error.message}`)
  return data as VariantRow
}
