import { AttendanceSessionCard } from './AttendanceSessionCard'
import type { AttendanceSession } from './attendanceClient'

// A plain list of sessions, newest first. No chart, no percentage, no
// count beyond "how many sessions" — just history, per this sprint's
// explicit scope.
export function AttendanceHistoryTable({
  sessions, classLabel, emptyMessage = 'No attendance sessions yet.',
}: { sessions: AttendanceSession[]; classLabel?: string; emptyMessage?: string }) {
  if (sessions.length === 0) {
    return <p className="text-sm text-slate-400">{emptyMessage}</p>
  }

  const sorted = [...sessions].sort((a, b) => b.attendance_date.localeCompare(a.attendance_date))

  return (
    <div className="space-y-2">
      {sorted.map(session => (
        <AttendanceSessionCard key={session.id} session={session} classLabel={classLabel} />
      ))}
    </div>
  )
}
