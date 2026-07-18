// lib/compass/summary.ts
//
// The one canonical external read for Learning Compass — Sprint 12M, ADR-0006
// §3's five frozen Blueprint fields (Current Learning Focus, Learning
// Readiness, Holiday Programme availability, Next Recommended Action, QR).
// Any consumer outside Compass's own surface (today: Learner Blueprint) that
// needs "what is this learner's current Compass state" calls this one
// function, never `getNextSubject` and the holiday-plan repository read
// separately — this is the encapsulation boundary RAS §10.7/§10.8 requires:
// one owner, called once, per consumer.
//
// Pure domain output only: no presentation, no formatting, no QR, no UI.

import { getNextSubject, type NextSubject } from './session'
import { repos } from '@/lib/repositories'
import { HOLIDAY_PLAN_RELEVANCE_DAYS } from '@/lib/holiday/types'

export type LearningCompassSummary = {
  /** Compass's own next-topic decision — subject/subtopic/reason, unchanged from `getNextSubject`. Null only when Compass genuinely has nothing to recommend. */
  nextSubject: NextSubject | null
  /**
   * Whether a currently-relevant published Holiday Programme exists for this
   * learner. A single boolean — this is the entire Holiday Programme surface
   * ADR-0006 §3 froze for Blueprint; no other holiday field (duration,
   * start date, schedule) is part of this canonical output.
   */
  holidayProgrammeAvailable: boolean
}

export async function getLearningCompassSummary(studentId: string): Promise<LearningCompassSummary> {
  const publishedSinceIso = new Date(Date.now() - HOLIDAY_PLAN_RELEVANCE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [nextSubject, holidayPlan] = await Promise.all([
    getNextSubject(studentId).catch(() => null),
    repos.learnerIntelligence.findPublishedHolidayPlan(studentId, publishedSinceIso).catch(() => null),
  ])

  return {
    nextSubject,
    holidayProgrammeAvailable: holidayPlan !== null,
  }
}
