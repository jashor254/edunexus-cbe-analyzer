'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, CalendarDays } from 'lucide-react'
import type { HolidayPlanData } from '@/lib/holiday/types'

export default function StudentHolidayPlan() {
  const [plan, setPlan]     = useState<HolidayPlanData | null | undefined>(undefined)
  const [error, setError]   = useState<string | null>(null)

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

        const res = await fetch(`/api/holiday/mine?studentId=${studentId}`, { credentials: 'include' })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to load Holiday plan')
        setPlan(json.data.plan)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load Holiday plan')
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

  if (plan === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
      </div>
    )
  }

  if (plan === null) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center space-y-2">
        <CalendarDays className="w-8 h-8 text-white/20 mx-auto" />
        <p className="text-sm text-white/60">No Holiday Learning plan has been published for you yet.</p>
        <p className="text-xs text-white/30">Your teacher publishes this once your holiday plan is ready.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-white">{plan.holiday_period} Holiday Plan</h1>
        <p className="text-sm text-white/50">{plan.parent_summary}</p>
      </header>

      {plan.priority_gaps.length > 0 && (
        <section className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide">Focus areas this holiday</h2>
          <ul className="text-sm text-white/80 list-disc list-inside space-y-1">
            {plan.priority_gaps.map((gap, i) => <li key={i}>{gap}</li>)}
          </ul>
        </section>
      )}

      {plan.career_note && (
        <p className="text-sm text-white/60 italic">{plan.career_note}</p>
      )}

      <section className="space-y-3">
        {plan.weeks.map(week => (
          <div key={week.week} className="border border-white/10 rounded-xl p-4 bg-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{week.label}</h3>
              {week.is_rest_week && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Rest week
                </span>
              )}
            </div>
            <p className="text-sm text-white/70">
              <span className="font-medium text-white/90">Your task: </span>{week.student_task}
            </p>
            <p className="text-xs text-white/40">
              <span className="font-medium text-white/60">For your parent: </span>{week.parent_action}
            </p>
            {week.compass_topics.length > 0 && (
              <p className="text-xs text-white/40">Compass topics: {week.compass_topics.join(', ')}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
