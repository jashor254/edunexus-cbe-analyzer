// lib/learnerBlueprint/composeMetadata.ts
//
// Metadata -> Blueprint lifecycle helper (ADR-0008 Part 1/Part 2). Pure
// presentation of provenance — no persistence, no table read, no domain
// calculation. `freshness` reflects whether every included section
// actually composed successfully, so a consumer never mistakes a
// partially-unavailable Blueprint for a fully live one.

import type { BlueprintMetadata } from './types'

export const BLUEPRINT_VERSION = '1.0.0-composition-engine'

export function composeMetadata(input: {
  sectionStatuses: Array<'available' | 'unavailable' | 'not_implemented'>
  ownerVersions: Record<string, string>
  evidenceWindowStart: string | null
}): BlueprintMetadata {
  const anyUnavailableOrNotImplemented = input.sectionStatuses.some(s => s !== 'available')

  return {
    blueprintVersion: BLUEPRINT_VERSION,
    generatedAt: new Date().toISOString(),
    // This composer only ever produces the live, current composition —
    // Snapshot-taking (ADR-0008 Part 3) is a distinct future concern with
    // its own trigger moments, not something this engine decides for itself.
    snapshotState: 'current',
    freshness: anyUnavailableOrNotImplemented ? 'partial' : 'live',
    evidenceWindow: { start: input.evidenceWindowStart, end: new Date().toISOString() },
    ownerVersions: input.ownerVersions,
  }
}
