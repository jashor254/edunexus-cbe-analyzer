// lib/eir/careerDevelopment.ts
// Pillar 5 — Career Development
//
// Snapshots and studies how each learner's career trajectory evolves:
//   - Interest changes (pivot events)
//   - Competency growth
//   - Career confidence trajectory
//   - Pathway changes (STEM → Arts, etc.)
//   - Career readiness trends
//
// Produces Career Development Models used by the parent and teacher panels.

import { createServiceClient } from '@/utils/supabase/service'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import type {
  EIRCareerDevelopmentSnapshot,
  CareerDevelopmentModel,
} from './types'

// ── Take Career Snapshot ──────────────────────────────────────────────────────
// Called by the research engine periodically (weekly or after profile update).

export async function takeCareerSnapshot(
  studentId: string,
): Promise<EIRCareerDevelopmentSnapshot> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)
  const now     = new Date().toISOString()

  // Fetch previous snapshot to detect changes
  const { data: previousRaw } = await db
    .from('eir_career_development')
    .select(
      'id, top_career_slug, pathway, career_readiness_score, ' +
      'competency_growth_rate, snapshot_at, career_confidence'
    )
    .eq('student_id', studentId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single()

  const previous    = previousRaw as unknown as EIRCareerDevelopmentSnapshot | null
  const prevSlug    = previous?.top_career_slug   ?? null
  const prevPathway = previous?.pathway           ?? null

  // Derive values from learner model
  const topCareerSlug   = profile.career_signals?.top_career_slugs?.[0] ?? null
  const pathway         = getPathwayFromProfile(profile)
  const readinessScore  = computeReadinessScore(profile)
  const interestStab    = computeInterestStability(profile, prevSlug)
  const growthRate      = computeCompetencyGrowthRate(profile, previous?.competency_growth_rate ?? null)
  const confidence      = computeCareerConfidence(profile)
  const careerChanged   = prevSlug !== null && prevSlug !== topCareerSlug
  const pathwayChanged  = prevPathway !== null && prevPathway !== pathway
  const trend           = computeReadinessTrend(readinessScore, previous?.career_readiness_score ?? null)

  const snapshot: Omit<EIRCareerDevelopmentSnapshot, 'id'> = {
    student_id:             studentId,
    snapshot_at:            now,
    top_career_slug:        topCareerSlug,
    previous_career_slug:   prevSlug,
    career_readiness_score: readinessScore,
    interest_stability:     interestStab,
    competency_growth_rate: growthRate,
    pathway,
    confidence_score:       confidence,
    career_confidence:      confidence,
    career_changed:         careerChanged,
    pathway_changed:        pathwayChanged,
    readiness_trend:        trend,
    evidence: {
      top_careers:        profile.career_signals?.top_career_slugs ?? [],
      pathway_readiness:  profile.pathway_readiness,
      capability_dims:    profile.capability_dimensions,
    },
    created_at: now,
    updated_at: now,
  }

  const { data: insertedRaw } = await db
    .from('eir_career_development')
    .insert(snapshot)
    .select()
    .single()

  const inserted = insertedRaw as unknown as EIRCareerDevelopmentSnapshot | null
  return inserted ?? ({ id: '', ...snapshot } as EIRCareerDevelopmentSnapshot)
}

// ── Build Career Development Model ────────────────────────────────────────────

export async function buildCareerDevelopmentModel(
  studentId: string,
): Promise<CareerDevelopmentModel> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  const { data } = await db
    .from('eir_career_development')
    .select(
      'id, student_id, snapshot_at, top_career_slug, previous_career_slug, ' +
      'career_readiness_score, interest_stability, competency_growth_rate, ' +
      'pathway, confidence_score, career_confidence, career_changed, pathway_changed, ' +
      'readiness_trend, evidence, created_at, updated_at'
    )
    .eq('student_id', studentId)
    .order('snapshot_at', { ascending: false })
    .limit(12)   // last ~3 months of weekly snapshots

  const snapshots = (data as unknown as EIRCareerDevelopmentSnapshot[] | null) ?? []
  const current   = snapshots[0]

  if (!current) {
    return emptyModel(studentId, now)
  }

  const careerStability = computeStabilityFromSnapshots(snapshots)
  const pivotCount      = snapshots.filter(s => s.career_changed).length
  const readinessTrend  = computeOverallTrend(snapshots)

  // Competency gap — simplified: based on readiness vs 75 threshold
  const competencyGap: Record<string, number> = {}
  if (current.top_career_slug && current.career_readiness_score !== null) {
    competencyGap[current.top_career_slug] = Math.max(0, 75 - current.career_readiness_score)
  }

  return {
    student_id:           studentId,
    current_snapshot:     current,
    snapshots,
    career_stability:     careerStability,
    readiness_trajectory: readinessTrend,
    pivot_count:          pivotCount,
    competency_gap:       competencyGap,
    generated_at:         now,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type LearnerProfile = Awaited<ReturnType<typeof getOrCreateLearnerProfile>>

function getPathwayFromProfile(profile: LearnerProfile): string | null {
  const pw = profile.pathway_readiness
  if (!pw) return null
  const entries = Object.entries(pw as Record<string, { score?: number }>)
  if (!entries.length) return null
  const top = entries.sort((a, b) => (b[1]?.score ?? 0) - (a[1]?.score ?? 0))[0]
  return top?.[0] ?? null
}

function computeReadinessScore(profile: LearnerProfile): number {
  const dims = profile.capability_dimensions as Record<string, { score?: number; trend?: string }> | null
  if (!dims) return 0
  const scores = Object.values(dims).map(d => d?.score ?? 0)
  if (!scores.length) return 0
  return Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 25)  // 0–100
}

function computeInterestStability(profile: LearnerProfile, prevSlug: string | null): number {
  const sigs = profile.career_signals?.top_career_slugs ?? []
  if (!prevSlug || sigs.length === 0) return 0.5

  // If the same career has been top for multiple signals, high stability
  const isStable = sigs[0] === prevSlug
  return isStable ? 0.85 : 0.3
}

function computeCompetencyGrowthRate(
  profile:    LearnerProfile,
  prevRate:   number | null,
): number {
  const dims   = profile.capability_dimensions as Record<string, { trend?: string; score?: number }> | null
  if (!dims) return prevRate ?? 0

  const improving = Object.values(dims).filter(d => d?.trend === 'improving' || d?.trend === 'accelerating').length
  const total     = Object.keys(dims).length
  if (!total) return prevRate ?? 0

  const rate = (improving / total) * 0.1   // 10% growth per cycle at max
  return prevRate !== null ? (prevRate * 0.7 + rate * 0.3) : rate   // EMA smoothing
}

function computeCareerConfidence(profile: LearnerProfile): number {
  const signals  = profile.career_signals
  const readiness = profile.pathway_readiness
  if (!signals || !readiness) return 0.4

  const topCareer    = signals.top_career_slugs?.[0]
  const pathwayScores = Object.values(readiness as Record<string, { score?: number }>)
    .map(v => v?.score ?? 0)
  const maxPathway   = pathwayScores.length ? Math.max(...pathwayScores) : 0

  return topCareer ? Math.min(1, 0.4 + maxPathway * 0.6) : 0.3
}

function computeReadinessTrend(
  current:  number,
  previous: number | null,
): 'improving' | 'stable' | 'declining' | null {
  if (previous === null) return null
  const delta = current - previous
  if (delta > 3)  return 'improving'
  if (delta < -3) return 'declining'
  return 'stable'
}

function computeStabilityFromSnapshots(snapshots: EIRCareerDevelopmentSnapshot[]): number {
  if (snapshots.length < 2) return 0.5
  const pivots = snapshots.filter(s => s.career_changed).length
  return Math.max(0, 1 - (pivots / snapshots.length))
}

function computeOverallTrend(
  snapshots: EIRCareerDevelopmentSnapshot[],
): 'accelerating' | 'improving' | 'stable' | 'declining' {
  if (snapshots.length < 3) return 'stable'

  const scores = snapshots
    .filter(s => s.career_readiness_score !== null)
    .map(s => s.career_readiness_score as number)

  if (scores.length < 2) return 'stable'

  const first = scores[scores.length - 1]
  const last  = scores[0]
  const delta = last - first

  if (delta > 15) return 'accelerating'
  if (delta > 5)  return 'improving'
  if (delta < -5) return 'declining'
  return 'stable'
}

function emptyModel(studentId: string, now: string): CareerDevelopmentModel {
  return {
    student_id:           studentId,
    current_snapshot:     null as unknown as EIRCareerDevelopmentSnapshot,
    snapshots:            [],
    career_stability:     0.5,
    readiness_trajectory: 'stable',
    pivot_count:          0,
    competency_gap:       {},
    generated_at:         now,
  }
}
