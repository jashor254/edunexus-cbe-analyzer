// lib/projection/knowledgeProjector.ts
// Current mastery state per subject — "what does this learner currently
// know," a snapshot, independent of trend (Academic) or normalized
// capability bucketing (Capability).
//
// ADR-0024 Phase 2 update: the header comment this file originally shipped
// with predicted exactly this — "the same {subject -> state} pattern
// extends naturally to {subject -> strand -> state}" — and that's now
// implemented below as `bySubStrand`, additive, only populated where
// confirmed evidence carries a real, resolved sub_strand_id (Sprint A/B/C's
// canonical curriculum identity on learner_evidence). No threshold, no
// fabrication — a missing entry means no strand-level evidence exists yet,
// not "not ready"; that judgment belongs to ARDS (ADR-0023), not here.

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { Projection, KnowledgeValue } from './types'
import { computeCoverage, computeProjectionConfidence, latestEvidencePerKey } from './coverage'

export const KNOWLEDGE_PROJECTION_VERSION = 'knowledge-v1'

export function projectKnowledge(evidence: EvidenceRow[], now: Date = new Date()): Projection<KnowledgeValue> | null {
  const scored = evidence.filter(e => e.cbc_level !== null)
  if (scored.length === 0) return null

  const latestBySubject = latestEvidencePerKey(scored, e => e.subject)

  const bySubject: KnowledgeValue['bySubject'] = {}
  for (const [subject, e] of latestBySubject) {
    bySubject[subject] = { currentLevel: e.cbc_level as 1 | 2 | 3 | 4, asOf: e.created_at }
  }

  const latestBySubStrand = latestEvidencePerKey(scored, e => e.sub_strand_id)

  const bySubStrand: KnowledgeValue['bySubStrand'] = {}
  for (const [subStrandId, e] of latestBySubStrand) {
    bySubStrand[subStrandId] = {
      subStrandId,
      subStrandTitle: e.sub_strand,
      strandTitle: e.strand,
      subject: e.subject,
      currentLevel: e.cbc_level as 1 | 2 | 3 | 4,
      asOf: e.created_at,
    }
  }

  // Union, deduplicated by id — a sub-strand's own latest row can be a
  // different (older) row than its subject's overall latest row, so it
  // isn't guaranteed to already be in latestBySubject. Every row actually
  // used to compute either bySubject or bySubStrand must be represented,
  // per the Projection Engine's own invariant that supportingEvidenceIds
  // is real and only the evidence actually used — no more, no less.
  const supportingById = new Map<string, EvidenceRow>()
  for (const e of latestBySubject.values()) supportingById.set(e.id, e)
  for (const e of latestBySubStrand.values()) supportingById.set(e.id, e)
  const supporting = [...supportingById.values()]

  return {
    value: { bySubject, bySubStrand },
    supportingEvidenceIds: supporting.map(e => e.id),
    confidence: computeProjectionConfidence(supporting),
    coverage: computeCoverage(supporting, now),
    lastComputed: now.toISOString(),
    projectionVersion: KNOWLEDGE_PROJECTION_VERSION,
  }
}
