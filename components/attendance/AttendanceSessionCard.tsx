import Link from 'next/link'
import { CalendarDays, CheckCircle2, Circle } from 'lucide-react'
import type { AttendanceSession } from './attendanceClient'

// One session, shown as a row/card. Used both on the workspace landing
// page (per-class recent-sessions preview) and the History page (full
// list for one class) — no calculation here, every field is displayed
// exactly as the API returned it.
export function AttendanceSessionCard({ session, classLabel }: { session: AttendanceSession; classLabel?: string }) {
  return (
    <Link
      href={`/teacher/attendance/${session.id}`}
      className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white hover:border-teal-400 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">
            {new Date(session.attendance_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            {classLabel && <span className="text-slate-400 font-medium"> · {classLabel}</span>}
          </p>
          <p className="text-xs text-slate-400 capitalize">{session.session_type} session</p>
        </div>
      </div>
      {session.marked_by_teacher_id ? (
        <span className="flex items-center gap-1 text-xs text-teal-600 font-medium shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" /> Marked
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
          <Circle className="w-3.5 h-3.5" /> Not marked
        </span>
      )}
    </Link>
  )
}
