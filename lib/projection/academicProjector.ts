// lib/projection/academicProjector.ts
// Per-subject performance trend, deterministically derived from confirmed
// evidence. Answers "how is this learner doing, and in what direction" —
// distinct from Knowledge Projector's "what do they currently know."

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { Projection, AcademicValue, SubjectPerformance, SubStrandPerformance, Trend } from './types'
import { computeCoverage, computeProjectionConfidence, sortEvidenceChronologically } from './coverage'

export const ACADEMIC_PROJECTION_VERSION = 'academic-v1'

/**
 * H2D Decision B (docs/architecture/adr-0029-addendum-h2d-capability-convergence.md):
 * this is the platform's **netTrend** concept — "what is the learner's net
 * change from their earliest to their latest confirmed evidence." First
 * value vs. last value, nothing in between matters.
 *
 * This is a DIFFERENT question from capabilityExtractor.ts's detectTrend(),
 * which answers **momentumTrend** — "is the learner's recent half of
 * history stronger or weaker than their earlier half." A history that
 * spikes mid-way and returns to its starting point reads as netTrend
 * 'stable' here but can read as momentumTrend 'accelerating' there — both
 * are correct answers to their own question; neither is a bug. Do not
 * unify these two functions — see the ADR addendum for why keeping them
 * distinct, and clearly named, is the chosen architecture.
 */
function computeTrend(levels: number[]): Trend {
  if (levels.length < 2) return 'insufficient_data'
  const earliest = levels[0]
  const latest = levels[levels.length - 1]
  if (latest > earliest) return 'improving'
  if (latest < earliest) return 'declining'
  return 'stable'
}

export function projectAcademic(evidence: EvidenceRow[], now: Date = new Date()): Projection<AcademicValue> | null {
  const scored = evidence.filter(e => e.cbc_level !== null)
  if (scored.length === 0) return null

  const bySubjectRaw = new Map<string, EvidenceRow[]>()
  for (const e of scored) {
    const group = bySubjectRaw.get(e.subject) ?? []
    group.push(e)
    bySubjectRaw.set(e.subject, group)
  }

  const bySubject: Record<string, SubjectPerformance> = {}
  for (const [subject, rows] of bySubjectRaw) {
    const sorted = sortEvidenceChronologically(rows)
    const levels = sorted.map(r => r.cbc_level!)
    bySubject[subject] = {
      subject,
      latestLevel: levels[levels.length - 1] as 1 | 2 | 3 | 4,
      trend: computeTrend(levels),
      history: sorted.map(r => ({ level: r.cbc_level as 1 | 2 | 3 | 4, score: r.score, at: r.created_at, evidenceId: r.id })),
    }
  }

  // ADR-0024 Phase 2, additive — same "latest confirmed evidence wins"
  // selection logic as bySubject above, deliberately not a new algorithm,
  // grouped by sub_strand_id instead of subject. Rows with no resolved
  // sub_strand_id (every row before Sprint A/B/C, and every producer not
  // yet updated to populate one) simply aren't grouped here — that's the
  // graceful fallback: no fabricated entry, no threshold judgment (ARDS's
  // job, not Projection's), just an honest reflection of what evidence
  // actually carries a canonical curriculum anchor.
  const bySubStrandRaw = new Map<string, EvidenceRow[]>()
  for (const e of scored) {
    if (!e.sub_strand_id) continue
    const group = bySubStrandRaw.get(e.sub_strand_id) ?? []
    group.push(e)
    bySubStrandRaw.set(e.sub_strand_id, group)
  }

  const bySubStrand: Record<string, SubStrandPerformance> = {}
  for (const [subStrandId, rows] of bySubStrandRaw) {
    const sorted = sortEvidenceChronologically(rows)
    const levels = sorted.map(r => r.cbc_level!)
    const latest = sorted[sorted.length - 1]
    bySubStrand[subStrandId] = {
      subStrandId,
      subStrandTitle: latest.sub_strand,
      strandTitle: latest.strand,
      subject: latest.subject,
      latestLevel: levels[levels.length - 1] as 1 | 2 | 3 | 4,
      trend: computeTrend(levels),
      history: sorted.map(r => ({ level: r.cbc_level as 1 | 2 | 3 | 4, score: r.score, at: r.created_at, evidenceId: r.id })),
    }
  }

  return {
    value: { bySubject, bySubStrand },
    supportingEvidenceIds: scored.map(e => e.id),
    confidence: computeProjectionConfidence(scored),
    coverage: computeCoverage(scored, now),
    lastComputed: now.toISOString(),
    projectionVersion: ACADEMIC_PROJECTION_VERSION,
  }
}
