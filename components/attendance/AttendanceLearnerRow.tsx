import { Trash2 } from 'lucide-react'
import { AttendanceStatusSelector } from './AttendanceStatusSelector'
import type { AttendanceStatus } from './attendanceClient'

// One learner's row. Three shapes, one component:
//  - marking (new/page.tsx): name + status selector only.
//  - not-yet-marked (session detail, a roster learner with no record yet):
//    name + status selector + a single "Save" button (one POST per click —
//    reuses the existing single-record create endpoint, never bulk).
//  - editing (session detail, an existing record): also arrival/departure/
//    notes fields, a Save button (PATCH), and a Delete button — all
//    controlled entirely by the caller; this component holds no state, no
//    validation, no ownership logic.
export function AttendanceLearnerRow({
  label, status, onStatusChange, disabled,
  create,
  detail,
}: {
  label: string
  status: AttendanceStatus | null
  onStatusChange: (status: AttendanceStatus) => void
  disabled?: boolean
  create?: { onSave: () => void; saving?: boolean; canSave: boolean }
  detail?: {
    arrivalTime: string
    departureTime: string
    notes: string
    onArrivalChange: (v: string) => void
    onDepartureChange: (v: string) => void
    onNotesChange: (v: string) => void
    onSave: () => void
    onDelete: () => void
    saving?: boolean
  }
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-800 min-w-0 truncate">{label}</p>
        <div className="flex items-center gap-2">
          <AttendanceStatusSelector value={status} onChange={onStatusChange} disabled={disabled} />
          {create && (
            <button
              type="button"
              onClick={create.onSave}
              disabled={!create.canSave || create.saving}
              className="text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              {create.saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {detail && (
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-slate-400">Arrival time</span>
              <input
                type="time"
                value={detail.arrivalTime}
                onChange={e => detail.onArrivalChange(e.target.value)}
                className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Departure time</span>
              <input
                type="time"
                value={detail.departureTime}
                onChange={e => detail.onDepartureChange(e.target.value)}
                className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-slate-400">Notes</span>
            <input
              type="text"
              value={detail.notes}
              onChange={e => detail.onNotesChange(e.target.value)}
              placeholder="Optional"
              className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800"
            />
          </label>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={detail.onSave}
              disabled={detail.saving}
              className="text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {detail.saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={detail.onDelete}
              className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 px-2 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
