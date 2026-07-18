import type { AttendanceStatus } from './attendanceClient'

const OPTIONS: Array<{ value: AttendanceStatus; label: string; activeClass: string }> = [
  { value: 'present', label: 'Present', activeClass: 'bg-emerald-600 text-white' },
  { value: 'absent',  label: 'Absent',  activeClass: 'bg-red-600 text-white' },
  { value: 'late',    label: 'Late',    activeClass: 'bg-amber-500 text-white' },
  { value: 'excused', label: 'Excused', activeClass: 'bg-slate-500 text-white' },
]

export function AttendanceStatusSelector({
  value, onChange, disabled,
}: { value: AttendanceStatus | null; onChange: (status: AttendanceStatus) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            value === opt.value ? opt.activeClass : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
