import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import type { LearnerIntelligenceProjection } from '@/lib/projection/types'

export type ProjectionAccessResult = {
  projection: LearnerIntelligenceProjection | null
  error: unknown | null
}

export async function loadProjectionAccess(
  legacyStudentId: string | null
): Promise<ProjectionAccessResult> {
  if (!legacyStudentId) return { projection: null, error: null }

  try {
    return {
      projection: await recomputeLearnerProjection(legacyStudentId),
      error: null,
    }
  } catch (error) {
    return { projection: null, error }
  }
}
