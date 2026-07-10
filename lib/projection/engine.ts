// lib/projection/engine.ts
// The Projection Engine core: a pure function from (learnerId, confirmed
// evidence) to a LearnerIntelligenceProjection. No database access here —
// that's persistence.ts's job. This separation is what makes "given only
// Evidence and Projection Rules, recreate the identical projection" true by
// construction: this function has no other inputs to depend on.

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { LearnerIntelligenceProjection } from './types'
import { projectAcademic } from './academicProjector'
import { projectCapability } from './capabilityProjector'
import { projectKnowledge } from './knowledgeProjector'
import { projectBehaviour } from './behaviourProjector'
import { projectGrowth } from './growthProjector'
import { projectRisk } from './riskProjector'
import { projectCompleteness } from './completenessProjector'
import { projectCapabilityV2 } from './capabilityV2Projector'
import { projectTrend } from './trendProjector'
import { projectKnowledgeV2 } from './knowledgeV2Projector'

export function computeLearnerProjection(
  learnerId: string,
  evidence: EvidenceRow[],
  now: Date = new Date(),
): LearnerIntelligenceProjection {
  return {
    learnerId,
    academic: projectAcademic(evidence, now),
    capability: projectCapability(evidence, now),
    knowledge: projectKnowledge(evidence, now),
    behaviour: projectBehaviour(evidence, now),
    growth: projectGrowth(evidence, now),
    risk: projectRisk(evidence, now),
    completeness: projectCompleteness(evidence, now),
    // Projection V2 — additive, does not alter any field above.
    capabilityV2: projectCapabilityV2(evidence, now),
    trendV2: projectTrend(evidence, now),
    knowledgeV2: projectKnowledgeV2(evidence, now),
  }
}
