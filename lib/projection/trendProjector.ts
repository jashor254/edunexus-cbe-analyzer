// lib/projection/trendProjector.ts
// Projection V2, Phase 4 — a richer trend vocabulary than V1's growthProjector
// (holistic improving/declining/stable) and academicProjector (per-subject
// improving/declining/stable). Additive: does not modify either — this is a
// new projection alongside them, reusing the same evidence, computed with a
// more detailed pattern classifier.
//
// Every pattern is derived from a deterministic, ordered set of numeric
// rules over the evidence's own (time, normalized CBC level) sequence — no
// heuristic-only or AI-derived label. Given the same evidence twice, the
// same pattern comes out every time.

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { Projection, TrendV2Value, TrendPattern } from './types'
import { computeCoverage, computeProjectionConfidence, normalizeLevelToUnit, STABLE_THRESHOLD } from './coverage'

export const TREND_PROJECTION_VERSION = 'trend-v1'

// A drop of this much from a prior peak (on the 0-1 normalized scale, i.e.
// roughly one full CBC level) counts as a genuine regression, not noise.
const REGRESSION_THRESHOLD = 0.33

type Point = { at: number; value: number; evidenceId: string }

function toPoints(rows: EvidenceRow[]): Point[] {
  return rows
    .filter(r => r.cbc_level !== null)
    .map(r => ({ at: new Date(r.created_at).getTime(), value: normalizeLevelToUnit(r.cbc_level!), evidenceId: r.id }))
    .sort((a, b) => a.at - b.at)
}

/**
 * Classifies a time-ordered sequence of normalized scores into one of the
 * Projection V2 trend patterns. Rules are evaluated in a fixed priority
 * order — first match wins — so exactly one pattern is ever produced for a
 * given sequence, with no ambiguity between overlapping conditions.
 */
export function classifyTrend(points: Point[]): TrendPattern {
  const n = points.length
  if (n < 2) return 'insufficient_data'

  const values = points.map(p => p.value)
  const mid = Math.floor(n / 2)
  const firstHalf = values.slice(0, mid || 1)
  const secondHalf = values.slice(mid || 1)
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
  const halfDelta = avg(secondHalf) - avg(firstHalf)
  const overallDelta = values[n - 1] - values[0]

  // Peak / interior trough (excludes the endpoints so a monotonic sequence
  // never registers a false trough or a false "regression from the start").
  let peak = values[0]
  let peakIndex = 0
  for (let i = 1; i < n; i++) {
    if (values[i] > peak) { peak = values[i]; peakIndex = i }
  }
  let interiorTrough: number | null = null
  let interiorTroughIndex = -1
  for (let i = 1; i < n - 1; i++) {
    if (interiorTrough === null || values[i] < interiorTrough) { interiorTrough = values[i]; interiorTroughIndex = i }
  }

  const consecutiveDeltas: number[] = []
  for (let i = 1; i < n; i++) consecutiveDeltas.push(values[i] - values[i - 1])

  // 1. Regression — dropped a full level or more from an established peak,
  //    and that peak wasn't just the final point (i.e. it actually declined
  //    afterward, not just "ended lower than its own current value").
  if (peakIndex < n - 1 && peak - values[n - 1] >= REGRESSION_THRESHOLD) {
    return 'regression'
  }

  // 2. Recovering — dipped below the starting level at some interior point,
  //    then climbed back up by at least one threshold's worth from that dip.
  if (
    interiorTrough !== null &&
    interiorTroughIndex > 0 && interiorTroughIndex < n - 1 &&
    interiorTrough < values[0] - STABLE_THRESHOLD / 2 &&
    values[n - 1] - interiorTrough >= STABLE_THRESHOLD
  ) {
    return 'recovering'
  }

  // 3. Accelerating — improving, and the rate of improvement itself is
  //    increasing (second-half average delta bigger than first-half).
  if (n >= 3 && overallDelta > STABLE_THRESHOLD && halfDelta > STABLE_THRESHOLD) {
    const firstHalfDeltas = consecutiveDeltas.slice(0, Math.floor(consecutiveDeltas.length / 2) || 1)
    const secondHalfDeltas = consecutiveDeltas.slice(Math.floor(consecutiveDeltas.length / 2) || 1)
    if (secondHalfDeltas.length > 0 && avg(secondHalfDeltas) > avg(firstHalfDeltas)) {
      return 'accelerating'
    }
  }

  // 4. Momentum — sustained, unbroken improvement across every consecutive
  //    step (no reversals), distinct from ordinary "improving" which only
  //    compares the two halves in aggregate.
  if (n >= 3 && overallDelta > STABLE_THRESHOLD && consecutiveDeltas.every(d => d >= -STABLE_THRESHOLD / 2)) {
    return 'momentum'
  }

  // 5 & 6. Ordinary improving / declining, from the half-vs-half comparison
  //    growthProjector already uses.
  if (halfDelta > STABLE_THRESHOLD) return 'improving'
  if (halfDelta < -STABLE_THRESHOLD) return 'declining'

  // 7. Plateau — genuinely flat across the WHOLE sequence (tighter than
  //    "stable", which only requires the two halves to be close).
  if (n >= 3 && Math.max(...values) - Math.min(...values) <= STABLE_THRESHOLD) {
    return 'plateau'
  }

  // 8. Stable — default: neither half shows meaningful movement.
  return 'stable'
}

export function projectTrend(evidence: EvidenceRow[], now: Date = new Date()): Projection<TrendV2Value> | null {
  const scored = evidence.filter(e => e.cbc_level !== null)
  if (scored.length === 0) return null

  const bySubjectRaw = new Map<string, EvidenceRow[]>()
  for (const e of scored) {
    const list = bySubjectRaw.get(e.subject) ?? []
    list.push(e)
    bySubjectRaw.set(e.subject, list)
  }

  const bySubject: TrendV2Value['bySubject'] = {}
  for (const [subject, rows] of bySubjectRaw) {
    const points = toPoints(rows)
    bySubject[subject] = { pattern: classifyTrend(points), evidenceIds: points.map(p => p.evidenceId) }
  }

  // Overall — same holistic (all-subjects-merged) approach growthProjector
  // uses for its trend, but through the richer classifier.
  const overallPoints = toPoints(scored)
  const overall = classifyTrend(overallPoints)

  return {
    value: { overall, bySubject },
    supportingEvidenceIds: scored.map(e => e.id),
    confidence: computeProjectionConfidence(scored),
    coverage: computeCoverage(scored, now),
    lastComputed: now.toISOString(),
    projectionVersion: TREND_PROJECTION_VERSION,
  }
}
