'use client'

// app/teacher/attendance/page.tsx
//
// Sprint 11F — the canonical Attendance workspace landing page. Composes
// existing reads only: /api/core/my-membership, /api/core/academic-years,
// /api/core/classes (all pre-existing Core routes), and the Sprint 11E
// Attendance API's session listing. No business logic, no calculation —
// "recent sessions" is just the first 3 of what the API already returned,
// sorted by date, exactly as they came back.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, CalendarRange, ArrowRight, History, UserCheck } from 'lucide-react'
import {
  fetchMembership, fetchCurrentAcademicYear, fetchClasses, listSessionsForClass,
  classLabel, type Membership, type ClassOption, type AttendanceSession,
} from '@/components/attendance/attendanceClient'
import { AttendanceHistoryTable } from '@/components/attendance/AttendanceHistoryTable'

const RECENT_SESSIONS_PER_CLASS = 3

export default function AttendanceWorkspacePage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [currentYearName, setCurrentYearName] = useState<string | null>(null)
  const [classes, setClasses] = useState<ClassOption[] | null>(null)
  const [sessionsByClass, setSessionsByClass] = useState<Record<string, AttendanceSession[]>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMembership()
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  useEffect(() => {
    if (!membership) return
    fetchCurrentAcademicYear(membership.schoolId)
      .then(({ years }) => setCurrentYearName(years.find(y => y.is_current)?.name ?? null))
      .catch(() => setCurrentYearName(null))
    fetchClasses(membership.schoolId)
      .then(({ classes }) => setClasses(classes))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load classes'))
  }, [membership])

  useEffect(() => {
    if (!membership || !classes || classes.length === 0) return
    Promise.all(classes.map(c => listSessionsForClass(membership.schoolId, c.id).catch(() => [] as AttendanceSession[])))
      .then(results => {
        const map: Record<string, AttendanceSession[]> = {}
        classes.forEach((c, i) => { map[c.id] = results[i] })
        setSessionsByClass(map)
      })
  }, [membership, classes])

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-teal-600" /> Attendance
        </h1>
        <p className="text-sm text-slate-500">
          {membership ? `${membership.schoolName} — ${today}` : today}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {currentYearName ? `Academic Year: ${currentYearName}` : ''}
          {currentYearName && membership?.currentTerm ? ' · ' : ''}
          {membership?.currentTerm ? `Current Term: ${membership.currentTerm.name}` : ''}
        </p>
      </header>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}

      {membership && !membership.currentTerm && (
        <p className="text-sm text-slate-500">No current term is set for {membership.schoolName} yet.</p>
      )}

      {membership && membership.currentTerm && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Current Classes</h2>
            <Link href="/teacher/attendance/history" className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium">
              <History className="w-3.5 h-3.5" /> Full history
            </Link>
          </div>

          {classes === null && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
            </div>
          )}

          {classes !== null && classes.length === 0 && (
            <p className="text-sm text-slate-500">No classes found for this school yet.</p>
          )}

          {classes !== null && classes.map(cls => (
            <div key={cls.id} className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{classLabel(cls)}</p>
                  <p className="text-xs text-slate-400">
                    {cls.grades?.name ?? 'Grade —'}{cls.streams?.name ? ` · ${cls.streams.name}` : ''}
                  </p>
                </div>
                <Link
                  href={`/teacher/attendance/new?classId=${cls.id}`}
                  className="flex items-center gap-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg transition-colors shrink-0"
                >
                  Take Attendance <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5" /> Recent Sessions
                </p>
                <AttendanceHistoryTable
                  sessions={[...(sessionsByClass[cls.id] ?? [])]
                    .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date))
                    .slice(0, RECENT_SESSIONS_PER_CLASS)}
                  emptyMessage="No sessions recorded yet for this class."
                />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
