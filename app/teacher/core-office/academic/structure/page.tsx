'use client'

// app/teacher/core-office/academic/structure/page.tsx
//
// Sprint 10 (Core Administration Completion) — Phase 2 Activation. Every
// action on this page calls a backend that already existed before this
// sprint with zero UI caller (createStream/createClass/assignSubjectToGrade/
// assignSubjectTeacher, all in lib/core/classes.ts + lib/core/subjects.ts,
// exposed via POST /api/core/classes and POST /api/core/subjects). No new
// business logic, no new API route, no new authorization rule — this page
// only arranges existing, already-admin-gated (requireSchoolAdmin) actions
// into one screen, same pattern as core-admissions/core-team.
//
// This is the "Classes" / "Subjects" activation the Academic Office page
// previously described as read-only ("Dedicated management screens for
// editing them are not yet available").

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, CheckCircle2, Plus } from 'lucide-react'
import type { ClassWithDetails, Grade, Stream, Subject, Term } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'

type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

type TeacherOption = { schoolUserId: string; fullName: string | null; email: string | null; status: 'pending' | 'active' }

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

export default function AcademicStructurePage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [grades, setGrades] = useState<Grade[] | null>(null)
  const [streams, setStreams] = useState<Stream[] | null>(null)
  const [classes, setClasses] = useState<ClassWithDetails[] | null>(null)
  const [subjects, setSubjects] = useState<Subject[] | null>(null)
  const [teachers, setTeachers] = useState<TeacherOption[] | null>(null)

  const [streamName, setStreamName] = useState('')
  const [savingStream, setSavingStream] = useState(false)

  const [classForm, setClassForm] = useState({ display_name: '', grade_id: '', stream_id: '', class_teacher_id: '', capacity: '' })
  const [savingClass, setSavingClass] = useState(false)

  const [gradeSubjectForm, setGradeSubjectForm] = useState({ grade_id: '', subject_id: '' })
  const [savingGradeSubject, setSavingGradeSubject] = useState(false)

  const [allocationClassId, setAllocationClassId] = useState('')
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[] | null>(null)
  const [allocationForm, setAllocationForm] = useState({ subject_id: '', teacher_id: '' })
  const [savingAllocation, setSavingAllocation] = useState(false)

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
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load classes'))
    fetchJson<Subject[]>('/api/core/subjects')
      .then(setSubjects)
      .catch(() => setSubjects([]))
    fetchJson<TeacherOption[]>(`/api/core/teachers?schoolId=${membership.schoolId}&list=true`)
      .then(list => setTeachers(list.filter(t => t.status === 'active')))
      .catch(() => setTeachers([]))
  }, [membership, isAdminTier, loadClasses])

  const loadClassSubjects = useCallback((schoolId: string, classId: string) => {
    fetchJson<ClassSubjectRow[]>(`/api/core/subjects?view=class-subjects&schoolId=${schoolId}&classId=${classId}`)
      .then(setClassSubjects)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load class subjects'))
  }, [])

  useEffect(() => {
    if (!membership || !allocationClassId) { setClassSubjects(null); return }
    loadClassSubjects(membership.schoolId, allocationClassId)
  }, [membership, allocationClassId, loadClassSubjects])

  async function createStream() {
    if (!membership || !streamName.trim()) return
    setSavingStream(true); setError(''); setNotice('')
    try {
      await fetchJson('/api/core/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'stream', schoolId: membership.schoolId, name: streamName.trim() }),
      })
      setStreamName('')
      setNotice('Stream created.')
      await loadClasses(membership.schoolId, membership.currentTerm?.academic_year_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create stream')
    } finally {
      setSavingStream(false)
    }
  }

  async function createClass() {
    if (!membership || !membership.currentTerm) return
    if (!classForm.display_name.trim() || !classForm.grade_id) return
    setSavingClass(true); setError(''); setNotice('')
    try {
      await fetchJson('/api/core/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: membership.schoolId,
          display_name: classForm.display_name.trim(),
          grade_id: classForm.grade_id,
          stream_id: classForm.stream_id || undefined,
          class_teacher_id: classForm.class_teacher_id || undefined,
          capacity: classForm.capacity ? Number(classForm.capacity) : undefined,
          academic_year_id: membership.currentTerm.academic_year_id,
        }),
      })
      setClassForm({ display_name: '', grade_id: '', stream_id: '', class_teacher_id: '', capacity: '' })
      setNotice('Class created.')
      await loadClasses(membership.schoolId, membership.currentTerm.academic_year_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create class')
    } finally {
      setSavingClass(false)
    }
  }

  async function assignGradeSubject() {
    if (!membership || !gradeSubjectForm.grade_id || !gradeSubjectForm.subject_id) return
    setSavingGradeSubject(true); setError(''); setNotice('')
    try {
      await fetchJson('/api/core/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: membership.schoolId, gradeId: gradeSubjectForm.grade_id, subjectId: gradeSubjectForm.subject_id }),
      })
      setNotice('Subject assigned to grade.')
      setGradeSubjectForm({ grade_id: '', subject_id: '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign subject to grade')
    } finally {
      setSavingGradeSubject(false)
    }
  }

  async function assignTeacher() {
    if (!membership || !allocationClassId || !allocationForm.subject_id || !allocationForm.teacher_id) return
    setSavingAllocation(true); setError(''); setNotice('')
    try {
      await fetchJson('/api/core/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-teacher',
          schoolId: membership.schoolId,
          classId: allocationClassId,
          subjectId: allocationForm.subject_id,
          teacherId: allocationForm.teacher_id,
        }),
      })
      setNotice('Teacher assigned to subject.')
      setAllocationForm({ subject_id: '', teacher_id: '' })
      loadClassSubjects(membership.schoolId, allocationClassId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign teacher')
    } finally {
      setSavingAllocation(false)
    }
  }

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <OperationalBreadcrumb parent={{ label: 'Academic Office', href: '/teacher/core-office/academic' }} current="Academic Structure" />

      <header>
        <h1 className="text-xl font-black text-slate-900">Academic Structure</h1>
        <p className="text-sm text-slate-500">Streams, classes, subjects and teacher allocation for {membership?.schoolName ?? 'your school'}</p>
      </header>

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
      {membership && isAdminTier && !membership.currentTerm && <p className="text-sm text-slate-500">No current term is set for this school yet — set one before creating classes.</p>}

      {membership && isAdminTier && membership.currentTerm && (
        <>
          {/* Streams */}
          <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <h2 className="text-sm font-black text-slate-900">Streams</h2>
            <div className="flex flex-wrap gap-1.5">
              {(streams ?? []).map(s => (
                <span key={s.id} className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{s.name}</span>
              ))}
              {streams !== null && streams.length === 0 && <p className="text-xs text-slate-400">No streams yet — optional for a single-stream school.</p>}
            </div>
            <div className="flex gap-2">
              <input value={streamName} onChange={e => setStreamName(e.target.value)} placeholder="e.g. East"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              <button onClick={createStream} disabled={savingStream || !streamName.trim()}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                {savingStream ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
              </button>
            </div>
          </section>

          {/* Classes */}
          <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <h2 className="text-sm font-black text-slate-900">Classes ({classes?.length ?? 0})</h2>
            <div className="space-y-1.5">
              {(classes ?? []).map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                  <span className="text-slate-700 font-medium">{c.display_name ?? c.class_name}</span>
                  <span className="text-xs text-slate-400">{c.grades?.name ?? '—'}{c.streams?.name ? ` · ${c.streams.name}` : ''}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Class name *</label>
                <input value={classForm.display_name} onChange={e => setClassForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="e.g. Grade 7 East"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Grade *</label>
                <select value={classForm.grade_id} onChange={e => setClassForm(f => ({ ...f, grade_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                  <option value="">Select…</option>
                  {(grades ?? []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Stream</label>
                <select value={classForm.stream_id} onChange={e => setClassForm(f => ({ ...f, stream_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                  <option value="">None</option>
                  {(streams ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Class teacher</label>
                <select value={classForm.class_teacher_id} onChange={e => setClassForm(f => ({ ...f, class_teacher_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                  <option value="">Unassigned</option>
                  {(teachers ?? []).map(t => <option key={t.schoolUserId} value={t.schoolUserId}>{t.fullName ?? t.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Capacity</label>
                <input type="number" min={1} value={classForm.capacity} onChange={e => setClassForm(f => ({ ...f, capacity: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              </div>
            </div>
            <button onClick={createClass} disabled={savingClass || !classForm.display_name.trim() || !classForm.grade_id}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
              {savingClass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Class
            </button>
          </section>

          {/* Subject → Grade assignment */}
          <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <h2 className="text-sm font-black text-slate-900">Assign Subjects to a Grade</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Grade</label>
                <select value={gradeSubjectForm.grade_id} onChange={e => setGradeSubjectForm(f => ({ ...f, grade_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                  <option value="">Select…</option>
                  {(grades ?? []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Subject</label>
                <select value={gradeSubjectForm.subject_id} onChange={e => setGradeSubjectForm(f => ({ ...f, subject_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                  <option value="">Select…</option>
                  {(subjects ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={assignGradeSubject} disabled={savingGradeSubject || !gradeSubjectForm.grade_id || !gradeSubjectForm.subject_id}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
              {savingGradeSubject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Assign
            </button>
          </section>

          {/* Teacher → Class + Subject allocation */}
          <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <h2 className="text-sm font-black text-slate-900">Allocate Teachers to Class Subjects</h2>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Class</label>
              <select value={allocationClassId} onChange={e => setAllocationClassId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                <option value="">Select a class…</option>
                {(classes ?? []).map(c => <option key={c.id} value={c.id}>{c.display_name ?? c.class_name}</option>)}
              </select>
            </div>

            {allocationClassId && (
              <>
                <div className="space-y-1.5">
                  {(classSubjects ?? []).map(cs => {
                    const t = teachers?.find(t => t.schoolUserId === cs.teacher_id)
                    return (
                      <div key={cs.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                        <span className="text-slate-700 font-medium">{cs.subjects.name}</span>
                        <span className="text-xs text-slate-400">{t?.fullName ?? t?.email ?? 'Assigned teacher'}</span>
                      </div>
                    )
                  })}
                  {classSubjects !== null && classSubjects.length === 0 && <p className="text-xs text-slate-400">No subjects allocated for this class yet.</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Subject</label>
                    <select value={allocationForm.subject_id} onChange={e => setAllocationForm(f => ({ ...f, subject_id: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                      <option value="">Select…</option>
                      {(subjects ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Teacher</label>
                    <select value={allocationForm.teacher_id} onChange={e => setAllocationForm(f => ({ ...f, teacher_id: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                      <option value="">Select…</option>
                      {(teachers ?? []).map(t => <option key={t.schoolUserId} value={t.schoolUserId}>{t.fullName ?? t.email}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={assignTeacher} disabled={savingAllocation || !allocationForm.subject_id || !allocationForm.teacher_id}
                  className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                  {savingAllocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Allocate
                </button>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
