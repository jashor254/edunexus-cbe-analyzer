// lib/learnerBlueprint/readSection.ts
//
// Reading a section off a Blueprint that may predate that section.
//
// Why this is needed
// ------------------
// `blueprint_snapshots.blueprint_payload` stores whatever `LearnerBlueprint`
// looked like on the day it was taken, and it is read back by casting JSON to
// the CURRENT type. Every section added after a snapshot was written is
// therefore `undefined` at runtime while the type insists it is present — so
// `blueprint.newSection.status` is a TypeError, not a false.
//
// This is not hypothetical: adding `pathwayReadiness` put 117 stored snapshots
// one property access away from crashing the parent's Blueprint history page.
// `resolveGradeBand()` already solves the same problem for `metadata.gradeBand`;
// this is the general form for whole sections.
//
// Use this instead of `blueprint.<section>` anywhere a stored snapshot can be
// the source — which is every renderer, since the same components render both
// live and historical Blueprints.

import type { BlueprintSection } from './types'

/**
 * A section that did not exist when this Blueprint was composed.
 *
 * Deliberately `unavailable` with an explicit reason rather than a silent
 * empty state: a parent looking at last term's report should be told the
 * section is missing because it did not exist yet, not left wondering why it
 * is blank.
 */
export function sectionNotInSnapshot<T>(sectionName: string): BlueprintSection<T> {
  return {
    status: 'unavailable',
    owner: 'lib/learnerBlueprint/readSection.sectionNotInSnapshot',
    freshness: 'historical',
    data: null,
    unavailableReason: `This report was generated before ${sectionName} existed, so it carries no ${sectionName} data. It is shown as it was written.`,
  }
}

/**
 * Read a section that may be absent from an older stored payload.
 *
 * The cast is unavoidable — the input is JSON claiming to be a
 * `LearnerBlueprint` — so it is confined here rather than repeated at every
 * call site.
 */
export function readSection<T>(
  section: BlueprintSection<T> | undefined | null,
  sectionName: string,
): BlueprintSection<T> {
  if (!section || typeof section !== 'object' || !('status' in section)) {
    return sectionNotInSnapshot<T>(sectionName)
  }
  return section
}
