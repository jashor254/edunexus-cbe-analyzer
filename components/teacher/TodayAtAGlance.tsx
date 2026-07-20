'use client'

// components/teacher/TodayAtAGlance.tsx
//
// PRP-2 (ADR-0019 §4/§6) built this as My Day's composed "today" strip.
// PRP-3 (Teacher Workflow Engine) upgrades it twice, per PRP-2A's named
// gaps:
//   - Phase 7: the attendance status now uses one batched request
//     (listSessionsForClassesOnDate) instead of one request per class —
//     replaces the documented 2+N fetch pattern with 3 total requests.
//   - Phase 6: attendance status is now actionable — it names the
//     specific class still needing attendance, not just a count.
// A "What's Next" card (Phase 2/3) is composed from the Next Action Engine
// (lib/teacherWorkflow/nextAction.ts) — a deterministic ordering of
// already-known facts (attendance gaps, teaching gaps, pending
// assessments), never a new calculation. Teaching-gap facts reuse
// ContinueWorking's own `schemes` data (already fetched once by
// DashboardDataProvider) — no new fetch for that fact.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserCheck, PieChart, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react'
import { fetchMembership, fetchClasses, listSessionsForClassesOnDate, classLabel } from '@/components/attendance/attendanceClient'
import { useDashboardData } from '@/components/teacher/DashboardDataProvider'
import { buildContinueItems } from '@/components/teacher/ContinueWorking'
import { composeNextActions, topNextAction, type AttendanceGapFact } from '@/lib/teacherWorkflow/nextAction'
import { getLastWorkingContext, clearLastWorkingContext, type LastWorkingContext } from '@/lib/config/teacherWorkspaceMemory'

type Props = {
  pendingAssessmentCount: number
  pendingAssessments: Array<{ id: string; class_id: string; title: string; class_name: string }>
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function TodayAtAGlance({ pendingAssessmentCount, pendingAssessments }: Props) {
  const { schemes } = useDashboardData()
  const [attendanceGaps, setAttendanceGaps] = useState<AttendanceGapFact[] | null>(null)
  const [attendanceTotal, setAttendanceTotal] = useState<number | null>(null)
  const [attendanceError, setAttendanceError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { membership } = await fetchMembership()
        if (!membership) { if (!cancelled) { setAttendanceGaps([]); setAttendanceTotal(0) }; return }

        const { classes } = await fetchClasses(membership.schoolId)
        if (classes.length === 0) { if (!cancelled) { setAttendanceGaps([]); setAttendanceTotal(0) }; return }

        // One batched request for every class, instead of one per class
        // (PRP-3 Phase 7 — replaces the documented 2+N fetch pattern).
        const sessions = await listSessionsForClassesOnDate(membership.schoolId, classes.map(c => c.id), todayIso())
        const markedClassIds = new Set(sessions.map(s => s.class_id))
        const gaps = classes.filter(c => !markedClassIds.has(c.id)).map(c => ({ classId: c.id, className: classLabel(c) }))

        if (!cancelled) {
          setAttendanceGaps(gaps)
          setAttendanceTotal(classes.length)
        }
      } catch {
        if (!cancelled) setAttendanceError(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const attendanceLabel = attendanceError
    ? 'Unavailable right now'
    : attendanceGaps === null
    ? 'Checking…'
    : attendanceTotal === 0
    ? 'No classes yet'
    : attendanceGaps.length === 0
    ? `Marked for all ${attendanceTotal} classes`
    : attendanceGaps.length === 1
    ? `${attendanceGaps[0].className} still needs attendance`
    : `${attendanceGaps.length} of ${attendanceTotal} classes still need attendance`

  const teachingGaps = buildContinueItems(schemes ?? []).map(item => ({
    schemeId: item.scheme.id,
    label: `${item.scheme.grade} · ${item.scheme.learning_area}`,
    track: item.track,
    done: item.done,
    total: item.total,
  }))

  const facts = {
    attendanceGaps: attendanceGaps ?? [],
    teachingGaps,
    pendingAssessments: pendingAssessments.map(a => ({ id: a.id, classId: a.class_id, title: a.title, className: a.class_name })),
  }
  // Only compose a "what's next" suggestion once attendance data has
  // actually loaded — otherwise a still-loading state could momentarily
  // suggest something that resolves itself a second later.
  const allActions = attendanceGaps === null ? null : composeNextActions(facts)
  const suggestion = allActions ? topNextAction(facts) : null

  // PRP-4 (Teacher Continuity, Phase 2) — a remembered "you were working
  // on this" context is only ever shown after being cross-checked against
  // today's real, live facts (allActions) — never trusted on its own
  // (Core Principle: never fabricate). If the remembered work is no
  // longer outstanding, the memory is stale and quietly cleared rather
  // than shown.
  const [resumeContext, setResumeContext] = useState<LastWorkingContext | null>(null)
  useEffect(() => {
    if (!allActions) return
    const remembered = getLastWorkingContext()
    if (!remembered) return
    const stillOutstanding = allActions.some(a => a.key === remembered.matchKey)
    if (stillOutstanding) {
      setResumeContext(remembered)
    } else {
      clearLastWorkingContext()
    }
    // allActions is derived fresh each render from primitive facts; this
    // effect only needs to run once those facts have actually resolved.
  }, [attendanceGaps === null, pendingAssessments.length, schemes === null])

  const resumeMatchesTop = resumeContext && suggestion && resumeContext.matchKey === suggestion.key
  const secondaryResume = resumeContext && suggestion && !resumeMatchesTop
    ? allActions?.find(a => a.key === resumeContext.matchKey) ?? null
    : null

  return (
    <div className="space-y-3">
      {suggestion && (
        <Link
          href={suggestion.href}
          className="flex items-center gap-3 border-2 border-teal-300 bg-teal-50 rounded-2xl px-5 py-4 hover:-translate-y-0.5 hover:shadow-md transition-all group"
        >
          <span className="text-[10px] font-black uppercase tracking-wide text-teal-700 bg-teal-100 rounded-full px-2 py-1 shrink-0">
            {resumeMatchesTop ? 'Continue' : 'Next'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900 truncate">{suggestion.title}</p>
            <p className="text-xs text-slate-500 truncate">{suggestion.description}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-teal-600 shrink-0" />
        </Link>
      )}

      {secondaryResume && (
        <Link
          href={secondaryResume.href}
          className="flex items-center gap-3 border border-slate-200 bg-white rounded-2xl px-5 py-3 hover:-translate-y-0.5 hover:shadow-sm transition-all group"
        >
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 bg-slate-100 rounded-full px-2 py-1 shrink-0">Continue</span>
          <p className="flex-1 min-w-0 text-sm font-bold text-slate-700 truncate">{secondaryResume.title}</p>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-600 shrink-0" />
        </Link>
      )}

      {suggestion === null && attendanceGaps !== null && (
        <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-2xl px-5 py-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-sm font-bold text-emerald-800">You&apos;re caught up — nothing urgent right now.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/teacher/attendance"
          className="flex items-center gap-3 border border-slate-200 rounded-2xl bg-white p-4 hover:-translate-y-0.5 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0">
            <UserCheck className="w-4 h-4 text-teal-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-black text-slate-900 text-sm">Attendance Today</div>
            <div className="text-slate-400 text-xs truncate">{attendanceLabel}</div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-600 shrink-0" />
        </Link>

        <Link
          href="/teacher/assessment"
          className="flex items-center gap-3 border border-slate-200 rounded-2xl bg-white p-4 hover:-translate-y-0.5 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0">
            <PieChart className="w-4 h-4 text-teal-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-black text-slate-900 text-sm">Assessment</div>
            <div className="text-slate-400 text-xs truncate">
              {pendingAssessmentCount === 0 ? 'No marks waiting to be entered' : `${pendingAssessmentCount} awaiting marks`}
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-600 shrink-0" />
        </Link>

        <Link
          href="/teacher/insights"
          className="flex items-center gap-3 border border-slate-200 rounded-2xl bg-white p-4 hover:-translate-y-0.5 hover:shadow-sm transition-all group"
        >
          <div className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-teal-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-black text-slate-900 text-sm">Insights</div>
            <div className="text-slate-400 text-xs truncate">Class gaps, cohort trends, career signals</div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-600 shrink-0" />
        </Link>
      </div>
    </div>
  )
}
