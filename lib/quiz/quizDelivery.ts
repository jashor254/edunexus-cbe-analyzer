// lib/quiz/quizDelivery.ts
// Sprint 9 Slice 3 — Adaptive Assessment Delivery. The one place a
// learner's served variant is ever decided, exactly once, and the one
// place a submission's answers are graded against the right answer key.
//
// Recommendation is consulted exactly once per (assignment, student) — at
// first open, when served_variant_map has no entry yet for that
// assignment's questions. Every later open, resubmission, refresh, or
// regrade reads the already-persisted map and never calls
// recomputeLearnerProjection/buildAdaptiveTask again for this
// (assignment, student) pair. No new classifier, no new curriculum
// resolver, no new recommendation engine — reuses exactly what Sprint 9
// Slice 2's generation pipeline already reuses.

import { createServiceClient } from '@/utils/supabase/service'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { buildAdaptiveTask, type AdaptiveGroupType } from '@/lib/adaptiveLearning/recommend'
import { CurriculumService } from '@/lib/curriculum/service'
import { BAND_TO_TIER } from '@/lib/assignments/variantGeneration'
import { findApprovedVariant, findVariantById, type VariantType } from '@/lib/assignments/variants'
import { findQuestionsForTeacher } from './quiz'

export type ServedVariantMap = Record<string, string | null>

export type ServedQuestion = {
  id: string
  question_text: string
  choices: string[]
  order_index: number
}

/**
 * Resolves and returns the authoritative served_variant_map for one
 * (assignment, student) pair. Fast path (no Projection call, no
 * classification, no AI, one indexed read): every question already has an
 * entry. Slow path (first open only): resolves the learner's band exactly
 * once, looks up an approved variant per question, and persists the whole
 * batch atomically via resolve_served_variants_batch() — a single UPDATE,
 * never a race that could let two concurrent opens disagree (see the
 * migration's own comment for why one guarded UPDATE is sufficient).
 */
export async function resolveServedVariantsForStudent(params: {
  assignmentId: string
  studentId: string
  learnerName: string
}): Promise<ServedVariantMap> {
  const db = createServiceClient()

  const [{ data: submission }, { data: assignment }, canonicalQuestions] = await Promise.all([
    db.from('assignment_submissions').select('served_variant_map').eq('assignment_id', params.assignmentId).eq('student_id', params.studentId).maybeSingle(),
    db.from('assignments').select('subject, substrand_id').eq('id', params.assignmentId).maybeSingle(),
    findQuestionsForTeacher(params.assignmentId),
  ])

  const existingMap = (submission?.served_variant_map as ServedVariantMap | null) ?? {}
  const missingQuestionIds = canonicalQuestions.filter(q => !(q.id in existingMap)).map(q => q.id)

  if (missingQuestionIds.length === 0) return existingMap
  if (!assignment) throw new Error(`Assignment ${params.assignmentId} not found`)

  // First open for at least one question — resolve the band exactly once,
  // reusing Projection + Recommendation exactly as every other consumer
  // does. Never called again for this (assignment, student) pair once the
  // map is complete (confirmed by the fast-path return above).
  const [projection, curriculum] = await Promise.all([
    recomputeLearnerProjection(params.studentId),
    assignment.substrand_id ? CurriculumService.resolveSubstrandContext(assignment.substrand_id) : Promise.resolve(null),
  ])
  const task = buildAdaptiveTask(params.studentId, params.learnerName, assignment.subject, projection, { curriculumContext: curriculum })
  const tier = BAND_TO_TIER[task.groupType as AdaptiveGroupType]

  const pairs: ServedVariantMap = {}
  for (const questionId of missingQuestionIds) {
    // No tier (insufficient_data) or no approved variant for this tier yet
    // — the honest ADR-0025 fallback: null, serving canonical, recorded as
    // a real sticky fact, never a guess and never retried on a later open.
    const approved = tier ? await findApprovedVariant(questionId, tier) : null
    pairs[questionId] = approved?.id ?? null
  }

  const { data, error } = await db.rpc('resolve_served_variants_batch', {
    p_assignment_id: params.assignmentId,
    p_student_id: params.studentId,
    p_pairs: pairs,
  })
  if (error) throw new Error(`Failed to resolve served variants: ${error.message}`)
  return (data as ServedVariantMap) ?? existingMap
}

/**
 * The student-facing question list — never includes correct_index for
 * either a canonical question or a variant, matching
 * findQuestionsForStudent's own existing security posture exactly.
 */
export async function findServedQuestionsForStudent(params: {
  assignmentId: string
  studentId: string
  learnerName: string
}): Promise<ServedQuestion[]> {
  const [canonicalQuestions, servedMap] = await Promise.all([
    findQuestionsForTeacher(params.assignmentId), // server-side only; correct_index stripped below before this ever reaches the student
    resolveServedVariantsForStudent(params),
  ])

  const results: ServedQuestion[] = []
  for (const question of canonicalQuestions) {
    const variantId = servedMap[question.id]
    if (variantId) {
      // Status-agnostic on purpose — a regenerated (now archived) variant
      // must still be servable to a student who was already bound to it
      // before the archived_at moment. Approval status only gates NEW
      // resolution (resolveServedVariantsForStudent's findApprovedVariant
      // call above), never a re-serve of an already-bound variant.
      const variant = await findVariantById(variantId)
      if (variant) {
        results.push({ id: question.id, question_text: variant.question_text, choices: variant.choices, order_index: question.order_index })
        continue
      }
    }
    results.push({ id: question.id, question_text: question.question_text, choices: question.choices, order_index: question.order_index })
  }

  return results.sort((a, b) => a.order_index - b.order_index)
}

/**
 * Adaptive Remediation Phase 1, Stage 1 — the instructional provenance of
 * one (assignment, student) delivery, assembled entirely from facts already
 * persisted at delivery time.
 *
 * Deliberately performs NO classification: it never calls
 * `recomputeLearnerProjection`, `decideAdaptive`, or `buildAdaptiveTask`.
 * Re-deriving the band here would report the learner's state after the
 * outcome rather than the condition under which it was produced — the exact
 * mistake this provenance exists to prevent. It reads `served_variant_map`
 * (written once, immutably, at first open) and the variant rows it names.
 *
 * Returns null when the submission has no served map at all — an assignment
 * delivered before Sprint 9 Slice 3, or a non-quiz path. Null is honest;
 * a fabricated "canonical" answer would not be.
 */
export async function summariseServedAdaptation(params: {
  assignmentId: string
  studentId: string
}): Promise<{
  servedTier: VariantType | null
  servedVariantIds: string[]
  questionsServedVariant: number
  questionsServedCanonical: number
} | null> {
  const db = createServiceClient()
  const { data: submission } = await db
    .from('assignment_submissions')
    .select('served_variant_map')
    .eq('assignment_id', params.assignmentId)
    .eq('student_id', params.studentId)
    .maybeSingle()

  const servedMap = submission?.served_variant_map as ServedVariantMap | null
  if (!servedMap) return null

  const entries = Object.values(servedMap)
  const variantIds = [...new Set(entries.filter((v): v is string => v !== null))]

  // Tier comes from the bound variant rows themselves — the only place it
  // is a recorded fact. All bound variants for one (assignment, student)
  // share a tier by construction (resolveServedVariantsForStudent resolves
  // the band exactly once), but this reads rather than assumes it, and
  // reports null if that invariant ever failed rather than picking one.
  const variants = await Promise.all(variantIds.map(id => findVariantById(id)))
  const tiers = [...new Set(variants.filter(v => v !== null).map(v => v!.variant_type))]

  return {
    servedTier: tiers.length === 1 ? tiers[0] : null,
    servedVariantIds: variantIds,
    questionsServedVariant: entries.filter(v => v !== null).length,
    questionsServedCanonical: entries.filter(v => v === null).length,
  }
}

/**
 * Resolves the correct_index to grade a submitted answer against: the
 * variant's own answer key when served_variant_map names one for this
 * question (status-agnostic — an archived variant is still gradable),
 * otherwise the canonical question's own key, exactly as before this slice.
 */
export async function resolveGradingQuestions(
  assignmentId: string,
  studentId: string,
  questions: Array<{ id: string; correct_index: number }>,
): Promise<Array<{ id: string; correctIndex: number }>> {
  const db = createServiceClient()
  const { data: submission } = await db
    .from('assignment_submissions')
    .select('served_variant_map')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()
  const servedMap = (submission?.served_variant_map as ServedVariantMap | null) ?? {}

  return Promise.all(questions.map(async q => {
    const variantId = servedMap[q.id]
    if (variantId) {
      const variant = await findVariantById(variantId)
      if (variant) return { id: q.id, correctIndex: variant.correct_index }
    }
    return { id: q.id, correctIndex: q.correct_index }
  }))
}
