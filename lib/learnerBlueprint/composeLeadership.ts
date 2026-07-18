// lib/learnerBlueprint/composeLeadership.ts
//
// Leadership -> one canonical read only (mission Phase 6). Reads via
// `getLeadershipSummary()` (lib/learnerLeadership/leadership.ts) only —
// never the repository or raw tables directly, and never more than the
// summary shape that function already caps itself to (current role,
// completed role count, latest completed role, URL). Blueprint never
// renders a full Leadership entry, never exposes review notes, election
// data, meeting history, mentor comments, or disciplinary information —
// the identical discipline composeCompetitions.ts/composeAchievement.ts
// already apply.
//
// Leadership is keyed on the Core learner directly (`learners.id`), like
// Portfolio/Achievement/Projects/Competitions — no legacy `students.id`
// space to resolve.

import { getLeadershipSummary } from '@/lib/learnerLeadership/leadership'
import type { BlueprintSection, LeadershipData } from './types'

const OWNER = 'lib/learnerLeadership/leadership.getLeadershipSummary'

export async function composeLeadership(coreLearnerId: string, schoolId: string): Promise<BlueprintSection<LeadershipData>> {
  try {
    const summary = await getLeadershipSummary(coreLearnerId, schoolId)

    if (!summary.available) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: 'This learner has no published or current leadership roles yet.',
      }
    }

    const data: LeadershipData = {
      currentRole: summary.currentRole,
      completedRoleCount: summary.completedRoleCount,
      latestCompletedRole: summary.latestCompletedRole,
      leadershipUrl: summary.leadershipUrl,
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Leadership composition failed',
    }
  }
}
