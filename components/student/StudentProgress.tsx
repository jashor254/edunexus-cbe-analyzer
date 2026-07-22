'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, TrendingUp, Clock } from 'lucide-react'
import type { SubjectProgress } from '@/lib/learn/progress'

type Props = {
  /**
   * Sprint 5 (Parent Experience Convergence) — when provided, skips the
   * "resolve my own student record" step and fetches this learner's
   * progress directly. Used by the Parent Portal, which already knows
   * (and has already authorized) the studentId via requireParent(). Omit
   * for the student's own self-view — unchanged default behavior.
   */
  studentId?: string
  /** Parent Portal is light-themed; the student app is dark. Presentation only — same data, same fetch. */
  theme?: 'dark' | 'light'
}

export default function StudentProgress({ studentId: providedStudentId, theme = 'dark' }: Props) {
  const [progress, setProgress] = useState<SubjectProgress[] | null>(null)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        let studentId = providedStudentId
        if (!studentId) {
          const meRes = await fetch('/api/learn/student', { credentials: 'include' })
          const meJson = await meRes.json()
          if (!meRes.ok || !meJson.success) throw new Error(meJson.error ?? 'Could not load your student record')
          if ('picker' in meJson.data && meJson.data.picker) {
            throw new Error('Multiple student profiles found — open Compass to choose one first')
          }
          studentId = meJson.data.id as string
        }

        const res = await fetch(`/api/learn/progress?studentId=${studentId}`, { credentials: 'include' })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to load progress')
        setProgress(json.data.progress)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load progress')
      }
    }
    load()
  }, [providedStudentId])

  const light = theme === 'light'
  const t = {
    error:    light ? 'text-red-500'     : 'text-red-400',
    spinner:  light ? 'text-gray-300'    : 'text-white/30',
    empty:    light ? 'text-gray-300'    : 'text-white/20',
    emptyMsg: light ? 'text-gray-600'    : 'text-white/60',
    emptySub: light ? 'text-gray-400'    : 'text-white/30',
    heading:  light ? 'text-gray-900'    : 'text-white',
    subhead:  light ? 'text-gray-500'    : 'text-white/50',
    card:     light ? 'border-gray-200 bg-white shadow-sm' : 'border-white/10 bg-white/5',
    cardTitle: light ? 'text-gray-900'   : 'text-white',
    cardMeta:  light ? 'text-gray-400'   : 'text-white/40',
    cardBody:  light ? 'text-gray-500'   : 'text-white/50',
    list:      light ? 'text-gray-600'   : 'text-white/60',
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-sm ${t.error} p-6`}>
        <AlertCircle className="w-4 h-4" /> {error}
      </div>
    )
  }

  if (!progress) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className={`w-5 h-5 ${t.spinner} animate-spin`} />
      </div>
    )
  }

  if (progress.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center space-y-2">
        <TrendingUp className={`w-8 h-8 ${t.empty} mx-auto`} />
        <p className={`text-sm ${t.emptyMsg}`}>No completed Compass sessions yet.</p>
        <p className={`text-xs ${t.emptySub}`}>Finish a Compass session to start building progress history.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <header>
        <h1 className={`text-xl font-semibold ${t.heading}`}>{light ? "Child's Progress" : 'Your Progress'}</h1>
        <p className={`text-sm ${t.subhead}`}>Completed Compass sessions by subject.</p>
      </header>

      {progress.map(subject => (
        <div key={subject.subject} className={`border rounded-xl p-4 space-y-2 ${t.card}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-sm font-semibold ${t.cardTitle}`}>{subject.subjectDisplay}</h2>
            <span className={`text-xs ${t.cardMeta} flex items-center gap-1`}>
              <Clock className="w-3 h-3" /> {subject.totalMinutes} min
            </span>
          </div>
          <p className={`text-xs ${t.cardBody}`}>
            {subject.completedSessions} session{subject.completedSessions === 1 ? '' : 's'} completed
            {subject.lastCompletedAt ? ` · last on ${new Date(subject.lastCompletedAt).toLocaleDateString()}` : ''}
          </p>
          {subject.recentSummaries.length > 0 && (
            <ul className={`text-xs ${t.list} list-disc list-inside space-y-0.5`}>
              {subject.recentSummaries.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
