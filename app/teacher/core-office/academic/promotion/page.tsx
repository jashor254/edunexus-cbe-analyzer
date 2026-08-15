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

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, AlertTriangle, CheckCircle2, XCircle, TrendingUp, GraduationCap, ChevronDown, ChevronRight, Layers, ArrowRight } from 'lucide-react'
import type { AcademicYear, ClassWithDetails, Term } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'
import {
  groupByCurrentClass, applyCohortDecision, summarizeDecisions, decisionNeedsDestination,
  type PromotionDecision,
} from '@/lib/core/client/promotionBulk'

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
  // Phase 7 (Task D/9) — which learners have been individually edited since
  // the last preview load. A bulk "Apply to cohort" action only ever
  // touches learners NOT in this set (§9's "apply to unmodified learners
  // only" rule) — an exception, once made, survives every later bulk apply.
  const [overridden, setOverridden] = useState<Record<string, boolean>>({})
  // Per-cohort bulk form input (the decision/destination the admin is about
  // to apply) — ephemeral UI state, never itself part of the submit
  // payload; only what it WRITES into decisions/destinationClassByLearner
  // above ever reaches the request.
  const [cohortBulkForm, setCohortBulkForm] = useState<Record<string, { decision: PromotionDecision; destinationClassId: string }>>({})
  const [collapsedCohorts, setCollapsedCohorts] = useState<Record<string, boolean>>({})
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
      setOverridden({})
      setCohortBulkForm({})
      setCollapsedCohorts({})
      setConfirming(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load promotion preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  const toSubmit = preview ? preview.filter(r => decisions[r.learner_id] !== 'skip') : []
  const toSubmitCount = toSubmit.length
  const missingDestination = toSubmit.some(r => decisionNeedsDestination(decisions[r.learner_id] ?? 'promote') && !destinationClassByLearner[r.learner_id])
  const canRun = toSubmitCount > 0 && !!destinationYearId && !missingDestination

  // Phase 7 (Task A/E/F) — cohorts grouped from the SAME preview data
  // already loaded; no new API call. classNameById lets the summary show
  // "Grade 8A" instead of a raw class id.
  const cohorts = useMemo(() => (preview ? groupByCurrentClass(preview) : []), [preview])
  const classNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of destinationClasses ?? []) map[c.id] = c.display_name ?? c.class_name
    return map
  }, [destinationClasses])
  const schoolWideSummary = useMemo(
    () => preview ? summarizeDecisions(preview.map(r => r.learner_id), decisions, destinationClassByLearner, overridden, classNameById) : null,
    [preview, decisions, destinationClassByLearner, overridden, classNameById]
  )

  function markOverridden(learnerId: string) {
    setOverridden(o => ({ ...o, [learnerId]: true }))
  }

  function applyCohortBulk(cohortClassName: string, cohortLearnerIds: string[]) {
    const form = cohortBulkForm[cohortClassName]
    if (!form) return
    if (decisionNeedsDestination(form.decision) && !form.destinationClassId) return
    const result = applyCohortDecision({
      learnerIds: cohortLearnerIds,
      decision: form.decision,
      destinationClassId: decisionNeedsDestination(form.decision) ? form.destinationClassId : null,
      currentDecisions: decisions,
      currentDestinations: destinationClassByLearner,
      overridden,
    })
    setDecisions(result.decisions)
    setDestinationClassByLearner(result.destinations)
  }

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
      if (data.errors.length === 0) {
        setPreview(null); setDecisions({}); setDestinationClassByLearner({})
        setOverridden({}); setCohortBulkForm({}); setCollapsedCohorts({})
      }
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
            {/* Phase 12 (§22) — Phase 10 found this dropdown simply empty
                with no way out when no next year exists yet. A real link
                to the actual place that creates one, not a dead end. */}
            {academicYears !== null && academicYears.filter(y => y.id !== yearId).length === 0 && (
              <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-700">No next academic year has been prepared yet.</p>
                <Link href="/teacher/core-office/academic/next-year" className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900 shrink-0">
                  Prepare next academic year <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
            {destinationYearId && destinationClasses !== null && destinationClasses.length === 0 && (
              <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-700">The destination year has no classes yet.</p>
                <Link href="/teacher/core-office/academic/next-year" className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900 shrink-0">
                  Add destination classes <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
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

              {/* Phase 7 (Task F) — school-wide review summary, before any
                  per-cohort detail. Pure arithmetic over state already held;
                  no backend call. */}
              {schoolWideSummary && preview.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                  <p className="font-bold text-slate-600 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Review summary</p>
                  <p className="text-slate-500">
                    {schoolWideSummary.byDecision.promote} promote · {schoolWideSummary.byDecision.repeat} repeat ·{' '}
                    {schoolWideSummary.byDecision.graduate} graduate · {schoolWideSummary.byDecision.skip} skip
                    {schoolWideSummary.overriddenCount > 0 && ` · ${schoolWideSummary.overriddenCount} individually adjusted`}
                  </p>
                  {schoolWideSummary.byDestinationClass.length > 0 && (
                    <p className="text-slate-400">
                      Destinations: {schoolWideSummary.byDestinationClass.map(d => `${d.className} (${d.count})`).join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* Phase 7 (Task A/B/C/D/E) — one cohort section per source
                  class, each with its own bulk decision + destination +
                  "Apply to N" action, and a collapsible list of individual
                  rows for exceptions. Large-school usability (Task G):
                  cohorts default collapsed once they exceed 8 learners, so
                  a 400-learner school never renders 400 expanded rows at
                  once — the bulk control above the fold handles the
                  ordinary case without expanding anything. */}
              <div className="space-y-3">
                {cohorts.map(cohort => {
                  const form = cohortBulkForm[cohort.className] ?? { decision: 'promote' as PromotionDecision, destinationClassId: '' }
                  const cohortSummary = summarizeDecisions(cohort.learnerIds, decisions, destinationClassByLearner, overridden, classNameById)
                  const unmodifiedCount = cohort.learnerIds.length - cohortSummary.overriddenCount
                  const bulkNeedsDestination = decisionNeedsDestination(form.decision)
                  const isCollapsed = collapsedCohorts[cohort.className] ?? cohort.learnerIds.length > 8

                  return (
                    <div key={cohort.className} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-3 py-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-800">{cohort.className} — {cohort.learnerIds.length} eligible learner{cohort.learnerIds.length === 1 ? '' : 's'}</p>
                          <button
                            type="button"
                            onClick={() => setCollapsedCohorts(c => ({ ...c, [cohort.className]: !isCollapsed }))}
                            aria-expanded={!isCollapsed}
                            className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                          >
                            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {isCollapsed ? 'Show learners' : 'Hide learners'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          {cohortSummary.byDecision.promote} promote · {cohortSummary.byDecision.repeat} repeat ·{' '}
                          {cohortSummary.byDecision.graduate} graduate · {cohortSummary.byDecision.skip} skip
                          {cohortSummary.overriddenCount > 0 && ` · ${cohortSummary.overriddenCount} exception${cohortSummary.overriddenCount === 1 ? '' : 's'}`}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="sr-only" htmlFor={`bulk-decision-${cohort.className}`}>Bulk decision for {cohort.className}</label>
                          <select
                            id={`bulk-decision-${cohort.className}`}
                            value={form.decision}
                            onChange={e => setCohortBulkForm(f => ({ ...f, [cohort.className]: { ...form, decision: e.target.value as PromotionDecision } }))}
                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-500 bg-white"
                          >
                            <option value="promote">Promote</option>
                            <option value="graduate">Graduate</option>
                            <option value="repeat">Repeat</option>
                            <option value="skip">Skip</option>
                          </select>
                          {bulkNeedsDestination && (
                            <>
                              <label className="sr-only" htmlFor={`bulk-destination-${cohort.className}`}>Bulk destination class for {cohort.className}</label>
                              <select
                                id={`bulk-destination-${cohort.className}`}
                                value={form.destinationClassId}
                                onChange={e => setCohortBulkForm(f => ({ ...f, [cohort.className]: { ...form, destinationClassId: e.target.value } }))}
                                disabled={!destinationYearId}
                                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-500 bg-white disabled:opacity-40"
                              >
                                <option value="">{destinationYearId ? 'Destination class…' : 'Select a destination year first'}</option>
                                {(destinationClasses ?? []).map(c => <option key={c.id} value={c.id}>{c.display_name ?? c.class_name}</option>)}
                              </select>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => applyCohortBulk(cohort.className, cohort.learnerIds)}
                            disabled={unmodifiedCount === 0 || (bulkNeedsDestination && !form.destinationClassId)}
                            className="text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-1.5"
                          >
                            Apply to {unmodifiedCount} eligible learner{unmodifiedCount === 1 ? '' : 's'}
                          </button>
                        </div>
                        {cohortSummary.overriddenCount > 0 && (
                          <p className="text-xs text-slate-400">{cohortSummary.overriddenCount} learner{cohortSummary.overriddenCount === 1 ? ' has' : 's have'} an individual exception and will not be changed by Apply.</p>
                        )}
                      </div>

                      {!isCollapsed && (
                        <div className="p-2 space-y-1.5">
                          {cohort.learnerIds.map(learnerId => {
                            const r = preview.find(row => row.learner_id === learnerId)!
                            const decision = decisions[learnerId] ?? 'promote'
                            const needsDestination = decisionNeedsDestination(decision)
                            return (
                              <div key={r.learner_id} className="border border-slate-100 rounded-lg px-3 py-2 text-sm space-y-1.5">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-700 truncate">{r.full_name}</p>
                                    <p className="text-xs text-slate-400">{r.admission_number} · {r.current_class}</p>
                                  </div>
                                  <label className="sr-only" htmlFor={`decision-${r.learner_id}`}>Decision for {r.full_name}</label>
                                  <select
                                    id={`decision-${r.learner_id}`}
                                    value={decision}
                                    onChange={e => {
                                      setDecisions(d => ({ ...d, [r.learner_id]: e.target.value as PromotionDecision }))
                                      markOverridden(r.learner_id)
                                    }}
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
                                  <>
                                    <label className="sr-only" htmlFor={`destination-${r.learner_id}`}>Destination class for {r.full_name}</label>
                                    <select
                                      id={`destination-${r.learner_id}`}
                                      value={destinationClassByLearner[r.learner_id] ?? ''}
                                      onChange={e => {
                                        setDestinationClassByLearner(d => ({ ...d, [r.learner_id]: e.target.value }))
                                        markOverridden(r.learner_id)
                                      }}
                                      disabled={!destinationYearId}
                                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-500 disabled:opacity-40"
                                    >
                                      <option value="">{destinationYearId ? 'Select destination class…' : 'Select a destination academic year first'}</option>
                                      {(destinationClasses ?? []).map(c => <option key={c.id} value={c.id}>{c.display_name ?? c.class_name}</option>)}
                                    </select>
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
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
