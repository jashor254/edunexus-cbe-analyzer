'use client'

// app/teacher/attendance/[sessionId]/page.tsx
//
// Sprint 11F — Session Detail. Shows session metadata and every existing
// record (status/arrival/departure/notes), each editable (PATCH) and
// deletable (DELETE, with confirmation), plus a "Delete Session" action
// (DELETE, with confirmation). Also lists any roster learner who has no
// record yet and lets a teacher mark them individually (single POST) —
// not in the sprint's literal screen description, but included
// deliberately to avoid a real dead end: a session created but abandoned
// before the bulk Save on /teacher/attendance/new (zero records) would
// otherwise be unrecoverable through this UI. This uses only the existing
// single-record create endpoint — no new validation, no bulk call here.
//
// Sprint 11H — this page is the "reopen session" workflow Phase 1's audit
// centered on: now shows the session's canonical completion state
// (created / partially marked / fully marked — Phase 2) fetched via
// getSessionWithCompletion, so a teacher reopening a session sees exactly
// how much is left, never guessing from the record list alone.

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, ArrowLeft, Trash2 } from 'lucide-react'
import {
  fetchMembership, fetchClasses, fetchClassRoster,
  getSessionWithCompletion, listRecordsForSession, updateRecord, deleteRecord, deleteSession,
  classLabel, learnerLabel,
  type Membership, type ClassOption, type LearnerOption,
  type AttendanceSessionWithCompletion, type AttendanceRecord, type AttendanceStatus,
} from '@/components/attendance/attendanceClient'
import { AttendanceLearnerRow } from '@/components/attendance/AttendanceLearnerRow'

async function createSingleRecord(schoolId: string, sessionId: string, learnerId: string, status: AttendanceStatus): Promise<AttendanceRecord> {
  const res = await fetch(`/api/core/attendance/${sessionId}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ schoolId, learnerId, status }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? (typeof json.error === 'string' ? json.error : 'Request failed'))
  return json.data as AttendanceRecord
}

type EditState = { status: AttendanceStatus; arrivalTime: string; departureTime: string; notes: string; saving?: boolean }

export default function AttendanceSessionDetailPage() {
  const router = useRouter()
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId

  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [session, setSession] = useState<AttendanceSessionWithCompletion | null>(null)
  const [classes, setClasses] = useState<ClassOption[] | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null)
  const [roster, setRoster] = useState<LearnerOption[] | null>(null)
  const [edits, setEdits] = useState<Record<string, EditState>>({})
  const [newStatuses, setNewStatuses] = useState<Record<string, AttendanceStatus>>({})
  const [creatingLearnerId, setCreatingLearnerId] = useState<string | null>(null)
  const [deletingSession, setDeletingSession] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMembership()
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const refresh = useCallback(async () => {
    if (!membership) return
    try {
      const [s, r] = await Promise.all([
        getSessionWithCompletion(membership.schoolId, sessionId),
        listRecordsForSession(membership.schoolId, sessionId),
      ])
      setSession(s)
      setRecords(r)
      setEdits(Object.fromEntries(r.map(rec => [rec.id, {
        status: rec.status,
        arrivalTime: rec.arrival_time?.slice(0, 5) ?? '',
        departureTime: rec.departure_time?.slice(0, 5) ?? '',
        notes: rec.notes ?? '',
      }])))
      const learners = await fetchClassRoster(membership.schoolId, s.class_id, s.term_id)
      setRoster(learners)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load this session')
    }
  }, [membership, sessionId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!membership) return
    fetchClasses(membership.schoolId)
      .then(({ classes }) => setClasses(classes))
      .catch(() => setClasses([]))
  }, [membership])

  async function saveRecord(recordId: string) {
    if (!membership) return
    const edit = edits[recordId]
    if (!edit) return
    setEdits(prev => ({ ...prev, [recordId]: { ...edit, saving: true } }))
    setError('')
    try {
      await updateRecord(membership.schoolId, sessionId, recordId, {
        status: edit.status,
        arrivalTime: edit.arrivalTime || null,
        departureTime: edit.departureTime || null,
        notes: edit.notes || null,
      })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save this record')
      setEdits(prev => ({ ...prev, [recordId]: { ...edit, saving: false } }))
    }
  }

  async function removeRecord(recordId: string) {
    if (!membership) return
    if (!confirm('Delete this attendance record? This cannot be undone.')) return
    setError('')
    try {
      await deleteRecord(membership.schoolId, sessionId, recordId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete this record')
    }
  }

  async function createRecordFor(learnerId: string) {
    if (!membership) return
    const status = newStatuses[learnerId]
    if (!status) return
    setCreatingLearnerId(learnerId)
    setError('')
    try {
      await createSingleRecord(membership.schoolId, sessionId, learnerId, status)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save this learner\'s attendance')
    } finally {
      setCreatingLearnerId(null)
    }
  }

  async function removeSession() {
    if (!membership) return
    if (!confirm('Delete this entire attendance session, including all its records? This cannot be undone.')) return
    setDeletingSession(true)
    setError('')
    try {
      await deleteSession(membership.schoolId, sessionId)
      router.push('/teacher/attendance')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete this session')
      setDeletingSession(false)
    }
  }

  if (membership === undefined || (membership && !session && !error)) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  const cls = classes?.find(c => c.id === session?.class_id)
  const markedLearnerIds = new Set((records ?? []).map(r => r.learner_id))
  const unmarkedRoster = (roster ?? []).filter(l => !markedLearnerIds.has(l.id))

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Link href="/teacher/attendance" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors font-medium">
        <ArrowLeft className="w-3.5 h-3.5" /> Attendance
      </Link>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Sprint 11I Phase 1/5 audit fix — every sibling Attendance page has
          this message; this one was missing it, leaving a user with no Core
          membership looking at a blank page with no explanation. */}
      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}

      {session && (
        <>
          <header className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-900">
                {new Date(session.attendance_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h1>
              <p className="text-sm text-slate-500">
                {cls ? classLabel(cls) : session.class_id} · <span className="capitalize">{session.session_type}</span> session
              </p>
            </div>
            <button
              onClick={removeSession}
              disabled={deletingSession}
              className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-600 disabled:opacity-40 px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" /> {deletingSession ? 'Deleting…' : 'Delete Session'}
            </button>
          </header>

          {/* Sprint 11H Phase 2/5 — the canonical completion state, computed
              fresh by the service on every load. Never guessed from the
              record list alone. */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className={`font-bold px-2.5 py-1 rounded-full ${
              session.completion.status === 'fully_marked' ? 'bg-emerald-100 text-emerald-700'
              : session.completion.status === 'partially_marked' ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500'
            }`}>
              {session.completion.status === 'fully_marked' ? 'Fully Marked'
                : session.completion.status === 'partially_marked' ? 'Partially Marked'
                : 'Created — No Records Yet'}
            </span>
            <span className="text-slate-400">
              {session.completion.recordCount} of {session.completion.rosterSize} learners recorded
            </span>
            <span className="text-slate-400">
              · {session.marked_by_teacher_id ? 'Marked' : 'Marker unknown'}
            </span>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Learners</h2>
            {records === null ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
              </div>
            ) : records.length === 0 ? (
              <p className="text-sm text-slate-500">No attendance recorded yet for this session.</p>
            ) : (
              <div className="space-y-2">
                {records.map(rec => {
                  const learner = roster?.find(l => l.id === rec.learner_id)
                  const edit = edits[rec.id]
                  if (!edit) return null
                  return (
                    <AttendanceLearnerRow
                      key={rec.id}
                      label={learner ? `${learnerLabel(learner)} (${learner.admission_number})` : rec.learner_id}
                      status={edit.status}
                      onStatusChange={status => setEdits(prev => ({ ...prev, [rec.id]: { ...prev[rec.id], status } }))}
                      detail={{
                        arrivalTime: edit.arrivalTime,
                        departureTime: edit.departureTime,
                        notes: edit.notes,
                        onArrivalChange: v => setEdits(prev => ({ ...prev, [rec.id]: { ...prev[rec.id], arrivalTime: v } })),
                        onDepartureChange: v => setEdits(prev => ({ ...prev, [rec.id]: { ...prev[rec.id], departureTime: v } })),
                        onNotesChange: v => setEdits(prev => ({ ...prev, [rec.id]: { ...prev[rec.id], notes: v } })),
                        onSave: () => saveRecord(rec.id),
                        onDelete: () => removeRecord(rec.id),
                        saving: edit.saving,
                      }}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {unmarkedRoster.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Not Yet Marked</h2>
              <div className="space-y-2">
                {unmarkedRoster.map(l => (
                  <AttendanceLearnerRow
                    key={l.id}
                    label={`${learnerLabel(l)} (${l.admission_number})`}
                    status={newStatuses[l.id] ?? null}
                    onStatusChange={status => setNewStatuses(prev => ({ ...prev, [l.id]: status }))}
                    create={{
                      onSave: () => createRecordFor(l.id),
                      saving: creatingLearnerId === l.id,
                      canSave: !!newStatuses[l.id],
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
