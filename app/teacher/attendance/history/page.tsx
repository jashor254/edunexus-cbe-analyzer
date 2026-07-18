'use client'

// app/teacher/attendance/history/page.tsx
//
// Sprint 11F — "Attendance History": pick a class, see every session for
// it. No analytics, no chart, no percentage — the full list, reusing the
// same AttendanceHistoryTable the workspace landing page's per-class
// preview already uses, just unsliced.
//
// Sprint 11G — accepts an optional `?classId=` query param to arrive with
// a class pre-selected, the same technique `new/page.tsx` already used
// (Sprint 11F) — lets the Attendance Administration workspace's per-class
// "session history" drill-down land here directly instead of requiring a
// second manual class pick. No new page, no new business logic.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import {
  fetchMembership, fetchClasses, listSessionsForClass,
  classLabel, type Membership, type ClassOption, type AttendanceSession,
} from '@/components/attendance/attendanceClient'
import { AttendanceHistoryTable } from '@/components/attendance/AttendanceHistoryTable'

export default function AttendanceHistoryPage() {
  const searchParams = useSearchParams()
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [classes, setClasses] = useState<ClassOption[] | null>(null)
  const [classId, setClassId] = useState(searchParams.get('classId') ?? '')
  const [sessions, setSessions] = useState<AttendanceSession[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMembership()
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  useEffect(() => {
    if (!membership) return
    fetchClasses(membership.schoolId)
      .then(({ classes }) => setClasses(classes))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load classes'))
  }, [membership])

  useEffect(() => {
    async function load() {
      if (!membership || !classId) { setSessions(null); return }
      setSessions(null)
      try {
        setSessions(await listSessionsForClass(membership.schoolId, classId))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load sessions')
        setSessions([])
      }
    }
    load()
  }, [membership, classId])

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  const selectedClass = classes?.find(c => c.id === classId)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Link href="/teacher/attendance" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors font-medium">
        <ArrowLeft className="w-3.5 h-3.5" /> Attendance
      </Link>

      <header>
        <h1 className="text-xl font-black text-slate-900">Attendance History</h1>
        <p className="text-sm text-slate-500">Select a class to see its previous attendance sessions.</p>
      </header>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}

      {membership && (
        <>
          <div className="border border-slate-200 rounded-2xl p-4 bg-white">
            <label className="block text-sm text-slate-600 mb-1.5">Class</label>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
            >
              <option value="">Select a class…</option>
              {(classes ?? []).map(c => (
                <option key={c.id} value={c.id}>{classLabel(c)}</option>
              ))}
            </select>
          </div>

          {classId && sessions === null && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
            </div>
          )}

          {classId && sessions !== null && (
            <AttendanceHistoryTable
              sessions={sessions}
              classLabel={selectedClass ? classLabel(selectedClass) : undefined}
              emptyMessage="No attendance sessions recorded yet for this class."
            />
          )}
        </>
      )}
    </div>
  )
}
