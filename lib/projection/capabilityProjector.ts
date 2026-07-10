// lib/projection/capabilityProjector.ts
// Overall and per-subject capability level, derived deterministically from
// the LATEST confirmed evidence per subject (a current-state snapshot, not
// a trend — Academic/Growth projectors own trend).
//
// Note: this supersedes lib/career/capabilityExtractor.ts's role in
// principle — that module computes something similar over legacy
// `assessments` data. It is intentionally not touched or reused here,
// since it operates on a different data source; it becomes a candidate for
// retirement once a consumer (Blueprint) migrates to read from this engine
// instead, which is out of scope for this phase.

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { Projection, CapabilityValue, CapabilityLevel } from './types'
import { computeCoverage, computeProjectionConfidence, normalizeLevelToUnit } from './coverage'

export const CAPABILITY_PROJECTION_VERSION = 'capability-v1'

function scoreToLevel(score: number): CapabilityLevel {
  if (score >= 0.85) return 'exceptional'
  if (score >= 0.70) return 'strong'
  if (score >= 0.50) return 'capable'
  if (score >= 0.30) return 'developing'
  return 'emerging'
}

export function projectCapability(evidence: EvidenceRow[], now: Date = new Date()): Projection<CapabilityValue> | null {
  const scored = evidence.filter(e => e.cbc_level !== null)
  if (scored.length === 0) return null

  // Latest evidence per subject only — capability is a current snapshot.
  const latestBySubject = new Map<string, EvidenceRow>()
  for (const e of scored) {
    const existing = latestBySubject.get(e.subject)
    if (!existing || new Date(e.created_at) > new Date(existing.created_at)) latestBySubject.set(e.subject, e)
  }

  const bySubject: Record<string, { level: CapabilityLevel; score: number }> = {}
  let sum = 0
  for (const [subject, e] of latestBySubject) {
    const norm = normalizeLevelToUnit(e.cbc_level!)
    bySubject[subject] = { level: scoreToLevel(norm), score: norm }
    sum += norm
  }
  const overallScore = sum / latestBySubject.size

  const supporting = [...latestBySubject.values()]
  return {
    value: { overallLevel: scoreToLevel(overallScore), overallScore, bySubject },
    supportingEvidenceIds: supporting.map(e => e.id),
    confidence: computeProjectionConfidence(supporting),
    coverage: computeCoverage(supporting, now),
    lastComputed: now.toISOString(),
    projectionVersion: CAPABILITY_PROJECTION_VERSION,
  }
}
