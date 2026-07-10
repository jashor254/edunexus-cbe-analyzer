// lib/projection/capabilityV2Projector.ts
// Projection V2, Phase 3 — a broader capability-dimension model than V1's
// capabilityProjector (which only tracks per-subject level). Additive: does
// not replace or modify capabilityProjector.ts, which existing consumers
// (Blueprint, Career Intelligence, via projectionToScoreHistory) still read
// unchanged.
//
// Every dimension score is a weighted average of real subject-evidence CBC
// levels via a fixed, documented subject→dimension mapping — the same
// technique lib/career/capabilityExtractor.ts already uses for its 6
// dimensions (precedent in this codebase), just with a Projection-native
// implementation and a wider dimension set. This is NOT emergent in the
// purest sense (the mapping is a static lookup, not learned), but every
// number in it traces to real subject-score evidence — no dimension is
// fabricated, and dimensions with zero contributing evidence are omitted
// entirely rather than defaulted.
//
// Deliberately excludes Leadership, Collaboration, Self Regulation, and
// Persistence — see CapabilityV2Dimension's doc comment in types.ts for why.

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { Projection, CapabilityV2Value, CapabilityV2Dimension, CapabilityV2Score, CapabilityLevel, Trend } from './types'
import { computeCoverage, computeProjectionConfidence, normalizeLevelToUnit, STABLE_THRESHOLD } from './coverage'

export const CAPABILITY_V2_PROJECTION_VERSION = 'capability-v2'

// Subject → dimension weights. A subject may contribute to several
// dimensions at different strengths; weights are relative importance within
// each dimension's own weighted average, not required to sum to 1.
const SUBJECT_DIMENSION_MAP: Record<string, Partial<Record<CapabilityV2Dimension, number>>> = {
  mathematics:            { numerical_fluency: 1.0, problem_solving: 0.6, analytical_thinking: 0.5 },
  core_mathematics:       { numerical_fluency: 1.0, problem_solving: 0.6, analytical_thinking: 0.5 },
  essential_mathematics:  { numerical_fluency: 1.0, problem_solving: 0.4 },
  integrated_science:     { scientific_inquiry: 1.0, analytical_thinking: 0.5, problem_solving: 0.4 },
  biology:                { scientific_inquiry: 1.0, analytical_thinking: 0.4, research: 0.3 },
  chemistry:              { scientific_inquiry: 1.0, analytical_thinking: 0.5, problem_solving: 0.3 },
  physics:                { scientific_inquiry: 1.0, analytical_thinking: 0.5, problem_solving: 0.5 },
  english:                { communication: 1.0, research: 0.3 },
  kiswahili:               { communication: 0.8 },
  kiswahili_ksl:           { communication: 0.8 },
  kiswahili_lugha:         { communication: 0.8 },
  computer_studies:       { digital_literacy: 1.0, systems_thinking: 0.5, problem_solving: 0.3 },
  social_studies:         { research: 0.7, systems_thinking: 0.3, analytical_thinking: 0.3 },
  history:                { research: 0.7, analytical_thinking: 0.3 },
  history_citizenship:    { research: 0.7, analytical_thinking: 0.3 },
  geography:              { research: 0.6, systems_thinking: 0.4, analytical_thinking: 0.3 },
  business_studies:       { systems_thinking: 0.4, numerical_fluency: 0.3, analytical_thinking: 0.3 },
  creative_arts_sports:   { creative_thinking: 1.0 },
  creative_arts:          { creative_thinking: 1.0 },
  pre_technical:          { problem_solving: 0.6, systems_thinking: 0.5, digital_literacy: 0.3 },
  pre_technical_studies:  { problem_solving: 0.6, systems_thinking: 0.5, digital_literacy: 0.3 },
  agriculture_nutrition:  { scientific_inquiry: 0.4, systems_thinking: 0.3 },
  agriculture:            { scientific_inquiry: 0.4, systems_thinking: 0.3 },
  home_science:           { systems_thinking: 0.3, research: 0.2 },
}

function scoreToLevel(score: number): CapabilityLevel {
  if (score >= 0.85) return 'exceptional'
  if (score >= 0.70) return 'strong'
  if (score >= 0.50) return 'capable'
  if (score >= 0.30) return 'developing'
  return 'emerging'
}

/** Same two-half-average approach as growthProjector.ts, applied to one dimension's own evidence set. */
function computeTrend(sorted: EvidenceRow[]): Trend {
  if (sorted.length < 2) return 'insufficient_data'
  const mid = Math.floor(sorted.length / 2)
  const firstHalf = sorted.slice(0, mid || 1)
  const secondHalf = sorted.slice(mid || 1)
  const avg = (rows: EvidenceRow[]) => rows.reduce((s, r) => s + normalizeLevelToUnit(r.cbc_level!), 0) / rows.length
  const delta = avg(secondHalf) - avg(firstHalf)
  if (delta > STABLE_THRESHOLD) return 'improving'
  if (delta < -STABLE_THRESHOLD) return 'declining'
  return 'stable'
}

export function projectCapabilityV2(evidence: EvidenceRow[], now: Date = new Date()): Projection<CapabilityV2Value> | null {
  const scored = evidence.filter(e => e.cbc_level !== null)
  if (scored.length === 0) return null

  // Latest evidence per subject only — same "current snapshot" contract as V1's capabilityProjector.
  const latestBySubject = new Map<string, EvidenceRow>()
  for (const e of scored) {
    const existing = latestBySubject.get(e.subject)
    if (!existing || new Date(e.created_at) > new Date(existing.created_at)) latestBySubject.set(e.subject, e)
  }

  // Group ALL scored evidence (not just latest) per dimension, for trend + confidence.
  const evidenceByDimension = new Map<CapabilityV2Dimension, EvidenceRow[]>()
  const latestByDimension = new Map<CapabilityV2Dimension, Array<{ subject: string; row: EvidenceRow; weight: number }>>()

  for (const e of scored) {
    const weights = SUBJECT_DIMENSION_MAP[e.subject]
    if (!weights) continue
    for (const dimension of Object.keys(weights) as CapabilityV2Dimension[]) {
      const list = evidenceByDimension.get(dimension) ?? []
      list.push(e)
      evidenceByDimension.set(dimension, list)
    }
  }
  for (const [subject, row] of latestBySubject) {
    const weights = SUBJECT_DIMENSION_MAP[subject]
    if (!weights) continue
    for (const [dimension, weight] of Object.entries(weights) as Array<[CapabilityV2Dimension, number]>) {
      const list = latestByDimension.get(dimension) ?? []
      list.push({ subject, row, weight })
      latestByDimension.set(dimension, list)
    }
  }

  if (latestByDimension.size === 0) return null

  const dimensions: CapabilityV2Value['dimensions'] = {}
  const allSupportingIds = new Set<string>()

  for (const [dimension, contributors] of latestByDimension) {
    const totalWeight = contributors.reduce((s, c) => s + c.weight, 0)
    const weightedScore = contributors.reduce((s, c) => s + normalizeLevelToUnit(c.row.cbc_level!) * c.weight, 0) / totalWeight

    const dimensionEvidence = (evidenceByDimension.get(dimension) ?? [])
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const score: CapabilityV2Score = {
      dimension,
      score: weightedScore,
      level: scoreToLevel(weightedScore),
      trend: computeTrend(dimensionEvidence),
      contributingSubjects: contributors.map(c => c.subject),
      evidenceIds: dimensionEvidence.map(e => e.id),
      confidence: computeProjectionConfidence(dimensionEvidence),
    }
    dimensions[dimension] = score
    for (const id of score.evidenceIds) allSupportingIds.add(id)
  }

  const supporting = scored.filter(e => allSupportingIds.has(e.id))

  return {
    value: { dimensions },
    supportingEvidenceIds: [...allSupportingIds],
    confidence: computeProjectionConfidence(supporting),
    coverage: computeCoverage(supporting, now),
    lastComputed: now.toISOString(),
    projectionVersion: CAPABILITY_V2_PROJECTION_VERSION,
  }
}
