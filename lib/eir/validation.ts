// lib/eir/validation.ts
// Pillar 9 — Continuous Validation
//
// Closes the recommendation loop by measuring whether EILS recommendations
// actually improved learning outcomes.
//
// Tracks:
//   - Recommendation accepted vs dismissed vs expired
//   - Post-recommendation mastery change
//   - Teacher / learner / parent feedback
//   - Per-action-type effectiveness rates
//
// Feeds findings back into the EIR knowledge base as validated evidence.

import { createServiceClient } from '@/utils/supabase/service'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import type { EIRRecommendationOutcome, ValidationSummary } from './types'

// ── Mark Recommendation Accepted ─────────────────────────────────────────────

export async function markRecommendationAccepted(
  recommendationId: string,
  studentId:        string,
): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  // Capture mastery snapshot at acceptance time (pre-mastery)
  const profile = await getOrCreateLearnerProfile(studentId)
  const avgLevel = computeAvgMastery(profile)

  await db
    .from('eir_recommendation_outcomes')
    .update({
      status:            'accepted',
      actioned_at:       now,
      pre_mastery_level: avgLevel,
      updated_at:        now,
    })
    .eq('recommendation_id', recommendationId)
}

// ── Mark Recommendation Dismissed ────────────────────────────────────────────

export async function markRecommendationDismissed(
  recommendationId: string,
  reason?:          string,
): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  await db
    .from('eir_recommendation_outcomes')
    .update({
      status:           'dismissed',
      teacher_feedback: reason ?? null,
      updated_at:       now,
    })
    .eq('recommendation_id', recommendationId)
}

// ── Record Outcome After Actioned Recommendation ──────────────────────────────
// Called ~2 weeks after a recommendation was accepted to measure impact.

export async function recordRecommendationOutcome(params: {
  recommendationId: string
  studentId:        string
}): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  // Fetch current outcome record
  const { data: existing } = await db
    .from('eir_recommendation_outcomes')
    .select('id, status, pre_mastery_level, recommendation_type')
    .eq('recommendation_id', params.recommendationId)
    .single()

  if (!existing || existing.status !== 'accepted') return

  // Measure post-mastery
  const profile    = await getOrCreateLearnerProfile(params.studentId)
  const postLevel  = computeAvgMastery(profile)
  const preLevel   = existing.pre_mastery_level as number | null

  const outcome: 'improved' | 'same' | 'declined' | 'unknown' =
    preLevel === null ? 'unknown' :
    postLevel > preLevel + 0.2 ? 'improved' :
    postLevel < preLevel - 0.2 ? 'declined' :
    'same'

  await db
    .from('eir_recommendation_outcomes')
    .update({
      post_mastery_level:  postLevel,
      outcome,
      outcome_recorded_at: now,
      updated_at:          now,
    })
    .eq('id', existing.id)
}

// ── Expire Stale Pending Recommendations ─────────────────────────────────────
// Run periodically — expire outcomes older than 30 days with no action taken.

export async function expireStalePendingOutcomes(): Promise<void> {
  const db      = createServiceClient()
  const cutoff  = new Date(Date.now() - 30 * 86400000).toISOString()

  await db
    .from('eir_recommendation_outcomes')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
}

// ── Build Validation Summary ───────────────────────────────────────────────────

export async function buildValidationSummary(
  studentId?: string,
): Promise<ValidationSummary> {
  const db = createServiceClient()

  let query = db
    .from('eir_recommendation_outcomes')
    .select(
      'status, outcome, recommendation_type, improvement_delta, teacher_feedback'
    )
    .not('status', 'eq', 'pending')

  if (studentId) {
    query = query.eq('student_id', studentId)
  }

  const { data } = await query.limit(1000)
  if (!data?.length) return emptySummary()

  const records = data as Pick<EIRRecommendationOutcome,
    'status' | 'outcome' | 'recommendation_type' | 'improvement_delta' | 'teacher_feedback'>[]

  const total      = records.length
  const accepted   = records.filter(r => r.status === 'accepted').length
  const dismissed  = records.filter(r => r.status === 'dismissed').length
  const expired    = records.filter(r => r.status === 'expired').length

  const effectiveRecords = records.filter(r => r.status === 'accepted' && r.outcome === 'improved')
  const effectivenessRate = accepted > 0 ? effectiveRecords.length / accepted : 0

  const deltas    = records.filter(r => r.improvement_delta !== null && r.status === 'accepted')
    .map(r => r.improvement_delta as number)
  const avgDelta  = deltas.length ? deltas.reduce((s, n) => s + n, 0) / deltas.length : 0

  // Per action type breakdown
  const byType: Record<string, { count: number; effectiveness: number }> = {}
  const typeGroups = new Map<string, { count: number; effective: number }>()

  for (const r of records) {
    const type = r.recommendation_type
    const entry = typeGroups.get(type) ?? { count: 0, effective: 0 }
    entry.count += 1
    if (r.status === 'accepted' && r.outcome === 'improved') entry.effective += 1
    typeGroups.set(type, entry)
  }

  for (const [type, stats] of typeGroups) {
    byType[type] = {
      count:         stats.count,
      effectiveness: stats.count > 0 ? stats.effective / stats.count : 0,
    }
  }

  // Teacher satisfaction: positive feedback / total with feedback
  const withFeedback = records.filter(r => r.teacher_feedback !== null)
  const teacherSatisfaction = withFeedback.length > 0
    ? withFeedback.filter(r => r.outcome === 'improved' || r.outcome === 'same').length / withFeedback.length
    : null

  return {
    total_recommendations:  total,
    accepted_count:         accepted,
    dismissed_count:        dismissed,
    expired_count:          expired,
    acceptance_rate:        total > 0 ? accepted / total : 0,
    effectiveness_rate:     effectivenessRate,
    by_action_type:         byType,
    avg_improvement_delta:  avgDelta,
    teacher_satisfaction:   teacherSatisfaction,
    generated_at:           new Date().toISOString(),
  }
}

// ── Get Pending Outcomes to Evaluate ─────────────────────────────────────────

export async function getPendingOutcomes(studentId: string): Promise<EIRRecommendationOutcome[]> {
  const db = createServiceClient()

  const { data } = await db
    .from('eir_recommendation_outcomes')
    .select(
      'id, recommendation_id, student_id, recommendation_type, subject, substrand, ' +
      'explanation, evidence_summary, alternative_actions, educational_theory, confidence, ' +
      'status, actioned_at, outcome, outcome_recorded_at, pre_mastery_level, post_mastery_level, ' +
      'improvement_delta, teacher_feedback, learner_feedback, parent_feedback, ' +
      'feedback_recorded_at, created_at, updated_at'
    )
    .eq('student_id', studentId)
    .eq('status', 'accepted')
    .is('outcome', null)
    .order('actioned_at', { ascending: false })
    .limit(10)

  return (data as unknown as EIRRecommendationOutcome[] | null) ?? []
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeAvgMastery(
  profile: Awaited<ReturnType<typeof getOrCreateLearnerProfile>>,
): number {
  const levels = Object.values(profile.knowledge_state).map(m => m.level)
  if (!levels.length) return 1
  return levels.reduce((s, n) => s + n, 0) / levels.length
}

function emptySummary(): ValidationSummary {
  return {
    total_recommendations:  0,
    accepted_count:         0,
    dismissed_count:        0,
    expired_count:          0,
    acceptance_rate:        0,
    effectiveness_rate:     0,
    by_action_type:         {},
    avg_improvement_delta:  0,
    teacher_satisfaction:   null,
    generated_at:           new Date().toISOString(),
  }
}
