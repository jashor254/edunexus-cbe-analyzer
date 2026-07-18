'use client'

// app/teacher/core-term/status/page.tsx
//
// Sprint 10A Commit 3 — the Headteacher/Academic Office view of End-of-Term
// completion, per class, for the current term. Read-only: no mutation
// action lives on this page (Phase 7 scope guard — no new workflow engine,
// no approvals). Every number shown is read straight from the existing
// assessments/report-cards routes; nothing here recomputes what those
// routes already compute (Phase 5 — "surface, don't duplicate").
//
// Placement note (corrected after actually running this page — see
// implementation log): originally placed under app/admin/core-schools,
// which inherits proxy.ts's `/admin/*` gate — hard-locked to a single
// internal platform email, not any real school's admin/headteacher. This
// platform has no separate "school_admin" platform-auth role distinct from
// 'teacher' (confirmed: login redirects and proxy.ts's role gate only know
// 'teacher'/'parent'), so a real headteacher reaches this the same way a
// teacher reaches app/teacher/core-term — this page lives alongside it and
// gates its content on the existing Core role (from /api/core/my-membership),
// not a new platform role.

import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { Term } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { fetchClassTermStatuses, type ClassTermStatus } from '@/lib/core/client/termStatus'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'

type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

type ClassStatus = ClassTermStatus

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

export default function CoreTermStatusPage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [rows, setRows] = useState<ClassStatus[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)

  useEffect(() => {
    if (!membership?.currentTerm || !isAdminTier) return
    fetchClassTermStatuses(membership.schoolId, membership.currentTerm)
      .then(setRows)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load class status'))
  }, [membership, isAdminTier])

  const completionPct = rows && rows.length > 0
    ? Math.round((rows.filter(r => r.reportState === 'published').length / rows.length) * 100)
    : null

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <OperationalBreadcrumb parent={{ label: 'Academic Office', href: '/teacher/core-office/academic' }} current="End of Term Status" />

      <header>
        <h1 className="text-xl font-black text-slate-900">End of Term Status</h1>
        <p className="text-sm text-slate-500">
          {membership ? `${membership.schoolName}${membership.currentTerm ? ` — ${membership.currentTerm.name}` : ''}` : 'Class completion, current term'}
        </p>
      </header>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}
      {membership && !isAdminTier && <p className="text-sm text-slate-500">This view is available to school admins and headteachers.</p>}
      {membership && isAdminTier && !membership.currentTerm && <p className="text-sm text-slate-500">No current term is set for this school yet.</p>}

      {membership && isAdminTier && membership.currentTerm && (
        <>
          {completionPct !== null && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-white">
              <p className="text-sm text-slate-500">Reports published</p>
              <p className="text-3xl font-black text-slate-900 mt-1">{completionPct}%</p>
            </div>
          )}

          {rows === null && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
            </div>
          )}

          {rows !== null && rows.length === 0 && <p className="text-sm text-slate-500">No classes found for this school yet.</p>}

          {rows !== null && rows.length > 0 && (
            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white">
              {rows.map(r => (
                <div key={r.classId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-slate-700">{r.className}</span>
                  <div className="flex items-center gap-4">
                    <StatePill kind="assessment" state={r.assessmentState} />
                    <StatePill kind="report" state={r.reportState} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const ASSESSMENT_LABELS: Record<ClassStatus['assessmentState'], string> = {
  missing: 'No assessments', pending: 'Assessments pending', locked: 'Assessments locked',
}
const REPORT_LABELS: Record<ClassStatus['reportState'], string> = {
  missing: 'No reports', generated: 'Reports pending', published: 'Reports published',
}

function StatePill({ kind, state }: { kind: 'assessment' | 'report'; state: ClassStatus['assessmentState'] | ClassStatus['reportState'] }) {
  const label = kind === 'assessment' ? ASSESSMENT_LABELS[state as ClassStatus['assessmentState']] : REPORT_LABELS[state as ClassStatus['reportState']]
  const done = state === 'locked' || state === 'published'
  const missing = state === 'missing'
  const Icon = done ? CheckCircle2 : missing ? XCircle : Clock
  const color = done ? 'text-teal-600' : missing ? 'text-slate-300' : 'text-amber-500'
  return (
    <span className={`flex items-center gap-1.5 text-xs ${color}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
  )
}
