'use client'

import { useState } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { buildTermSchedule } from '@/lib/sow/termSchedule'
import type { TermScheduleResult } from '@/lib/sow/termSchedule'
import type { LessonStructure } from '@/lib/sow/types'

const LP_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const WEEK_OPTIONS = Array.from({ length: 15 }, (_, i) => i + 1)

export default function Step3Structure({
  onComplete,
  onBack,
}: {
  onComplete: (ls: LessonStructure, ts: TermScheduleResult) => void
  onBack: () => void
}) {
  const [lessonsPerWeek, setLessonsPerWeek] = useState(5)
  const [firstWeek, setFirstWeek] = useState(1)
  const [firstLesson, setFirstLesson] = useState(1)
  const [lastWeek, setLastWeek] = useState(13)
  const [lastLesson, setLastLesson] = useState(5)
  const [doubleLessonOption, setDoubleLessonOption] = useState<'single' | 'double'>('single')
  const [doubleLessonCombination, setDoubleLessonCombination] = useState('')
  const [error, setError] = useState('')

  const lessonOptions = Array.from({ length: lessonsPerWeek }, (_, i) => i + 1)

  // Live summary
  let totalWeeks = 0
  let totalSlots = 0
  let summaryError = ''
  try {
    const ts = buildTermSchedule({
      lessonsPerWeek,
      firstWeek,
      firstLesson,
      lastWeek,
      lastLesson,
      doubleLessonOption,
      doubleLessonCombination: doubleLessonCombination || null,
    })
    totalSlots = ts.totalSlots
    totalWeeks = ts.lastWeek - ts.firstWeek + 1
  } catch (e: any) {
    summaryError = e.message
  }

  function handleNext() {
    setError('')
    try {
      const termSchedule = buildTermSchedule({
        lessonsPerWeek,
        firstWeek,
        firstLesson,
        lastWeek,
        lastLesson,
        doubleLessonOption,
        doubleLessonCombination: doubleLessonCombination || null,
      })
      const ls: LessonStructure = {
        lessonsPerWeek,
        firstWeek,
        firstLesson,
        lastWeek,
        lastLesson,
        doubleLessonOption,
        doubleLessonCombination: doubleLessonCombination || undefined,
      }
      console.log('[Step3] passing termSchedule, lessonsPerWeek:', termSchedule.lessonsPerWeek)
      onComplete(ls, termSchedule)
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-black text-gray-900 mb-5">Lesson Schedule</h2>

        <div className="grid sm:grid-cols-2 gap-5">
          {/* Lessons per week */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Lessons per week
            </label>
            <select
              value={lessonsPerWeek}
              onChange={e => {
                const v = Number(e.target.value)
                setLessonsPerWeek(v)
                if (firstLesson > v) setFirstLesson(v)
                if (lastLesson > v) setLastLesson(v)
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
            >
              {LP_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Double lesson */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Double lessons
            </label>
            <select
              value={doubleLessonOption}
              onChange={e => setDoubleLessonOption(e.target.value as 'single' | 'double')}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
            >
              <option value="single">Single lessons only</option>
              <option value="double">Double lessons enabled</option>
            </select>
          </div>

          {doubleLessonOption === 'double' && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Double lesson combination{' '}
                <span className="text-gray-400 font-normal">(e.g. Lessons 3 &amp; 4)</span>
              </label>
              <input
                value={doubleLessonCombination}
                onChange={e => setDoubleLessonCombination(e.target.value)}
                placeholder="e.g. Lessons 3 & 4"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
              />
            </div>
          )}

          {/* First week */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              First week of teaching
            </label>
            <select
              value={firstWeek}
              onChange={e => setFirstWeek(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
            >
              {WEEK_OPTIONS.map(w => <option key={w} value={w}>Week {w}</option>)}
            </select>
          </div>

          {/* First lesson */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              First lesson number
            </label>
            <select
              value={firstLesson}
              onChange={e => setFirstLesson(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
            >
              {lessonOptions.map(l => <option key={l} value={l}>Lesson {l}</option>)}
            </select>
          </div>

          {/* Last week */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Last week of teaching
            </label>
            <select
              value={lastWeek}
              onChange={e => setLastWeek(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
            >
              {WEEK_OPTIONS.filter(w => w >= firstWeek).map(w => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </div>

          {/* Last lesson */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Last lesson number
            </label>
            <select
              value={lastLesson}
              onChange={e => setLastLesson(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
            >
              {lessonOptions.map(l => <option key={l} value={l}>Lesson {l}</option>)}
            </select>
          </div>
        </div>

        {/* Live summary */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 space-y-2">
          {summaryError ? (
            <p className="text-red-600 text-sm font-bold">{summaryError}</p>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Teaching weeks:</span>
                <span className="font-bold text-gray-900">{totalWeeks}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total lesson slots:</span>
                <span className="font-bold text-teal-700">{totalSlots}</span>
              </div>
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 text-red-600 text-sm font-bold">{error}</p>
        )}
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
          disabled={!!summaryError}
          className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next — Add Breaks <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
