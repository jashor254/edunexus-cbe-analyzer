'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import type { LessonWithCompletion } from '@/lib/academy/types'

interface Props {
  lessons: LessonWithCompletion[]
  moduleColor: string
}

export default function LessonAccordion({ lessons: initial, moduleColor }: Props) {
  const [lessons, setLessons] = useState<LessonWithCompletion[]>(initial)
  const [openId, setOpenId] = useState<string | null>(() => {
    const first = initial.find(l => !l.completed)
    return first?.id ?? initial[0]?.id ?? null
  })
  const [isPending, startTransition] = useTransition()
  const [markingId, setMarkingId] = useState<string | null>(null)

  function toggle(id: string) {
    setOpenId(prev => (prev === id ? null : id))
  }

  async function handleMarkComplete(lessonId: string) {
    setMarkingId(lessonId)
    try {
      const res = await fetch('/api/academy/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: lessonId }),
      })
      if (!res.ok) throw new Error('Failed to save progress')

      startTransition(() => {
        setLessons(prev =>
          prev.map(l =>
            l.id === lessonId
              ? { ...l, completed: true, completed_at: new Date().toISOString() }
              : l
          )
        )
        // Auto-open next incomplete lesson
        const idx = lessons.findIndex(l => l.id === lessonId)
        const next = lessons.slice(idx + 1).find(l => !l.completed && l.id !== lessonId)
        if (next) setOpenId(next.id)
      })
    } catch {
      // keep marking state — user can retry
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {lessons.map((lesson, idx) => {
        const isOpen = openId === lesson.id
        const isMarking = markingId === lesson.id

        return (
          <div
            key={lesson.id}
            className={`bg-white rounded-2xl border transition-all overflow-hidden ${
              lesson.completed
                ? 'border-emerald-100'
                : isOpen
                ? 'border-gray-200 shadow-sm'
                : 'border-gray-100'
            }`}
          >
            {/* Lesson header */}
            <button
              onClick={() => toggle(lesson.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="shrink-0">
                {lesson.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Circle
                    className="w-5 h-5 text-gray-300"
                    style={{ color: isOpen ? moduleColor : undefined }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 font-semibold">
                    Lesson {idx + 1}
                  </span>
                  {lesson.completed && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded font-bold">
                      Done
                    </span>
                  )}
                </div>
                <div className="font-black text-gray-900 text-sm mt-0.5 truncate">
                  {lesson.title}
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Lesson content */}
            {isOpen && (
              <div className="px-5 pb-5">
                <div
                  className="prose prose-sm max-w-none text-gray-700 prose-headings:text-gray-900 prose-headings:font-black mb-5"
                  dangerouslySetInnerHTML={{ __html: lesson.content }}
                />
                {!lesson.completed && (
                  <button
                    onClick={() => handleMarkComplete(lesson.id)}
                    disabled={isMarking || isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                    style={{ background: moduleColor }}
                  >
                    {isMarking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Mark as Complete
                      </>
                    )}
                  </button>
                )}
                {lesson.completed && lesson.completed_at && (
                  <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed {new Date(lesson.completed_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
