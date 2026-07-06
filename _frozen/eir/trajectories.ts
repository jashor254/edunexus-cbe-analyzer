// lib/eir/trajectories.ts
// Pillar 2 — Learning Trajectories
//
// Studies how learning evolves over time for each learner × substrand.
// Measures mastery velocity, plateau periods, breakthrough moments,
// forgetting curves, and produces a Trajectory Model for each learner.
//
// Data sources:
//   - knowledge_state in learner profile (mastery levels + timestamps)
//   - assessment count per substrand
//   - Compass session data

import { createServiceClient } from '@/utils/supabase/service'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import type {
  EIRLearningTrajectory,
  TrajectoryClass,
  TrajectoryModel,
} from './types'

// ── Compute and Persist Trajectory Model ─────────────────────────────────────

export async function computeTrajectoryModel(
  studentId: string,
): Promise<TrajectoryModel> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const now     = new Date().toISOString()

  const trajectories: EIRLearningTrajectory[] = []

  for (const [key, mastery] of Object.entries(profile.knowledge_state)) {
    const [subject, substrand] = key.split(':')
    if (!subject || !substrand) continue

    const level         = mastery.level
    const count         = mastery.assessment_count
    const lastAssessed  = (mastery as { last_assessed_at?: string }).last_assessed_at ?? null

    const daysSinceLast = lastAssessed
      ? Math.floor((Date.now() - new Date(lastAssessed).getTime()) / 86400000)
      : null

    // Velocity: level / count gives a rough rate; we'd ideally use time series
    // but with count-only data, we use mastery level per assessment as proxy.
    const velocity = count >= 2 ? (level - 1) / count : null

    // Retention: decreases with time since last assessment
    const retention = daysSinceLast !== null
      ? Math.max(0, 1 - (daysSinceLast / 90))   // full decay assumed at 90 days
      : null

    const trajectoryClass = classifyTrajectory(level, velocity, daysSinceLast, count)

    const row: EIRLearningTrajectory = {
      id:                               '',   // assigned by DB
      student_id:                       studentId,
      subject,
      substrand,
      mastery_velocity:                 velocity,
      plateau_detected_at:              trajectoryClass === 'plateau' ? now : null,
      plateau_weeks:                    trajectoryClass === 'plateau' && count > 3 ? Math.floor(count / 2) : null,
      breakthrough_at:                  level >= 3.5 && count <= 4 ? now : null,
      forgetting_curve_rate:            daysSinceLast !== null ? (1 - (retention ?? 1)) : null,
      days_since_last_assessment:       daysSinceLast,
      days_to_recover_after_intervention: null,   // set after intervention resolves
      retention_score:                  retention,
      current_mastery_level:            level,
      peak_mastery_level:               level,   // simplified — full impl uses history
      assessment_count:                 count,
      compass_session_count:            0,         // enriched below
      trajectory_class:                 trajectoryClass,
      snapshot_at:                      now,
      created_at:                       now,
      updated_at:                       now,
    }

    // Upsert trajectory
    const { data: upserted } = await db
      .from('eir_learning_trajectories')
      .upsert({
        student_id:                       studentId,
        subject,
        substrand,
        mastery_velocity:                 row.mastery_velocity,
        plateau_detected_at:              row.plateau_detected_at,
        plateau_weeks:                    row.plateau_weeks,
        breakthrough_at:                  row.breakthrough_at,
        forgetting_curve_rate:            row.forgetting_curve_rate,
        days_since_last_assessment:       row.days_since_last_assessment,
        retention_score:                  row.retention_score,
        current_mastery_level:            row.current_mastery_level,
        peak_mastery_level:               row.peak_mastery_level,
        assessment_count:                 row.assessment_count,
        trajectory_class:                 row.trajectory_class,
        snapshot_at:                      row.snapshot_at,
        updated_at:                       now,
      }, { onConflict: 'student_id,subject,substrand' })
      .select()
      .single()

    if (upserted) {
      trajectories.push(upserted as EIRLearningTrajectory)
    } else {
      trajectories.push(row)
    }
  }

  return buildModel(studentId, trajectories, now)
}

// ── Get Persisted Trajectory Model ────────────────────────────────────────────

export async function getTrajectoryModel(
  studentId: string,
): Promise<TrajectoryModel> {
  const db = createServiceClient()

  const { data } = await db
    .from('eir_learning_trajectories')
    .select(
      'id, student_id, subject, substrand, mastery_velocity, plateau_detected_at, ' +
      'plateau_weeks, breakthrough_at, forgetting_curve_rate, days_since_last_assessment, ' +
      'days_to_recover_after_intervention, retention_score, current_mastery_level, ' +
      'peak_mastery_level, assessment_count, compass_session_count, trajectory_class, ' +
      'snapshot_at, created_at, updated_at'
    )
    .eq('student_id', studentId)

  const trajectories = (data as unknown as EIRLearningTrajectory[] | null) ?? []
  return buildModel(studentId, trajectories, new Date().toISOString())
}

// ── Record Breakthrough ───────────────────────────────────────────────────────
// Called when a student reaches mastery level 3+ for the first time.

export async function recordBreakthrough(
  studentId:  string,
  subject:    string,
  substrand:  string,
): Promise<void> {
  const db = createServiceClient()

  await db
    .from('eir_learning_trajectories')
    .update({
      breakthrough_at: new Date().toISOString(),
      trajectory_class: 'accelerating',
      updated_at: new Date().toISOString(),
    })
    .eq('student_id', studentId)
    .eq('subject', subject)
    .eq('substrand', substrand)
}

// ── Record Recovery After Intervention ───────────────────────────────────────

export async function recordRecoveryAfterIntervention(
  studentId:   string,
  subject:     string,
  substrand:   string,
  daysToRecover: number,
): Promise<void> {
  const db = createServiceClient()

  await db
    .from('eir_learning_trajectories')
    .update({
      days_to_recover_after_intervention: daysToRecover,
      trajectory_class:                   'recovering',
      updated_at:                         new Date().toISOString(),
    })
    .eq('student_id', studentId)
    .eq('subject', subject)
    .eq('substrand', substrand)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyTrajectory(
  level:          number,
  velocity:       number | null,
  daysSinceLast:  number | null,
  count:          number,
): TrajectoryClass {
  if (count < 2) return 'insufficient_data'

  if (daysSinceLast !== null && daysSinceLast > 60) return 'declining'
  if (level >= 3.5 && velocity !== null && velocity > 0.3) return 'accelerating'
  if (level >= 3.0 && velocity !== null && velocity > 0.1) return 'improving'
  if (velocity !== null && velocity < 0) return 'declining'
  if (velocity !== null && Math.abs(velocity) < 0.05 && count > 4) return 'plateau'
  if (velocity !== null && velocity > 0.05 && level >= 2.0) return 'recovering'
  if (velocity !== null && velocity > 0) return 'improving'
  return 'stable'
}

function buildModel(
  studentId:    string,
  trajectories: EIRLearningTrajectory[],
  now:          string,
): TrajectoryModel {
  if (!trajectories.length) {
    return {
      student_id:            studentId,
      trajectories:          [],
      overall_class:         'insufficient_data',
      avg_velocity:          0,
      subjects_accelerating: [],
      subjects_plateauing:   [],
      subjects_declining:    [],
      learning_rhythm:       'irregular',
      predicted_mastery_in_4_weeks: {},
      generated_at:          now,
    }
  }

  const classes = trajectories.map(t => t.trajectory_class)

  const counts: Record<TrajectoryClass, number> = {
    accelerating: 0, improving: 0, stable: 0,
    plateau: 0, declining: 0, recovering: 0, insufficient_data: 0,
  }
  for (const c of classes) counts[c] = (counts[c] ?? 0) + 1

  const totalVelocities = trajectories.filter(t => t.mastery_velocity !== null)
  const avgVelocity = totalVelocities.length
    ? totalVelocities.reduce((s, t) => s + (t.mastery_velocity ?? 0), 0) / totalVelocities.length
    : 0

  // Determine overall trajectory class by majority
  const overallClass = (Object.entries(counts) as [TrajectoryClass, number][])
    .sort((a, b) => b[1] - a[1])[0][0]

  const subjects_accelerating = [...new Set(
    trajectories.filter(t => t.trajectory_class === 'accelerating').map(t => t.subject)
  )]
  const subjects_plateauing = [...new Set(
    trajectories.filter(t => t.trajectory_class === 'plateau').map(t => t.subject)
  )]
  const subjects_declining = [...new Set(
    trajectories.filter(t => t.trajectory_class === 'declining').map(t => t.subject)
  )]

  // Learning rhythm — based on recency of assessments
  const daysList = trajectories
    .filter(t => t.days_since_last_assessment !== null)
    .map(t => t.days_since_last_assessment as number)

  const learningRhythm: 'consistent' | 'irregular' | 'burst_and_rest' =
    daysList.length < 3  ? 'irregular' :
    stdDev(daysList) < 7 ? 'consistent' :
    stdDev(daysList) > 20 ? 'burst_and_rest' :
    'irregular'

  // Predict mastery in 4 weeks (simple linear extrapolation from velocity)
  const predicted: Record<string, number> = {}
  for (const t of trajectories) {
    if (t.mastery_velocity !== null && t.current_mastery_level !== null) {
      predicted[t.substrand] = Math.min(4, Math.max(1,
        t.current_mastery_level + t.mastery_velocity * 4
      ))
    }
  }

  return {
    student_id:                   studentId,
    trajectories,
    overall_class:                overallClass,
    avg_velocity:                 avgVelocity,
    subjects_accelerating,
    subjects_plateauing,
    subjects_declining,
    learning_rhythm:              learningRhythm,
    predicted_mastery_in_4_weeks: predicted,
    generated_at:                 now,
  }
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0
  const mean = nums.reduce((s, n) => s + n, 0) / nums.length
  const sq   = nums.reduce((s, n) => s + Math.pow(n - mean, 2), 0)
  return Math.sqrt(sq / nums.length)
}
