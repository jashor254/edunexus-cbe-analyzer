'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, CalendarDays } from 'lucide-react'
import type { HolidayPlanData } from '@/lib/holiday/types'

type Props = {
  /** Sprint 5 (Parent Experience Convergence) — see StudentProgress's identical prop for rationale. */
  studentId?: string
  theme?: 'dark' | 'light'
}

export default function StudentHolidayPlan({ studentId: providedStudentId, theme = 'dark' }: Props) {
  const [plan, setPlan]     = useState<HolidayPlanData | null | undefined>(undefined)
  const [error, setError]   = useState<string | null>(null)

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

        const res = await fetch(`/api/holiday/mine?studentId=${studentId}`, { credentials: 'include' })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to load Holiday plan')
        setPlan(json.data.plan)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load Holiday plan')
      }
    }
    load()
  }, [providedStudentId])

  const light = theme === 'light'
  const t = {
    error:   light ? 'text-red-500'  : 'text-red-400',
    spinner: light ? 'text-gray-300' : 'text-white/30',
    empty:   light ? 'text-gray-300' : 'text-white/20',
    emptyMsg: light ? 'text-gray-600' : 'text-white/60',
    emptySub: light ? 'text-gray-400' : 'text-white/30',
    heading: light ? 'text-gray-900' : 'text-white',
    subhead: light ? 'text-gray-500' : 'text-white/50',
    section: light ? 'bg-teal-50 border-teal-100' : 'bg-white/5 border-white/10',
    sectionTitle: light ? 'text-teal-700' : 'text-white/40',
    sectionList: light ? 'text-gray-700' : 'text-white/80',
    careerNote: light ? 'text-gray-500' : 'text-white/60',
    card: light ? 'border-gray-200 bg-white shadow-sm' : 'border-white/10 bg-white/5',
    cardTitle: light ? 'text-gray-900' : 'text-white',
    task: light ? 'text-gray-700' : 'text-white/70',
    taskLabel: light ? 'text-gray-900' : 'text-white/90',
    parentAction: light ? 'text-teal-700' : 'text-white/40',
    parentActionLabel: light ? 'text-teal-900' : 'text-white/60',
    compassTopics: light ? 'text-gray-400' : 'text-white/40',
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-sm ${t.error} p-6`}>
        <AlertCircle className="w-4 h-4" /> {error}
      </div>
    )
  }

  if (plan === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className={`w-5 h-5 ${t.spinner} animate-spin`} />
      </div>
    )
  }

  if (plan === null) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center space-y-2">
        <CalendarDays className={`w-8 h-8 ${t.empty} mx-auto`} />
        <p className={`text-sm ${t.emptyMsg}`}>{light ? 'No Holiday Learning plan has been published yet.' : 'No Holiday Learning plan has been published for you yet.'}</p>
        <p className={`text-xs ${t.emptySub}`}>The teacher publishes this once the holiday plan is ready.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <header>
        <h1 className={`text-xl font-semibold ${t.heading}`}>{plan.holiday_period} Holiday Plan</h1>
        <p className={`text-sm ${t.subhead}`}>{plan.parent_summary}</p>
      </header>

      {plan.priority_gaps.length > 0 && (
        <section className={`border rounded-xl p-4 space-y-2 ${t.section}`}>
          <h2 className={`text-xs font-semibold uppercase tracking-wide ${t.sectionTitle}`}>Focus areas this holiday</h2>
          <ul className={`text-sm list-disc list-inside space-y-1 ${t.sectionList}`}>
            {plan.priority_gaps.map((gap, i) => <li key={i}>{gap}</li>)}
          </ul>
        </section>
      )}

      {plan.career_note && (
        <p className={`text-sm italic ${t.careerNote}`}>{plan.career_note}</p>
      )}

      <section className="space-y-3">
        {plan.weeks.map(week => (
          <div key={week.week} className={`border rounded-xl p-4 space-y-2 ${t.card}`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold ${t.cardTitle}`}>{week.label}</h3>
              {week.is_rest_week && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 border border-emerald-500/30">
                  Rest week
                </span>
              )}
            </div>
            <p className={`text-sm ${t.task}`}>
              <span className={`font-medium ${t.taskLabel}`}>Their task: </span>{week.student_task}
            </p>
            <p className={`text-xs ${t.parentAction}`}>
              <span className={`font-medium ${t.parentActionLabel}`}>For you: </span>{week.parent_action}
            </p>
            {week.compass_topics.length > 0 && (
              <p className={`text-xs ${t.compassTopics}`}>Compass topics: {week.compass_topics.join(', ')}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
