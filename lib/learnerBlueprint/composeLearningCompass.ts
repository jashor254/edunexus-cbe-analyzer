// lib/learnerBlueprint/composeLearningCompass.ts
//
// Learning Compass -> one canonical read only (ADR-0006 §3, Sprint 12M):
// `getLearningCompassSummary()` (lib/compass/summary.ts). This composer
// surfaces Compass's exactly-once call — it never queries `getNextSubject`
// or the holiday-plan repository directly (that consolidation is Sprint
// 12M's own change; the previous version of this file called both
// separately, and duplicated `HOLIDAY_PLAN_RELEVANCE_DAYS` locally with a
// stale value (90) that disagreed with the canonical constant (45,
// lib/holiday/types.ts) — fixed by removing the duplicate and importing the
// shared constant inside the new summary function instead).
//
// Learning Readiness stays null: no Compass-owned function producing a
// readiness label (or even a raw score) exists — never fabricated.
// Holiday Programme stays a single boolean, exactly ADR-0006 §3's frozen
// field ("Holiday Programme availability") — duration/start date/schedule
// are not part of this section (see sprint-12m doc §5 for why).
// This composer never calls anything that computes mastery, sessions, or
// tutoring content — those stay exclusively inside Compass's own surface.
//
// Blueprint Section Access Boundary Fix — this composer no longer calls
// getLearningCompassSummary() itself. composeBlueprint() (the only real
// caller) resolves it once via compassAccess.ts's loadCompassAccess() and
// passes the result in, so importing composeLearningCompass.ts alone never
// boots Compass infrastructure. No caller currently relies on an internal
// self-fetch fallback (confirmed: composeLearningCompass's only callers are
// composeBlueprint.ts and composeBlueprint.pure.test.ts's null-guard test),
// so none is retained here — see compassAccess.ts if a future caller needs
// one.

import type { BlueprintSection, LearningCompassData } from './types'
import type { StudentId } from '@/lib/core/identityTypes'
import type { CompassAccessResult } from './compassAccess'

const OWNER = 'lib/compass/summary.getLearningCompassSummary'

export async function composeLearningCompass(
  legacyStudentId: StudentId | null,
  compassAccess: CompassAccessResult | null = null
): Promise<BlueprintSection<LearningCompassData>> {
  if (!legacyStudentId) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: 'No legacy student identity bridged for this learner — Compass cannot be queried.',
    }
  }

  try {
    if (compassAccess?.error) throw compassAccess.error
    const summary = compassAccess?.summary

    if (!summary) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: 'Learning Compass data is not yet available for this learner.',
      }
    }

    const data: LearningCompassData = {
      currentLearningFocus: summary.nextSubject
        ? { subject: summary.nextSubject.subject, subtopic: summary.nextSubject.subtopic }
        : null,
      nextRecommendedAction: summary.nextSubject
        ? `Continue with ${summary.nextSubject.subject}${summary.nextSubject.subtopic ? ` — ${summary.nextSubject.subtopic}` : ''}`
        : null,
      holidayProgrammeAvailable: summary.holidayProgrammeAvailable,
      learningReadiness: null,
      notes: [
        'Learning Readiness (ADR-0006 §3) has no Compass-owned source function yet — left null, not guessed.',
      ],
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Learning Compass composition failed',
    }
  }
}
