'use client'

// app/teacher/core-office/academic/term-close/page.tsx
//
// Phase 12 (DR-03/DR-05) — the principal-facing "Close Term" screen. Calls
// the new school-level POST /api/core/school/close-term (lib/core/endOfTerm.ts's
// runSchoolEndOfTerm), never the old class-level end-of-term route — that
// route mutates the school's global current term after only ONE class,
// which is the exact defect this phase closes. This page shows every class
// in the current term, lets the admin see which are ready, and closes the
// term for the WHOLE school in one action.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import type { Term } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'
import { fetchClassTermStatuses, type ClassTermStatus } from '@/lib/core/client/termStatus'

type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

type CloseTermResult =
  | { academicYearComplete: true; classResults: unknown[] }
  | { academicYearComplete: false; nextTermId: string; classResults: unknown[] }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

const FINAL_TERM_NUMBER = 3

export default function TermClosePage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [classStatuses, setClassStatuses] = useState<ClassTermStatus[] | null>(null)
  const [nextTerm, setNextTerm] = useState<Term | null | undefined>(undefined) // undefined = not yet checked, null = genuinely missing
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [closing, setClosing] = useState(false)
  const [result, setResult] = useState<CloseTermResult | null>(null)

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)
  const currentTerm = membership?.currentTerm ?? null
  const isFinalTerm = currentTerm?.term_number === FINAL_TERM_NUMBER

  const loadStatuses = useCallback(() => {
    if (!membership?.currentTerm) return
    fetchClassTermStatuses(membership.schoolId, membership.currentTerm)
      .then(setClassStatuses)
      .catch(() => setClassStatuses([]))
  }, [membership])

  useEffect(() => { loadStatuses() }, [loadStatuses])

  useEffect(() => {
    if (!membership || !currentTerm || isFinalTerm) { setNextTerm(isFinalTerm ? null : undefined); return }
    fetchJson<{ terms: Term[] }>(`/api/core/academic-years?schoolId=${membership.schoolId}&academicYearId=${currentTerm.academic_year_id}`)
      .then(({ terms }) => setNextTerm(terms.find(t => t.term_number === currentTerm.term_number + 1) ?? null))
      .catch(() => setNextTerm(null))
  }, [membership, currentTerm, isFinalTerm])

  async function closeTerm() {
    if (!membership || !currentTerm) return
    if (!confirming) { setConfirming(true); return }
    setConfirming(false); setClosing(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/core/school/close-term', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: membership.schoolId,
          currentTermId: currentTerm.id,
          ...(isFinalTerm ? {} : { nextTerm: nextTerm ? {
            academic_year_id: nextTerm.academic_year_id, term_number: nextTerm.term_number,
            name: nextTerm.name, start_date: nextTerm.start_date, end_date: nextTerm.end_date,
          } : undefined }),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'incomplete_classes' && Array.isArray(json.failures)) {
          const names = json.failures.map((f: { className: string; reason: string }) => `${f.className}: ${f.reason}`).join('; ')
          throw new Error(`Not every class is ready yet — ${names}`)
        }
        throw new Error(json.error ?? 'Failed to close the term')
      }
      setResult(json.data as CloseTermResult)
      loadStatuses()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close the term')
    } finally {
      setClosing(false)
    }
  }

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  const totalClasses = classStatuses?.length ?? 0
  const readyClasses = classStatuses?.filter(c => c.assessmentState === 'locked' && c.reportState === 'published').length ?? 0
  const notReady = classStatuses?.filter(c => !(c.assessmentState === 'locked' && c.reportState === 'published')) ?? []
  const canClose = !!currentTerm && (isFinalTerm || nextTerm !== undefined)

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <OperationalBreadcrumb parent={{ label: 'Academic Office', href: '/teacher/core-office/academic' }} current="Close Term" />

      <header>
        <h1 className="text-xl font-black text-slate-900">Close Term</h1>
        <p className="text-sm text-slate-500">{membership?.schoolName ?? 'Your school'}</p>
      </header>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}
      {membership && !isAdminTier && <p className="text-sm text-slate-500">This view is available to school admins and headteachers.</p>}
      {membership && isAdminTier && !currentTerm && <p className="text-sm text-slate-500">No current term is set for this school yet.</p>}

      {membership && isAdminTier && currentTerm && !result && (
        <>
          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-1">
            <p className="text-sm font-bold text-slate-800">Current: {currentTerm.name}</p>
            <p className="text-xs text-slate-500">
              {isFinalTerm
                ? 'This is the final term of the academic year — closing it finalizes report cards. There is no next term to advance to; you\'ll then prepare next academic year.'
                : nextTerm ? `Advances the whole school to ${nextTerm.name} once every class is ready.` : 'Checking the next term…'}
            </p>
          </div>

          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <h2 className="text-sm font-black text-slate-900">Classes ({readyClasses} of {totalClasses} ready)</h2>
            {classStatuses === null && <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />}
            {classStatuses !== null && totalClasses === 0 && <p className="text-xs text-slate-400">No classes yet.</p>}
            <div className="space-y-1.5">
              {(classStatuses ?? []).map(c => {
                const ready = c.assessmentState === 'locked' && c.reportState === 'published'
                return (
                  <div key={c.classId} className="flex items-center gap-2.5 text-sm border border-slate-100 rounded-lg px-3 py-2">
                    {ready ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-amber-400 shrink-0" />}
                    <span className="text-slate-700 font-medium flex-1">{c.className}</span>
                    {!ready && (
                      <span className="text-xs text-amber-700">
                        {c.assessmentState !== 'locked' ? 'Assessments not locked' : c.reportState !== 'published' ? 'Reports not published' : ''}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {notReady.length > 0 && (
              <Link href="/teacher/core-term" className="flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900">
                Finish report cards for the classes above <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className="space-y-2">
            {confirming && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Closing {currentTerm.name} will finalize end-of-term processing for every class{isFinalTerm ? '' : ` and carry current learners into ${nextTerm?.name ?? 'the next term'}`}.
                Teachers do not need to update class lists manually. This cannot be undone from here.
              </p>
            )}
            <button
              onClick={closeTerm}
              disabled={closing || !canClose}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-xl transition-colors"
            >
              {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {confirming ? `Confirm — Close ${currentTerm.name}` : `Close ${currentTerm.name}`}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {result.academicYearComplete
              ? `${currentTerm?.name ?? 'This term'} closed successfully. The academic year is complete.`
              : `${currentTerm?.name ?? 'This term'} closed successfully. Your school is now in the next term.`}
          </p>
          {result.academicYearComplete && (
            <Link href="/teacher/core-office/academic/next-year" className="flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:text-teal-900">
              Prepare next academic year <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
