// lib/learnerModel/queries.ts
// DB read/write for the Permanent Learner Memory.
// All writes go through upsert — the model is always current, never historical.
// Historical snapshots are in capability_history (separate table).

import { createServiceClient } from '@/utils/supabase/service'
import type {
  LearnerProfile, KnowledgeState, CapabilityDimensions,
  CareerSignals, EngagementPatterns, RiskFlag, RiskLevel,
  FormativeSignalSnapshot, LearningBehaviour, BehaviourMetric,
  GrowthMilestone, RiskHistoryRecord, ParentObservation,
  PathwayReadiness, TermSnapshot,
} from './types'

// All columns fetched for a learner profile — explicit, never select('*')
const COLUMNS = [
  'id', 'student_id',
  // Legacy (kept for compat)
  'learning_style', 'strengths', 'weaknesses', 'interests', 'profile_data',
  // EIOS intelligence columns
  'knowledge_state', 'capability_dimensions', 'career_signals',
  'engagement_patterns', 'risk_flags', 'formative_signals',
  'overall_risk_level', 'last_assessment_date', 'current_term', 'current_year',
  // New EIOS columns
  'learning_behaviour', 'growth_milestones', 'risk_history',
  'confirmed_gaps', 'persistent_gaps', 'parent_observations',
  'pathway_readiness', 'term_snapshots',
  'created_at', 'updated_at',
].join(', ')

// ── Default values for new columns (in case DB rows predate migration) ────────

function defaultLearningBehaviour(): LearningBehaviour {
  const defaultMetric = (): BehaviourMetric => ({
    score: 0.5, trend: 'stable', data_points: 0,
    last_updated: new Date().toISOString(),
  })
  return {
    persistence:  defaultMetric(),
    confidence:   defaultMetric(),
    velocity:     defaultMetric(),
    help_seeking: defaultMetric(),
    reflection:   defaultMetric(),
    consistency:  defaultMetric(),
  }
}

function defaultPathwayReadiness(): PathwayReadiness {
  const defaultScore = () => ({ score: 0, trend: 'stable' as const, last_updated: null })
  return {
    stem:            defaultScore(),
    social_sciences: defaultScore(),
    arts_sports:     defaultScore(),
    technical_tvet:  defaultScore(),
  }
}

function hydrateProfile(raw: Record<string, unknown>): LearnerProfile {
  return {
    ...raw,
    knowledge_state:      (raw.knowledge_state      ?? {}) as KnowledgeState,
    capability_dimensions:(raw.capability_dimensions ?? {}) as Partial<CapabilityDimensions>,
    career_signals:       (raw.career_signals        ?? {}) as Partial<CareerSignals>,
    engagement_patterns:  (raw.engagement_patterns   ?? {}) as Partial<EngagementPatterns>,
    risk_flags:           (raw.risk_flags            ?? []) as RiskFlag[],
    formative_signals:    (raw.formative_signals     ?? []) as FormativeSignalSnapshot[],
    overall_risk_level:   (raw.overall_risk_level    ?? 'normal') as RiskLevel,
    // EIOS fields — hydrate with defaults if column not yet present
    learning_behaviour:   (raw.learning_behaviour    ?? defaultLearningBehaviour()) as LearningBehaviour,
    growth_milestones:    (raw.growth_milestones     ?? []) as GrowthMilestone[],
    risk_history:         (raw.risk_history          ?? []) as RiskHistoryRecord[],
    confirmed_gaps:       (raw.confirmed_gaps        ?? []) as string[],
    persistent_gaps:      (raw.persistent_gaps       ?? []) as string[],
    parent_observations:  (raw.parent_observations   ?? []) as ParentObservation[],
    pathway_readiness:    (raw.pathway_readiness     ?? defaultPathwayReadiness()) as PathwayReadiness,
    term_snapshots:       (raw.term_snapshots        ?? []) as TermSnapshot[],
  } as LearnerProfile
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getLearnerProfile(studentId: string): Promise<LearnerProfile | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('learner_profiles')
    .select(COLUMNS)
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) throw new Error(`getLearnerProfile: ${error.message}`)
  if (!data) return null
  return hydrateProfile(data as unknown as Record<string, unknown>)
}

export async function getOrCreateLearnerProfile(studentId: string): Promise<LearnerProfile> {
  const existing = await getLearnerProfile(studentId)
  if (existing) return existing

  const db = createServiceClient()
  const { data, error } = await db
    .from('learner_profiles')
    .insert({ student_id: studentId })
    .select(COLUMNS)
    .single()

  if (error) throw new Error(`getOrCreateLearnerProfile: ${error.message}`)
  return hydrateProfile(data as unknown as Record<string, unknown>)
}

export async function getClassLearnerProfiles(classId: string): Promise<LearnerProfile[]> {
  const db = createServiceClient()

  const { data: enrollment } = await db
    .from('class_students')
    .select('student_id')
    .eq('class_id', classId)

  if (!enrollment?.length) return []

  const studentIds = enrollment.map(e => e.student_id as string)

  const { data, error } = await db
    .from('learner_profiles')
    .select(COLUMNS)
    .in('student_id', studentIds)

  if (error) throw new Error(`getClassLearnerProfiles: ${error.message}`)

  const profileMap = new Map(
    (data ?? []).map(p => {
      const hydrated = hydrateProfile(p as unknown as Record<string, unknown>)
      return [hydrated.student_id, hydrated]
    })
  )

  // Ensure every enrolled student has a profile row
  const missing = studentIds.filter(id => !profileMap.has(id))
  if (missing.length > 0) {
    const { data: created } = await db
      .from('learner_profiles')
      .insert(missing.map(id => ({ student_id: id })))
      .select(COLUMNS)
    for (const p of created ?? []) {
      const hydrated = hydrateProfile(p as unknown as Record<string, unknown>)
      profileMap.set(hydrated.student_id, hydrated)
    }
  }

  return [...profileMap.values()]
}

export async function getAtRiskStudents(
  classId:  string,
  minRisk:  RiskLevel = 'watch',
): Promise<LearnerProfile[]> {
  const profiles = await getClassLearnerProfiles(classId)
  const order: Record<RiskLevel, number> = { normal: 0, watch: 1, at_risk: 2, critical: 3 }
  return profiles.filter(p => order[p.overall_risk_level] >= order[minRisk])
}

// ── Patch Helpers — each engine calls only what it changed ────────────────────

export async function patchKnowledgeState(
  studentId: string,
  patch:     Partial<KnowledgeState>,
): Promise<void> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const merged  = { ...profile.knowledge_state, ...patch }

  const { error } = await db
    .from('learner_profiles')
    .update({ knowledge_state: merged })
    .eq('student_id', studentId)

  if (error) throw new Error(`patchKnowledgeState: ${error.message}`)
}

export async function patchCapabilityDimensions(
  studentId:  string,
  dimensions: Partial<CapabilityDimensions>,
): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('learner_profiles')
    .update({ capability_dimensions: dimensions })
    .eq('student_id', studentId)

  if (error) throw new Error(`patchCapabilityDimensions: ${error.message}`)
}

export async function patchCareerSignals(
  studentId: string,
  signals:   Partial<CareerSignals>,
): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('learner_profiles')
    .update({ career_signals: signals })
    .eq('student_id', studentId)

  if (error) throw new Error(`patchCareerSignals: ${error.message}`)
}

export async function patchEngagementPatterns(
  studentId: string,
  patterns:  Partial<EngagementPatterns>,
): Promise<void> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const merged  = { ...profile.engagement_patterns, ...patterns }

  const { error } = await db
    .from('learner_profiles')
    .update({ engagement_patterns: merged })
    .eq('student_id', studentId)

  if (error) throw new Error(`patchEngagementPatterns: ${error.message}`)
}

export async function patchLearningBehaviour(
  studentId: string,
  patch:     Partial<LearningBehaviour>,
): Promise<void> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const merged  = { ...profile.learning_behaviour, ...patch }

  const { error } = await db
    .from('learner_profiles')
    .update({ learning_behaviour: merged })
    .eq('student_id', studentId)

  if (error) throw new Error(`patchLearningBehaviour: ${error.message}`)
}

export async function patchPathwayReadiness(
  studentId: string,
  patch:     Partial<PathwayReadiness>,
): Promise<void> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const merged  = { ...profile.pathway_readiness, ...patch }

  const { error } = await db
    .from('learner_profiles')
    .update({ pathway_readiness: merged })
    .eq('student_id', studentId)

  if (error) throw new Error(`patchPathwayReadiness: ${error.message}`)
}

export async function addFormativeSignal(
  studentId: string,
  signal:    FormativeSignalSnapshot,
): Promise<void> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const signals = [signal, ...profile.formative_signals].slice(0, 20)  // keep last 20

  const { error } = await db
    .from('learner_profiles')
    .update({ formative_signals: signals })
    .eq('student_id', studentId)

  if (error) throw new Error(`addFormativeSignal: ${error.message}`)
}

export async function addParentObservation(
  studentId:   string,
  observation: ParentObservation,
): Promise<void> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const observations = [observation, ...profile.parent_observations].slice(0, 12)  // 3 months

  const { error } = await db
    .from('learner_profiles')
    .update({ parent_observations: observations })
    .eq('student_id', studentId)

  if (error) throw new Error(`addParentObservation: ${error.message}`)
}

export async function addGrowthMilestone(
  studentId:  string,
  milestone:  GrowthMilestone,
): Promise<void> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const milestones = [milestone, ...profile.growth_milestones]  // keep all — permanent record

  const { error } = await db
    .from('learner_profiles')
    .update({ growth_milestones: milestones })
    .eq('student_id', studentId)

  if (error) throw new Error(`addGrowthMilestone: ${error.message}`)
}

export async function updateRiskProfile(
  studentId:   string,
  flags:       RiskFlag[],
  riskLevel:   RiskLevel,
  riskHistory: RiskHistoryRecord[],
): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('learner_profiles')
    .update({
      risk_flags:         flags,
      overall_risk_level: riskLevel,
      risk_history:       riskHistory,
    })
    .eq('student_id', studentId)

  if (error) throw new Error(`updateRiskProfile: ${error.message}`)
}

export async function updateConfirmedGaps(
  studentId:      string,
  confirmedGaps:  string[],
  persistentGaps: string[],
): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('learner_profiles')
    .update({ confirmed_gaps: confirmedGaps, persistent_gaps: persistentGaps })
    .eq('student_id', studentId)

  if (error) throw new Error(`updateConfirmedGaps: ${error.message}`)
}

export async function markAssessmentDate(
  studentId:  string,
  assessedAt: string,
  term:       number,
  year:       number,
): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('learner_profiles')
    .update({
      last_assessment_date: assessedAt,
      current_term:         term,
      current_year:         year,
    })
    .eq('student_id', studentId)

  if (error) throw new Error(`markAssessmentDate: ${error.message}`)
}

export async function snapshotTermEnd(
  studentId: string,
  term:      number,
  year:      number,
): Promise<void> {
  const profile = await getOrCreateLearnerProfile(studentId)
  const db      = createServiceClient()

  const snapshot: TermSnapshot = {
    term,
    year,
    snapped_at:  new Date().toISOString(),
    risk_level:  profile.overall_risk_level,
    capability_summary: Object.fromEntries(
      Object.entries(profile.capability_dimensions as Record<string, { level: string; raw_score: number }>)
        .map(([k, v]) => [k, { level: v?.level ?? 'emerging', score: v?.raw_score ?? 0 }])
    ),
    knowledge_summary: Object.fromEntries(
      Object.entries(profile.knowledge_state)
        .map(([k, v]) => [k, v.level])
    ),
    pathway_readiness: {
      stem:            profile.pathway_readiness.stem.score,
      social_sciences: profile.pathway_readiness.social_sciences.score,
      arts_sports:     profile.pathway_readiness.arts_sports.score,
      technical_tvet:  profile.pathway_readiness.technical_tvet.score,
    },
  }

  const snapshots = [snapshot, ...profile.term_snapshots].slice(0, 12)  // 4 years of terms

  const { error } = await db
    .from('learner_profiles')
    .update({ term_snapshots: snapshots })
    .eq('student_id', studentId)

  if (error) throw new Error(`snapshotTermEnd: ${error.message}`)
}
