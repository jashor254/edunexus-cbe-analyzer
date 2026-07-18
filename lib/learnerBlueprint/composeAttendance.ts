// lib/learnerBlueprint/composeAttendance.ts
//
// Attendance -> Attendance service only (ADR-0005 §2.3, ADR-0004 §4).
// Reads via getLearnerAttendanceHistory() only — no raw
// `attendance_sessions`/`attendance_records` read. Tallying the returned,
// already-labeled records into present/absent/late/excused counts is the
// same "derived value computed by the consumer at read time" pattern
// ADR-0004 §4 already sanctions and Report Cards already uses (Sprint
// 12B's `toReportCardAttendance`) — it is not a new attendance
// calculation in the sense this sprint's mission forbids (no business
// rule about what counts as present/absent is decided here).
//
// Attendance Trend/Health/Risk/Support (ADR-0006 §5, ADR-0007 §4) are
// NOT computed here: no Attendance-owned function producing any of them
// exists yet (confirmed Sprint 12G). Only raw counts are returned.
//
// Note: getLearnerAttendanceHistory is admin-tier only as of Sprint 11G's
// own scope — a non-admin actorUserId will make this section unavailable,
// not throw. Widening that authorization is out of this sprint's scope.

import { getLearnerAttendanceHistory } from '@/lib/core/attendance'
import type { BlueprintSection, AttendanceData } from './types'

const OWNER = 'lib/core/attendance.getLearnerAttendanceHistory'

export async function composeAttendance(
  actorUserId: string,
  schoolId: string,
  coreLearnerId: string
): Promise<BlueprintSection<AttendanceData>> {
  try {
    const history = await getLearnerAttendanceHistory(actorUserId, schoolId, coreLearnerId)

    const counts = { present: 0, absent: 0, late: 0, excused: 0 }
    for (const row of history) {
      counts[row.status] += 1
    }
    const totalSessions = history.length

    const data: AttendanceData = {
      presentCount: counts.present,
      absentCount: counts.absent,
      lateCount: counts.late,
      excusedCount: counts.excused,
      totalSessions,
      attendancePercentage: totalSessions > 0
        ? Math.round(((counts.present + counts.late) / totalSessions) * 100)
        : null,
      notes: [
        'Attendance Trend/Health/Risk/Support (ADR-0006 §5) are not yet computed by any Attendance-owned function — raw counts only.',
      ],
    }

    return { status: 'available', owner: OWNER, freshness: 'snapshot', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'snapshot',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Attendance composition failed',
    }
  }
}
