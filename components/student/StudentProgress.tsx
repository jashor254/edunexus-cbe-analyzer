'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, TrendingUp, Clock } from 'lucide-react'
import type { SubjectProgress } from '@/lib/learn/progress'

export default function StudentProgress() {
  const [progress, setProgress] = useState<SubjectProgress[] | null>(null)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/learn/student', { credentials: 'include' })
        const meJson = await meRes.json()
        if (!meRes.ok || !meJson.success) throw new Error(meJson.error ?? 'Could not load your student record')
        if ('picker' in meJson.data && meJson.data.picker) {
          throw new Error('Multiple student profiles found — open Compass to choose one first')
        }
        const studentId = meJson.data.id as string

        const res = await fetch(`/api/learn/progress?studentId=${studentId}`, { credentials: 'include' })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to load progress')
        setProgress(json.data.progress)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load progress')
      }
    }
    load()
  }, [])

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400 p-6">
        <AlertCircle className="w-4 h-4" /> {error}
      </div>
    )
  }

  if (!progress) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
      </div>
    )
  }

  if (progress.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center space-y-2">
        <TrendingUp className="w-8 h-8 text-white/20 mx-auto" />
        <p className="text-sm text-white/60">No completed Compass sessions yet.</p>
        <p className="text-xs text-white/30">Finish a Compass session to start building your progress history.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-white">Your Progress</h1>
        <p className="text-sm text-white/50">Completed Compass sessions by subject.</p>
      </header>

      {progress.map(subject => (
        <div key={subject.subject} className="border border-white/10 rounded-xl p-4 bg-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{subject.subjectDisplay}</h2>
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {subject.totalMinutes} min
            </span>
          </div>
          <p className="text-xs text-white/50">
            {subject.completedSessions} session{subject.completedSessions === 1 ? '' : 's'} completed
            {subject.lastCompletedAt ? ` · last on ${new Date(subject.lastCompletedAt).toLocaleDateString()}` : ''}
          </p>
          {subject.recentSummaries.length > 0 && (
            <ul className="text-xs text-white/60 list-disc list-inside space-y-0.5">
              {subject.recentSummaries.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
