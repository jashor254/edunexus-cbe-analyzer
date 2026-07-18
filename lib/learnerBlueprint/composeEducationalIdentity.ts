// lib/learnerBlueprint/composeEducationalIdentity.ts
//
// Educational Identity -> placeholder only, per explicit Sprint 12G
// instruction: "Do NOT invent algorithms. Do NOT classify learners.
// Do NOT use AI." ADR-0006 §9 deliberately left the owning domain
// undecided — this composer must not pre-empt that decision by guessing
// one. Always `not_implemented`.

import type { BlueprintSection, EducationalIdentityData } from './types'

const OWNER = 'unassigned — owning domain deliberately undecided (ADR-0006 §9)'

export function composeEducationalIdentity(): BlueprintSection<EducationalIdentityData> {
  return {
    status: 'not_implemented',
    owner: OWNER,
    freshness: 'live',
    data: null,
    unavailableReason: 'Educational Identity is architecture-only per ADR-0006 §9 — no computation exists or should be invented here.',
  }
}
