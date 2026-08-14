import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import type { LearnerIntelligenceProjection } from '@/lib/projection/types'
import type { StudentId } from '@/lib/core/identityTypes'

export type ProjectionAccessResult = {
  projection: LearnerIntelligenceProjection | null
  error: unknown | null
}

export async function loadProjectionAccess(
  legacyStudentId: StudentId | null
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
