// lib/learnerBlueprint/composeRecommendedNextSteps.ts
//
// Recommended Next Steps -> Parent Action Centre (Sprint 12S, Phase 5).
// Thin composer, matching every other Blueprint section's shape — the
// actual selection logic lives entirely in
// `lib/parentExperience/actions.ts`'s `composeParentActions()`, called
// exactly once here. This composer performs no selection itself: it only
// passes this Blueprint's own already-composed sibling sections (never a
// second read of any canonical domain) and the latest Blueprint Snapshot
// through to that one pure function.

import { composeParentActions } from '@/lib/parentExperience/actions'
import { getLatestBlueprintSnapshot } from './snapshot'
import type {
  BlueprintSection,
  RecommendedNextStepsData,
  LearningCompassData,
  TeacherReflectionData,
  AttendanceData,
  CareerData,
} from './types'

const OWNER = 'lib/parentExperience/actions.composeParentActions'

export async function composeRecommendedNextSteps(
  coreLearnerId: string,
  schoolId: string,
  learningCompass: BlueprintSection<LearningCompassData>,
  teacherReflection: BlueprintSection<TeacherReflectionData>,
  attendance: BlueprintSection<AttendanceData>,
  career: BlueprintSection<CareerData>
): Promise<BlueprintSection<RecommendedNextStepsData>> {
  try {
    // The only DB read this composer performs — the one signal
    // `composeParentActions()` needs that isn't already one of Blueprint's
    // own sibling sections (ADR-0008 Part 3: Snapshots are Blueprint's own
    // downstream artifact, not a second canonical domain).
    const latestSnapshot = await getLatestBlueprintSnapshot(coreLearnerId, schoolId)

    const { actions } = composeParentActions({
      learnerId: coreLearnerId,
      learningCompass,
      teacherReflection,
      attendance,
      career,
      latestSnapshot,
    })

    return { status: 'available', owner: OWNER, freshness: 'live', data: { actions } }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Recommended Next Steps composition failed',
    }
  }
}
