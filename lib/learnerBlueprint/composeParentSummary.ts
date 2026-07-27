// lib/learnerBlueprint/composeParentSummary.ts
//
// Parent Summary -> presentation composition only (ADR-0005 §2.8,
// ADR-0007 §8). No new data source, no LLM, no generated paragraphs —
// deterministic templating over already-composed sections only, per
// explicit Sprint 12G instruction ("Return structured fields. No
// generated paragraphs."). Owns nothing; if its source sections are
// unavailable, it degrades to null fields rather than inventing text.

import type {
  BlueprintSection,
  AcademicRecordData,
  AttendanceData,
  ParentSummaryData,
} from './types'

const OWNER = 'lib/learnerBlueprint (presentation composition over Academic Record + Attendance)'

/** The one shared "attendance needs attention" threshold — also reused by lib/parentExperience/actions.ts (Sprint 12S) so the two don't silently diverge, the exact bug class Sprint 12M found and fixed for HOLIDAY_PLAN_RELEVANCE_DAYS. */
export const ATTENDANCE_ATTENTION_THRESHOLD_PERCENT = 90

// Phase 4B.1 (docs/architecture/comparable-context-growth-correction-
// phase4b1.md) — each trend state owns its own complete, grammatically
// correct headline sentence, rather than contributing a bare word/phrase
// into one shared template. The previous approach (`TREND_WORDS[trend]`
// interpolated into a single fixed "is showing {X} progress this term"
// template) broke for `declining`, whose phrase ("an area needing
// attention") was a noun phrase, not an adjective — producing "is showing
// an area needing attention progress this term." Semantic phrase ownership
// makes that class of mismatch structurally impossible: a new trend state
// must supply its own full sentence, never a fragment assumed to fit a
// template it was never checked against.
type OverallTrend = NonNullable<AcademicRecordData['overallTrend']>

const TREND_HEADLINE: Record<OverallTrend, (name: string) => string> = {
  improving: (name) => `${name} is showing improving progress this term.`,
  declining: (name) => `${name}'s progress this term needs attention.`,
  stable: (name) => `${name} is showing steady progress this term.`,
  insufficient_data: (name) => `${name} is still building a fuller evidence picture this term.`,
  // A real, reachable state (Phase 4B.1) — opposing valid subject trends.
  // Never collapsed into 'improving' or 'declining'.
  mixed: (name) => `${name} is showing a mixed picture this term — improving in some areas, needing attention in others.`,
}

export function composeParentSummary(
  learnerName: string | null,
  academicRecord: BlueprintSection<AcademicRecordData>,
  attendance: BlueprintSection<AttendanceData>
): BlueprintSection<ParentSummaryData> {
  const name = learnerName ?? 'Your learner'

  const headline =
    academicRecord.status === 'available' && academicRecord.data?.overallTrend
      ? TREND_HEADLINE[academicRecord.data.overallTrend](name)
      : null

  const detail =
    attendance.status === 'available' && attendance.data?.attendancePercentage !== null && attendance.data
      ? `Attendance this term is at ${attendance.data.attendancePercentage}%.`
      : academicRecord.status === 'available' && academicRecord.data && academicRecord.data.bySubject.length > 0
        ? `${academicRecord.data.bySubject.length} subject${academicRecord.data.bySubject.length === 1 ? '' : 's'} currently tracked.`
        : null

  const action =
    attendance.status === 'available' && attendance.data?.attendancePercentage !== null
      && attendance.data && attendance.data.attendancePercentage < ATTENDANCE_ATTENTION_THRESHOLD_PERCENT
        ? 'Consistent attendance most days would help most right now.'
        : academicRecord.status === 'available' && academicRecord.data?.overallTrend === 'declining'
          ? 'A short conversation with the class teacher about this term\'s progress would help.'
          : null

  const data: ParentSummaryData = { headline, detail, action }

  return {
    status: headline || detail || action ? 'available' : 'unavailable',
    owner: OWNER,
    freshness: 'live',
    data,
    ...(headline || detail || action ? {} : { unavailableReason: 'No source section (Academic Record, Attendance) was available to summarize.' }),
  }
}
