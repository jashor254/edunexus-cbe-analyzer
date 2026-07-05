import { repos } from '@/lib/repositories'
import type { FollowUp, ReflectionSource } from '@/lib/teachingIntelligence/types'

export type EvaluationInput = {
  evaluation: string
  followUp: FollowUp
  reflectionSource?: ReflectionSource
}

// Shared evaluation logic called by both the API route and seed/testing scripts.
// userId must be the auth user ID — used for ownership check and substrand_health.teacher_id.
export async function submitEvaluation(
  planId: string,
  userId: string,
  input: EvaluationInput
): Promise<Record<string, unknown>> {
  const plan = await repos.curriculum.findLessonPlanStatus(planId, userId)

  if (!plan) throw new Error(`Plan ${planId} not found or not owned by user`)

  if (plan.status !== 'taught') {
    throw new Error('Plan must be marked as taught before evaluation can be saved')
  }

  const updated = await repos.curriculum.updateLessonPlanEvaluation(
    planId,
    userId,
    input.evaluation,
    input.followUp,
    input.reflectionSource,
  )

  // Synchronous substrand_health upsert — mirrors the behaviour of the evaluation API route.
  // lessons_covered always increments; struggle_count increments only on minor/major follow-up.
  if (plan.sow_id && plan.strand && plan.sub_strand) {
    const needsFlag = input.followUp !== 'none'

    const healthRow = await repos.curriculum.findSubstrandHealth(plan.sow_id, plan.strand, plan.sub_strand)

    if (healthRow) {
      await repos.curriculum.updateSubstrandHealth(healthRow.id, {
        lessons_covered: healthRow.lessons_covered + 1,
        ...(needsFlag ? {
          struggle_count: healthRow.struggle_count + 1,
          last_flagged: new Date().toISOString(),
        } : {}),
        updated_at: new Date().toISOString(),
      })
    } else {
      await repos.curriculum.insertSubstrandHealth({
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

  return updated
}
