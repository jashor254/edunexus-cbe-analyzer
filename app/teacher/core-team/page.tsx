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
  userId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

type TeacherMembership = {
  schoolUserId: string
  userId: string
  fullName: string | null
  email: string | null
  role: string
  status: 'pending' | 'active'
  joinedAt: string | null
  invitedAt: string
}

type InviteResult = {
  status: 'invited' | 'already_pending' | 'already_member' | 'role_changed' | 'no_account'
  email?: string
  previousRole?: string
}

// Human-facing labels for the two roles a school admin may hand out. The
// server holds the authoritative allowlist (INVITABLE_SCHOOL_ROLES); this is
// only how the choice is worded. 'School administrator' is what lets a school
// run itself — invite the principal here and they can manage their own staff,
// learners and academic setup without the EduNexus team in the loop.
const INVITE_ROLES = [
  { value: 'teacher',      label: 'Teacher',              hint: 'Plans and teaches. Sees their own classes.' },
  { value: 'school_admin', label: 'School administrator', hint: 'Manages staff, learners and academic setup.' },
] as const

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

const INVITE_RESULT_LABEL: Record<InviteResult['status'], { text: string; tone: 'success' | 'info' | 'error' }> = {
  invited:         { text: 'Invitation sent — they can now accept it from their account.', tone: 'success' },
  already_pending: { text: 'Already invited — waiting for them to accept.',                tone: 'info' },
  already_member:  { text: 'This person already holds that role at this school.',          tone: 'info' },
  role_changed:    { text: 'Role updated for this member.',                                tone: 'success' },
  no_account:      { text: 'No EduNexus account exists for that email yet — ask them to sign up at edunexus.co.ke first, then invite this same address.', tone: 'error' },
}

const ROLE_LABEL: Record<string, string> = {
  school_admin:        'School administrator',
  headteacher:         'Headteacher',
  deputy_headteacher:  'Deputy headteacher',
  teacher:             'Teacher',
}

export default function CoreTeamPage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [teachers, setTeachers] = useState<TeacherMembership[] | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)
  const [inviteRole, setInviteRole] = useState<(typeof INVITE_ROLES)[number]['value']>('teacher')
  const [confirmRemove, setConfirmRemove] = useState<TeacherMembership | null>(null)
  const [removing, setRemoving] = useState(false)

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
        body: JSON.stringify({
          action:   'invite',
          schoolId: membership.schoolId,
          email:    email.trim(),
          role:     inviteRole,
        }),
      })
      setInviteResult(result)
      if (result.status === 'invited' || result.status === 'role_changed') setEmail('')
      loadTeachers(membership.schoolId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  async function submitRemove() {
    if (!membership || !confirmRemove) return
    setRemoving(true)
    setError('')
    try {
      await fetchJson('/api/core/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', schoolId: membership.schoolId, userId: confirmRemove.userId }),
      })
      setConfirmRemove(null)
      loadTeachers(membership.schoolId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove access')
    } finally {
      setRemoving(false)
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
            <label className="block text-sm font-bold text-slate-700">Invite someone by email</label>
            <p className="text-xs text-slate-500">They must already have an EduNexus account — this creates a pending membership they accept themselves. No email is sent from here.</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as typeof inviteRole)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
              >
                {INVITE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="person@example.com"
                className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
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
                        <span className="ml-auto shrink-0 text-xs text-slate-400">{ROLE_LABEL[t.role] ?? t.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Active ({active.length})</h2>
                {active.length === 0 && <p className="text-sm text-slate-500">Nobody has accepted an invitation yet.</p>}
                <div className="space-y-1.5">
                  {active.map(t => (
                    <div key={t.schoolUserId} className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-sm text-slate-700 truncate">{t.fullName ?? t.email ?? t.userId}</span>
                      <span className={`shrink-0 text-xs ${
                        t.role === 'teacher' ? 'text-slate-400' : 'text-teal-600 font-semibold'
                      }`}>
                        {ROLE_LABEL[t.role] ?? t.role}
                      </span>
                      {/* No delete. Ending employment is a status change, never
                          a deletion — the person, their history and their past
                          teaching all survive it. Self-removal is hidden here
                          and refused by the API. */}
                      {t.userId !== membership.userId && (
                        <button
                          onClick={() => setConfirmRemove(t)}
                          className="ml-auto shrink-0 text-xs font-semibold text-slate-400 hover:text-red-600 transition-colors"
                        >
                          Remove access
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Ending employment. The wording states plainly what is lost and what
          is kept, because an administrator should never have to guess whether
          this destroys a teacher's records. It does not. */}
      {confirmRemove && membership && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-black text-slate-900">
              Remove {confirmRemove.fullName ?? confirmRemove.email ?? 'this person'} from {membership.schoolName}?
            </h2>
            <div className="text-sm text-slate-600 space-y-2">
              <p>
                They will lose access to this school and any classes assigned to them will
                become unassigned, ready for whoever takes over.
              </p>
              <p className="text-slate-500">
                Nothing is deleted. Their EduNexus account, their schemes of work, lesson
                plans, records of work, and everything they have marked all stay exactly as
                they are — including the record that they taught those classes.
              </p>
              <p className="text-slate-500">
                If they come back, an administrator can invite them again.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                disabled={removing}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRemove}
                disabled={removing}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {removing && <Loader2 className="w-4 h-4 animate-spin" />}
                Remove access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
