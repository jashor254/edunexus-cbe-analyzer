'use client'

// app/admin/schools/[schoolId]/page.tsx
//
// The founder's school-payment screen: record a confirmed institutional
// payment, and see what has been received.
//
// This page collects no money. The school has already paid outside EduNexus;
// this records that fact and activates entitlement as a consequence.
//
// All data comes from /api/admin/schools/[schoolId]/payments, which is gated by
// requireGrowthUser(). The browser never queries the database directly — same
// model as the pilot admin repair. There is deliberately no client-side admin
// check here: an unauthorised caller simply gets 403 from the API and sees the
// error state, so the server remains the only authority rather than one of two.

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'mpesa',         label: 'M-PESA' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'cash',          label: 'Cash' },
  { value: 'other',         label: 'Other' },
] as const

type Payment = {
  id: string
  amount: number
  payment_method: string
  payment_reference: string
  payment_date: string
  coverage_start: string | null
  coverage_end: string
  status: string
  notes: string | null
  created_at: string
}

type SchoolSummary = {
  id: string
  school_name: string
  county: string | null
  school_entitlement_status: string
  school_entitlement_expires_at: string | null
}

type LoadResult =
  | { ok: true; school: SchoolSummary; payments: Payment[]; activeTeacherCount: number }
  | { ok: false; message: string }

const fmtKes = (n: number) => `KES ${n.toLocaleString('en-KE')}`
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const methodLabel = (v: string) => PAYMENT_METHODS.find(m => m.value === v)?.label ?? v

export default function SchoolPaymentsPage() {
  const { schoolId } = useParams<{ schoolId: string }>()

  const [school, setSchool] = useState<SchoolSummary | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [teacherCount, setTeacherCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<string>('bank_transfer')
  const [reference, setReference] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [coverageStart, setCoverageStart] = useState('')
  const [coverageEnd, setCoverageEnd] = useState('')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetching and state application are separate on purpose. `fetchContext` is
  // pure — it returns data or an error string and touches no state — so the
  // effect below never reaches a setState synchronously, and the result can be
  // discarded if the founder navigates away mid-request.
  const fetchContext = useCallback(async (): Promise<LoadResult> => {
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}/payments`)
      const json = await res.json()
      if (json.success) {
        return {
          ok: true,
          school: json.data.school,
          payments: json.data.payments,
          activeTeacherCount: json.data.activeTeacherCount,
        }
      }
      return {
        ok: false,
        message: res.status === 401 || res.status === 403
          ? 'You are not authorised to view school payments.'
          : 'Could not load this school. Please try again.',
      }
    } catch {
      return { ok: false, message: 'Could not load this school. Please try again.' }
    }
  }, [schoolId])

  const apply = useCallback((result: LoadResult) => {
    setLoading(false)
    if (result.ok === false) {
      setLoadError(result.message)
      return
    }
    setSchool(result.school)
    setPayments(result.payments)
    setTeacherCount(result.activeTeacherCount)
    setLoadError(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchContext().then(result => { if (!cancelled) apply(result) })
    return () => { cancelled = true }
  }, [fetchContext, apply])

  const reload = useCallback(async () => { apply(await fetchContext()) }, [fetchContext, apply])

  const handleSubmit = async () => {
    setFormError(null)
    setSuccess(null)

    if (!amount || !reference.trim() || !paymentDate || !coverageEnd) {
      setFormError('Amount, reference, payment date and coverage end are required.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:            Number(amount),
          payment_method:    method,
          payment_reference: reference.trim(),
          payment_date:      paymentDate,
          coverage_start:    coverageStart || null,
          coverage_end:      coverageEnd,
          notes:             notes.trim() || null,
        }),
      })
      const json = await res.json()

      if (json.success) {
        const activeUntil = fmtDate(json.data.entitlementExpiresAt)
        setSuccess(
          `${json.data.created ? 'Payment recorded' : 'Payment already on record'}. ` +
          `${school?.school_name ?? 'School'} · ${fmtKes(Number(amount))} · ` +
          `Active until ${activeUntil} · ${teacherCount} active teacher${teacherCount === 1 ? '' : 's'} covered.`
        )
        setAmount(''); setReference(''); setPaymentDate('')
        setCoverageStart(''); setCoverageEnd(''); setNotes('')
        reload()
      } else {
        // 409 carries the conflicting-payment explanation verbatim — it tells
        // the founder exactly which fact disagreed, which is the actionable part.
        setFormError(json.error ?? 'Could not record this payment.')
      }
    } catch {
      setFormError('Could not record this payment. Please try again.')
    }
    setSaving(false)
  }

  const entitlementPill = () => {
    if (!school) return null
    const active = school.school_entitlement_status === 'active'
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
        active
          ? 'bg-green-900/50 text-green-400 border-green-500/30'
          : 'bg-white/10 text-white/50 border-white/20'
      }`}>
        {active
          ? `Active until ${school.school_entitlement_expires_at ? fmtDate(school.school_entitlement_expires_at) : 'further notice'}`
          : `Not entitled (${school.school_entitlement_status})`}
      </span>
    )
  }

  const field = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500'
  const label = 'text-white/60 text-xs mb-1 block'

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        <div>
          <a href="/admin" className="text-white/40 hover:text-white/70 text-sm transition-colors">← Admin</a>
          <h1 className="text-3xl font-black text-white mt-1">
            {loading ? 'Loading…' : school?.school_name ?? 'School'}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            {entitlementPill()}
            {!loading && school && (
              <span className="text-white/50 text-sm">
                {teacherCount} active teacher{teacherCount === 1 ? '' : 's'}
                {school.county ? ` · ${school.county}` : ''}
              </span>
            )}
          </div>
        </div>

        {loadError && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4">
            <p className="text-red-300 text-sm">{loadError}</p>
          </div>
        )}

        {!loadError && (
          <>
            {/* RECORD PAYMENT */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-lg font-bold">Record a confirmed payment</h2>
                <p className="text-white/40 text-xs mt-1">
                  Only record a payment you have already verified arrived. This activates the school immediately.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className={label}>Amount (KES)</label>
                  <input type="number" min="1" value={amount} placeholder="25000"
                    onChange={e => setAmount(e.target.value)} className={field} />
                </div>
                <div>
                  <label className={label}>Payment method</label>
                  <select value={method} onChange={e => setMethod(e.target.value)} className={field}>
                    {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>Reference</label>
                  <input type="text" value={reference} placeholder="M-PESA code or bank reference"
                    onChange={e => setReference(e.target.value)} className={field} />
                </div>
                <div>
                  <label className={label}>Payment date</label>
                  <input type="date" value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)} className={field} />
                </div>
                <div>
                  <label className={label}>Coverage start <span className="text-white/30">(optional)</span></label>
                  <input type="date" value={coverageStart}
                    onChange={e => setCoverageStart(e.target.value)} className={field} />
                </div>
                <div>
                  <label className={label}>Coverage end</label>
                  <input type="date" value={coverageEnd}
                    onChange={e => setCoverageEnd(e.target.value)} className={field} />
                </div>
              </div>

              <div>
                <label className={label}>Notes <span className="text-white/30">(optional)</span></label>
                <input type="text" value={notes} placeholder="e.g. Term 1 2027, agreed at demo on 3 Aug"
                  onChange={e => setNotes(e.target.value)} className={field} />
              </div>

              {formError && <p className="text-red-400 text-xs">{formError}</p>}
              {success && (
                <div className="bg-green-950/40 border border-green-500/30 rounded-lg p-3">
                  <p className="text-green-300 text-sm">{success}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={saving || loading}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {saving ? 'Recording…' : 'Confirm payment & activate school'}
              </button>
            </div>

            {/* HISTORY */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10">
                <h2 className="text-sm font-bold text-white/70">Payment history</h2>
              </div>

              {loading ? (
                <div className="p-5 space-y-3">
                  {[1, 2].map(i => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />)}
                </div>
              ) : payments.length === 0 ? (
                <p className="p-10 text-center text-white/40 text-sm">
                  No payments recorded yet for this school.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 text-xs">
                        <th className="text-left font-medium px-5 py-2">Paid</th>
                        <th className="text-left font-medium px-5 py-2">Amount</th>
                        <th className="text-left font-medium px-5 py-2">Method</th>
                        <th className="text-left font-medium px-5 py-2">Reference</th>
                        <th className="text-left font-medium px-5 py-2">Coverage</th>
                        <th className="text-left font-medium px-5 py-2">Status</th>
                        <th className="text-left font-medium px-5 py-2">Recorded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id} className="border-t border-white/5">
                          <td className="px-5 py-3 text-white/70 whitespace-nowrap">{fmtDate(p.payment_date)}</td>
                          <td className="px-5 py-3 font-semibold whitespace-nowrap">{fmtKes(p.amount)}</td>
                          <td className="px-5 py-3 text-white/70 whitespace-nowrap">{methodLabel(p.payment_method)}</td>
                          <td className="px-5 py-3 text-white/50 font-mono text-xs">{p.payment_reference}</td>
                          <td className="px-5 py-3 text-white/70 whitespace-nowrap">
                            {p.coverage_start ? `${fmtDate(p.coverage_start)} – ` : 'until '}{fmtDate(p.coverage_end)}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              p.status === 'confirmed'
                                ? 'bg-green-900/50 text-green-400'
                                : 'bg-amber-900/50 text-amber-400'
                            }`}>{p.status}</span>
                          </td>
                          <td className="px-5 py-3 text-white/30 text-xs whitespace-nowrap">{fmtDate(p.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
