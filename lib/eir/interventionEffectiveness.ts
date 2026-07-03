// lib/eir/interventionEffectiveness.ts
// Pillar 3 — Intervention Effectiveness
//
// Records every completed intervention and computes effectiveness rates
// across intervention types, learner profiles, subjects, and grades.
//
// Answers the research question:
//   "Which intervention works best, for which learner, under which conditions?"

import { createServiceClient } from '@/utils/supabase/service'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import type {
  EIRInterventionRecord,
  EIRInterventionType,
  InterventionEffectivenessReport,
  InterventionTypeStats,
} from './types'

// ── Record a Completed Intervention ──────────────────────────────────────────
// Called when an EILS intervention transitions from pending → resolved.

export async function recordInterventionOutcome(params: {
  studentId:            string
  teacherId?:           string
  grade:                number
  subject:              string
  substrand?:           string
  interventionType:     EIRInterventionType
  preMasteryLevel?:     number
  postMasteryLevel?:    number
  startedAt:            string
  completedAt?:         string
  outcome:              EIRInterventionRecord['outcome']
  evidence?:            Record<string, unknown>
}): Promise<void> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(params.studentId)
  const now     = new Date().toISOString()

  const { data: learnerRow } = await db
    .from('learners')
    .select('school_id')
    .eq('id', params.studentId)
    .single()

  const startedDate  = new Date(params.startedAt)
  const completedDate = params.completedAt ? new Date(params.completedAt) : new Date()
  const daysToResolution = Math.ceil((completedDate.getTime() - startedDate.getTime()) / 86400000)

  // Classify learner profile type at intervention time
  const learnerProfileType = classifyLearnerProfileType(
    profile.risk_flags.map(f => f.type),
    profile.overall_risk_level,
  )

  await db.from('eir_intervention_effectiveness').insert({
    student_id:           params.studentId,
    teacher_id:           params.teacherId ?? null,
    school_id:            learnerRow?.school_id ?? null,
    grade:                params.grade,
    subject:              params.subject,
    substrand:            params.substrand ?? null,
    intervention_type:    params.interventionType,
    learner_risk_level:   profile.overall_risk_level,
    learner_profile_type: learnerProfileType,
    pre_mastery_level:    params.preMasteryLevel ?? null,
    post_mastery_level:   params.postMasteryLevel ?? null,
    started_at:           params.startedAt,
    completed_at:         params.completedAt ?? now,
    days_to_resolution:   daysToResolution,
    outcome:              params.outcome,
    evidence:             params.evidence ?? {},
    created_at:           now,
    updated_at:           now,
  })
}

// ── Best Intervention for This Learner ────────────────────────────────────────
// Given a learner's current state, returns the historically most effective
// intervention type for similar learner profiles and subjects.

export async function bestInterventionForLearner(
  studentId: string,
  subject:   string,
  grade:     number,
): Promise<{ type: EIRInterventionType; confidence: number; rationale: string }> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const profileType = classifyLearnerProfileType(
    profile.risk_flags.map(f => f.type),
    profile.overall_risk_level,
  )

  // Query historical effectiveness for this profile type and subject
  const { data } = await db
    .from('eir_intervention_effectiveness')
    .select('intervention_type, outcome, mastery_delta, days_to_resolution')
    .eq('subject', subject)
    .eq('grade', grade)
    .eq('learner_profile_type', profileType)
    .not('outcome', 'eq', 'unknown')

  if (!data?.length) {
    // Fall back to best intervention across all profiles for this subject
    return fallbackBestIntervention(db, subject, grade)
  }

  const statsByType = aggregateByType(data as EIRInterventionRecord[])
  const ranked = statsByType.sort((a, b) => {
    // Score = effectiveness_rate × 0.6 + (1 / avg_days) × 0.4
    const scoreA = a.effectiveness_rate * 0.6 + (a.avg_days_to_resolve > 0 ? (1 / a.avg_days_to_resolve) * 14 * 0.4 : 0)
    const scoreB = b.effectiveness_rate * 0.6 + (b.avg_days_to_resolve > 0 ? (1 / b.avg_days_to_resolve) * 14 * 0.4 : 0)
    return scoreB - scoreA
  })

  const top = ranked[0]
  if (!top) return { type: 'practice_questions', confidence: 0.4, rationale: 'Default intervention — insufficient data' }

  return {
    type:       top.intervention_type,
    confidence: Math.min(0.95, top.effectiveness_rate * (Math.min(top.total_records, 20) / 20)),
    rationale:  `${Math.round(top.effectiveness_rate * 100)}% effective for ${profileType} learners in ${subject} (${top.total_records} data points).`,
  }
}

// ── Generate Effectiveness Report ─────────────────────────────────────────────

export async function buildInterventionEffectivenessReport(
  schoolId?: string,
): Promise<InterventionEffectivenessReport> {
  const db = createServiceClient()

  let query = db
    .from('eir_intervention_effectiveness')
    .select(
      'intervention_type, outcome, mastery_delta, days_to_resolution, ' +
      'learner_risk_level, learner_profile_type, subject, grade, was_effective'
    )
    .not('outcome', 'eq', 'unknown')

  if (schoolId) {
    query = query.eq('school_id', schoolId)
  }

  const { data } = await query
  if (!data?.length) return emptyReport()

  const records = data as unknown as EIRInterventionRecord[]
  const byType  = aggregateByType(records)

  // Best intervention per risk level
  const riskLevels = ['critical', 'at_risk', 'watch', 'normal'] as const
  const bestForRisk: Record<string, EIRInterventionType> = {}
  for (const riskLevel of riskLevels) {
    const subset = records.filter(r => r.learner_risk_level === riskLevel)
    if (subset.length) {
      const agg = aggregateByType(subset)
      const top = agg.sort((a, b) => b.effectiveness_rate - a.effectiveness_rate)[0]
      if (top) bestForRisk[riskLevel] = top.intervention_type
    }
  }

  // Best intervention per subject
  const subjects = [...new Set(records.map(r => r.subject))]
  const bestForSubject: Record<string, EIRInterventionType> = {}
  for (const subject of subjects) {
    const subset = records.filter(r => r.subject === subject)
    const agg    = aggregateByType(subset)
    const top    = agg.sort((a, b) => b.effectiveness_rate - a.effectiveness_rate)[0]
    if (top) bestForSubject[subject] = top.intervention_type
  }

  const sortedBySpeed = [...byType]
    .filter(t => t.avg_days_to_resolve > 0)
    .sort((a, b) => a.avg_days_to_resolve - b.avg_days_to_resolve)

  const sortedByMastery = [...byType]
    .sort((a, b) => b.avg_mastery_delta - a.avg_mastery_delta)

  return {
    by_type:              byType,
    best_for_risk_level:  bestForRisk,
    best_for_subject:     bestForSubject,
    fastest_resolution:   sortedBySpeed[0]
      ? { type: sortedBySpeed[0].intervention_type, avg_days: sortedBySpeed[0].avg_days_to_resolve }
      : { type: 'practice_questions', avg_days: 0 },
    highest_mastery_gain: sortedByMastery[0]
      ? { type: sortedByMastery[0].intervention_type, avg_delta: sortedByMastery[0].avg_mastery_delta }
      : { type: 'remedial_plan', avg_delta: 0 },
    generated_at: new Date().toISOString(),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyLearnerProfileType(
  flagTypes:  string[],
  riskLevel:  string,
): string {
  if (flagTypes.includes('missing_prerequisite')) return 'missing_prerequisite'
  if (flagTypes.includes('disengaged'))            return 'disengaged'
  if (flagTypes.includes('declining_performance')) return 'low_confidence'
  if (riskLevel === 'critical')                    return 'high_risk'
  return 'standard'
}

function aggregateByType(records: EIRInterventionRecord[]): InterventionTypeStats[] {
  const map = new Map<string, {
    total: number; effective: number; deltas: number[]; days: number[]
    profilesEffective: string[]; profilesIneffective: string[]
  }>()

  for (const r of records) {
    const type = r.intervention_type
    const entry = map.get(type) ?? {
      total: 0, effective: 0, deltas: [], days: [],
      profilesEffective: [], profilesIneffective: [],
    }
    entry.total += 1
    if (r.was_effective) {
      entry.effective += 1
      if (r.learner_profile_type) entry.profilesEffective.push(r.learner_profile_type)
    } else {
      if (r.learner_profile_type) entry.profilesIneffective.push(r.learner_profile_type)
    }
    if (r.mastery_delta !== null) entry.deltas.push(r.mastery_delta)
    if (r.days_to_resolution !== null) entry.days.push(r.days_to_resolution)
    map.set(type, entry)
  }

  return Array.from(map.entries()).map(([type, s]) => ({
    intervention_type:   type as EIRInterventionType,
    total_records:       s.total,
    effectiveness_rate:  s.total > 0 ? s.effective / s.total : 0,
    avg_mastery_delta:   s.deltas.length ? s.deltas.reduce((a, b) => a + b, 0) / s.deltas.length : 0,
    avg_days_to_resolve: s.days.length  ? s.days.reduce((a, b) => a + b, 0)  / s.days.length   : 0,
    best_for_profile:    [...new Set(s.profilesEffective)].slice(0, 3),
    worst_for_profile:   [...new Set(s.profilesIneffective)].slice(0, 3),
  }))
}

async function fallbackBestIntervention(
  db:      ReturnType<typeof createServiceClient>,
  subject: string,
  grade:   number,
): Promise<{ type: EIRInterventionType; confidence: number; rationale: string }> {
  const { data } = await db
    .from('eir_intervention_effectiveness')
    .select('intervention_type, outcome, mastery_delta, days_to_resolution')
    .eq('subject', subject)
    .eq('grade', grade)
    .not('outcome', 'eq', 'unknown')

  if (!data?.length) {
    return { type: 'practice_questions', confidence: 0.3, rationale: 'Insufficient data — defaulting to Compass practice questions.' }
  }

  const stats = aggregateByType(data as EIRInterventionRecord[])
  const top   = stats.sort((a, b) => b.effectiveness_rate - a.effectiveness_rate)[0]

  return top
    ? { type: top.intervention_type, confidence: 0.5, rationale: `${Math.round(top.effectiveness_rate * 100)}% effective in ${subject} overall.` }
    : { type: 'practice_questions', confidence: 0.3, rationale: 'Insufficient data.' }
}

function emptyReport(): InterventionEffectivenessReport {
  return {
    by_type:              [],
    best_for_risk_level:  {},
    best_for_subject:     {},
    fastest_resolution:   { type: 'practice_questions', avg_days: 0 },
    highest_mastery_gain: { type: 'remedial_plan', avg_delta: 0 },
    generated_at:         new Date().toISOString(),
  }
}
