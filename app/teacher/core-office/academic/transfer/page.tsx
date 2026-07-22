'use client'

// app/teacher/core-office/academic/transfer/page.tsx
//
// Sprint 10 (Core Administration Completion) — Phase 2 Activation. The
// backend (lib/core/transfers.ts: transferLearner, getLearnerTransfers,
// GET/POST /api/core/transfers) already existed with zero UI caller — the
// Academic Office page rendered "Transfer" as an inert FutureModule
// placeholder tile. No new business logic here: learner search reuses the
// existing GET /api/core/learners?search= (already used elsewhere), and
// the transfer-out effects (learner.status -> 'transferred', active
// enrollment withdrawn) are entirely lib/core/transfers.ts's own, unchanged
// behaviour. Only "out" transfers are exposed here — "in" (a learner
// arriving from another school with no existing Core record) also needs
// that learner admitted first via Admissions, a separate, deliberate
// two-step flow rather than a single form guessing at both at once.

import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, CheckCircle2, Search, ArrowLeftRight } from 'lucide-react'
import type { Term } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'

type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

type LearnerRow = {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  admission_number: string
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

const EMPTY_FORM = { to_school_name: '', transfer_date: new Date().toISOString().split('T')[0], reason: '' }

export default function TransferPage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<LearnerRow[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<LearnerRow | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)

  async function runSearch() {
    if (!membership || !search.trim()) return
    setSearching(true); setError(''); setResults(null)
    try {
      const rows = await fetchJson<LearnerRow[]>(`/api/core/learners?schoolId=${membership.schoolId}&status=active&search=${encodeURIComponent(search.trim())}`)
      setResults(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to search learners')
    } finally {
      setSearching(false)
    }
  }

  function selectLearner(l: LearnerRow) {
    setSelected(l); setResults(null); setSearch(''); setForm(EMPTY_FORM); setDone(false); setConfirming(false)
  }

  async function submitTransfer() {
    if (!membership || !selected) return
    if (!confirming) { setConfirming(true); return }
    setSubmitting(true); setError('')
    try {
      await fetchJson('/api/core/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: membership.schoolId,
          learner_id: selected.id,
          direction: 'out',
          transfer_date: form.transfer_date,
          to_school_name: form.to_school_name.trim() || undefined,
          reason: form.reason.trim() || undefined,
        }),
      })
      setDone(true)
      setConfirming(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record transfer')
      setConfirming(false)
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
      <OperationalBreadcrumb parent={{ label: 'Academic Office', href: '/teacher/core-office/academic' }} current="Transfer" />

      <header>
        <h1 className="text-xl font-black text-slate-900">Transfer a Learner Out</h1>
        <p className="text-sm text-slate-500">
          Records the learner as transferred and withdraws their active enrollment at {membership?.schoolName ?? 'your school'}.
          A learner arriving from another school is admitted through <span className="font-medium">Admit a Learner</span> instead.
        </p>
      </header>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}
      {membership && !isAdminTier && <p className="text-sm text-slate-500">This view is available to school admins and headteachers.</p>}

      {membership && isAdminTier && !selected && (
        <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
          <label className="block text-xs font-bold text-slate-500 mb-1">Find a learner</label>
          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="Name or admission number"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            <button onClick={runSearch} disabled={searching || !search.trim()}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          {results !== null && (
            <div className="space-y-1.5">
              {results.length === 0 && <p className="text-xs text-slate-400">No matching active learners.</p>}
              {results.map(l => (
                <button key={l.id} onClick={() => selectLearner(l)}
                  className="w-full text-left flex items-center justify-between text-sm border border-slate-100 hover:border-teal-400 rounded-lg px-3 py-2 transition-colors">
                  <span className="text-slate-700 font-medium">{[l.first_name, l.middle_name, l.last_name].filter(Boolean).join(' ')}</span>
                  <span className="text-xs text-slate-400">{l.admission_number}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {membership && isAdminTier && selected && !done && (
        <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">{[selected.first_name, selected.middle_name, selected.last_name].filter(Boolean).join(' ')}</p>
              <p className="text-xs text-slate-400">{selected.admission_number}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-slate-600">Change</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Transfer date *</label>
              <input type="date" value={form.transfer_date} onChange={e => setForm(f => ({ ...f, transfer_date: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Destination school</label>
              <input value={form.to_school_name} onChange={e => setForm(f => ({ ...f, to_school_name: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Reason</label>
            <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
          </div>

          {confirming && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This withdraws the learner&apos;s active enrollment immediately. Click again to confirm.
            </p>
          )}

          <button onClick={submitTransfer} disabled={submitting || !form.transfer_date}
            className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-xl transition-colors">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
            {confirming ? 'Confirm Transfer Out' : 'Transfer Out'}
          </button>
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Learner recorded as transferred out.
        </div>
      )}
    </div>
  )
}
