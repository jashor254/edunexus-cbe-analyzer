import type { AttendanceStatus } from './attendanceClient'

const STYLES: Record<AttendanceStatus, string> = {
  present: 'text-emerald-700 bg-emerald-100',
  absent:  'text-red-700 bg-red-100',
  late:    'text-amber-700 bg-amber-100',
  excused: 'text-slate-600 bg-slate-100',
}

const LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent:  'Absent',
  late:    'Late',
  excused: 'Excused',
}

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  )
}
