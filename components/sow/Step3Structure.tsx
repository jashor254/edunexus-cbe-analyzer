'use client'

import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { buildTermSchedule } from '@/lib/sow/termSchedule'
import type { TermScheduleResult } from '@/lib/sow/termSchedule'
import type { LessonStructure } from '@/lib/sow/types'

const TERM_WEEKS     = [8, 9, 10, 11, 12, 13, 14]
const LESSONS_PER_WK = [2, 3, 4, 5, 6]

const selectCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white'

export default function Step3Structure({
  onComplete,
  onBack,
}: {
  onComplete: (ls: LessonStructure, ts: TermScheduleResult) => void
  onBack: () => void
}) {
  const [termWeeks,            setTermWeeks]            = useState(13)
  const [lessonsPerWeek,       setLessonsPerWeek]       = useState(4)
  const [doubleLessonOption,   setDoubleLessonOption]   = useState<'single' | 'double'>('single')
  const [doubleLessonCombo,    setDoubleLessonCombo]    = useState<string>('')

  const totalSlots     = termWeeks * lessonsPerWeek
  const isDouble       = doubleLessonOption === 'double'
  const singlesPerWeek = isDouble ? lessonsPerWeek - 2 : lessonsPerWeek

  function handleNext() {
    const ls: LessonStructure = {
      lessonsPerWeek,
      firstWeek:   1,
      firstLesson: 1,
      lastWeek:    termWeeks,
      lastLesson:  lessonsPerWeek,
      doubleLessonOption,
      doubleLessonCombination: isDouble && doubleLessonCombo ? doubleLessonCombo : undefined,
    }
    const ts = buildTermSchedule({
      lessonsPerWeek,
      firstWeek:   1,
      firstLesson: 1,
      lastWeek:    termWeeks,
      lastLesson:  lessonsPerWeek,
      doubleLessonOption,
      doubleLessonCombination: ls.doubleLessonCombination,
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
              className={selectCls}
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
              onChange={e => {
                setLessonsPerWeek(Number(e.target.value))
                setDoubleLessonCombo('')
              }}
              className={selectCls}
            >
              {LESSONS_PER_WK.map(n => (
                <option key={n} value={n}>{n} lessons/week</option>
              ))}
            </select>
          </div>

          {/* Double lesson toggle */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Double lessons
            </label>
            <select
              value={doubleLessonOption}
              onChange={e => {
                const opt = e.target.value as 'single' | 'double'
                setDoubleLessonOption(opt)
                if (opt === 'single') setDoubleLessonCombo('')
              }}
              className={selectCls}
            >
              <option value="single">Single lessons only</option>
              <option value="double">Double lessons enabled</option>
            </select>
          </div>

        </div>

        {/* Double lesson slot picker — full width, shown only when double is on */}
        {isDouble && (
          <div className="mt-4">
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Which lessons form the double?
            </label>
            <select
              value={doubleLessonCombo}
              onChange={e => setDoubleLessonCombo(e.target.value)}
              className={selectCls}
            >
              <option value="">Select lesson pair</option>
              {Array.from({ length: lessonsPerWeek - 1 }, (_, i) => {
                const combo = `${i + 1}-${i + 2}`
                return <option key={combo} value={combo}>Lessons {combo} (double)</option>
              })}
            </select>
          </div>
        )}

        {/* Live summary */}
        <div className="mt-6 bg-teal-50 border border-teal-200 rounded-xl px-5 py-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Teaching weeks</span>
            <span className="font-bold text-gray-900">{termWeeks}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Lessons per week</span>
            <span className="font-bold text-gray-900">
              {isDouble ? `${singlesPerWeek} single + 1 double` : `${lessonsPerWeek} single`}
            </span>
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
