import { createServiceClient } from '@/utils/supabase/service'
import type { FollowUp, ReflectionSource } from '@/lib/teachingIntelligence/types'

export type EvaluationInput = {
  evaluation: string
  followUp: FollowUp
  reflectionSource?: ReflectionSource
}

type ExistingPlan = {
  status: string
  sow_id: string
  strand: string
  sub_strand: string
}

type HealthRow = {
  id: string
  struggle_count: number
  lessons_covered: number
}

// Shared evaluation logic called by both the API route and seed/testing scripts.
// userId must be the auth user ID — used for ownership check and substrand_health.teacher_id.
export async function submitEvaluation(
  planId: string,
  userId: string,
  input: EvaluationInput
): Promise<Record<string, unknown>> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from('lesson_plans')
    .select('status, sow_id, strand, sub_strand')
    .eq('id', planId)
    .eq('teacher_id', userId)
    .single()

  if (!existing) throw new Error(`Plan ${planId} not found or not owned by user`)
  const plan = existing as ExistingPlan

  if (plan.status !== 'taught') {
    throw new Error('Plan must be marked as taught before evaluation can be saved')
  }

  const { data: updated, error } = await db
    .from('lesson_plans')
    .update({
      teacher_self_evaluation: input.evaluation,
      teacher_flagged_followup: input.followUp,
      ...(input.reflectionSource ? { reflection_source: input.reflectionSource } : {}),
    })
    .eq('id', planId)
    .eq('teacher_id', userId)
    .select()
    .single()

  if (error || !updated) throw new Error(`Failed to save evaluation: ${error?.message ?? 'unknown'}`)

  // Synchronous substrand_health upsert — mirrors the behaviour of the evaluation API route.
  // lessons_covered always increments; struggle_count increments only on minor/major follow-up.
  if (plan.sow_id && plan.strand && plan.sub_strand) {
    const needsFlag = input.followUp !== 'none'

    const { data: healthRow } = await db
      .from('substrand_health')
      .select('id, struggle_count, lessons_covered')
      .eq('sow_id', plan.sow_id)
      .eq('strand', plan.strand)
      .eq('sub_strand', plan.sub_strand)
      .maybeSingle()

    if (healthRow) {
      const h = healthRow as HealthRow
      await db
        .from('substrand_health')
        .update({
          lessons_covered: h.lessons_covered + 1,
          ...(needsFlag ? {
            struggle_count: h.struggle_count + 1,
            last_flagged: new Date().toISOString(),
          } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', h.id)
    } else {
      await db.from('substrand_health').insert({
        sow_id: plan.sow_id,
        teacher_id: userId,
        strand: plan.strand,
        sub_strand: plan.sub_strand,
        lessons_covered: 1,
        struggle_count: needsFlag ? 1 : 0,
        ...(needsFlag ? { last_flagged: new Date().toISOString() } : {}),
      })
    }
  }

  return updated as Record<string, unknown>
}
