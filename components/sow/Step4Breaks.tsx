'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { applyBreaksToSchedule } from '@/lib/sow/breakEngine'
import type { TermScheduleResult } from '@/lib/sow/termSchedule'
import type { BreakItem, LessonStructure, SelectedSubstrand, TimelineSlot } from '@/lib/sow/types'
import type { BreakWithSlots } from '@/lib/sow/breakEngine'

const BREAK_TILE_COLORS = [
  { bg: '#E6F1FB', border: '#378ADD', text: '#0C447C' },
  { bg: '#FAEEDA', border: '#EF9F27', text: '#633806' },
  { bg: '#FCEBEB', border: '#F09595', text: '#791F1F' },
  { bg: '#EEEDFE', border: '#7F77DD', text: '#3C3489' },
]

function getBreakWeekMap(breaks: Break[], lpw: number): Map<number, string> {
  const map = new Map<number, string>()
  for (const b of breaks) {
    for (let w = b.startWeek; w <= b.endWeek; w++) {
      const lStart = w === b.startWeek ? b.startLesson : 1
      const lEnd   = w === b.endWeek   ? b.endLesson   : lpw
      if (lEnd >= lStart) map.set(w, b.name)
    }
  }
  return map
}

interface Break {
  id:          string
  name:        string
  startWeek:   number
  startLesson: number
  endWeek:     number
  endLesson:   number
  lessonsLost: number
}

interface BreakForm {
  name:        string
  startWeek:   number
  startLesson: number
  endWeek:     number
  endLesson:   number
}

interface Props {
  termSchedule:       TermScheduleResult
  timeline:           TimelineSlot[]
  lessonStructure:    LessonStructure
  selectedSubstrands: SelectedSubstrand[]
  onComplete:         (finalTimeline: TimelineSlot[], breaks: BreakItem[]) => void
  onBack:             () => void
  onBreaksChange?:    (breaks: Break[], lessonsToGenerate: number) => void
}

export default function Step4Breaks({
  termSchedule,
  lessonStructure,
  selectedSubstrands,
  onComplete,
  onBack,
  onBreaksChange,
}: Props) {
  const { lessonsPerWeek, lastWeek: totalWeeks } = lessonStructure

  const [breaks,   setBreaks]   = useState<Break[]>([])
  const [form,     setForm]     = useState<BreakForm>({
    name:        '',
    startWeek:   1,
    startLesson: 1,
    endWeek:     1,
    endLesson:   lessonsPerWeek,
  })
  const [error,    setError]    = useState('')
  const [noBreaks, setNoBreaks] = useState(false)

  // Derived — no extra state
  const totalBreakLessons = breaks.reduce((sum, b) => sum + b.lessonsLost, 0)
  const totalSlots        = totalWeeks * lessonsPerWeek
  const lessonsToGenerate = totalSlots - totalBreakLessons

  const weekOptions   = Array.from({ length: totalWeeks },    (_, i) => i + 1)
  const lessonOptions = Array.from({ length: lessonsPerWeek }, (_, i) => i + 1)

  // Timeline derived state
  const breakWeekMap  = getBreakWeekMap(breaks, lessonsPerWeek)
  const breakColorMap = new Map<string, number>()
  breaks.forEach((b, i) => {
    if (!breakColorMap.has(b.name)) breakColorMap.set(b.name, i % BREAK_TILE_COLORS.length)
  })

  useEffect(() => {
    onBreaksChange?.(breaks, lessonsToGenerate)
  }, [breaks, lessonsToGenerate])

  // ─── helpers ────────────────────────────────────────────────────────────────

  function calcLessonsLost(f: BreakForm): number {
    const startSlot = (f.startWeek - 1) * lessonsPerWeek + f.startLesson
    const endSlot   = (f.endWeek   - 1) * lessonsPerWeek + f.endLesson
    return Math.max(0, endSlot - startSlot + 1)
  }

  function addBreak() {
    setError('')

    if (!form.name.trim()) {
      setError('Please enter a break name')
      return
    }

    const startSlot = (form.startWeek - 1) * lessonsPerWeek + form.startLesson
    const endSlot   = (form.endWeek   - 1) * lessonsPerWeek + form.endLesson

    if (endSlot < startSlot) {
      setError('End must be after start')
      return
    }

    const lost = endSlot - startSlot + 1
    if (totalBreakLessons + lost >= totalSlots) {
      setError('Not enough teaching lessons remaining')
      return
    }

    const newBreak: Break = {
      id:          crypto.randomUUID(),
      name:        form.name.trim(),
      startWeek:   form.startWeek,
      startLesson: form.startLesson,
      endWeek:     form.endWeek,
      endLesson:   form.endLesson,
      lessonsLost: lost,
    }

    setBreaks(prev => [...prev, newBreak])
    // Reset name only — keep week/lesson for fast consecutive entry
    setForm(prev => ({ ...prev, name: '' }))
  }

  function removeBreak(id: string) {
    setBreaks(prev => prev.filter(b => b.id !== id))
  }

  function handleNext() {
    const breakItems: BreakItem[] = noBreaks ? [] : breaks.map(b => ({
      id:          b.id,
      title:       b.name,
      startWeek:   b.startWeek,
      startLesson: b.startLesson,
      endWeek:     b.endWeek,
      endLesson:   b.endLesson,
    }))

    const breaksWithSlots: BreakWithSlots[] = breakItems.map(b => ({
      ...b,
      startSlot: (b.startWeek - 1) * lessonsPerWeek + b.startLesson,
      endSlot:   (b.endWeek   - 1) * lessonsPerWeek + b.endLesson,
    }))

    onComplete(applyBreaksToSchedule(termSchedule, breaksWithSlots), breakItems)
  }

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-black text-gray-900 mb-5">Term Breaks</h2>

        {/* A. No breaks toggle */}
        <label className="flex items-center gap-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={noBreaks}
            onChange={e => {
              setNoBreaks(e.target.checked)
              if (e.target.checked) {
                setBreaks([])
                setError('')
              }
            }}
            className="w-4 h-4 accent-teal-600"
          />
          <span className="text-sm font-bold text-gray-700">
            No breaks this term
          </span>
        </label>

        {noBreaks ? (
          <div className="rounded-xl bg-teal-50 border border-teal-200 px-5 py-4 text-sm font-bold text-teal-700 mb-5">
            {totalSlots} lessons — full term, no interruptions
          </div>
        ) : (
          <>
            {/* B. Add break form */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3 mb-5">
              <p className="text-sm font-bold text-gray-700">Add a break</p>

              <input
                type="text"
                placeholder="Break name  e.g. Opener Assessment"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addBreak()}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />

              <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                <span className="text-xs font-bold text-gray-500 w-10">Start</span>
                <select
                  value={form.startWeek}
                  onChange={e => setForm(p => ({ ...p, startWeek: Number(e.target.value) }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {weekOptions.map(w => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </select>
                <select
                  value={form.startLesson}
                  onChange={e => setForm(p => ({ ...p, startLesson: Number(e.target.value) }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {lessonOptions.map(l => (
                    <option key={l} value={l}>Lesson {l}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                <span className="text-xs font-bold text-gray-500 w-10">End</span>
                <select
                  value={form.endWeek}
                  onChange={e => setForm(p => ({ ...p, endWeek: Number(e.target.value) }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {weekOptions.map(w => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </select>
                <select
                  value={form.endLesson}
                  onChange={e => setForm(p => ({ ...p, endLesson: Number(e.target.value) }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {lessonOptions.map(l => (
                    <option key={l} value={l}>Lesson {l}</option>
                  ))}
                </select>
              </div>

              {/* Live preview of lessons lost */}
              {form.name.trim() && (
                <p className="text-xs text-gray-400">
                  This break covers{' '}
                  <span className="font-bold text-gray-600">
                    {calcLessonsLost(form)}
                  </span>{' '}
                  lesson{calcLessonsLost(form) !== 1 ? 's' : ''}
                </p>
              )}

              {error && (
                <p className="text-xs font-medium text-red-600">{error}</p>
              )}

              <button
                onClick={addBreak}
                className="flex items-center gap-1.5 text-sm font-bold bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition"
              >
                + Add break
              </button>
            </div>

            {/* C. Breaks table — always visible */}
            <div className="w-full border border-gray-200 rounded-lg overflow-hidden mb-4">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-gray-600 font-medium text-sm">Break name</th>
                    <th className="text-left px-3 py-2 text-gray-600 font-medium text-sm">Start</th>
                    <th className="text-left px-3 py-2 text-gray-600 font-medium text-sm">End</th>
                    <th className="text-left px-3 py-2 text-gray-600 font-medium text-sm">Lessons lost</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {breaks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-4 text-gray-500 text-sm border border-dashed border-gray-300 rounded-lg"
                      >
                        No breaks added yet
                      </td>
                    </tr>
                  ) : (
                    breaks.map(b => (
                      <tr
                        key={b.id}
                        className="border-b border-gray-200 text-gray-800 text-sm"
                      >
                        <td className="py-2 px-3 text-gray-700">{b.name}</td>
                        <td className="py-2 px-3 text-gray-700">
                          Wk {b.startWeek}, L {b.startLesson}
                        </td>
                        <td className="py-2 px-3 text-gray-700">
                          Wk {b.endWeek}, L {b.endLesson}
                        </td>
                        <td className="py-2 px-3 text-gray-700">{b.lessonsLost}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => removeBreak(b.id)}
                            className="text-xs font-bold text-red-500 hover:text-red-700 transition"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Timeline — below table, above summary */}
            <div className="mt-1 mb-1">
              <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Term overview</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {weekOptions.map(week => {
                  const breakName = breakWeekMap.get(week)
                  const colorIdx  = breakName !== undefined ? (breakColorMap.get(breakName) ?? 0) : -1
                  const colors    = colorIdx >= 0 ? BREAK_TILE_COLORS[colorIdx] : null
                  return (
                    <div
                      key={week}
                      style={{
                        borderRadius: 6,
                        padding: '5px 2px',
                        textAlign: 'center',
                        border: `0.5px solid ${colors ? colors.border : '#5DCAA5'}`,
                        backgroundColor: colors ? colors.bg : '#E1F5EE',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 9, color: colors ? colors.text : '#085041', marginBottom: 2 }}>
                        Wk {week}
                      </span>
                      <span style={{ display: 'block', fontSize: 9, fontWeight: 500, color: colors ? colors.text : '#0F6E56' }}>
                        {breakName
                          ? (breakName.length > 8 ? breakName.slice(0, 7) + '…' : breakName)
                          : `${lessonsPerWeek} les`}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              {breaks.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, border: '0.5px solid #5DCAA5', backgroundColor: '#E1F5EE', color: '#085041' }}>
                    Teaching week
                  </span>
                  {[...new Set(breaks.map(b => b.name))].map((name, i) => {
                    const c = BREAK_TILE_COLORS[i % 4]
                    return (
                      <span
                        key={name}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, border: `0.5px solid ${c.border}`, backgroundColor: c.bg, color: c.text }}
                      >
                        {name}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* D. Summary — always visible */}
        <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 text-sm">
              <div className="flex gap-5 flex-wrap">
                <span className="text-gray-500">
                  Total slots:{' '}
                  <span className="font-bold text-gray-900">{totalSlots}</span>
                </span>
                {!noBreaks && totalBreakLessons > 0 && (
                  <span className="text-gray-500">
                    Lessons lost:{' '}
                    <span className="font-bold text-gray-900">{totalBreakLessons}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                {selectedSubstrands.length} topics selected
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400 mb-0.5">lessons to generate</p>
              <p
                className="font-medium leading-none"
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: lessonsToGenerate > 0 ? '#0d9488' : '#ef4444',
                }}
              >
                {noBreaks ? totalSlots : lessonsToGenerate}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 px-5 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleNext}
          disabled={(noBreaks ? totalSlots : lessonsToGenerate) < 1}
          className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next — Generate Preview <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
