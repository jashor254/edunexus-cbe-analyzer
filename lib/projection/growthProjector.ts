// lib/projection/growthProjector.ts
// Growth trajectory, derived only from comparable educational contexts —
// never by pooling evidence from different subjects into one chronological
// sequence and comparing early-vs-late averages. That pooled algorithm was
// this file's original implementation and produced real, reproducible false
// "declining" verdicts for learners whose every individual subject was
// stable or improving (Phase 4B.1, docs/architecture/comparable-context-
// growth-correction-phase4b1.md — Victor Gitau: Mathematics improving
// Level 3->4, Kiswahili at Level 4, both individually fine, yet the pooled
// algorithm read the chronological gap between his earliest-recorded
// subject and his latest-recorded subject as "decline").
//
// Comparable-context invariant: evidence from different subjects, learning
// areas, competencies, or otherwise incomparable contexts must never be
// treated as sequential measurements of one capability trajectory. Subject
// is the narrowest reliable comparable context this domain model already
// supports (the same grouping key academicProjector.ts uses) — trend is
// computed independently within each subject, then aggregated conservatively.

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { Projection, GrowthValue, GrowthContextTrend, Trend } from './types'
import { computeCoverage, computeProjectionConfidence, normalizeLevelToUnit, STABLE_THRESHOLD } from './coverage'

export const GROWTH_PROJECTION_VERSION = 'growth-v2-comparable-context'

const EMPTY_CONTEXT_TREND: GrowthContextTrend = {
  trend: 'insufficient_data', earliestScore: null, latestScore: null, delta: null, windowStart: null, windowEnd: null,
}

/**
 * One subject's own trend. Requires evidence from at least two temporally
 * distinct effective periods (academic year + term) — multiple assessments
 * recorded within the same term are a snapshot of that term, not movement
 * ("do not treat multiple records from the same effective period as
 * longitudinal change"), so a subject with evidence confined to one period
 * stays `insufficient_data` regardless of row count.
 */
function computeContextTrend(rows: EvidenceRow[]): GrowthContextTrend {
  const byPeriod = new Map<string, EvidenceRow[]>()
  for (const row of rows) {
    const key = `${row.academic_year}:${row.term ?? 'null'}`
    const group = byPeriod.get(key) ?? []
    group.push(row)
    byPeriod.set(key, group)
  }
  if (byPeriod.size < 2) return EMPTY_CONTEXT_TREND

  const periods = [...byPeriod.values()]
    .map(group => {
      const sortedGroup = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const avgScore = group.reduce((sum, r) => sum + normalizeLevelToUnit(r.cbc_level!), 0) / group.length
      return { at: sortedGroup[0].created_at, avgScore }
    })
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  const earliestScore = periods[0].avgScore
  const latestScore = periods[periods.length - 1].avgScore
  const delta = latestScore - earliestScore

  let trend: Trend = 'stable'
  if (delta > STABLE_THRESHOLD) trend = 'improving'
  else if (delta < -STABLE_THRESHOLD) trend = 'declining'

  return { trend, earliestScore, latestScore, delta, windowStart: periods[0].at, windowEnd: periods[periods.length - 1].at }
}

/**
 * Conservative aggregation across 2+ subjects with a valid (non-
 * `insufficient_data`) trend. Never asserts a direction unsupported by at
 * least one real subject trend, and never lets one subject's movement
 * silently overrule an opposing subject's movement:
 *
 * - all valid trends agree (all improving / all declining / all stable) -> that trend.
 * - a mix of 'stable' and one direction (no opposing direction present) -> that direction
 *   (a real, observed subject-level movement; the stable subjects don't contradict it).
 * - both an improving AND a declining subject -> 'mixed' — the only honest
 *   label, per the comparable-context invariant: a high score in one
 *   subject and a lower score in another is never "decline," and neither
 *   direction may be dropped to force a single label.
 */
function aggregateValidTrends(valid: Trend[]): Trend {
  const hasImproving = valid.includes('improving')
  const hasDeclining = valid.includes('declining')
  if (hasImproving && hasDeclining) return 'mixed'
  if (hasImproving) return 'improving'
  if (hasDeclining) return 'declining'
  return 'stable'
}

export function projectGrowth(evidence: EvidenceRow[], now: Date = new Date()): Projection<GrowthValue> | null {
  const scored = evidence.filter(e => e.cbc_level !== null)
  if (scored.length === 0) return null

  const bySubjectRaw = new Map<string, EvidenceRow[]>()
  for (const row of scored) {
    const group = bySubjectRaw.get(row.subject) ?? []
    group.push(row)
    bySubjectRaw.set(row.subject, group)
  }

  const bySubject: Record<string, GrowthContextTrend> = {}
  for (const [subject, rows] of bySubjectRaw) {
    bySubject[subject] = computeContextTrend(rows)
  }

  const validEntries = Object.entries(bySubject).filter(([, ctx]) => ctx.trend !== 'insufficient_data')

  let overall: GrowthValue
  if (validEntries.length === 0) {
    overall = { trend: 'insufficient_data', sourceSubject: null, earliestScore: null, latestScore: null, delta: null, windowStart: null, windowEnd: null, bySubject }
  } else if (validEntries.length === 1) {
    const [subject, ctx] = validEntries[0]
    overall = { trend: ctx.trend, sourceSubject: subject, earliestScore: ctx.earliestScore, latestScore: ctx.latestScore, delta: ctx.delta, windowStart: ctx.windowStart, windowEnd: ctx.windowEnd, bySubject }
  } else {
    const trend = aggregateValidTrends(validEntries.map(([, ctx]) => ctx.trend))
    // 2+ contexts contributed — no single scalar score/delta can represent
    // them without re-introducing cross-subject pooling, so these stay
    // null; `bySubject` carries the real, traceable per-subject values.
    overall = { trend, sourceSubject: null, earliestScore: null, latestScore: null, delta: null, windowStart: null, windowEnd: null, bySubject }
  }

  return {
    value: overall,
    supportingEvidenceIds: scored.map(e => e.id),
    confidence: computeProjectionConfidence(scored),
    coverage: computeCoverage(scored, now),
    lastComputed: now.toISOString(),
    projectionVersion: GROWTH_PROJECTION_VERSION,
  }
}
