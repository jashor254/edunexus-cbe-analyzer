// lib/learnerBlueprint/composeCareer.ts
//
// Career -> one canonical read only (ADR-0005 §2.5, ADR-0006 Decisions #3,
// Sprint 12N). Reads via `getCareerBlueprintSummary()`
// (lib/learnerIntelligence/careerIntelligenceOrchestration.ts) only — never
// `computeCapabilityMatches`/`capabilityExtractor`/Projection directly,
// never the deprecated `careerEngine.getMatchesForStudent()` persisted-table
// path this composer used before Sprint 12N (see sprint-12n doc §1 for why
// that path was deprecated: it read AI-generated, ungated matches that
// disagreed with the evidence-first pipeline every other Career surface —
// the student Career Explorer, Parent Career Intelligence, Holiday
// Planner — already uses via `buildCareerIntelligence()`, and it showed a
// specific predicted career to Junior learners in violation of the Career
// Principle `buildCareerIntelligence()` already correctly enforces).
//
// Only the single top cluster/direction is surfaced — never the full
// families/matches list, never a specific career/job title (ADR-0006 §4,
// this sprint's Architectural Goal: orientation, not job selection).
//
// Blueprint Section Access Boundary Fix — this composer no longer calls
// getCareerBlueprintSummary() itself. composeBlueprint() (the only real
// caller) resolves it once via careerAccess.ts's loadCareerAccess() and
// passes the result in, so importing composeCareer.ts alone never boots
// Career infrastructure. No caller currently relies on an internal
// self-fetch fallback (confirmed: composeCareer's only callers are
// composeBlueprint.ts and composeBlueprint.pure.test.ts's null-guard test),
// so none is retained here — see careerAccess.ts if a future caller needs
// one.

import type { BlueprintSection, CareerData } from './types'
import type { StudentId } from '@/lib/core/identityTypes'
import type { CareerAccessResult } from './careerAccess'

const OWNER = 'lib/learnerIntelligence/careerIntelligenceOrchestration.getCareerBlueprintSummary'

const INSUFFICIENT_EVIDENCE_REASON =
  'More learning evidence is needed before Career Intelligence can provide reliable guidance.'

export async function composeCareer(
  legacyStudentId: StudentId | null,
  careerAccess: CareerAccessResult | null = null
): Promise<BlueprintSection<CareerData>> {
  if (!legacyStudentId) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: 'No legacy student identity bridged for this learner — Career Intelligence cannot be queried.',
    }
  }

  try {
    if (careerAccess?.error) throw careerAccess.error
    const summary = careerAccess?.summary ?? null

    if (!summary) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: INSUFFICIENT_EVIDENCE_REASON,
      }
    }

    const data: CareerData = {
      careerCluster: summary.careerCluster,
      strengthProfile: summary.strengthProfile,
      futureDirection: summary.futureDirection,
      aiOutlook: summary.aiOutlook,
      confidence: summary.confidence,
      doorsPreview: summary.doorsPreview,
      aiChangeSummary: summary.aiChangeSummary,
      humanAdvantageSummary: summary.humanAdvantageSummary,
      explorationSuggestions: summary.explorationSuggestions,
      knowledge: summary.knowledge,
      notes: [
        ...(summary.knowledge && summary.knowledge.freshness === 'stale'
          ? ['The career knowledge behind this section is out of date and is shown with its confirmation date rather than as current.']
          : []),
        ...(summary.knowledge && summary.knowledge.freshness === 'unknown'
          ? ['We have no record of when this career\'s figures were last confirmed.']
          : []),
        ...(summary.aiOutlook === null ? ['AI Outlook has no canonical cluster-level source yet — left null, not guessed.'] : []),
        ...(summary.version === null ? ['No canonical algorithm-version export exists yet for Career Intelligence matching — left null, not invented.'] : []),
      ],
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Career Intelligence composition failed',
    }
  }
}
