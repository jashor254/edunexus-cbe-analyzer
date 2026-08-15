'use client'

// app/teacher/core-office/academic/next-year/page.tsx
//
// Phase 12 (DR-02) — "Prepare Next Academic Year." Every write here is an
// existing, unmodified backend call: createAcademicYear/createTerm
// (POST /api/core/academic-years, already requireSchoolAdmin-gated, already
// existed with zero UI caller — Phase 10's exact finding) and createClass
// (POST /api/core/classes, the same endpoint Academic Structure already
// uses to create THIS year's classes — Structure's own form hardcodes the
// current year, so this page is the first UI that can create a class for a
// year that is not yet current). No new lib function, no duplicate class
// API — this page only lets the admin point the existing calls at a
// destination year instead of the current one.
//
// Readiness ("Ready for promotion") is derived here, not persisted — exactly
// the existing pattern academic/page.tsx's own readiness checklist uses.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, Circle, Plus, ArrowRight } from 'lucide-react'
import type { AcademicYear, Term, ClassWithDetails, Grade, Stream } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'

type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

const TERM_NUMBERS = [1, 2, 3] as const

export default function NextAcademicYearPage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [academicYears, setAcademicYears] = useState<AcademicYear[] | null>(null)
  const [grades, setGrades] = useState<Grade[] | null>(null)
  const [streams, setStreams] = useState<Stream[] | null>(null)

  const [yearForm, setYearForm] = useState({ name: '', start_date: '', end_date: '' })
  const [savingYear, setSavingYear] = useState(false)

  const [nextYearId, setNextYearId] = useState('')
  const [nextYearTerms, setNextYearTerms] = useState<Term[] | null>(null)
  const [nextYearClasses, setNextYearClasses] = useState<ClassWithDetails[] | null>(null)

  const [termForm, setTermForm] = useState({ term_number: '' as '' | '1' | '2' | '3', name: '', start_date: '', end_date: '' })
  const [savingTerm, setSavingTerm] = useState(false)

  const [classForm, setClassForm] = useState({ display_name: '', grade_id: '', stream_id: '' })
  const [savingClass, setSavingClass] = useState(false)

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)

  const loadYears = useCallback((schoolId: string) => {
    return fetchJson<{ years: AcademicYear[] }>(`/api/core/academic-years?schoolId=${schoolId}`)
      .then(({ years }) => {
        setAcademicYears(years)
        const current = years.find(y => y.is_current)
        const next = years.find(y => y.id !== current?.id)
        if (next) setNextYearId(next.id)
      })
  }, [])

  useEffect(() => {
    if (!membership || !isAdminTier) return
    loadYears(membership.schoolId).catch(e => setError(e instanceof Error ? e.message : 'Failed to load academic years'))
    fetchJson<{ classes: ClassWithDetails[]; grades: Grade[]; streams: Stream[] }>(`/api/core/classes?schoolId=${membership.schoolId}`)
      .then(({ grades, streams }) => { setGrades(grades); setStreams(streams) })
      .catch(() => { setGrades([]); setStreams([]) })
  }, [membership, isAdminTier, loadYears])

  const loadNextYearDetail = useCallback((schoolId: string, yearId: string) => {
    if (!yearId) { setNextYearTerms(null); setNextYearClasses(null); return }
    fetchJson<{ terms: Term[] }>(`/api/core/academic-years?schoolId=${schoolId}&academicYearId=${yearId}`)
      .then(({ terms }) => setNextYearTerms(terms))
      .catch(() => setNextYearTerms([]))
    fetchJson<{ classes: ClassWithDetails[] }>(`/api/core/classes?schoolId=${schoolId}&academicYearId=${yearId}`)
      .then(({ classes }) => setNextYearClasses(classes))
      .catch(() => setNextYearClasses([]))
  }, [])

  useEffect(() => {
    if (!membership) return
    loadNextYearDetail(membership.schoolId, nextYearId)
  }, [membership, nextYearId, loadNextYearDetail])

  async function createYear() {
    if (!membership || !yearForm.name.trim() || !yearForm.start_date || !yearForm.end_date) return
    setSavingYear(true); setError(''); setNotice('')
    try {
      const year = await fetchJson<AcademicYear>('/api/core/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: membership.schoolId, name: yearForm.name.trim(), start_date: yearForm.start_date, end_date: yearForm.end_date }),
      })
      setYearForm({ name: '', start_date: '', end_date: '' })
      setNotice('Academic year created.')
      await loadYears(membership.schoolId)
      setNextYearId(year.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create academic year')
    } finally {
      setSavingYear(false)
    }
  }

  async function createTermForNextYear() {
    if (!membership || !nextYearId || !termForm.term_number || !termForm.name.trim() || !termForm.start_date || !termForm.end_date) return
    setSavingTerm(true); setError(''); setNotice('')
    try {
      await fetchJson('/api/core/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: membership.schoolId, type: 'term',
          academic_year_id: nextYearId, term_number: Number(termForm.term_number),
          name: termForm.name.trim(), start_date: termForm.start_date, end_date: termForm.end_date,
        }),
      })
      setTermForm({ term_number: '', name: '', start_date: '', end_date: '' })
      setNotice('Term added.')
      loadNextYearDetail(membership.schoolId, nextYearId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add term')
    } finally {
      setSavingTerm(false)
    }
  }

  async function createClassForNextYear() {
    if (!membership || !nextYearId || !classForm.display_name.trim() || !classForm.grade_id) return
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
          academic_year_id: nextYearId,
        }),
      })
      setClassForm({ display_name: '', grade_id: '', stream_id: '' })
      setNotice('Class created.')
      loadNextYearDetail(membership.schoolId, nextYearId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create class')
    } finally {
      setSavingClass(false)
    }
  }

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  const nextYear = academicYears?.find(y => y.id === nextYearId) ?? null
  const readyTerms = (nextYearTerms?.length ?? 0) > 0
  const readyClasses = (nextYearClasses?.length ?? 0) > 0
  const readyForPromotion = readyTerms && readyClasses

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <OperationalBreadcrumb parent={{ label: 'Academic Office', href: '/teacher/core-office/academic' }} current="Prepare Next Academic Year" />

      <header>
        <h1 className="text-xl font-black text-slate-900">Prepare Next Academic Year</h1>
        <p className="text-sm text-slate-500">{membership?.schoolName ?? 'Your school'}</p>
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

      {membership && isAdminTier && (
        <>
          {!nextYear && (
            <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
              <h2 className="text-sm font-black text-slate-900">Create the Academic Year</h2>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Name *</label>
                  <input value={yearForm.name} onChange={e => setYearForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 2027"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Start date *</label>
                  <input type="date" value={yearForm.start_date} onChange={e => setYearForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">End date *</label>
                  <input type="date" value={yearForm.end_date} onChange={e => setYearForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
              </div>
              <button onClick={createYear} disabled={savingYear || !yearForm.name.trim() || !yearForm.start_date || !yearForm.end_date}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                {savingYear ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Academic Year
              </button>
            </section>
          )}

          {nextYear && (
            <>
              <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2">
                <h2 className="text-sm font-black text-slate-900">{nextYear.name} setup</h2>
                <ReadinessRow label="Academic year" done>{nextYear.name}</ReadinessRow>
                <ReadinessRow label="Terms" done={readyTerms}>{nextYearTerms === null ? 'Loading…' : `${nextYearTerms.length} term(s)`}</ReadinessRow>
                <ReadinessRow label="Destination classes" done={readyClasses}>{nextYearClasses === null ? 'Loading…' : `${nextYearClasses.length} class(es)`}</ReadinessRow>
                <div className="pt-2 mt-1 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">Ready for promotion</span>
                  <span className={`text-sm font-bold ${readyForPromotion ? 'text-emerald-600' : 'text-slate-400'}`}>{readyForPromotion ? 'Yes' : 'No'}</span>
                </div>
                {readyForPromotion && (
                  <Link href="/teacher/core-office/academic/promotion" className="mt-2 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
                    Review learner progression <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </section>

              <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <h2 className="text-sm font-black text-slate-900">Terms</h2>
                <div className="space-y-1.5">
                  {(nextYearTerms ?? []).map(t => (
                    <div key={t.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                      <span className="text-slate-700 font-medium">{t.name}</span>
                      <span className="text-xs text-slate-400">Term {t.term_number}</span>
                    </div>
                  ))}
                  {nextYearTerms !== null && nextYearTerms.length === 0 && <p className="text-xs text-slate-400">No terms yet.</p>}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Term #</label>
                    <select value={termForm.term_number} onChange={e => setTermForm(f => ({ ...f, term_number: e.target.value as typeof f.term_number }))}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-teal-500">
                      <option value="">…</option>
                      {TERM_NUMBERS.filter(n => !(nextYearTerms ?? []).some(t => t.term_number === n)).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Name</label>
                    <input value={termForm.name} onChange={e => setTermForm(f => ({ ...f, name: e.target.value }))} placeholder="Term 1"
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Start</label>
                    <input type="date" value={termForm.start_date} onChange={e => setTermForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">End</label>
                    <input type="date" value={termForm.end_date} onChange={e => setTermForm(f => ({ ...f, end_date: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-teal-500" />
                  </div>
                </div>
                <button onClick={createTermForNextYear}
                  disabled={savingTerm || !termForm.term_number || !termForm.name.trim() || !termForm.start_date || !termForm.end_date}
                  className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                  {savingTerm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Term
                </button>
              </section>

              <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <h2 className="text-sm font-black text-slate-900">Destination Classes</h2>
                <div className="space-y-1.5">
                  {(nextYearClasses ?? []).map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                      <span className="text-slate-700 font-medium">{c.display_name ?? c.class_name}</span>
                      <span className="text-xs text-slate-400">{c.grades?.name ?? '—'}{c.streams?.name ? ` · ${c.streams.name}` : ''}</span>
                    </div>
                  ))}
                  {nextYearClasses !== null && nextYearClasses.length === 0 && <p className="text-xs text-slate-400">No destination classes yet.</p>}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Class name *</label>
                    <input value={classForm.display_name} onChange={e => setClassForm(f => ({ ...f, display_name: e.target.value }))} placeholder="e.g. Grade 8 East"
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
                </div>
                <button onClick={createClassForNextYear} disabled={savingClass || !classForm.display_name.trim() || !classForm.grade_id}
                  className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                  {savingClass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Class
                </button>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}

function ReadinessRow({ label, done, children }: { label: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm py-1">
      {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-amber-400 shrink-0" />}
      <span className="text-slate-600 flex-1">{label}</span>
      <span className="text-xs text-slate-400">{children}</span>
    </div>
  )
}
