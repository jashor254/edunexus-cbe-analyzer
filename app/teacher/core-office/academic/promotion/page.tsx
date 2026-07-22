'use client'

// app/teacher/core-office/academic/promotion/page.tsx
//
// Sprint 10 (Core Administration Completion) — Phase 2 Activation. The
// backend (lib/core/promotions.ts: previewPromotion, runAnnualPromotion,
// GET/POST /api/core/promotions) already existed with zero UI caller — the
// Academic Office page rendered "Promotion" as an inert FutureModule
// placeholder tile. This page adds no new business logic: the "promote or
// graduate" suggestion per learner is exactly previewPromotion()'s existing
// `suggested_action` field (Grade 9 -> graduate, everything else ->
// promote); this screen only lets an admin confirm or override it per
// learner before submitting. Graduation is a `promotion_type` value on the
// same decisions array, not a separate workflow — so this one screen also
// closes the "Graduation" placeholder, which the previous page listed
// separately despite having no distinct backend of its own.
//
// Sprint 12 Wave 2 (Critical 2 + High 4, Release Blocker Remediation) —
// this page previously never collected a destination class at all, which
// is why every "promoted"/"graduated" decision was submitted with
// `to_class_id: undefined` and runAnnualPromotion() only ever logged an
// audit row without ever actually re-enrolling the learner (the Critical
// finding). This page now: (1) requires a destination academic year and a
// per-learner destination class before a promote/repeat decision can be
// submitted, reusing the exact same GET /api/core/classes call the
// Structure page already uses; (2) shows a non-blocking "no report card
// generated yet" warning per row (High 4) — a warning, never a block, so a
// school may still intentionally promote without complete academic
// evidence; (3) requires a deliberate two-click confirm before running,
// matching Transfer's and Report Publish's pattern for an equally
// irreversible action (the Sprint 11 UX-consistency finding).

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, AlertTriangle, CheckCircle2, XCircle, TrendingUp, GraduationCap } from 'lucide-react'
import type { AcademicYear, ClassWithDetails, Term } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'

type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

type PreviewRow = {
  learner_id: string
  full_name: string
  admission_number: string
  current_class: string
  grade_name: string
  suggested_action: 'promote' | 'graduate'
  hasReportCard: boolean
}

type PromotionDecision = 'promote' | 'graduate' | 'repeat' | 'skip'

type RunResult = { processed: number; errors: string[] }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

export default function PromotionPage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [academicYears, setAcademicYears] = useState<AcademicYear[] | null>(null)
  const [yearId, setYearId] = useState('')
  const [termId, setTermId] = useState('')
  const [destinationYearId, setDestinationYearId] = useState('')
  const [destinationClasses, setDestinationClasses] = useState<ClassWithDetails[] | null>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [decisions, setDecisions] = useState<Record<string, PromotionDecision>>({})
  const [destinationClassByLearner, setDestinationClassByLearner] = useState<Record<string, string>>({})
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [running, setRunning] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)

  useEffect(() => {
    if (!membership || !isAdminTier) return
    fetchJson<{ years: AcademicYear[]; terms: Term[] }>(`/api/core/academic-years?schoolId=${membership.schoolId}`)
      .then(({ years }) => {
        setAcademicYears(years)
        const current = years.find(y => y.is_current)
        if (current) setYearId(current.id)
        if (membership.currentTerm) setTermId(membership.currentTerm.id)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load academic years'))
  }, [membership, isAdminTier])

  const loadDestinationClasses = useCallback((yearId: string) => {
    if (!membership || !yearId) { setDestinationClasses(null); return }
    fetchJson<{ classes: ClassWithDetails[] }>(`/api/core/classes?schoolId=${membership.schoolId}&academicYearId=${yearId}`)
      .then(({ classes }) => setDestinationClasses(classes))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load destination classes'))
  }, [membership])

  useEffect(() => { loadDestinationClasses(destinationYearId) }, [destinationYearId, loadDestinationClasses])

  async function loadPreview() {
    if (!membership || !yearId || !termId) return
    setLoadingPreview(true); setError(''); setResult(null)
    try {
      const rows = await fetchJson<PreviewRow[]>(`/api/core/promotions?schoolId=${membership.schoolId}&academicYearId=${yearId}&termId=${termId}`)
      setPreview(rows)
      const initial: Record<string, PromotionDecision> = {}
      rows.forEach(r => { initial[r.learner_id] = r.suggested_action === 'graduate' ? 'graduate' : 'promote' })
      setDecisions(initial)
      setDestinationClassByLearner({})
      setConfirming(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load promotion preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  const toSubmit = preview ? preview.filter(r => decisions[r.learner_id] !== 'skip') : []
  const toSubmitCount = toSubmit.length
  // A promote/repeat decision needs a destination class; graduate does not.
  const missingDestination = toSubmit.some(r => decisions[r.learner_id] !== 'graduate' && !destinationClassByLearner[r.learner_id])
  const canRun = toSubmitCount > 0 && !!destinationYearId && !missingDestination

  async function runPromotion() {
    if (!membership || !preview || !yearId || !canRun) return
    if (!confirming) { setConfirming(true); return }
    setRunning(true); setError(''); setResult(null); setConfirming(false)
    try {
      const data = await fetchJson<RunResult>('/api/core/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: membership.schoolId,
          academic_year_id: yearId,
          decisions: toSubmit.map(r => {
            const decision = decisions[r.learner_id]
            const promotion_type = decision === 'graduate' ? 'graduated' : decision === 'repeat' ? 'repeated' : 'promoted'
            return {
              learner_id: r.learner_id,
              promotion_type,
              ...(promotion_type !== 'graduated' ? {
                to_class_id: destinationClassByLearner[r.learner_id],
                to_academic_year_id: destinationYearId,
              } : {}),
            }
          }),
        }),
      })
      setResult(data)
      if (data.errors.length === 0) { setPreview(null); setDecisions({}); setDestinationClassByLearner({}) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run promotion')
    } finally {
      setRunning(false)
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
      <OperationalBreadcrumb parent={{ label: 'Academic Office', href: '/teacher/core-office/academic' }} current="Promotion" />

      <header>
        <h1 className="text-xl font-black text-slate-900">Annual Promotion</h1>
        <p className="text-sm text-slate-500">
          Review and confirm each learner&apos;s promotion or graduation for {membership?.schoolName ?? 'your school'}. This is a
          deliberate, once-a-year administrative action — nothing here is undone automatically.
        </p>
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
          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Academic year being closed</label>
                <select value={yearId} onChange={e => setYearId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                  <option value="">Select…</option>
                  {(academicYears ?? []).map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (current)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Destination academic year</label>
                <select value={destinationYearId} onChange={e => { setDestinationYearId(e.target.value); setDestinationClassByLearner({}) }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                  <option value="">Select…</option>
                  {(academicYears ?? []).filter(y => y.id !== yearId).map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
            </div>
            {destinationYearId && destinationClasses !== null && destinationClasses.length === 0 && (
              <p className="text-xs text-amber-600">The destination year has no classes yet — create them in Academic Structure first.</p>
            )}
            <button onClick={loadPreview} disabled={loadingPreview || !yearId || !termId}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
              {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />} Load Learners
            </button>
          </div>

          {preview && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900">{preview.length} learner{preview.length === 1 ? '' : 's'}</h2>
                <p className="text-xs text-slate-400">{toSubmitCount} to submit</p>
              </div>
              {preview.length === 0 && <p className="text-sm text-slate-400">No active enrollments found for this academic year.</p>}
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {preview.map(r => {
                  const decision = decisions[r.learner_id] ?? 'promote'
                  const needsDestination = decision !== 'graduate' && decision !== 'skip'
                  return (
                    <div key={r.learner_id} className="border border-slate-100 rounded-lg px-3 py-2 text-sm space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-700 truncate">{r.full_name}</p>
                          <p className="text-xs text-slate-400">{r.admission_number} · {r.current_class}</p>
                        </div>
                        <select
                          value={decision}
                          onChange={e => setDecisions(d => ({ ...d, [r.learner_id]: e.target.value as PromotionDecision }))}
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-500"
                        >
                          <option value="promote">Promote</option>
                          <option value="graduate">Graduate</option>
                          <option value="repeat">Repeat</option>
                          <option value="skip">Skip</option>
                        </select>
                      </div>
                      {!r.hasReportCard && decision !== 'skip' && (
                        <p className="text-xs text-amber-600 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> No report card generated for this learner yet — you can still proceed.
                        </p>
                      )}
                      {needsDestination && (
                        <select
                          value={destinationClassByLearner[r.learner_id] ?? ''}
                          onChange={e => setDestinationClassByLearner(d => ({ ...d, [r.learner_id]: e.target.value }))}
                          disabled={!destinationYearId}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-500 disabled:opacity-40"
                        >
                          <option value="">{destinationYearId ? 'Select destination class…' : 'Select a destination academic year first'}</option>
                          {(destinationClasses ?? []).map(c => <option key={c.id} value={c.id}>{c.display_name ?? c.class_name}</option>)}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
              {preview.length > 0 && (
                <>
                  {confirming && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      This withdraws each learner&apos;s current enrollment and creates a new one in their destination class (or marks them
                      graduated) immediately. Click again to confirm.
                    </p>
                  )}
                  <button onClick={runPromotion} disabled={running || !canRun}
                    className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-xl transition-colors">
                    {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                    {confirming ? `Confirm Promotion for ${toSubmitCount} learner${toSubmitCount === 1 ? '' : 's'}` : `Run Promotion for ${toSubmitCount} learner${toSubmitCount === 1 ? '' : 's'}`}
                  </button>
                </>
              )}
            </div>
          )}

          {result && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2">
              <p className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {result.processed} learner{result.processed === 1 ? '' : 's'} processed
              </p>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600 flex items-start gap-1.5"><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
