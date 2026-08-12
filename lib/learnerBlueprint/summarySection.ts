// lib/learnerBlueprint/summarySection.ts
//
// The one shared shape behind every "read one owning domain's own summary
// function and wrap it in a BlueprintSection" composer. Six of these
// existed as separate near-identical files (Portfolio, Achievement,
// Projects, Competitions, Leadership, Innovation), each repeating the same
// thirty lines: call the summary, return `unavailable` when the domain says
// it has nothing, map the capped fields, and turn any throw into an
// `unavailable` section so one domain failing never destroys the whole
// Blueprint (ADR-0008's failure model).
//
// This helper owns that shape once. It deliberately does NOT own the field
// mapping — each caller still names exactly the fields Blueprint is allowed
// to surface, so the "never render more than the domain's own capped
// summary" discipline stays visible at the call site rather than hidden
// behind a generic.

import type { BlueprintSection } from './types'

/** Every domain summary function Blueprint reads reports its own availability. */
type DomainSummary = { available: boolean }

export async function composeSummarySection<TSummary extends DomainSummary, TData>(args: {
  /** The owning domain function's fully-qualified identifier, for traceability (ADR-0008 Part 9). */
  owner: string
  /** Reads the owning domain's own canonical summary — never a repository, never a raw table. */
  load: () => Promise<TSummary>
  /** Names exactly the fields Blueprint may surface. Only called when the domain reports `available`. */
  map: (summary: TSummary) => TData
  /** Learner-facing sentence for the "this learner has nothing here yet" case. */
  emptyReason: string
  /** Fallback message when the domain read throws. */
  failureReason: string
}): Promise<BlueprintSection<TData>> {
  try {
    const summary = await args.load()

    if (!summary.available) {
      return {
        status: 'unavailable',
        owner: args.owner,
        freshness: 'live',
        data: null,
        unavailableReason: args.emptyReason,
      }
    }

    return { status: 'available', owner: args.owner, freshness: 'live', data: args.map(summary) }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: args.owner,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : args.failureReason,
    }
  }
}
