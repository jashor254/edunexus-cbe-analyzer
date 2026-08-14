// lib/learnerBlueprint/composeCareer.ts
//
// Career -> one canonical read only (ADR-0005 §2.5, ADR-0006 Decisions #3,
// Sprint 12N). Reads via `getCareerBlueprintSummary()`
// (lib/learnerIntelligence/careerIntelligence.ts) only — never
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

import { getCareerBlueprintSummary } from '@/lib/learnerIntelligence/careerIntelligence'
import type { BlueprintSection, CareerData } from './types'
import type { StudentId } from '@/lib/core/identityTypes'

const OWNER = 'lib/learnerIntelligence/careerIntelligence.getCareerBlueprintSummary'

const INSUFFICIENT_EVIDENCE_REASON =
  'More learning evidence is needed before Career Intelligence can provide reliable guidance.'

export async function composeCareer(
  legacyStudentId: StudentId | null
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
    const summary = await getCareerBlueprintSummary(legacyStudentId)

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
