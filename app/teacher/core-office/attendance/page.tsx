'use client'

// app/teacher/core-office/attendance/page.tsx
//
// Sprint 11G — Attendance Administration. Read-only orchestration inside
// School Office / Academic Office: exposes the operational state of the
// Attendance domain to admin-tier users, composing only routes that
// already existed before this sprint —
//   /api/core/my-membership          (admin-tier gate, unchanged)
//   /api/core/academic-years         (year/term filters + checklist)
//   /api/core/academic-readiness     (getSchoolAcademicReadiness — checklist)
//   /api/core/classes                (class list + filters)
//   /api/core/attendance             (Sprint 11E — school-wide session list,
//                                      the admin-tier-only branch Sprint 11F's
//                                      teacher workspace deliberately never
//                                      called)
//   /api/core/attendance/[id]/records (Sprint 11E — record counts for
//                                      TODAY's sessions only, to distinguish
//                                      "completed" from "pending" without a
//                                      new endpoint; see the doc's Reuse Map
//                                      for why this is bounded, not N+1 over
//                                      the whole history)
//
// No new business logic: every count below is a plain Array.filter/length
// over data the API already returned — no percentage, no trend, no
// inferred score. "Today's attendance state" and "latest attendance date"
// use only session existence/attendance_date, matching ADR-0003 §4's own
// "session existence = was attendance taken" semantics.
//
// Sprint 11H Phase 5 — replaced the "Marked"/"Not marked" label (which,
// per Sprint 11G's own Known Limitations, was always "Not marked" since
// nothing set marked_by_teacher_id before this sprint) with the genuine
// completion state (created / partially marked / fully marked — Phase 2's
// getSessionCompletionState, reused verbatim via the same
// getSessionWithCompletion client call Session Detail uses). "Completed
// Today"/"Pending Today" in the School Summary now mean the same thing:
// fully marked vs not, never inferred from record-count-greater-than-zero
// alone. If completion state hasn't loaded yet for a session, this page
// says exactly that ("Checking…") rather than guessing.

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, CalendarDays, CheckCircle2, Circle, XCircle, ArrowRight } from 'lucide-react'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'
import {
  fetchClasses, listSessionsForSchool, getSessionWithCompletion,
  classLabel, type ClassOption, type AttendanceSession, type SessionCompletion,
} from '@/components/attendance/attendanceClient'

type Membership = { schoolId: string; schoolName: string; role: string }
type AcademicYear = { id: string; name: string; is_current: boolean }
type Term = { id: string; name: string; academic_year_id: string; is_current: boolean }

type Resolved<T> = { resolved: true; value: T } | { resolved: false; value: null; reason: string }
type SchoolAcademicReadiness = {
  academicYear: Resolved<{ name: string }>
  term: Resolved<{ name: string }>
  classes: { count: number }
  teachers: { allActiveTeachersHaveCanonicalIdentity: boolean; reason?: string }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? (typeof json.error === 'string' ? json.error : 'Request failed'))
  return json.data as T
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Monday-Sunday window containing `d` — a plain date-window computation,
// not a trend or a percentage.
function weekRange(d: Date): { start: string; end: string } {
  const day = d.getDay() // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setDate(d.getDate() + diffToMonday)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: isoDate(start), end: isoDate(end) }
}

export default function AttendanceAdministrationPage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [years, setYears] = useState<AcademicYear[] | null>(null)
  const [terms, setTerms] = useState<Term[] | null>(null)
  const [readiness, setReadiness] = useState<SchoolAcademicReadiness | null>(null)
  const [classes, setClasses] = useState<ClassOption[] | null>(null)
  const [sessions, setSessions] = useState<AttendanceSession[] | null>(null)
  const [completionBySessionId, setCompletionBySessionId] = useState<Record<string, SessionCompletion>>({})
  const [error, setError] = useState('')

  const [yearFilter, setYearFilter] = useState('')
  const [termFilter, setTermFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)

  useEffect(() => {
    if (!membership || !isAdminTier) return
    fetchJson<{ years: AcademicYear[]; terms: Term[] }>(`/api/core/academic-years?schoolId=${membership.schoolId}`)
      .then(({ years, terms }) => {
        setYears(years)
        setTerms(terms)
        setYearFilter(years.find(y => y.is_current)?.id ?? '')
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load academic years'))

    fetchJson<SchoolAcademicReadiness>(`/api/core/academic-readiness?schoolId=${membership.schoolId}`)
      .then(setReadiness)
      .catch(() => setReadiness(null))

    fetchClasses(membership.schoolId)
      .then(({ classes }) => setClasses(classes))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load classes'))

    listSessionsForSchool(membership.schoolId)
      .then(setSessions)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load attendance sessions'))
  }, [membership, isAdminTier])

  const today = useMemo(() => isoDate(new Date()), [])
  const { start: weekStart, end: weekEnd } = useMemo(() => weekRange(new Date()), [])

  const todaysSessions = useMemo(() => (sessions ?? []).filter(s => s.attendance_date === today), [sessions, today])

  // One latest session per class, from the unfiltered full session list —
  // "latest" always means the actual latest, independent of the year/term/
  // class filters above (which only narrow what's *displayed*).
  const latestSessionByClass = useMemo(() => {
    const map: Record<string, AttendanceSession> = {}
    for (const s of sessions ?? []) {
      const current = map[s.class_id]
      if (!current || s.attendance_date > current.attendance_date) map[s.class_id] = s
    }
    return map
  }, [sessions])

  // Completion state is fetched only for the sessions this page actually
  // displays a state for — today's sessions (School Summary) and each
  // class's latest session (Class List) — never the whole history.
  useEffect(() => {
    if (!membership) return
    const ids = new Set<string>()
    todaysSessions.forEach(s => ids.add(s.id))
    Object.values(latestSessionByClass).forEach(s => ids.add(s.id))
    if (ids.size === 0) return

    Promise.all(
      Array.from(ids).map(id =>
        getSessionWithCompletion(membership.schoolId, id)
          .then(s => [id, s.completion] as const)
          .catch(() => null),
      ),
    ).then(results => {
      setCompletionBySessionId(prev => {
        const next = { ...prev }
        for (const r of results) if (r) next[r[0]] = r[1]
        return next
      })
    })
  }, [membership, todaysSessions, latestSessionByClass])

  const filteredSessions = useMemo(() => {
    return (sessions ?? []).filter(s =>
      (!yearFilter || s.academic_year_id === yearFilter) &&
      (!termFilter || s.term_id === termFilter) &&
      (!classFilter || s.class_id === classFilter),
    )
  }, [sessions, yearFilter, termFilter, classFilter])

  const sessionsToday = filteredSessions.filter(s => s.attendance_date === today)
  const sessionsThisWeek = filteredSessions.filter(s => s.attendance_date >= weekStart && s.attendance_date <= weekEnd)
  const completedToday = sessionsToday.filter(s => completionBySessionId[s.id]?.status === 'fully_marked').length
  const pendingToday = sessionsToday.filter(s => completionBySessionId[s.id] && completionBySessionId[s.id].status !== 'fully_marked').length

  const visibleClasses = useMemo(() => {
    return (classes ?? []).filter(c =>
      (!yearFilter || c.academic_year_id === yearFilter) &&
      (!classFilter || c.id === classFilter),
    )
  }, [classes, yearFilter, classFilter])

  const filteredTerms = useMemo(() => (terms ?? []).filter(t => !yearFilter || t.academic_year_id === yearFilter), [terms, yearFilter])

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  const checklist: Array<{ label: string; ok: boolean }> = readiness ? [
    { label: 'Academic Year exists', ok: readiness.academicYear.resolved },
    { label: 'Current Term exists', ok: readiness.term.resolved },
    { label: 'Classes exist', ok: readiness.classes.count > 0 },
    { label: 'Teachers assigned', ok: readiness.teachers.allActiveTeachersHaveCanonicalIdentity },
    { label: 'Attendance sessions created today', ok: sessionsToday.length > 0 },
  ] : []

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <OperationalBreadcrumb parent={{ label: 'Academic Office', href: '/teacher/core-office/academic' }} current="Attendance Administration" />

      <header>
        <h1 className="text-xl font-black text-slate-900">Attendance Administration</h1>
        <p className="text-sm text-slate-500">School-wide attendance sessions, by class, for {membership ? membership.schoolName : 'your school'}.</p>
      </header>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}
      {membership && !isAdminTier && <p className="text-sm text-slate-500">This view is available to school admins and headteachers.</p>}

      {membership && isAdminTier && (
        <>
          {/* Filters */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">Academic Year</span>
              <select
                value={yearFilter}
                onChange={e => { setYearFilter(e.target.value); setTermFilter('') }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900"
              >
                <option value="">All years</option>
                {(years ?? []).map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">Term</span>
              <select
                value={termFilter}
                onChange={e => setTermFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900"
              >
                <option value="">All terms</option>
                {filteredTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">Class</span>
              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900"
              >
                <option value="">All classes</option>
                {(classes ?? []).map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
              </select>
            </label>
          </div>

          {/* School Summary — plain counts only */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">School Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Classes', value: visibleClasses.length },
                { label: 'Sessions Today', value: sessionsToday.length },
                { label: 'Sessions This Week', value: sessionsThisWeek.length },
                { label: 'Completed Today', value: completedToday },
                { label: 'Pending Today', value: pendingToday },
              ].map(item => (
                <div key={item.label} className="border border-slate-200 rounded-2xl p-4 bg-white text-center">
                  <p className="text-2xl font-black text-slate-900">{sessions === null ? '—' : item.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Checklist — reuses getSchoolAcademicReadiness() plus one plain existence check */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Operational Checklist</h2>
            <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2">
              {readiness === null ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : (
                checklist.map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-sm">
                    {item.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-amber-500" />}
                    <span className={item.ok ? 'text-slate-700' : 'text-slate-500'}>{item.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Class List */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Classes</h2>
            {classes === null || sessions === null ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
              </div>
            ) : visibleClasses.length === 0 ? (
              <p className="text-sm text-slate-500">No classes match the current filters.</p>
            ) : (
              <div className="space-y-2">
                {visibleClasses.map(cls => {
                  const hasToday = todaysSessions.some(s => s.class_id === cls.id)
                  const latest = latestSessionByClass[cls.id] ?? null
                  const completion = latest ? completionBySessionId[latest.id] : undefined

                  // Phase 5 — never guess: a plain, honest label for exactly
                  // what's known. "Checking…" while the completion fetch for
                  // this class's latest session is still in flight — never
                  // presented as "not marked" before we actually know.
                  const completionLabel = !latest
                    ? 'No sessions yet'
                    : !completion
                      ? 'Checking…'
                      : completion.status === 'fully_marked'
                        ? 'Fully marked'
                        : completion.status === 'partially_marked'
                          ? `Partially marked (${completion.recordCount}/${completion.rosterSize})`
                          : 'No records yet'

                  return (
                    <div key={cls.id} className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900">{classLabel(cls)}</p>
                        {hasToday ? (
                          <span className="flex items-center gap-1 text-xs text-teal-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Taken today</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-slate-400"><Circle className="w-3.5 h-3.5" /> Not taken today</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                          {latest ? `Latest: ${new Date(latest.attendance_date).toLocaleDateString()}` : 'No sessions yet'}
                          {latest && ` · ${completionLabel}`}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          {latest && (
                            <Link href={`/teacher/attendance/${latest.id}`} className="text-teal-600 hover:text-teal-700 font-medium">
                              Latest session
                            </Link>
                          )}
                          <Link href={`/teacher/attendance/history?classId=${cls.id}`} className="flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium">
                            History <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
