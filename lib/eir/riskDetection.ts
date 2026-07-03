// lib/eir/riskDetection.ts
// Pillar 7 — Early Risk Detection
//
// Predicts educational risks before they fully manifest, giving teachers
// and parents a 2–4 week window to intervene before a student deteriorates.
//
// Risk types predicted:
//   - Disengagement (decreasing interaction frequency)
//   - Burnout (high frequency followed by sudden drop)
//   - Learning regression (mastery gains reversing)
//   - Exam failure (low velocity + low mastery + assessment approaching)
//   - Dropout risk (extended absence + critical risk level)
//   - Confidence collapse (persistent wrong answers + abandonment spike)

import { createServiceClient } from '@/utils/supabase/service'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import type {
  EIRRiskType,
  EIRRiskPrediction,
  RiskPredictionResult,
} from './types'

const HORIZON_DAYS = 14   // predict 2 weeks into the future
const MODEL_VERSION = 'v1'

// ── Predict Risks for a Learner ───────────────────────────────────────────────

export async function predictRisks(
  studentId: string,
): Promise<RiskPredictionResult> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const now     = new Date().toISOString()

  // Fetch recent Compass session history for engagement signals
  const { data: sessionRows } = await db
    .from('compass_sessions')
    .select('completed_at, abandoned, duration_mins, consecutive_wrong')
    .eq('student_id', studentId)
    .order('completed_at', { ascending: false })
    .limit(20)

  const sessions = (sessionRows ?? []) as SessionRow[]
  const predictions: Omit<EIRRiskPrediction, 'id' | 'created_at' | 'updated_at'>[] = []

  // ── 1. Disengagement Risk ──────────────────────────────────────────────────
  const disengagementRisk = predictDisengagement(profile, sessions)
  if (disengagementRisk.level !== 'low') {
    predictions.push(makePrediction(studentId, now, 'disengagement', disengagementRisk))
  }

  // ── 2. Burnout Risk ────────────────────────────────────────────────────────
  const burnoutRisk = predictBurnout(sessions)
  if (burnoutRisk.level !== 'low') {
    predictions.push(makePrediction(studentId, now, 'burnout', burnoutRisk))
  }

  // ── 3. Learning Regression ─────────────────────────────────────────────────
  const regressionRisk = predictLearningRegression(profile)
  if (regressionRisk.level !== 'low') {
    predictions.push(makePrediction(studentId, now, 'learning_regression', regressionRisk))
  }

  // ── 4. Exam Failure ────────────────────────────────────────────────────────
  const examFailureRisk = predictExamFailure(profile)
  if (examFailureRisk.level !== 'low') {
    predictions.push(makePrediction(studentId, now, 'exam_failure', examFailureRisk))
  }

  // ── 5. Confidence Collapse ─────────────────────────────────────────────────
  const confidenceRisk = predictConfidenceCollapse(profile, sessions)
  if (confidenceRisk.level !== 'low') {
    predictions.push(makePrediction(studentId, now, 'confidence_collapse', confidenceRisk))
  }

  // ── 6. Dropout Risk (only for critical + prolonged) ───────────────────────
  const dropoutRisk = predictDropoutRisk(profile, sessions)
  if (dropoutRisk.level !== 'low') {
    predictions.push(makePrediction(studentId, now, 'dropout_risk', dropoutRisk))
  }

  // Persist predictions
  const persisted: EIRRiskPrediction[] = []
  for (const pred of predictions) {
    const { data: inserted } = await db
      .from('eir_risk_predictions')
      .insert({ ...pred, created_at: now, updated_at: now })
      .select()
      .single()
    if (inserted) persisted.push(inserted as EIRRiskPrediction)
  }

  // Find the most severe prediction
  const severity: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
  const sorted = persisted.sort((a, b) =>
    (severity[b.predicted_risk_level] ?? 0) - (severity[a.predicted_risk_level] ?? 0)
  )

  const topPrediction = sorted[0]
  const alert = topPrediction ? severity[topPrediction.predicted_risk_level] >= 2 : false

  return {
    student_id:    studentId,
    predictions:   persisted,
    top_risk:      topPrediction?.risk_type ?? null,
    top_risk_level: topPrediction?.predicted_risk_level ?? null,
    alert,
    alert_reason:  alert && topPrediction
      ? `Early warning: ${topPrediction.risk_type.replace(/_/g, ' ')} risk detected — intervention recommended within ${HORIZON_DAYS} days.`
      : null,
    generated_at:  now,
  }
}

// ── Evaluate Past Predictions ─────────────────────────────────────────────────
// Run after horizon passes to measure prediction accuracy.

export async function evaluatePastPredictions(): Promise<void> {
  const db  = createServiceClient()
  const now = new Date()

  const { data: duePredictions } = await db
    .from('eir_risk_predictions')
    .select('id, student_id, risk_type, predicted_risk_level, evaluate_at')
    .lt('evaluate_at', now.toISOString())
    .is('evaluated_at', null)
    .limit(50)

  if (!duePredictions?.length) return

  for (const pred of duePredictions) {
    const profile = await getOrCreateLearnerProfile(pred.student_id as string)
    const actual  = profile.overall_risk_level

    // Map learner model risk level to EIR risk level
    const actualMapped: string =
      actual === 'critical' ? 'critical' :
      actual === 'at_risk'  ? 'high' :
      actual === 'watch'    ? 'medium' :
      'low'

    const wasAccurate = pred.predicted_risk_level === actualMapped

    await db
      .from('eir_risk_predictions')
      .update({
        actual_risk_level: actualMapped,
        evaluated_at:      now.toISOString(),
        was_accurate:      wasAccurate,
        updated_at:        now.toISOString(),
      })
      .eq('id', pred.id)
  }
}

// ── Get Risk Predictions for Student ─────────────────────────────────────────

export async function getRiskPredictions(
  studentId: string,
): Promise<EIRRiskPrediction[]> {
  const db = createServiceClient()

  const { data } = await db
    .from('eir_risk_predictions')
    .select(
      'id, student_id, predicted_at, prediction_horizon_days, risk_type, ' +
      'predicted_risk_level, actual_risk_level, prediction_features, confidence, ' +
      'evaluate_at, evaluated_at, was_accurate, model_version, created_at, updated_at'
    )
    .eq('student_id', studentId)
    .order('predicted_at', { ascending: false })
    .limit(20)

  return (data as unknown as EIRRiskPrediction[] | null) ?? []
}

// ── Prediction Logic ──────────────────────────────────────────────────────────

type PredictionSignal = {
  level:      'low' | 'medium' | 'high' | 'critical'
  confidence: number
  features:   Record<string, unknown>
}

type SessionRow = {
  completed_at:      string | null
  abandoned:         boolean | null
  duration_mins:     number | null
  consecutive_wrong: number | null
}

type LearnerProfile = Awaited<ReturnType<typeof getOrCreateLearnerProfile>>

function predictDisengagement(profile: LearnerProfile, sessions: SessionRow[]): PredictionSignal {
  const disengageFlag = profile.risk_flags.find(f => f.type === 'disengaged')
  const recentSessions = sessions.slice(0, 5)
  const abandonRate    = recentSessions.filter(s => s.abandoned).length / Math.max(recentSessions.length, 1)

  const features = {
    has_disengage_flag: !!disengageFlag,
    recent_abandon_rate: abandonRate,
    risk_level: profile.overall_risk_level,
    disengage_severity: disengageFlag?.severity ?? 'low',
  }

  if (disengageFlag?.severity === 'high' && abandonRate > 0.2) {
    return { level: 'critical', confidence: 0.85, features }
  }
  if (disengageFlag && abandonRate > 0.4) {
    return { level: 'high', confidence: 0.75, features }
  }
  if (abandonRate > 0.3 || !!disengageFlag) {
    return { level: 'medium', confidence: 0.6, features }
  }
  return { level: 'low', confidence: 0.9, features }
}

function predictBurnout(sessions: SessionRow[]): PredictionSignal {
  if (sessions.length < 5) {
    return { level: 'low', confidence: 0.5, features: { reason: 'insufficient_data' } }
  }

  // Burnout pattern: high activity followed by sudden drop
  const recent = sessions.slice(0, 5)
  const older  = sessions.slice(5, 10)

  const recentCount = recent.filter(s => s.completed_at).length
  const olderCount  = older.filter(s => s.completed_at).length
  const drop        = olderCount > 0 ? (olderCount - recentCount) / olderCount : 0

  const avgDuration = recent
    .filter(s => s.duration_mins)
    .reduce((s, r) => s + (r.duration_mins ?? 0), 0) / Math.max(recent.length, 1)

  const features = { recent_count: recentCount, older_count: olderCount, drop_rate: drop, avg_duration: avgDuration }

  if (drop > 0.7 && olderCount >= 4) return { level: 'high',   confidence: 0.7, features }
  if (drop > 0.5 && olderCount >= 3) return { level: 'medium', confidence: 0.6, features }
  return { level: 'low', confidence: 0.85, features }
}

function predictLearningRegression(profile: LearnerProfile): PredictionSignal {
  const dims     = profile.capability_dimensions as Record<string, { trend?: string }> | null
  const declining = dims ? Object.values(dims).filter(d => d?.trend === 'declining').length : 0
  const total    = dims ? Object.keys(dims).length : 0
  const decliningRate = total > 0 ? declining / total : 0

  const features = {
    declining_dimensions: declining,
    total_dimensions: total,
    declining_rate: decliningRate,
    persistent_gaps: profile.persistent_gaps.length,
  }

  if (decliningRate > 0.6)  return { level: 'critical', confidence: 0.8, features }
  if (decliningRate > 0.4)  return { level: 'high',     confidence: 0.7, features }
  if (decliningRate > 0.25) return { level: 'medium',   confidence: 0.6, features }
  return { level: 'low', confidence: 0.9, features }
}

function predictExamFailure(profile: LearnerProfile): PredictionSignal {
  const weakSubstrands = Object.values(profile.knowledge_state).filter(m => m.level <= 2).length
  const totalSubstrands = Object.keys(profile.knowledge_state).length
  const weakRate = totalSubstrands > 0 ? weakSubstrands / totalSubstrands : 0
  const riskLevel = profile.overall_risk_level

  const features = { weak_rate: weakRate, risk_level: riskLevel, confirmed_gaps: profile.confirmed_gaps.length }

  if (weakRate > 0.6 && riskLevel === 'critical') return { level: 'critical', confidence: 0.85, features }
  if (weakRate > 0.5 || riskLevel === 'at_risk')  return { level: 'high',     confidence: 0.7,  features }
  if (weakRate > 0.3 || riskLevel === 'watch')    return { level: 'medium',   confidence: 0.6,  features }
  return { level: 'low', confidence: 0.9, features }
}

function predictConfidenceCollapse(profile: LearnerProfile, sessions: SessionRow[]): PredictionSignal {
  const avgWrong = sessions.length
    ? sessions.reduce((s, r) => s + (r.consecutive_wrong ?? 0), 0) / sessions.length
    : 0
  const abandonRate = sessions.length
    ? sessions.filter(s => s.abandoned).length / sessions.length
    : 0

  const behaviour    = profile.learning_behaviour
  const persistence  = (behaviour.persistence as { score?: number } | undefined)?.score ?? 0.5
  const helpSeeking  = (behaviour.help_seeking as { score?: number } | undefined)?.score ?? 0.5

  const features = { avg_wrong: avgWrong, abandon_rate: abandonRate, persistence, help_seeking: helpSeeking }

  if (avgWrong > 5 && abandonRate > 0.5) return { level: 'high',   confidence: 0.75, features }
  if (avgWrong > 3 && persistence < 0.3) return { level: 'medium', confidence: 0.65, features }
  return { level: 'low', confidence: 0.85, features }
}

function predictDropoutRisk(profile: LearnerProfile, sessions: SessionRow[]): PredictionSignal {
  const lastSession = sessions[0]
  const daysSinceLast = lastSession?.completed_at
    ? Math.floor((Date.now() - new Date(lastSession.completed_at).getTime()) / 86400000)
    : 999

  const riskLevel = profile.overall_risk_level
  const features  = { days_since_last: daysSinceLast, risk_level: riskLevel }

  if (daysSinceLast > 30 && riskLevel === 'critical') return { level: 'critical', confidence: 0.8,  features }
  if (daysSinceLast > 21 && riskLevel === 'at_risk')  return { level: 'high',     confidence: 0.7,  features }
  if (daysSinceLast > 14)                              return { level: 'medium',   confidence: 0.55, features }
  return { level: 'low', confidence: 0.9, features }
}

// ── Factory ───────────────────────────────────────────────────────────────────

function makePrediction(
  studentId:  string,
  now:        string,
  riskType:   EIRRiskType,
  signal:     PredictionSignal,
): Omit<EIRRiskPrediction, 'id' | 'created_at' | 'updated_at'> {
  const evaluateAt = new Date(Date.now() + HORIZON_DAYS * 86400000).toISOString()
  return {
    student_id:              studentId,
    predicted_at:            now,
    prediction_horizon_days: HORIZON_DAYS,
    risk_type:               riskType,
    predicted_risk_level:    signal.level,
    actual_risk_level:       null,
    prediction_features:     signal.features,
    confidence:              signal.confidence,
    evaluate_at:             evaluateAt,
    evaluated_at:            null,
    was_accurate:            null,
    model_version:           MODEL_VERSION,
  }
}
