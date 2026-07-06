// lib/eir/engine.ts
// EIR Research Orchestration Engine
//
// The heartbeat of Education Intelligence Research.
//
// Two modes of operation:
//
//   1. Per-learner cycle  — triggered after every significant EILS event
//      (assessment completed, Compass session, intervention resolved).
//      Runs the pillars that are learner-specific: misconceptions, trajectories,
//      personalization, career, risk detection, explainability.
//
//   2. Platform-wide cycle — runs on a cron schedule (weekly).
//      Runs the pillars that analyse patterns across all learners:
//      intervention effectiveness, KG evolution, validation sweep,
//      knowledge base synthesis.
//
// The engine does not replace any EILS service.
// It studies every interaction EILS records and produces research evidence.

import { createServiceClient } from '@/utils/supabase/service'
import { discoverMisconceptions, markMisconceptionResolved } from './misconceptions'
import { computeTrajectoryModel, recordBreakthrough } from './trajectories'
import { recordInterventionOutcome, buildInterventionEffectivenessReport } from './interventionEffectiveness'
import { buildPersonalizationModel } from './personalization'
import { takeCareerSnapshot } from './careerDevelopment'
import { discoverKGImprovements } from './kgEvolution'
import { predictRisks, evaluatePastPredictions } from './riskDetection'
import { explainRecommendation } from './explainability'
import { buildValidationSummary, expireStalePendingOutcomes, recordRecommendationOutcome } from './validation'
import { autoProposeHypothesis, buildKnowledgeBaseReport } from './knowledgeBase'
import type {
  EIRResearchCycle,
  ResearchPillar,
  EIRInterventionType,
} from './types'
import type { EILSRecommendation } from '@/_frozen/eils/types'

// ── Per-Learner Research Cycle ────────────────────────────────────────────────
// Call this after every major EILS event for a student.
// grade is optional — if omitted, it is looked up from the learners table.

export async function runLearnerResearchCycle(params: {
  studentId: string
  grade?:    number
  trigger:   'assessment' | 'compass' | 'intervention_resolved' | 'periodic'
}): Promise<EIRResearchCycle> {
  const { studentId, trigger } = params
  const grade = params.grade ?? await resolveGrade(studentId)
  const now     = new Date().toISOString()
  const updated: ResearchPillar[] = []

  // Always run: misconceptions, trajectories, risk detection
  const [misconceptions, trajectoryModel, riskResult] = await Promise.all([
    safeRun(() => discoverMisconceptions(studentId, grade)),
    safeRun(() => computeTrajectoryModel(studentId)),
    safeRun(() => predictRisks(studentId)),
  ])

  if (misconceptions !== null) updated.push('misconception')
  if (trajectoryModel !== null) updated.push('trajectory')
  if (riskResult !== null)      updated.push('risk')

  // Career snapshot: run on assessment events (more meaningful data)
  let careerSnapshotTaken = false
  if (trigger === 'assessment' || trigger === 'periodic') {
    const snapshot = await safeRun(() => takeCareerSnapshot(studentId))
    if (snapshot !== null) {
      careerSnapshotTaken = true
      updated.push('career')
    }
  }

  // Personalization: update after sufficient events, not every session
  let personalizationUpdated = false
  if (trigger === 'periodic' || trigger === 'assessment') {
    const model = await safeRun(() => buildPersonalizationModel(studentId))
    if (model !== null) {
      personalizationUpdated = true
      updated.push('personalization')
    }
  }

  // Auto-propose hypotheses from findings
  const riskAlerts = riskResult?.predictions.map(p => p.risk_type) ?? []
  if (riskAlerts.length > 0) {
    void safeRun(() => autoProposeHypothesis({
      pillar:       'risk',
      title:        `Early ${riskAlerts[0]} risk detected`,
      description:  `Learner ${studentId} shows early signals of ${riskAlerts[0]} ${HORIZON_DAYS} days ahead of manifestation.`,
      evidence:     {
        student_id:    studentId,
        risk_types:    riskAlerts,
        trigger,
        detected_at:   now,
      },
    }))
  }

  // Check trajectory class for breakthrough — auto-propose hypothesis
  const trajectoryClass = trajectoryModel?.overall_class ?? null
  if (trajectoryClass === 'accelerating') {
    void safeRun(() => autoProposeHypothesis({
      pillar:       'trajectory',
      title:        'Accelerating trajectory pattern',
      description:  'Learner is accelerating across multiple subjects — may indicate recent intervention was highly effective.',
      evidence:     { student_id: studentId, trigger, detected_at: now },
    }))

    // Record breakthroughs for accelerating substrands
    for (const t of trajectoryModel?.trajectories ?? []) {
      if (t.trajectory_class === 'accelerating' && t.breakthrough_at) {
        void safeRun(() => recordBreakthrough(studentId, t.subject, t.substrand))
      }
    }
  }

  return {
    student_id:              studentId,
    ran_at:                  now,
    pillars_updated:         updated,
    misconceptions_found:    (misconceptions ?? []).length,
    trajectory_class:        trajectoryClass,
    risk_alerts:             riskAlerts,
    kg_discoveries:          0,   // KG discovery is platform-wide only
    recommendations_tracked: 0,
    personalization_updated: personalizationUpdated,
    career_snapshot_taken:   careerSnapshotTaken,
  }
}

// ── Platform-Wide Research Cycle ──────────────────────────────────────────────
// Run on a cron schedule — not per-learner.

export async function runPlatformResearchCycle(): Promise<{
  kg_discoveries:          number
  validation_summary:      Awaited<ReturnType<typeof buildValidationSummary>>
  effectiveness_report:    Awaited<ReturnType<typeof buildInterventionEffectivenessReport>>
  knowledge_base_report:   Awaited<ReturnType<typeof buildKnowledgeBaseReport>>
  ran_at:                  string
}> {
  const now = new Date().toISOString()

  const [kgDiscoveries, , validationSummary, effectivenessReport, knowledgeBaseReport] = await Promise.all([
    safeRun(() => discoverKGImprovements()),
    safeRun(() => expireStalePendingOutcomes()),
    safeRun(() => buildValidationSummary()),
    safeRun(() => buildInterventionEffectivenessReport()),
    safeRun(() => buildKnowledgeBaseReport()),
    safeRun(() => evaluatePastPredictions()),
  ])

  const discoveries = kgDiscoveries ?? []
  if (discoveries.length > 0) {
    for (const disc of discoveries) {
      void safeRun(() => autoProposeHypothesis({
        pillar:       'kg_evolution',
        title:        `KG ${disc.discovery_type.replace(/_/g, ' ')}: ${disc.substrand}`,
        description:  disc.description,
        evidence:     {
          discovery_id:   disc.id,
          discovery_type: disc.discovery_type,
          subject:        disc.subject,
          substrand:      disc.substrand,
          evidence_count: disc.evidence_count,
        },
      }))
    }
  }

  return {
    kg_discoveries:        discoveries.length,
    validation_summary:    validationSummary ?? emptyValidationSummary(),
    effectiveness_report:  effectivenessReport ?? emptyEffectivenessReport(),
    knowledge_base_report: knowledgeBaseReport ?? emptyKnowledgeBaseReport(),
    ran_at:                now,
  }
}

// ── After Intervention Resolved ───────────────────────────────────────────────
// Called when an EILS intervention transitions to resolved.
// Records the outcome in the EIR effectiveness database.

export async function afterInterventionResolved(params: {
  studentId:         string
  grade:             number
  subject:           string
  substrand?:        string
  interventionType:  EIRInterventionType
  preMasteryLevel?:  number
  postMasteryLevel?: number
  startedAt:         string
  outcome:           'effective' | 'partial' | 'ineffective' | 'unknown'
  teacherId?:        string
}): Promise<void> {
  await safeRun(() => recordInterventionOutcome({
    studentId:         params.studentId,
    teacherId:         params.teacherId,
    grade:             params.grade,
    subject:           params.subject,
    substrand:         params.substrand,
    interventionType:  params.interventionType,
    preMasteryLevel:   params.preMasteryLevel,
    postMasteryLevel:  params.postMasteryLevel,
    startedAt:         params.startedAt,
    outcome:           params.outcome,
  }))

  // If effective, mark any related misconceptions as resolved
  if (params.outcome === 'effective' && params.substrand) {
    void safeRun(() => markMisconceptionResolved(
      params.studentId,
      params.substrand as string,
      'intervention',
      true,
    ))
  }
}

// ── After Recommendation Created ──────────────────────────────────────────────
// Automatically generate the explainability record when EILS creates a recommendation.

export async function afterRecommendationCreated(
  recommendation: EILSRecommendation,
): Promise<void> {
  await safeRun(() => explainRecommendation(recommendation))
}

// ── After Recommendation Actioned ─────────────────────────────────────────────
// Schedule outcome measurement ~2 weeks later.
// In practice this is triggered by the next periodic learner cycle.

export async function scheduleOutcomeMeasurement(
  recommendationId: string,
  studentId:        string,
): Promise<void> {
  // Record immediately with pending status — outcome will be recorded
  // when the next periodic learner cycle runs (computeTrajectoryModel picks up deltas)
  void safeRun(() => recordRecommendationOutcome({ recommendationId, studentId }))
}

// ── Safe Runner ───────────────────────────────────────────────────────────────
// EIR failures must never crash the main EILS pipeline.

async function safeRun<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch {
    return null
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HORIZON_DAYS = 14

// ── Empty Fallbacks ───────────────────────────────────────────────────────────

function emptyValidationSummary() {
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

function emptyEffectivenessReport() {
  return {
    by_type:              [],
    best_for_risk_level:  {},
    best_for_subject:     {},
    fastest_resolution:   { type: 'practice_questions' as EIRInterventionType, avg_days: 0 },
    highest_mastery_gain: { type: 'remedial_plan'      as EIRInterventionType, avg_delta: 0 },
    generated_at:         new Date().toISOString(),
  }
}

async function resolveGrade(studentId: string): Promise<number> {
  try {
    const db = createServiceClient()
    const { data } = await db
      .from('learners')
      .select('grade')
      .eq('id', studentId)
      .single()
    return (data?.grade as number | null) ?? 7
  } catch {
    return 7
  }
}

function emptyKnowledgeBaseReport() {
  const pillars = [
    'misconception', 'trajectory', 'intervention', 'personalization',
    'career', 'kg_evolution', 'risk', 'explainability', 'validation', 'general',
  ] as const
  const byPillar = Object.fromEntries(pillars.map(p => [p, { hypotheses: 0, findings: 0 }]))
  return {
    total_hypotheses: 0,
    total_findings:   0,
    by_pillar:        byPillar as Record<ResearchPillar, { hypotheses: number; findings: number }>,
    recent_findings:  [],
    top_findings:     [],
    open_hypotheses:  [],
    generated_at:     new Date().toISOString(),
  }
}
