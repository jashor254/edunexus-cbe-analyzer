// lib/learnerBlueprint/legacyBridgeAccess.ts
//
// The Blueprint's resilience boundary for the one read that runs *before*
// the composer layer: the Core<->legacy bridge resolution. A sibling of
// projectionAccess.ts / careerAccess.ts / compassAccess.ts — a thin,
// catch-and-degrade wrapper so importing this file (and testing it) boots
// only `@/lib/core/identity`, never the full composer graph.
//
// Every composer already turns its own failure into an `unavailable`
// section (ADR-0008's failure model — see composeSummarySection and each
// composer's catch), so one domain failing never destroys the Blueprint.
// But that guarantee begins only once the composers run. The legacy-bridge
// resolution happens before them, so a *rejected* bridge lookup (a genuine
// query/infrastructure failure — never the ordinary "no bridge yet" case,
// which resolveLegacyStudentId already returns as null) would throw the
// whole Blueprint away before a single section is composed.
//
// A null bridge is already a first-class, handled state everywhere
// downstream: a newly-enrolled learner with no legacy row composes a
// Blueprint whose legacy-space sections are `unavailable` and whose
// Core-space sections stay live. So a failed lookup degrades to that same
// null — the teacher gets a Blueprint instead of a 500, and the failure is
// logged, not swallowed. This extends the per-composer resilience to the
// pre-composer read rather than adding a second, competing safety layer.

import { resolveLegacyStudentId } from '@/lib/core/identity'
import type { LearnerId } from '@/lib/core/identityTypes'

export async function resolveLegacyStudentIdOrDegrade(
  coreLearnerId: LearnerId,
): Promise<Awaited<ReturnType<typeof resolveLegacyStudentId>>> {
  try {
    return await resolveLegacyStudentId(coreLearnerId)
  } catch (error) {
    console.error(
      '[learnerBlueprint/legacyBridgeAccess] legacy bridge lookup failed — composing with legacy-space sections unavailable',
      {
        coreLearnerId,
        message: error instanceof Error ? error.message : String(error),
      },
    )
    return null
  }
}
