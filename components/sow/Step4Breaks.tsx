'use client'

import { useState } from 'react'
import { ChevronRight, ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { validateBreak, applyBreaksToSchedule } from '@/lib/sow/breakEngine'
import type { TermScheduleResult } from '@/lib/sow/termSchedule'
import type { BreakItem, LessonStructure, SelectedSubstrand, TimelineSlot } from '@/lib/sow/types'
import type { BreakWithSlots } from '@/lib/sow/breakEngine'

interface Props {
  termSchedule: TermScheduleResult
  timeline: TimelineSlot[]
  lessonStructure: LessonStructure
  selectedSubstrands: SelectedSubstrand[]
  onComplete: (finalTimeline: TimelineSlot[], breaks: BreakItem[]) => void
  onBack: () => void
}

export default function Step4Breaks({
  termSchedule,
  timeline,
  lessonStructure,
  selectedSubstrands,
  onComplete,
  onBack,
}: Props) {
  const [noBreaks, setNoBreaks] = useState(false)
  const [breaks, setBreaks] = useState<BreakItem[]>([])
  const [addError, setAddError] = useState('')

  const [newTitle, setNewTitle] = useState('')
  const [newStartWeek, setNewStartWeek] = useState(1)
  const [newStartLesson, setNewStartLesson] = useState(1)
  const [newEndWeek, setNewEndWeek] = useState(1)
  const [newEndLesson, setNewEndLesson] = useState(1)

  const { lessonsPerWeek, firstWeek, firstLesson, lastWeek, lastLesson } = lessonStructure

  console.log('[Step4] termSchedule.lessonsPerWeek:', termSchedule.lessonsPerWeek)

  const weekOptions = Array.from(
    { length: lastWeek - firstWeek + 1 },
    (_, i) => firstWeek + i
  )
  const lessonOptions = Array.from({ length: lessonsPerWeek }, (_, i) => i + 1)

  // Compute current break slots (needed for validateBreak)
  const breaksWithSlots: BreakWithSlots[] = breaks.map(b => ({
    ...b,
    startSlot: (b.startWeek - 1) * lessonsPerWeek + b.startLesson,
    endSlot: (b.endWeek - 1) * lessonsPerWeek + b.endLesson,
  }))

  // Teaching slots after breaks
  const activeTimeline = applyBreaksToSchedule(termSchedule, breaksWithSlots)
  const teachingSlots = activeTimeline.filter(s => !s.isBreak).length
  const availableSlots = noBreaks ? termSchedule.totalSlots : teachingSlots

  function addBreak() {
    setAddError('')
    if (!newTitle.trim()) {
      setAddError('Break name is required.')
      return
    }

    const candidate: BreakItem = {
      id: `break_${Date.now()}`,
      title: newTitle.trim(),
      startWeek: Number(newStartWeek),
      startLesson: Number(newStartLesson),
      endWeek: Number(newEndWeek),
      endLesson: Number(newEndLesson),
    }

    const validation = validateBreak(candidate, breaksWithSlots, termSchedule)
    if (!validation.valid) {
      setAddError(validation.error || 'Invalid break.')
      return
    }

    setBreaks(prev => [...prev, candidate])
    setNewTitle('')
    setNewStartWeek(firstWeek)
    setNewStartLesson(1)
    setNewEndWeek(firstWeek)
    setNewEndLesson(1)
  }

  function removeBreak(id: string) {
    setBreaks(prev => prev.filter(b => b.id !== id))
  }

  function handleNext() {
    if (noBreaks) {
      onComplete(timeline, [])
      return
    }
    const finalTimeline = applyBreaksToSchedule(termSchedule, breaksWithSlots)
    onComplete(finalTimeline, breaks)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-black text-gray-900 mb-5">Term Breaks</h2>

        <label className="flex items-center gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={noBreaks}
            onChange={e => setNoBreaks(e.target.checked)}
            className="w-4 h-4 accent-teal-600"
          />
          <span className="text-sm font-bold text-gray-700">
            No breaks this term (continuous teaching)
          </span>
        </label>

        {!noBreaks && (
          <>
            {/* Add break form */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-5">
              <h3 className="text-sm font-black text-gray-800 mb-4">Add Break</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Break Name
                  </label>
                  <input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Mid-term Break"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Start Week</label>
                  <select
                    value={newStartWeek}
                    onChange={e => { const v = Number(e.target.value); setNewStartWeek(v); if (newEndWeek < v) setNewEndWeek(v) }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                  >
                    {weekOptions.map(w => <option key={w} value={w}>Week {w}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Start Lesson</label>
                  <select
                    value={newStartLesson}
                    onChange={e => setNewStartLesson(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                  >
                    {lessonOptions.map(l => <option key={l} value={l}>Lesson {l}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">End Week</label>
                  <select
                    value={newEndWeek}
                    onChange={e => setNewEndWeek(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                  >
                    {weekOptions.filter(w => w >= newStartWeek).map(w => (
                      <option key={w} value={w}>Week {w}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">End Lesson</label>
                  <select
                    value={newEndLesson}
                    onChange={e => setNewEndLesson(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                  >
                    {lessonOptions.map(l => <option key={l} value={l}>Lesson {l}</option>)}
                  </select>
                </div>
              </div>

              {addError && (
                <p className="mt-3 text-red-600 text-sm font-bold">{addError}</p>
              )}

              <button
                onClick={addBreak}
                className="mt-4 flex items-center gap-2 bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-900 transition"
              >
                <Plus className="w-4 h-4" /> Add Break
              </button>
            </div>

            {/* Break list */}
            {breaks.length > 0 && (
              <div className="space-y-2 mb-5">
                {breaks.map(b => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
                  >
                    <div>
                      <div className="font-bold text-amber-900 text-sm">{b.title}</div>
                      <div className="text-xs text-amber-700">
                        Week {b.startWeek} Lesson {b.startLesson} → Week {b.endWeek} Lesson {b.endLesson}
                      </div>
                    </div>
                    <button
                      onClick={() => removeBreak(b.id)}
                      className="text-red-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Slot summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 space-y-3">
          {/* Term overview */}
          <div className="text-xs text-gray-500 pb-2 border-b border-gray-200">
            <span className="font-bold text-gray-700">Term schedule:</span>
            {' '}Week {firstWeek}–{lastWeek}
            {' · '}{lessonsPerWeek} lessons/week
            {' · '}{termSchedule.totalSlots} total slots
          </div>

          {/* Break impact */}
          {!noBreaks && breaksWithSlots.length > 0 && (
            <div className="space-y-1 pb-2 border-b border-gray-200">
              {breaksWithSlots.map(b => (
                <div key={b.id} className="flex justify-between text-xs text-amber-700">
                  <span>{b.title}: W{b.startWeek} L{b.startLesson} → W{b.endWeek} L{b.endLesson}</span>
                  <span className="font-bold shrink-0 ml-3">−{b.endSlot - b.startSlot + 1} slots</span>
                </div>
              ))}
            </div>
          )}

          {/* Final counts */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">📅 Teaching slots</span>
              <span className="font-bold text-gray-900">{availableSlots}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">📚 Topics selected</span>
              <span className="font-bold text-gray-900">{selectedSubstrands.length}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="font-bold text-gray-800">✅ Lessons to generate</span>
              <span className="font-bold text-teal-700">{availableSlots}</span>
            </div>
            <p className="text-[11px] text-gray-400">Every teaching slot will have a generated lesson</p>
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
          disabled={availableSlots < 1}
          className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next — Generate Preview <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
