'use client'

// app/teacher/attendance/new/page.tsx
//
// Sprint 11F — Taking Attendance. Choose Class -> Date -> Session Type,
// load the roster, mark each learner, Save. The Save button fires exactly
// one API call (bulkCreateRecords) — no auto-save, no derived summary.
//
// Session creation happens at "Load Learners" time, not at Save, because a
// session must exist before records can be attached to it (the nested
// /records route is keyed by session id) — this is a structural
// requirement of the API shape from Sprint 11E, not an extra business rule
// invented here. If a session already exists for the chosen class+date and
// already has at least one record, this page hands off to the Session
// Detail screen instead of attempting a merge (bulkRecordAttendance's own
// duplicate-learner rule would reject re-marking an already-marked learner
// anyway — reconciling that is Session Detail's job, not this workflow's).

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import {
  fetchMembership, fetchClasses, fetchClassRoster,
  listSessionsForClass, listRecordsForSession, createSession, bulkCreateRecords,
  classLabel, learnerLabel,
  type Membership, type ClassOption, type LearnerOption, type AttendanceStatus,
} from '@/components/attendance/attendanceClient'
import { AttendanceToolbar } from '@/components/attendance/AttendanceToolbar'
import { AttendanceLearnerRow } from '@/components/attendance/AttendanceLearnerRow'
import { setLastWorkingContext } from '@/lib/config/teacherWorkspaceMemory'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function TakeAttendancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [classes, setClasses] = useState<ClassOption[] | null>(null)
  const [classId, setClassId] = useState(searchParams.get('classId') ?? '')
  const [date, setDate] = useState(today())

  const [step, setStep] = useState<'select' | 'marking'>('select')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [roster, setRoster] = useState<LearnerOption[] | null>(null)
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({})

  const [loadingRoster, setLoadingRoster] = useState(false)
  const [saving, setSaving] = useState(false)
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

  const selectedClass = useMemo(() => classes?.find(c => c.id === classId) ?? null, [classes, classId])

  async function loadLearners() {
    if (!membership?.currentTerm || !classId) return
    // Sprint 11I Phase 1/5 audit fix — a class with no resolvable academic
    // year (classes.academic_year_id is nullable in the schema, even though
    // the activation pipeline always sets it in practice) previously made
    // this button a silent no-op: clicking it did nothing, with zero
    // feedback. Say exactly what's wrong instead of failing silently.
    if (!selectedClass?.academic_year_id) {
      setError('This class has no academic year set, so an attendance session cannot be created for it yet.')
      return
    }
    setError('')
    setLoadingRoster(true)
    try {
      // A class+date+session may already exist — reuse it if it's still
      // unmarked, hand off to Session Detail if it already has records.
      const existingSessions = await listSessionsForClass(membership.schoolId, classId)
      const existing = existingSessions.find(s => s.attendance_date === date && s.session_type === 'daily')

      let activeSessionId: string
      if (existing) {
        const existingRecords = await listRecordsForSession(membership.schoolId, existing.id)
        if (existingRecords.length > 0) {
          router.push(`/teacher/attendance/${existing.id}`)
          return
        }
        activeSessionId = existing.id
      } else {
        const created = await createSession({
          schoolId:       membership.schoolId,
          academicYearId: selectedClass.academic_year_id,
          termId:         membership.currentTerm.id,
          classId,
          attendanceDate: date,
        })
        activeSessionId = created.id
      }

      const learners = await fetchClassRoster(membership.schoolId, classId, membership.currentTerm.id)
      setSessionId(activeSessionId)
      setRoster(learners)
      setStatuses({})
      setStep('marking')
      // PRP-4 (Teacher Continuity, Phase 3) — navigation context only
      // (class + a link back to this exact class/date), never roster
      // names or marked statuses.
      if (selectedClass) {
        setLastWorkingContext({
          kind: 'attendance',
          matchKey: `attendance-${classId}`,
          classId,
          className: classLabel(selectedClass),
          href: `/teacher/attendance/new?classId=${classId}`,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load learners')
    } finally {
      setLoadingRoster(false)
    }
  }

  async function save() {
    if (!membership || !sessionId || !roster) return
    setError('')
    setSaving(true)
    try {
      // Exactly one API call — every learner's status, bulk-submitted once.
      await bulkCreateRecords(
        membership.schoolId,
        sessionId,
        roster.map(l => ({ learnerId: l.id, status: statuses[l.id] })),
      )
      router.push(`/teacher/attendance/${sessionId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  const allMarked = roster !== null && roster.length > 0 && roster.every(l => !!statuses[l.id])

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Link href="/teacher/attendance" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors font-medium">
        <ArrowLeft className="w-3.5 h-3.5" /> Attendance
      </Link>

      <header>
        <h1 className="text-xl font-black text-slate-900">Take Attendance</h1>
        <p className="text-sm text-slate-500">Choose a class and date, then mark each learner.</p>
      </header>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}
      {membership && !membership.currentTerm && <p className="text-sm text-slate-500">No current term is set for {membership.schoolName} yet.</p>}

      {membership && membership.currentTerm && step === 'select' && (
        <>
          <AttendanceToolbar
            classes={classes ?? []}
            classId={classId}
            onClassChange={setClassId}
            date={date}
            onDateChange={setDate}
            disabled={loadingRoster}
          />
          <button
            onClick={loadLearners}
            disabled={!classId || !date || loadingRoster}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loadingRoster ? 'Loading…' : 'Load Learners'}
          </button>
        </>
      )}

      {step === 'marking' && roster && (
        <>
          <div className="border border-slate-200 rounded-2xl p-4 bg-white">
            <p className="text-sm text-slate-500">
              {selectedClass ? classLabel(selectedClass) : ''} — {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {roster.length === 0 && <p className="text-sm text-slate-500">No learners enrolled in this class for the current term.</p>}

          <div className="space-y-2">
            {roster.map(l => (
              <AttendanceLearnerRow
                key={l.id}
                label={`${learnerLabel(l)} (${l.admission_number})`}
                status={statuses[l.id] ?? null}
                onStatusChange={status => setStatuses(prev => ({ ...prev, [l.id]: status }))}
                disabled={saving}
              />
            ))}
          </div>

          {roster.length > 0 && (
            <button
              onClick={save}
              disabled={!allMarked || saving}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
            >
              {saving ? 'Saving…' : allMarked ? 'Save Attendance' : `Mark every learner to save (${roster.filter(l => !!statuses[l.id]).length}/${roster.length})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
