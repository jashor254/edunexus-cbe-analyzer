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

const TREND_WORDS: Record<string, string> = {
  improving: 'improving',
  declining: 'an area needing attention',
  stable: 'steady',
  insufficient_data: 'still building a picture',
}

export function composeParentSummary(
  learnerName: string | null,
  academicRecord: BlueprintSection<AcademicRecordData>,
  attendance: BlueprintSection<AttendanceData>
): BlueprintSection<ParentSummaryData> {
  const name = learnerName ?? 'Your learner'

  const headline =
    academicRecord.status === 'available' && academicRecord.data?.overallTrend
      ? `${name} is showing ${TREND_WORDS[academicRecord.data.overallTrend]} progress this term.`
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
