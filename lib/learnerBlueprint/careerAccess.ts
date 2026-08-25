// lib/learnerBlueprint/careerAccess.ts
//
// Blueprint's Career acquisition boundary — mirrors projectionAccess.ts's
// shape exactly. The one place composeBlueprint() calls
// getCareerBlueprintSummary() (lib/learnerIntelligence/
// careerIntelligenceOrchestration.ts, the canonical Career read for
// Blueprint per composeCareer.ts's own header comment) so composeCareer.ts
// itself never needs to import Career infrastructure to be composed from
// already-resolved data.

import { getCareerBlueprintSummary } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import type { CareerBlueprintSummary } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import type { StudentId } from '@/lib/core/identityTypes'

export type CareerAccessResult = {
  summary: CareerBlueprintSummary | null
  error: unknown | null
}

export async function loadCareerAccess(legacyStudentId: StudentId | null): Promise<CareerAccessResult> {
  if (!legacyStudentId) return { summary: null, error: null }

  try {
    return {
      summary: await getCareerBlueprintSummary(legacyStudentId),
      error: null,
    }
  } catch (error) {
    return { summary: null, error }
  }
}
