// lib/parentExperience/terminology.ts
//
// The one shared vocabulary layer ADR-0010 Part 4 freezes — a pure lookup,
// never a calculation. Every Parent Portal screen must use these labels
// instead of an internal status/freshness enum value verbatim (ADR-0010
// Part 6: "internal architecture is never parent-facing"). Nothing here
// reads data, computes a value, or makes an educational judgment — it only
// renames values Blueprint already produced.

import type { BlueprintSectionStatus, SectionFreshness } from '@/lib/learnerBlueprint/types'

export const PARENT_STATUS_LABEL: Record<BlueprintSectionStatus, string> = {
  available: 'Ready',
  unavailable: 'Not Enough Information Yet',
  not_implemented: 'Not Enough Information Yet',
}

export const PARENT_FRESHNESS_LABEL: Record<SectionFreshness, string> = {
  live: 'Up to Date',
  snapshot: 'A Moment in Their Journey',
  historical: 'A Moment in Their Journey',
}

/** ADR-0010 Part 4's frozen table — extend only under the same review discipline as the ADR itself. */
export const PARENT_TERM_LABEL: Record<string, string> = {
  'Capability Projection': 'Learning Strengths',
  'Risk Index': 'Needs Extra Support',
  'Risk Flag': 'Needs Extra Support',
  'Attendance Percentage': 'Learning Time',
  'Overall Trend: declining': 'An Area to Focus On Together',
  'Overall Trend: improving': 'Growing Well',
  'Career Cluster': 'An Area They Are Exploring',
  Evidence: "What We've Seen So Far",
}
