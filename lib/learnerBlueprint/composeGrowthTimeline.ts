// lib/learnerBlueprint/composeGrowthTimeline.ts
//
// Growth Timeline -> Projection Engine's `growth` projection, exclusively
// (mirrors composeAcademicRecord.ts's Projection-only discipline, ADR-0005
// §2.2 / RAS §9). The Projection Engine computes one aggregate growth
// window per learner (earliest/latest score, delta, trend) — not a log of
// discrete dated events — so this composer surfaces that one real window
// as a single GrowthTimelineEntry rather than fabricating a multi-entry
// history the platform does not track.

import type { BlueprintSection, GrowthTimelineEntry } from './types'
import type { ProjectionAccessResult } from './projectionAccess'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import type { StudentId } from '@/lib/core/identityTypes'

const OWNER = 'lib/projection/recompute.recomputeLearnerProjection'

export async function composeGrowthTimeline(
  legacyStudentId: StudentId | null,
  projectionAccess?: ProjectionAccessResult
): Promise<BlueprintSection<GrowthTimelineEntry[]>> {
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
    const growth = projection.growth

    if (!growth) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: 'There is not yet enough scored evidence to describe a growth timeline.',
      }
    }

    if (
      growth.value.windowStart === null ||
      growth.value.windowEnd === null ||
      growth.value.earliestScore === null ||
      growth.value.latestScore === null ||
      growth.value.delta === null
    ) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: 'Growth direction remains provisional until at least two scored evidence points are available.',
      }
    }

    const percent = (score: number) => `${Math.round(score * 100)}%`
    const trendLabel = growth.value.trend === 'improving'
      ? 'Current evidence suggests upward movement across the available scored evidence.'
      : growth.value.trend === 'declining'
        ? 'Current evidence suggests downward movement across the available scored evidence.'
        : 'Current evidence suggests a stable pattern across the available scored evidence.'

    const data: GrowthTimelineEntry[] = [{
      windowStart: growth.value.windowStart,
      windowEnd: growth.value.windowEnd,
      direction: growth.value.trend,
      earliestScore: growth.value.earliestScore,
      latestScore: growth.value.latestScore,
      delta: growth.value.delta,
      trajectory: `${trendLabel} The visible window moves from ${percent(growth.value.earliestScore)} to ${percent(growth.value.latestScore)} (${growth.value.delta >= 0 ? '+' : ''}${Math.round(growth.value.delta * 100)} points).`,
      supportingEvidenceIds: growth.supportingEvidenceIds,
      confidence: growth.confidence,
      coverage: growth.coverage,
    }]

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Growth Timeline composition failed',
    }
  }
}
