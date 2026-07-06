// lib/eils/profile.ts
// Layer 1 — Learner Intelligence Profile
//
// Produces a unified IntelligenceSnapshot by combining:
//   - Permanent Learner Model (lib/learnerModel)
//   - Knowledge Graph root causes (lib/knowledgeGraph)
//   - Career readiness score (lib/career)
//   - EILS-specific data (recommendations, interventions, milestones)
//
// This is the single entry point any EduNexus service calls to understand a learner.

import { createServiceClient } from '@/utils/supabase/service'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import { analyseStudentRootCauses } from '@/lib/knowledgeGraph'
import type { IntelligenceSnapshot, IntelligenceSummary, EILSRecommendation, EILSIntervention, EILSMilestone } from './types'
import type { RootCauseResult } from '@/lib/knowledgeGraph/types'
import type { LearnerProfile, RiskLevel } from '@/lib/learnerModel/types'

// ── Main: build full intelligence snapshot ────────────────────────────────────

export async function buildIntelligenceSnapshot(
  studentId: string,
  grade:     number,
): Promise<IntelligenceSnapshot> {
  const db = createServiceClient()

  // Fan out — all reads in parallel
  const [profile, rootCauses, eilsData] = await Promise.all([
    getOrCreateLearnerProfile(studentId),
    analyseStudentRootCausesGracefully(studentId, grade),
    loadEILSData(studentId, db),
  ])

  const missingPrereqs = extractMissingPrereqs(profile, rootCauses)
  const careerReadinessScore = computeCareerReadinessScore(profile)
  const topCareer = profile.career_signals?.top_career_slugs?.[0] ?? null
  const pathwayLeader = getPathwayLeader(profile)

  return {
    student_id:    studentId,
    generated_at:  new Date().toISOString(),
    profile,
    root_causes:   rootCauses,
    missing_prereqs: missingPrereqs,
    career_readiness_score: careerReadinessScore,
    top_career:    topCareer,
    pathway_leader: pathwayLeader,
    pending_recommendations: eilsData.recommendations,
    active_interventions:    eilsData.interventions,
    recent_milestones:       eilsData.milestones,
    summary: buildSummary(profile, eilsData.recommendations, eilsData.milestones),
  }
}

// ── Lightweight snapshot — no KG traversal, no DB reads beyond learner model ──
// Use this in hot paths (e.g. Compass session start) where latency matters.

export async function buildLightweightSnapshot(
  studentId: string,
): Promise<Pick<IntelligenceSnapshot, 'student_id' | 'profile' | 'summary' | 'generated_at'>> {
  const profile = await getOrCreateLearnerProfile(studentId)
  return {
    student_id:   studentId,
    generated_at: new Date().toISOString(),
    profile,
    summary: buildSummary(profile, [], []),
  }
}

// ── Summary builder ───────────────────────────────────────────────────────────

function buildSummary(
  profile:         LearnerProfile,
  recommendations: EILSRecommendation[],
  milestones:      EILSMilestone[],
): IntelligenceSummary {
  const topRec = recommendations.find(r => r.status === 'pending')

  const knowledgeState = profile.knowledge_state
  const entries        = Object.entries(knowledgeState)
  const struggling     = entries.filter(([, m]) => m.level <= 2).map(([k]) => k.split(':')[0]).filter(Boolean)
  const strong         = entries.filter(([, m]) => m.level >= 3).map(([k]) => k.split(':')[0]).filter(Boolean)

  // Weeks at current risk — from risk_history
  const currentFlags = profile.risk_flags
  let weeksAtRisk    = 0
  if (currentFlags.length > 0) {
    const history  = profile.risk_history
    const matching = history.find(h => !h.resolved_at && h.flag_type === currentFlags[0]?.type)
    weeksAtRisk    = matching?.consecutive_weeks ?? 0
  }

  // Last positive signal
  const engagementSignals = [
    ...(profile.formative_signals ?? []).filter(s => s.outcome === 'got_it').map(s => s.recorded_at),
    ...(profile.parent_observations ?? []).filter(o => o.outcome === 'demonstrated').map(o => o.recorded_at),
  ].sort().reverse()
  const lastPositiveSignal = engagementSignals[0] ?? null

  const celebrationPending = milestones.some(m => !m.celebrated)

  return {
    overall_risk:          profile.overall_risk_level,
    top_action:            topRec?.reasoning ?? 'No active recommendations — profile is current',
    top_action_type:       topRec?.action_type ?? 'review_topic',
    struggling_subjects:   [...new Set(struggling)].slice(0, 5),
    strong_subjects:       [...new Set(strong)].slice(0, 3),
    weeks_at_current_risk: weeksAtRisk,
    last_positive_signal:  lastPositiveSignal,
    celebration_pending:   celebrationPending,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function analyseStudentRootCausesGracefully(
  studentId: string,
  grade:     number,
): Promise<RootCauseResult[]> {
  try {
    return await analyseStudentRootCauses(studentId, grade)
  } catch (e: unknown) {
    console.error('[profile:analyseStudentRootCausesGracefully]', e instanceof Error ? e.message : String(e))
    return []
  }
}

async function loadEILSData(studentId: string, db: ReturnType<typeof createServiceClient>) {
  const [recsRes, interventionsRes, milestonesRes] = await Promise.all([
    db.from('eils_recommendations')
      .select('id, student_id, action_type, priority, confidence, reasoning, evidence, expected_impact, subject, substrand, source_system, status, actioned_at, outcome, outcome_note, expires_at, created_at, updated_at')
      .eq('student_id', studentId)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .limit(10),

    db.from('eils_interventions')
      .select('id, student_id, risk_flag_type, subject, substrand, intervention_type, intervention_ref, teacher_id, started_at, resolved_at, outcome, outcome_evidence, consecutive_weeks_before, was_effective, created_at, updated_at')
      .eq('student_id', studentId)
      .is('resolved_at', null)
      .order('started_at', { ascending: false })
      .limit(5),

    db.from('eils_milestones')
      .select('id, student_id, milestone_type, title, description, evidence, celebrated, notified_teacher, notified_parent, achieved_at, created_at')
      .eq('student_id', studentId)
      .eq('celebrated', false)
      .order('achieved_at', { ascending: false })
      .limit(5),
  ])

  return {
    recommendations: (recsRes.data ?? []) as EILSRecommendation[],
    interventions:   (interventionsRes.data ?? []) as EILSIntervention[],
    milestones:      (milestonesRes.data ?? []) as EILSMilestone[],
  }
}

function extractMissingPrereqs(
  profile:    LearnerProfile,
  rootCauses: RootCauseResult[],
): string[] {
  const fromKG = rootCauses
    .flatMap(r => r.root_causes)
    .filter(c => c.cause_type === 'root')
    .map(c => c.name)

  const fromFlags = profile.risk_flags
    .filter(f => f.type === 'missing_prerequisite')
    .map(f => f.substrand ?? '')
    .filter(Boolean)

  return [...new Set([...fromKG, ...fromFlags])].slice(0, 10)
}

function computeCareerReadinessScore(profile: LearnerProfile): number {
  const dims  = profile.capability_dimensions as Record<string, { raw_score?: number }> ?? {}
  const scores = Object.values(dims).map(d => d?.raw_score ?? 0).filter(s => s > 0)
  if (!scores.length) return 0

  const avgCapability    = scores.reduce((a, b) => a + b, 0) / scores.length
  const pathwayLeaderPct = getPathwayLeaderScore(profile) / 100
  const careerCount      = profile.career_signals?.top_career_slugs?.length ?? 0

  // Weighted composite: 50% capability, 40% pathway readiness, 10% career signal strength
  const raw = (avgCapability * 0.5) + (pathwayLeaderPct * 0.4) + (Math.min(careerCount / 5, 1) * 0.1)
  return Math.round(raw * 100)
}

function getPathwayLeaderScore(profile: LearnerProfile): number {
  const r = profile.pathway_readiness
  return Math.max(r.stem.score, r.social_sciences.score, r.arts_sports.score, r.technical_tvet.score)
}

function getPathwayLeader(
  profile: LearnerProfile,
): IntelligenceSnapshot['pathway_leader'] {
  const r      = profile.pathway_readiness
  const scores: [IntelligenceSnapshot['pathway_leader'], number][] = [
    ['stem',            r.stem.score],
    ['social_sciences', r.social_sciences.score],
    ['arts_sports',     r.arts_sports.score],
    ['technical_tvet',  r.technical_tvet.score],
  ]
  const best = scores.sort((a, b) => b[1] - a[1])[0]
  return best[1] > 0 ? best[0] : null
}

// ── RiskLevel comparator ──────────────────────────────────────────────────────

export function riskOrder(level: RiskLevel): number {
  return { normal: 0, watch: 1, at_risk: 2, critical: 3 }[level]
}
