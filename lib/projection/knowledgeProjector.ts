// lib/projection/knowledgeProjector.ts
// Current mastery state per subject — "what does this learner currently
// know," a snapshot, independent of trend (Academic) or normalized
// capability bucketing (Capability). Deliberately the simplest projector:
// today's evidence carries no strand/topic granularity (only subject-level
// CBC scores from CSV import), so knowledge state is subject-level, not
// topic-level. A future evidence source with strand/topic data (e.g. a
// Topical Assessment evidence source) would let this projector go deeper
// without changing its shape — the same {subject -> state} pattern extends
// naturally to {subject -> strand -> state}.

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { Projection, KnowledgeValue } from './types'
import { computeCoverage, computeProjectionConfidence } from './coverage'

export const KNOWLEDGE_PROJECTION_VERSION = 'knowledge-v1'

export function projectKnowledge(evidence: EvidenceRow[], now: Date = new Date()): Projection<KnowledgeValue> | null {
  const scored = evidence.filter(e => e.cbc_level !== null)
  if (scored.length === 0) return null

  const latestBySubject = new Map<string, EvidenceRow>()
  for (const e of scored) {
    const existing = latestBySubject.get(e.subject)
    if (!existing || new Date(e.created_at) > new Date(existing.created_at)) latestBySubject.set(e.subject, e)
  }

  const bySubject: KnowledgeValue['bySubject'] = {}
  for (const [subject, e] of latestBySubject) {
    bySubject[subject] = { currentLevel: e.cbc_level as 1 | 2 | 3 | 4, asOf: e.created_at }
  }

  const supporting = [...latestBySubject.values()]
  return {
    value: { bySubject },
    supportingEvidenceIds: supporting.map(e => e.id),
    confidence: computeProjectionConfidence(supporting),
    coverage: computeCoverage(supporting, now),
    lastComputed: now.toISOString(),
    projectionVersion: KNOWLEDGE_PROJECTION_VERSION,
  }
}
