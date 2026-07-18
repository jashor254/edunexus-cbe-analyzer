// lib/learnerBlueprint/composeGrowthTimeline.ts
//
// Growth Timeline -> placeholder only, per explicit Sprint 12G
// instruction: "Return [] or equivalent placeholder. No events. No
// history. No timeline generation. Future sprint." ADR-0008 Part 1/§1
// (companion doc) reserves this as a future extension point. Always
// `not_implemented`, data is always [].

import type { BlueprintSection, GrowthTimelineEntry } from './types'

const OWNER = 'unassigned — reserved future extension point (ADR-0006 §10, ADR-0008 Part 1)'

export function composeGrowthTimeline(): BlueprintSection<GrowthTimelineEntry[]> {
  return {
    status: 'not_implemented',
    owner: OWNER,
    freshness: 'historical',
    data: [],
    unavailableReason: 'Growth Timeline generation is a future sprint — this always returns an empty, non-fabricated list.',
  }
}
