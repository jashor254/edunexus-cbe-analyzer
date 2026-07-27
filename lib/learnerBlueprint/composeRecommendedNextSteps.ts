// lib/learnerBlueprint/composeRecommendedNextSteps.ts
//
// Recommended Next Steps -> Parent Action Centre (Sprint 12S, Phase 5).
//
// Phase 1 cutover (docs/architecture/blueprint-living-action-plan-audit.md
// §"Resolve composeRecommendedNextSteps explicitly" — mandatory, not
// optional): this composer no longer runs the legacy selector
// unconditionally. It first checks whether the learner has any
// teacher-approved, parent-visible Blueprint action items
// (`lib/learnerBlueprint/actionPlan/`'s canonical table). If so, THIS
// becomes a pure read projection over those canonical items — the legacy
// `composeParentActions()` selector is not called at all, so there is
// never a moment where both sources are shown together (Phase 1's own
// rule: "do not silently run both outputs together"). Only when a
// learner has zero approved canonical action items does this composer
// fall back to the original stateless selector — explicitly the
// compatibility path, not a permanent parallel source of truth. Once
// every pilot teacher is using the action-plan workflow, the fallback
// branch is expected to stop firing in practice; removing it entirely is
// a future phase's decision, not this one's — Phase 1 only guarantees the
// two paths never compete for the same learner at the same time.

import { composeParentActions } from '@/lib/parentExperience/actions'
import { listApprovedParentActionsForLearner } from './actionPlan/projections'
import { getLatestBlueprintSnapshot } from './snapshot'
import type {
  BlueprintSection,
  RecommendedNextStepsData,
  LearningCompassData,
  TeacherReflectionData,
  AttendanceData,
  CareerData,
} from './types'
import type { ParentAction } from '@/lib/parentExperience/actions'

const OWNER = 'lib/learnerBlueprint/actionPlan (canonical, when approved items exist) | lib/parentExperience/actions.composeParentActions (compatibility fallback)'

export async function composeRecommendedNextSteps(
  coreLearnerId: string,
  schoolId: string,
  learningCompass: BlueprintSection<LearningCompassData>,
  teacherReflection: BlueprintSection<TeacherReflectionData>,
  attendance: BlueprintSection<AttendanceData>,
  career: BlueprintSection<CareerData>
): Promise<BlueprintSection<RecommendedNextStepsData>> {
  try {
    // Canonical path, checked first — never merged with the legacy
    // selector's output.
    const canonicalActions = await listApprovedParentActionsForLearner(coreLearnerId, schoolId)
    if (canonicalActions.length > 0) {
      const generatedAt = new Date().toISOString()
      const actions: ParentAction[] = canonicalActions.map(view => ({
        title: view.title,
        description: view.observation,
        actionType: 'canonical_action_item',
        // `ParentSafeActionView` deliberately doesn't carry the item's raw
        // priority (Phase 4's stakeholder-language design owns how/whether
        // priority is framed to a parent) — 'important' is a fixed,
        // conservative default here, never 'critical', so a canonical item
        // never silently claims the legacy selector's single-critical-slot
        // precedence (composeParentActions.ts's own CRITICAL_PRECEDENCE
        // logic, which this cutover path doesn't run at all).
        priority: 'important',
        sourceDomain: 'Blueprint Action Plan',
        destination: `/child/${coreLearnerId}/full`,
        available: true,
        reasonUnavailable: null,
        generatedAt,
      }))
      return { status: 'available', owner: OWNER, freshness: 'live', data: { actions } }
    }

    // Compatibility fallback — unchanged legacy behavior, used only when
    // no canonical action items exist yet for this learner.
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
