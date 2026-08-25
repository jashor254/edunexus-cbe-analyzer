// lib/learnerBlueprint/compassAccess.ts
//
// Blueprint's Learning Compass acquisition boundary — mirrors
// projectionAccess.ts's shape exactly. The one place composeBlueprint()
// calls getLearningCompassSummary() (lib/compass/summary.ts, the canonical
// Compass read for Blueprint per composeLearningCompass.ts's own header
// comment) so composeLearningCompass.ts itself never needs to import
// Compass infrastructure to be composed from already-resolved data.

import { getLearningCompassSummary } from '@/lib/compass/summary'
import type { LearningCompassSummary } from '@/lib/compass/summary'
import type { StudentId } from '@/lib/core/identityTypes'

export type CompassAccessResult = {
  summary: LearningCompassSummary | null
  error: unknown | null
}

export async function loadCompassAccess(legacyStudentId: StudentId | null): Promise<CompassAccessResult> {
  if (!legacyStudentId) return { summary: null, error: null }

  try {
    return {
      summary: await getLearningCompassSummary(legacyStudentId),
      error: null,
    }
  } catch (error) {
    return { summary: null, error }
  }
}
