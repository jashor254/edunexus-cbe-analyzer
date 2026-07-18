'use client'

// app/teacher/core-team/page.tsx
//
// Sprint 10E Phase 2 — the UI for a backend that already existed with zero
// caller: POST /api/core/teachers (action:'invite', Sprint 9C) and the new
// GET ?list=true branch this sprint adds. This screen contains no business
// logic of its own — invite validation, idempotency (already
// pending/already member), and identity creation all happen in
// lib/core/teacherOnboarding.ts, unchanged. This page only calls the route
// and renders what it returns.
//
// No email/token invitation system is built here (per Sprint 9C's own
// documented scope) — inviting someone with no EduNexus account yet
// surfaces as the existing 'no_account' status, shown as-is, not worked
// around.

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, UserPlus, Clock, CheckCircle2 } from 'lucide-react'
import type { Term } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'

type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

type TeacherMembership = {
  schoolUserId: string
  userId: string
  fullName: string | null
  email: string | null
  status: 'pending' | 'active'
  joinedAt: string | null
  invitedAt: string
}

type InviteResult = {
  status: 'invited' | 'already_pending' | 'already_member' | 'no_account'
  email?: string
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

const INVITE_RESULT_LABEL: Record<InviteResult['status'], { text: string; tone: 'success' | 'info' | 'error' }> = {
  invited:         { text: 'Invitation sent — they can now accept it from their account.', tone: 'success' },
  already_pending: { text: 'Already invited — waiting for them to accept.',                tone: 'info' },
  already_member:  { text: 'This person is already a teacher at this school.',             tone: 'info' },
  no_account:      { text: 'No EduNexus account exists for that email yet — they need to sign up first.', tone: 'error' },
}

export default function CoreTeamPage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [teachers, setTeachers] = useState<TeacherMembership[] | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)

  const loadTeachers = useCallback((schoolId: string) => {
    fetchJson<TeacherMembership[]>(`/api/core/teachers?schoolId=${schoolId}&list=true`)
      .then(setTeachers)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load teachers'))
  }, [])

  useEffect(() => {
    if (membership && isAdminTier) loadTeachers(membership.schoolId)
  }, [membership, isAdminTier, loadTeachers])

  async function submitInvite() {
    if (!membership || !email.trim()) return
    setInviting(true)
    setInviteResult(null)
    setError('')
    try {
      const result = await fetchJson<InviteResult>('/api/core/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', schoolId: membership.schoolId, email: email.trim() }),
      })
      setInviteResult(result)
      if (result.status === 'invited') setEmail('')
      loadTeachers(membership.schoolId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  const pending = teachers?.filter(t => t.status === 'pending') ?? []
  const active = teachers?.filter(t => t.status === 'active') ?? []

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <OperationalBreadcrumb current="Team" />

      <header>
        <h1 className="text-xl font-black text-slate-900">Team</h1>
        <p className="text-sm text-slate-500">{membership ? membership.schoolName : 'Invite and manage teachers'}</p>
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
            <label className="block text-sm font-bold text-slate-700">Invite a teacher by email</label>
            <p className="text-xs text-slate-500">They must already have an EduNexus account — this creates a pending membership they accept themselves.</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="teacher@example.com"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
              />
              <button
                onClick={submitInvite}
                disabled={inviting || !email.trim()}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Invite
              </button>
            </div>
            {inviteResult && (
              <p className={`text-xs ${
                INVITE_RESULT_LABEL[inviteResult.status].tone === 'success' ? 'text-emerald-600' :
                INVITE_RESULT_LABEL[inviteResult.status].tone === 'error' ? 'text-red-600' : 'text-slate-500'
              }`}>
                {INVITE_RESULT_LABEL[inviteResult.status].text}
              </p>
            )}
          </div>

          {teachers === null && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
            </div>
          )}

          {teachers && (
            <div className="space-y-4">
              {pending.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Pending ({pending.length})</h2>
                  <div className="space-y-1.5">
                    {pending.map(t => (
                      <div key={t.schoolUserId} className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white">
                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{t.email ?? t.fullName ?? t.userId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Teachers ({active.length})</h2>
                {active.length === 0 && <p className="text-sm text-slate-500">No teachers have accepted an invitation yet.</p>}
                <div className="space-y-1.5">
                  {active.map(t => (
                    <div key={t.schoolUserId} className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-sm text-slate-700 truncate">{t.fullName ?? t.email ?? t.userId}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
