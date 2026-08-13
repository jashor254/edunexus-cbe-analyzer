'use client'

// app/teacher/core-admissions/page.tsx
//
// Sprint 10E Phase 3 — the UI for a backend that already existed with zero
// caller: POST /api/core/learners' class_id branch (Sprint 9D), which runs
// lib/core/learnerOnboarding.ts::onboardLearner() — Admission -> Guardian
// (optional) -> Enrollment, in one idempotent call. This page validates
// nothing itself; the route's OnboardSchema (Zod) is the single source of
// truth, and every field below maps 1:1 onto it. Guardian fields are
// genuinely optional, matching the backend contract exactly.

import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import type { ClassWithDetails, Term } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'

type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

type OnboardingStepResult = {
  step: 'learner' | 'guardian' | 'enrollment'
  status: 'created' | 'already_exists' | 'skipped' | 'failed'
  detail: string
}

type OnboardingResult = {
  schoolId: string
  learnerId?: string
  status: 'complete' | 'failed'
  steps: OnboardingStepResult[]
  failedStep?: string
  error?: string
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

const EMPTY_FORM = {
  admission_number: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '' as '' | 'male' | 'female' | 'other',
  class_id: '',
  guardian_full_name: '',
  guardian_phone: '',
  guardian_relationship: '' as '' | 'father' | 'mother' | 'guardian' | 'grandparent' | 'sibling' | 'other',
}

export default function CoreAdmissionsPage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [classes, setClasses] = useState<ClassWithDetails[] | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<OnboardingResult | null>(null)

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)

  useEffect(() => {
    if (!membership?.currentTerm || !isAdminTier) return
    fetchJson<{ classes: ClassWithDetails[] }>(
      `/api/core/classes?schoolId=${membership.schoolId}&academicYearId=${membership.currentTerm.academic_year_id}`
    )
      .then(({ classes }) => setClasses(classes))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load classes'))
  }, [membership, isAdminTier])

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const guardianStarted = form.guardian_full_name.trim() || form.guardian_phone.trim() || form.guardian_relationship
  const guardianComplete = form.guardian_full_name.trim() && form.guardian_phone.trim() && form.guardian_relationship
  const canSubmit =
    !!membership?.currentTerm &&
    form.admission_number.trim() && form.first_name.trim() && form.last_name.trim() && form.class_id &&
    (!guardianStarted || guardianComplete)

  async function submit() {
    if (!membership?.currentTerm || !canSubmit) return
    setSubmitting(true)
    setResult(null)
    setError('')
    try {
      const data = await fetchJson<OnboardingResult>('/api/core/learners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId:          membership.schoolId,
          admission_number:  form.admission_number.trim(),
          first_name:        form.first_name.trim(),
          middle_name:        form.middle_name.trim() || undefined,
          last_name:          form.last_name.trim(),
          date_of_birth:      form.date_of_birth || undefined,
          gender:             form.gender || undefined,
          class_id:           form.class_id,
          term_id:            membership.currentTerm.id,
          academic_year_id:   membership.currentTerm.academic_year_id,
          guardian: guardianComplete ? {
            full_name:    form.guardian_full_name.trim(),
            phone:        form.guardian_phone.trim(),
            relationship: form.guardian_relationship,
          } : undefined,
        }),
      })
      setResult(data)
      if (data.status === 'complete') setForm(EMPTY_FORM)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to admit learner')
    } finally {
      setSubmitting(false)
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
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <OperationalBreadcrumb current="Admit a Learner" />

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Admit a Learner</h1>
          <p className="text-sm text-slate-500">{membership ? membership.schoolName : 'Admission, guardian, and enrollment in one step'}</p>
        </div>
        {/* Bulk import supplements this form; it does not replace it. Adding one
            learner mid-term stays a one-screen job. */}
        <a
          href="/teacher/core-admissions/import"
          className="shrink-0 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        >
          Import learners
        </a>
      </header>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}
      {membership && !isAdminTier && <p className="text-sm text-slate-500">This view is available to school admins and headteachers.</p>}
      {membership && isAdminTier && !membership.currentTerm && <p className="text-sm text-slate-500">No current term is set for this school yet — set one before admitting learners.</p>}

      {membership && isAdminTier && membership.currentTerm && (
        <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Admission number *</label>
              <input value={form.admission_number} onChange={e => update('admission_number', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Class *</label>
              <select value={form.class_id} onChange={e => update('class_id', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                <option value="">Select a class…</option>
                {(classes ?? []).map(c => <option key={c.id} value={c.id}>{c.display_name ?? c.class_name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">First name *</label>
              <input value={form.first_name} onChange={e => update('first_name', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Middle name</label>
              <input value={form.middle_name} onChange={e => update('middle_name', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Last name *</label>
              <input value={form.last_name} onChange={e => update('last_name', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Date of birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Gender</label>
              <select value={form.gender} onChange={e => update('gender', e.target.value as typeof form.gender)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-500 mb-2">Guardian (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.guardian_full_name} onChange={e => update('guardian_full_name', e.target.value)}
                placeholder="Full name"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              <input value={form.guardian_phone} onChange={e => update('guardian_phone', e.target.value)}
                placeholder="Phone"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <select value={form.guardian_relationship} onChange={e => update('guardian_relationship', e.target.value as typeof form.guardian_relationship)}
              className="mt-3 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
              <option value="">Relationship…</option>
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Guardian</option>
              <option value="grandparent">Grandparent</option>
              <option value="sibling">Sibling</option>
              <option value="other">Other</option>
            </select>
            {guardianStarted && !guardianComplete && (
              <p className="text-xs text-amber-600 mt-2">Fill in name, phone, and relationship, or clear all three to skip the guardian.</p>
            )}
          </div>

          <button
            onClick={submit}
            disabled={submitting || !canSubmit}
            className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-xl transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Admit Learner
          </button>

          {result && (
            <div className="space-y-1.5 pt-2">
              {result.steps.map(s => (
                <div key={s.step} className="flex items-center gap-2 text-xs">
                  {s.status === 'failed'
                    ? <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  <span className="text-slate-600"><span className="font-bold capitalize">{s.step}:</span> {s.detail}</span>
                </div>
              ))}
              {result.status === 'complete' && (
                <p className="text-sm text-emerald-600 font-bold pt-1">Learner admitted and enrolled.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
