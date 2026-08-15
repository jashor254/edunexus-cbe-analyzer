'use client'

// app/teacher/core-office/academic/structure/[classId]/page.tsx
//
// Phase 8 (Principal Class Operations). Every read/write this page performs
// already existed with zero or one UI caller before this phase — see
// docs referenced in the Phase 8 closeout report. This page's only new
// contribution is: (1) a navigable per-class route (none existed —
// Academic Structure previously showed roster+allocation as an inline
// panel for a client-side-selected class, not a real URL), and (2) PATCH
// /api/core/classes/[id], wiring the previously-orphaned updateClass.
//
// Canonical roster: GET /api/core/learners (→ getClassRoster →
// learner_enrollments), never class_students. Canonical teaching coverage:
// GET /api/core/subjects?view=class-subjects (→ listClassSubjects, current
// assignments only — ended_at IS NULL).

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ClassWithDetails, Grade, Stream, GradeSubject, Subject, Term, Learner } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'

type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

// Same pending/departed distinction as the Academic Structure page:
// joinedAt is only ever stamped on acceptance, so a still-null joinedAt on
// a pending row means genuinely-invited-not-yet-departed.
type TeacherOption = { schoolUserId: string; fullName: string | null; email: string | null; status: 'pending' | 'active' | 'departed'; joinedAt: string | null }

type ClassSubjectRow = {
  id: string
  subject_id: string
  teacher_id: string
  subjects: { id: string; name: string; code: string }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

export default function ClassOperationsPage() {
  const params = useParams<{ classId: string }>()
  const classId = params.classId

  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [classes, setClasses] = useState<ClassWithDetails[] | null>(null)
  const [grades, setGrades] = useState<Grade[] | null>(null)
  const [streams, setStreams] = useState<Stream[] | null>(null)
  const [teachers, setTeachers] = useState<TeacherOption[] | null>(null)
  // Unfiltered — includes departed teachers, needed to put a name to a
  // historical (not just current/assignable) tenure in the history toggle.
  const [allTeachers, setAllTeachers] = useState<TeacherOption[] | null>(null)

  const [gradeSubjects, setGradeSubjects] = useState<Array<GradeSubject & { subjects: Subject }> | null>(null)
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[] | null>(null)
  const [allocationForm, setAllocationForm] = useState({ subject_id: '', teacher_id: '' })
  const [savingAllocation, setSavingAllocation] = useState(false)

  const [historyForSubject, setHistoryForSubject] = useState<string | null>(null)
  const [history, setHistory] = useState<Array<{ id: string; teacherId: string; startedAt: string; endedAt: string | null }> | null>(null)

  const [roster, setRoster] = useState<Learner[] | null>(null)
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({})
  const [movingLearnerId, setMovingLearnerId] = useState<string | null>(null)
  const [withdrawingLearnerId, setWithdrawingLearnerId] = useState<string | null>(null)
  const [rosterSearch, setRosterSearch] = useState('')

  const [editForm, setEditForm] = useState({ display_name: '', class_teacher_id: '', capacity: '' })
  const [editingClass, setEditingClass] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)

  const loadClasses = useCallback((schoolId: string, academicYearId?: string) => {
    const qs = academicYearId ? `&academicYearId=${academicYearId}` : ''
    return fetchJson<{ classes: ClassWithDetails[]; grades: Grade[]; streams: Stream[] }>(`/api/core/classes?schoolId=${schoolId}${qs}`)
      .then(({ classes, grades, streams }) => { setClasses(classes); setGrades(grades); setStreams(streams) })
  }, [])

  useEffect(() => {
    if (!membership || !isAdminTier) return
    loadClasses(membership.schoolId, membership.currentTerm?.academic_year_id)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load class'))
    fetchJson<TeacherOption[]>(`/api/core/teachers?schoolId=${membership.schoolId}&list=true`)
      .then(list => {
        setAllTeachers(list)
        setTeachers(list.filter(t => t.status === 'active' || (t.status === 'pending' && t.joinedAt === null)))
      })
      .catch(() => { setTeachers([]); setAllTeachers([]) })
  }, [membership, isAdminTier, loadClasses])

  const thisClass = classes?.find(c => c.id === classId) ?? null

  const loadGradeSubjects = useCallback((schoolId: string, gradeId: string) => {
    fetchJson<Array<GradeSubject & { subjects: Subject }>>(`/api/core/subjects?view=grade-subjects&schoolId=${schoolId}&gradeId=${gradeId}`)
      .then(setGradeSubjects)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load expected subjects'))
  }, [])

  const loadClassSubjects = useCallback((schoolId: string) => {
    fetchJson<ClassSubjectRow[]>(`/api/core/subjects?view=class-subjects&schoolId=${schoolId}&classId=${classId}`)
      .then(setClassSubjects)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load teaching coverage'))
  }, [classId])

  const loadRoster = useCallback((schoolId: string, termId: string) => {
    fetchJson<Learner[]>(`/api/core/learners?schoolId=${schoolId}&classId=${classId}&termId=${termId}`)
      .then(setRoster)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load class roster'))
  }, [classId])

  useEffect(() => {
    if (!membership || !thisClass) return
    if (thisClass.grade_id) loadGradeSubjects(membership.schoolId, thisClass.grade_id)
    loadClassSubjects(membership.schoolId)
  }, [membership, thisClass, loadGradeSubjects, loadClassSubjects])

  useEffect(() => {
    if (!membership?.currentTerm) { setRoster(null); return }
    loadRoster(membership.schoolId, membership.currentTerm.id)
  }, [membership, loadRoster])

  async function assignTeacher() {
    if (!membership || !allocationForm.subject_id || !allocationForm.teacher_id) return
    setSavingAllocation(true); setError(''); setNotice('')
    try {
      await fetchJson('/api/core/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-teacher',
          schoolId: membership.schoolId,
          classId,
          subjectId: allocationForm.subject_id,
          teacherId: allocationForm.teacher_id,
        }),
      })
      setNotice('Teacher assigned.')
      setAllocationForm({ subject_id: '', teacher_id: '' })
      loadClassSubjects(membership.schoolId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign teacher')
    } finally {
      setSavingAllocation(false)
    }
  }

  function toggleHistory(subjectId: string) {
    if (historyForSubject === subjectId) { setHistoryForSubject(null); setHistory(null); return }
    if (!membership) return
    setHistoryForSubject(subjectId)
    setHistory(null)
    fetchJson<Array<{ id: string; teacherId: string; startedAt: string; endedAt: string | null }>>(
      `/api/core/subjects?view=subject-history&schoolId=${membership.schoolId}&classId=${classId}&subjectId=${subjectId}`
    ).then(setHistory).catch(e => setError(e instanceof Error ? e.message : 'Failed to load history'))
  }

  async function moveLearner(learnerId: string) {
    const destinationClassId = moveTargets[learnerId]
    if (!membership || !destinationClassId) return
    setMovingLearnerId(learnerId); setError(''); setNotice('')
    try {
      await fetchJson(`/api/core/learners/${learnerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', schoolId: membership.schoolId, class_id: destinationClassId }),
      })
      setNotice('Learner moved to the new class.')
      setMoveTargets(f => { const { [learnerId]: _, ...rest } = f; return rest })
      loadRoster(membership.schoolId, membership.currentTerm!.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move learner')
    } finally {
      setMovingLearnerId(null)
    }
  }

  async function withdrawLearner(learnerId: string, learnerName: string) {
    if (!membership?.currentTerm) return
    if (!window.confirm(`Withdraw ${learnerName} from this school? Their enrollment history is preserved — this is not a deletion.`)) return
    setWithdrawingLearnerId(learnerId); setError(''); setNotice('')
    try {
      await fetchJson(`/api/core/learners/${learnerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw', schoolId: membership.schoolId, termId: membership.currentTerm.id }),
      })
      setNotice('Learner withdrawn.')
      loadRoster(membership.schoolId, membership.currentTerm.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to withdraw learner')
    } finally {
      setWithdrawingLearnerId(null)
    }
  }

  function startEditingClass() {
    if (!thisClass) return
    setEditForm({
      display_name: thisClass.display_name ?? thisClass.class_name ?? '',
      class_teacher_id: thisClass.class_teacher_id ?? '',
      capacity: thisClass.capacity ? String(thisClass.capacity) : '',
    })
    setEditingClass(true)
  }

  async function saveClassEdit() {
    if (!membership || !editForm.display_name.trim()) return
    setSavingEdit(true); setError(''); setNotice('')
    try {
      await fetchJson(`/api/core/classes/${classId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: membership.schoolId,
          display_name: editForm.display_name.trim(),
          class_teacher_id: editForm.class_teacher_id || undefined,
          capacity: editForm.capacity ? Number(editForm.capacity) : undefined,
        }),
      })
      setNotice('Class updated.')
      setEditingClass(false)
      await loadClasses(membership.schoolId, membership.currentTerm?.academic_year_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update class')
    } finally {
      setSavingEdit(false)
    }
  }

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  const unassignedSubjects = (gradeSubjects ?? []).filter(gs => !(classSubjects ?? []).some(cs => cs.subject_id === gs.subject_id))
  const assignedCount = (gradeSubjects ?? []).length - unassignedSubjects.length
  const filteredRoster = rosterSearch.trim()
    ? (roster ?? []).filter(l => `${l.first_name} ${l.last_name}`.toLowerCase().includes(rosterSearch.trim().toLowerCase()))
    : roster

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <OperationalBreadcrumb parent={{ label: 'Academic Structure', href: '/teacher/core-office/academic/structure' }} current={thisClass?.display_name ?? thisClass?.class_name ?? 'Class'} />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}
      {membership && !isAdminTier && <p className="text-sm text-slate-500">This view is available to school admins and headteachers.</p>}
      {membership && isAdminTier && !membership.currentTerm && <p className="text-sm text-slate-500">No current term is set for this school yet.</p>}
      {membership && isAdminTier && membership.currentTerm && classes !== null && !thisClass && (
        <p className="text-sm text-slate-500">This class was not found in your school.</p>
      )}

      {membership && isAdminTier && membership.currentTerm && thisClass && (
        <>
          {/* Header + readiness */}
          <header className="border border-slate-200 rounded-2xl p-5 bg-white space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-black text-slate-900">{thisClass.display_name ?? thisClass.class_name}</h1>
                <p className="text-sm text-slate-500">
                  {thisClass.grades?.name ?? 'Grade —'}{thisClass.streams?.name ? ` · ${thisClass.streams.name}` : ''} · {membership.currentTerm.name}
                </p>
              </div>
              <button onClick={startEditingClass} className="text-xs font-bold text-teal-700 hover:text-teal-900 shrink-0">Edit class</button>
            </div>

            {editingClass && (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Class name</label>
                  <input value={editForm.display_name} onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Class teacher</label>
                  <select value={editForm.class_teacher_id} onChange={e => setEditForm(f => ({ ...f, class_teacher_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                    <option value="">Unassigned</option>
                    {(teachers ?? []).map(t => <option key={t.schoolUserId} value={t.schoolUserId}>{t.fullName ?? t.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Capacity</label>
                  <input type="number" min={1} value={editForm.capacity} onChange={e => setEditForm(f => ({ ...f, capacity: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div className="flex items-end gap-2">
                  <button onClick={saveClassEdit} disabled={savingEdit || !editForm.display_name.trim()}
                    className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                    {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
                  </button>
                  <button onClick={() => setEditingClass(false)} className="text-sm font-bold text-slate-500 hover:text-slate-700 px-2 py-2">Cancel</button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-100 text-sm">
              <span className="text-slate-700 font-bold">{roster === null ? '—' : roster.length} learners</span>
              <span className="text-slate-700 font-bold">
                {gradeSubjects === null ? '—' : `${assignedCount} of ${gradeSubjects.length} learning areas assigned`}
              </span>
            </div>
            {unassignedSubjects.length > 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Needs attention: {unassignedSubjects.map(s => s.subjects.name).join(', ')} — no teacher assigned.
              </div>
            )}
          </header>

          {/* Roster */}
          <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">Learners ({roster?.length ?? 0})</h2>
              {(roster?.length ?? 0) > 8 && (
                <input value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} placeholder="Search…"
                  className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-teal-500 w-36" />
              )}
            </div>
            <div className="space-y-1.5 max-h-112 overflow-y-auto">
              {(filteredRoster ?? []).map(learner => (
                <div key={learner.id} className="flex items-center justify-between gap-2 text-sm border border-slate-100 rounded-lg px-3 py-2">
                  <span className="text-slate-700 font-medium truncate">
                    {learner.first_name} {learner.last_name} <span className="text-xs text-slate-400">({learner.admission_number})</span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={moveTargets[learner.id] ?? ''}
                      onChange={e => setMoveTargets(f => ({ ...f, [learner.id]: e.target.value }))}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-teal-500"
                    >
                      <option value="">Move to…</option>
                      {(classes ?? []).filter(c => c.id !== classId).map(c => (
                        <option key={c.id} value={c.id}>{c.display_name ?? c.class_name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => moveLearner(learner.id)}
                      disabled={movingLearnerId !== null || !moveTargets[learner.id]}
                      className="text-xs font-bold text-teal-700 hover:text-teal-900 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      {movingLearnerId === learner.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Move'}
                    </button>
                    <button
                      onClick={() => withdrawLearner(learner.id, `${learner.first_name} ${learner.last_name}`)}
                      disabled={withdrawingLearnerId !== null}
                      className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      {withdrawingLearnerId === learner.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Withdraw'}
                    </button>
                  </div>
                </div>
              ))}
              {filteredRoster !== null && filteredRoster.length === 0 && (
                <p className="text-xs text-slate-400">{rosterSearch ? 'No learners match that search.' : 'No learners currently in this class.'}</p>
              )}
            </div>
          </section>

          {/* Teaching coverage */}
          <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <h2 className="text-sm font-black text-slate-900">
              Teaching Coverage {gradeSubjects !== null && `(${assignedCount} of ${gradeSubjects.length})`}
            </h2>
            <div className="space-y-1.5">
              {(gradeSubjects ?? []).map(gs => {
                const assignment = (classSubjects ?? []).find(cs => cs.subject_id === gs.subject_id)
                const t = assignment ? teachers?.find(t => t.schoolUserId === assignment.teacher_id) : null
                const isHistoryOpen = historyForSubject === gs.subject_id
                return (
                  <div key={gs.id} className="border border-slate-100 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 font-medium">{gs.subjects.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${assignment ? 'text-slate-400' : 'text-amber-700 font-bold'}`}>
                          {assignment ? (t?.fullName ?? t?.email ?? 'Assigned teacher') : 'Not assigned'}
                        </span>
                        <button onClick={() => toggleHistory(gs.subject_id)} className="text-xs font-semibold text-slate-400 hover:text-teal-700">
                          {isHistoryOpen ? 'Hide history' : 'View history'}
                        </button>
                      </div>
                    </div>
                    {isHistoryOpen && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                        {history === null && <Loader2 className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
                        {history !== null && history.length === 0 && <p className="text-xs text-slate-400">No teaching history yet.</p>}
                        {history !== null && history.map(h => {
                          const ht = allTeachers?.find(at => at.schoolUserId === h.teacherId)
                          return (
                            <p key={h.id} className="text-xs text-slate-500">
                              {ht?.fullName ?? ht?.email ?? 'Former teacher'} —{' '}
                              {new Date(h.startedAt).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}
                              {' – '}
                              {h.endedAt ? new Date(h.endedAt).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' }) : 'Current'}
                            </p>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {gradeSubjects !== null && gradeSubjects.length === 0 && (
                <p className="text-xs text-slate-400">No learning areas assigned to this grade yet — set them up in Academic Structure.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Learning area</label>
                <select value={allocationForm.subject_id} onChange={e => setAllocationForm(f => ({ ...f, subject_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                  <option value="">Select…</option>
                  {(gradeSubjects ?? []).map(gs => <option key={gs.subject_id} value={gs.subject_id}>{gs.subjects.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Teacher</label>
                <select value={allocationForm.teacher_id} onChange={e => setAllocationForm(f => ({ ...f, teacher_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                  <option value="">Select…</option>
                  {(teachers ?? []).map(t => (
                    <option key={t.schoolUserId} value={t.schoolUserId}>
                      {t.fullName ?? t.email}{t.status === 'pending' ? ' (invited — not yet activated)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={assignTeacher} disabled={savingAllocation || !allocationForm.subject_id || !allocationForm.teacher_id}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
              {savingAllocation ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Assign
            </button>
          </section>
        </>
      )}
    </div>
  )
}
