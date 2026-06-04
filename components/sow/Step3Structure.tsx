'use client'

import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { buildTermSchedule } from '@/lib/sow/termSchedule'
import type { TermScheduleResult } from '@/lib/sow/termSchedule'
import type { LessonStructure } from '@/lib/sow/types'

const TERM_WEEKS     = [8, 9, 10, 11, 12, 13, 14]
const LESSONS_PER_WK = [2, 3, 4, 5, 6]

export default function Step3Structure({
  onComplete,
  onBack,
}: {
  onComplete: (ls: LessonStructure, ts: TermScheduleResult) => void
  onBack: () => void
}) {
  const [termWeeks,      setTermWeeks]      = useState(13)
  const [lessonsPerWeek, setLessonsPerWeek] = useState(4)

  const totalSlots = termWeeks * lessonsPerWeek

  function handleNext() {
    const ls: LessonStructure = {
      lessonsPerWeek,
      firstWeek:   1,
      firstLesson: 1,
      lastWeek:    termWeeks,
      lastLesson:  lessonsPerWeek,
      doubleLessonOption: 'single',
    }
    const ts = buildTermSchedule({
      lessonsPerWeek,
      firstWeek:   1,
      firstLesson: 1,
      lastWeek:    termWeeks,
      lastLesson:  lessonsPerWeek,
    })
    onComplete(ls, ts)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-black text-gray-900 mb-5">Lesson Schedule</h2>

        <div className="grid sm:grid-cols-2 gap-5">
          {/* Term length */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Term length (weeks)
            </label>
            <select
              value={termWeeks}
              onChange={e => setTermWeeks(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
            >
              {TERM_WEEKS.map(w => (
                <option key={w} value={w}>
                  {w} weeks{w === 13 ? ' (standard)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Lessons per week */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Lessons per week <span className="text-gray-400 font-normal">(this subject)</span>
            </label>
            <select
              value={lessonsPerWeek}
              onChange={e => setLessonsPerWeek(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
            >
              {LESSONS_PER_WK.map(n => (
                <option key={n} value={n}>{n} lessons/week</option>
              ))}
            </select>
          </div>
        </div>

        {/* Live summary */}
        <div className="mt-6 bg-teal-50 border border-teal-200 rounded-xl px-5 py-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Teaching weeks</span>
            <span className="font-bold text-gray-900">{termWeeks}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Lessons per week</span>
            <span className="font-bold text-gray-900">{lessonsPerWeek}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-teal-200 mt-2">
            <span className="font-bold text-teal-800">Slots before breaks</span>
            <span className="font-black text-teal-700 text-base">{totalSlots}</span>
          </div>
          <p className="text-[11px] text-teal-600 mt-1">
            You'll select break weeks in the next step. Available lessons = {totalSlots} minus break weeks.
          </p>
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
          className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition"
        >
          Next — Add Breaks <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
