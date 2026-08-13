'use client'

// app/admin/schools/page.tsx
//
// The founder's canonical school finder. Search a school by name, see enough
// to know it is the right institution, open it, record the payment.
//
// This closes the "/growth → ??? → /admin/schools/<UUID>" gap: there was no
// list of canonical schools anywhere, so the payment page could only be reached
// by hand-copying an id.
//
// All data comes from /api/admin/schools, gated by requireGrowthUser(). The
// browser never queries schools directly — cross-tenant reads belong on the
// server. There is no client-side admin check: an unauthorised caller gets 403
// and sees the error state, keeping the server the only authority.

import { useCallback, useEffect, useState } from 'react'

type SchoolRow = {
  id: string
  schoolName: string
  county: string | null
  entitlementStatus: string
  entitlementExpiresAt: string | null
  activeTeacherCount: number
  activeMemberCount: number
  autoProvisioned: boolean
  likelyTestFixture: boolean
  createdAt: string
}

type LoadResult =
  | { ok: true; schools: SchoolRow[] }
  | { ok: false; message: string }

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : null

export default function AdminSchoolsPage() {
  const [search, setSearch] = useState('')
  const [schools, setSchools] = useState<SchoolRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSchools = useCallback(async (term: string): Promise<LoadResult> => {
    try {
      const qs = term.trim() ? `?search=${encodeURIComponent(term.trim())}` : ''
      const res = await fetch(`/api/admin/schools${qs}`)
      const json = await res.json()
      if (json.success) return { ok: true, schools: json.data.schools }
      return {
        ok: false,
        message: res.status === 401 || res.status === 403
          ? 'You are not authorised to view the school list.'
          : 'Could not load schools. Please try again.',
      }
    } catch {
      return { ok: false, message: 'Could not load schools. Please try again.' }
    }
  }, [])

  const apply = useCallback((result: LoadResult) => {
    setLoading(false)
    if (result.ok === false) {
      setError(result.message)
      return
    }
    setSchools(result.schools)
    setError(null)
  }, [])

  // Debounced so typing a school name is one request, not one per keystroke.
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      fetchSchools(search).then(result => { if (!cancelled) apply(result) })
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [search, fetchSchools, apply])

  const pill = (s: SchoolRow) => {
    const active = s.entitlementStatus === 'active'
    const expiry = fmtDate(s.entitlementExpiresAt)
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${
        active
          ? 'bg-green-900/50 text-green-400 border-green-500/30'
          : 'bg-white/10 text-white/50 border-white/20'
      }`}>
        {active ? (expiry ? `Active until ${expiry}` : 'Active') : s.entitlementStatus}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-start justify-between gap-4">
          <div>
            <a href="/growth" className="text-white/40 hover:text-white/70 text-sm transition-colors">← Growth</a>
            <h1 className="text-3xl font-black text-white mt-1">Live schools</h1>
            <p className="text-white/50 text-sm mt-1">
              Canonical school records. Open a school to record payment and activate entitlement.
            </p>
          </div>
          <a
            href="/admin/core-schools/new"
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            + New school
          </a>
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search schools by name…"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
        />

        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {!error && (
          loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/5 border border-white/10 rounded-xl animate-pulse" />)}
            </div>
          ) : schools.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
              <p className="text-white/40 text-sm">
                {search.trim() ? `No schools matching “${search.trim()}”.` : 'No schools yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {schools.map(s => (
                <a
                  key={s.id}
                  href={`/admin/schools/${s.id}`}
                  className="block bg-white/5 border border-white/10 hover:border-violet-500/50 rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-white truncate">{s.schoolName}</p>
                        {s.likelyTestFixture && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-900/60 text-amber-300 border border-amber-500/40 whitespace-nowrap">
                            TEST / SYNTHETIC
                          </span>
                        )}
                        {s.autoProvisioned && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/50 border border-white/20 whitespace-nowrap">
                            AUTO-PROVISIONED
                          </span>
                        )}
                      </div>
                      <p className="text-white/50 text-xs mt-1">
                        {s.county ? `${s.county} · ` : ''}
                        {s.activeTeacherCount} teacher{s.activeTeacherCount === 1 ? '' : 's'}
                        {' · '}{s.activeMemberCount} member{s.activeMemberCount === 1 ? '' : 's'}
                        {' · created '}{fmtDate(s.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {pill(s)}
                      <span className="text-white/30 text-sm">→</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )
        )}

        {!error && schools.length > 1 && search.trim() && (
          <p className="text-white/30 text-xs text-center">
            Several schools match. Check county, teacher count and creation date before recording a payment —
            similar names are shown rather than merged.
          </p>
        )}
      </div>
    </div>
  )
}
