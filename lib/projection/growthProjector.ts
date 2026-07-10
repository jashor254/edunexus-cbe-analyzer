// lib/projection/growthProjector.ts
// Holistic growth trajectory across ALL confirmed evidence (not per-subject
// — that's Academic Projector's job). Answers "on the whole, is this
// learner's evidenced performance trending up, down, or flat."

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { Projection, GrowthValue, Trend } from './types'
import { computeCoverage, computeProjectionConfidence, normalizeLevelToUnit, STABLE_THRESHOLD } from './coverage'

export const GROWTH_PROJECTION_VERSION = 'growth-v1'

export function projectGrowth(evidence: EvidenceRow[], now: Date = new Date()): Projection<GrowthValue> | null {
  const scored = evidence.filter(e => e.cbc_level !== null)
  if (scored.length === 0) return null

  const sorted = [...scored].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  if (sorted.length < 2) {
    return {
      value: { trend: 'insufficient_data', earliestScore: null, latestScore: null, delta: null, windowStart: null, windowEnd: null },
      supportingEvidenceIds: sorted.map(e => e.id),
      confidence: computeProjectionConfidence(sorted),
      coverage: computeCoverage(sorted, now),
      lastComputed: now.toISOString(),
      projectionVersion: GROWTH_PROJECTION_VERSION,
    }
  }

  const mid = Math.floor(sorted.length / 2)
  const firstHalf = sorted.slice(0, mid || 1)
  const secondHalf = sorted.slice(mid || 1)
  const avg = (rows: EvidenceRow[]) => rows.reduce((s, r) => s + normalizeLevelToUnit(r.cbc_level!), 0) / rows.length

  const earliestScore = avg(firstHalf)
  const latestScore = avg(secondHalf)
  const delta = latestScore - earliestScore

  let trend: Trend = 'stable'
  if (delta > STABLE_THRESHOLD) trend = 'improving'
  else if (delta < -STABLE_THRESHOLD) trend = 'declining'

  return {
    value: {
      trend, earliestScore, latestScore, delta,
      windowStart: sorted[0].created_at,
      windowEnd: sorted[sorted.length - 1].created_at,
    },
    supportingEvidenceIds: sorted.map(e => e.id),
    confidence: computeProjectionConfidence(sorted),
    coverage: computeCoverage(sorted, now),
    lastComputed: now.toISOString(),
    projectionVersion: GROWTH_PROJECTION_VERSION,
  }
}
