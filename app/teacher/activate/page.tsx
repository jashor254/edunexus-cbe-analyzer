'use client'

// app/teacher/activate/page.tsx
//
// Phase 2 (admin-provisioned teacher activation) — the UI for a backend
// that already existed with zero caller: POST /api/core/teachers
// (action:'accept', Sprint 9C) plus the new GET ?mine=true branch this
// phase adds (lib/core/teacherOnboarding.ts::listMyPendingInvitations).
//
// This page never lets the visitor choose a school or a role — both were
// already decided by the school administrator who invited them
// (lib/core/teacherOnboarding.ts::inviteSchoolMember). The only input this
// page collects is the teacher's own name, because acceptTeacherInvitation()
// needs it to materialize their `teachers` row on first acceptance.
//
// Reachable by any authenticated user regardless of role (proxy.ts, same
// carve-out shape as the pre-existing /teacher/setup) — a brand-new
// invitee has neither a teacher-role profile nor a teachers row yet.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle2, School as SchoolIcon } from 'lucide-react'

type Invitation = {
  schoolId: string
  schoolName: string
  role: string
  invitedAt: string
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

export default function TeacherActivatePage() {
  const router = useRouter()
  const [invitations, setInvitations] = useState<Invitation[] | null>(null)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [accepting, setAccepting] = useState<string | null>(null) // schoolId currently being accepted

  useEffect(() => {
    fetchJson<Invitation[]>('/api/core/teachers?mine=true')
      .then(setInvitations)
      .catch(e => { setInvitations([]); setError(e instanceof Error ? e.message : 'Failed to load your invitations') })
  }, [])

  async function acceptInvitation(schoolId: string) {
    if (!fullName.trim()) {
      setError('Enter your full name before accepting.')
      return
    }
    setError('')
    setAccepting(schoolId)
    try {
      const res = await fetch('/api/core/teachers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', schoolId, full_name: fullName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to accept invitation')
      // Landing destination (Task H): the normal teacher workspace, never
      // School Office — role-appropriate admin-tier routing already
      // happens on next login via /api/core/my-membership; this page does
      // not special-case school_admin invitations differently.
      router.push('/teacher/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
      setAccepting(null)
    }
  }

  if (invitations === null) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-xl font-black text-slate-900">Activate your teacher account</h1>
        <p className="text-sm text-slate-500">Accept an invitation from your school to get started.</p>
      </header>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {invitations.length === 0 ? (
        <div className="border border-slate-200 rounded-2xl p-5 bg-white text-center">
          <p className="text-sm text-slate-500">
            You don&rsquo;t have any pending school invitations. Ask your school administrator to add you as a teacher.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block text-xs text-slate-500">
            Your full name
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Jane Wanjiru"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
            />
          </label>

          {invitations.map(inv => (
            <div key={inv.schoolId} className="border border-slate-200 rounded-2xl p-4 bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <SchoolIcon className="w-4.5 h-4.5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{inv.schoolName}</p>
                  <p className="text-xs text-slate-500">Invited as {inv.role.replace('_', ' ')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => acceptInvitation(inv.schoolId)}
                disabled={accepting !== null}
                className="text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg px-3 py-2 shrink-0 flex items-center gap-1.5"
              >
                {accepting === inv.schoolId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Accept
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
