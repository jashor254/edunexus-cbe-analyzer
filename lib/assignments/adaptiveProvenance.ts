// lib/assignments/adaptiveProvenance.ts
// Adaptive Remediation Phase 1, Stage 1 — the one place an outcome's
// instructional provenance is assembled.
//
// Answers "what support was this learner actually given when they produced
// this result?" from facts already persisted at delivery time, and nothing
// else. It performs NO classification: no `recomputeLearnerProjection`, no
// `decideAdaptive`, no `buildAdaptiveTask`. Re-deriving a band at grading
// time would describe the learner AFTER the outcome, which is a different
// question wearing the right label — see AdaptiveDeliveryPayload's own doc
// comment for the full reasoning.
//
// Shared by both outcome producers (the teacher-marked assignment route and
// the auto-graded quiz route) so neither assembles its own version.

import { createServiceClient } from '@/utils/supabase/service'
import type { AdaptiveDeliveryPayload } from '@/lib/intelligence/evidence'
import { summariseServedAdaptation } from '@/lib/quiz/quizDelivery'

/**
 * Builds the provenance payload for one (assignment, student) outcome.
 *
 * Returns null only when the assignment row itself cannot be read — in
 * which case the caller emits evidence with no payload, exactly as before
 * this stage. A missing served-variant map is NOT a failure: a plain
 * non-quiz assignment legitimately has none, and the assignment-level facts
 * (`is_adaptive`, `blueprint_action_item_id`) are still real provenance
 * worth recording on their own.
 */
export async function buildAdaptiveProvenance(params: {
  assignmentId: string
  studentId: string
}): Promise<AdaptiveDeliveryPayload | null> {
  const db = createServiceClient()

  const [{ data: assignment }, served] = await Promise.all([
    db
      .from('assignments')
      .select('is_adaptive, blueprint_action_item_id')
      .eq('id', params.assignmentId)
      .maybeSingle(),
    summariseServedAdaptation(params),
  ])

  if (!assignment) return null

  return {
    kind: 'adaptive_delivery',
    payloadVersion: 1,
    servedTier: served?.servedTier ?? null,
    servedVariantIds: served?.servedVariantIds ?? [],
    questionsServedVariant: served?.questionsServedVariant ?? 0,
    questionsServedCanonical: served?.questionsServedCanonical ?? 0,
    isAdaptiveAssignment: (assignment.is_adaptive as boolean | null) ?? false,
    blueprintActionItemId: (assignment.blueprint_action_item_id as string | null) ?? null,
  }
}
