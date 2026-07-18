import { classLabel, type ClassOption } from './attendanceClient'

// The Class / Date / Session Type picker at the top of the "Take
// Attendance" workflow. Session type has exactly one live value today
// ('daily' — the live CHECK constraint from Sprint 11B) so it's shown as
// a fixed, disabled field rather than a free choice that could 422.
export function AttendanceToolbar({
  classes, classId, onClassChange, date, onDateChange, disabled,
}: {
  classes: ClassOption[]
  classId: string
  onClassChange: (id: string) => void
  date: string
  onDateChange: (date: string) => void
  disabled?: boolean
}) {
  return (
    <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
      <div>
        <label className="block text-sm text-slate-600 mb-1.5">Class</label>
        <select
          value={classId}
          onChange={e => onClassChange(e.target.value)}
          disabled={disabled}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-60"
        >
          <option value="">Select a class…</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{classLabel(c)}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1.5">Date</span>
          <input
            type="date"
            value={date}
            onChange={e => onDateChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-60"
          />
        </label>
        <label className="block">
          <span className="block text-sm text-slate-600 mb-1.5">Session Type</span>
          <select disabled className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-500">
            <option>Daily</option>
          </select>
        </label>
      </div>
    </div>
  )
}
