import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import type { BlueprintSection, RiskData } from './types'
import type { ProjectionAccessResult } from './projectionAccess'
import type { StudentId } from '@/lib/core/identityTypes'

const OWNER = 'lib/projection/recompute.recomputeLearnerProjection'

export async function composeRisk(
  legacyStudentId: StudentId | null,
  projectionAccess?: ProjectionAccessResult
): Promise<BlueprintSection<RiskData>> {
  if (!legacyStudentId) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: 'No legacy student identity bridged for this learner (see learner-record-layer-decisions.md Decision 3) — Projection Engine cannot be queried.',
    }
  }

  try {
    if (projectionAccess?.error) throw projectionAccess.error
    const projection = projectionAccess?.projection ?? await recomputeLearnerProjection(legacyStudentId)
    const risk = projection.risk

    if (!risk) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: 'There is not yet enough scored evidence to describe current risk exposure.',
      }
    }

    return {
      status: 'available',
      owner: OWNER,
      freshness: 'live',
      data: {
        overallRiskLevel: risk.value.overallRiskLevel,
        flags: risk.value.flags,
        supportingEvidenceIds: risk.supportingEvidenceIds,
        confidence: risk.confidence,
        coverage: risk.coverage,
        lastComputed: risk.lastComputed,
      },
    }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Risk composition failed',
    }
  }
}
