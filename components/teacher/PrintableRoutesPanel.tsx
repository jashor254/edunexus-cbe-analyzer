'use client'

// components/teacher/PrintableRoutesPanel.tsx
//
// "Prepare Printable Routes" — Printable Adaptive Assignments pilot.
// Self-contained panel embedded on the assignment detail page. Deliberately
// separate from the existing "Print Differentiated Papers" block (generic
// per-level papers, unchanged) — this is the new, evidence-informed,
// teacher-approved three-route workflow.
//
// Every generated route is a DRAFT until the teacher clicks Approve —
// nothing here is called an assignment, and nothing is printable, before
// that explicit action. No automatic or time-based approval exists.

import { useEffect, useState, useCallback } from 'react'
import { Sparkles, Printer, RefreshCcw, CheckCircle2 } from 'lucide-react'

type PrintRoute = 'guided' | 'core' | 'extension'

type PrintRunSummary = {
  id: string
  status: 'draft' | 'approved' | 'superseded'
  generated_at: string
  approved_at: string | null
}

type PrintRouteRow = {
  id: string
  student_id: string
  route: PrintRoute
  source: 'system_suggested' | 'teacher_override'
  evidence_note: string | null
}

type RosterEntry = { id: string; name: string }

const ROUTE_LABEL: Record<PrintRoute, string> = {
  guided: 'Guided Practice',
  core: 'Core Practice',
  extension: 'Extension Practice',
}

const ROUTE_STYLE: Record<PrintRoute, string> = {
  guided: 'border-blue-300 text-blue-700 bg-blue-50',
  core: 'border-gray-300 text-gray-700 bg-gray-50',
  extension: 'border-emerald-300 text-emerald-700 bg-emerald-50',
}

export default function PrintableRoutesPanel({ assignmentId }: { assignmentId: string }) {
  const [runs, setRuns] = useState<PrintRunSummary[] | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [routes, setRoutes] = useState<PrintRouteRow[]>([])
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRuns = useCallback(async () => {
    const res = await fetch(`/api/teacher/assignments/${assignmentId}/print-routes`)
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to load print runs'); return }
    const list: PrintRunSummary[] = json.data.runs
    setRuns(list)
    if (list.length > 0) setActiveRunId(list[0].id)
  }, [assignmentId])

  const loadActiveRun = useCallback(async (runId: string) => {
    const res = await fetch(`/api/teacher/assignments/${assignmentId}/print-routes/${runId}`)
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to load print run'); return }
    setRoutes(json.data.routes)
    setRoster(json.data.roster)
  }, [assignmentId])

  useEffect(() => { loadRuns() }, [loadRuns])
  useEffect(() => { if (activeRunId) loadActiveRun(activeRunId) }, [activeRunId, loadActiveRun])

  const activeRun = runs?.find(r => r.id === activeRunId) ?? null
  const nameFor = (studentId: string) => roster.find(s => s.id === studentId)?.name ?? studentId

  async function generate() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/print-routes`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to generate printable routes'); return }
      await loadRuns()
      setActiveRunId(json.data.run.id)
      setRoutes(json.data.routes)
    } finally {
      setLoading(false)
    }
  }

  async function regenerate() {
    if (!activeRunId) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/print-routes/${activeRunId}/regenerate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to regenerate'); return }
      await loadRuns()
      setActiveRunId(json.data.run.id)
      setRoutes(json.data.routes)
    } finally {
      setLoading(false)
    }
  }

  async function overrideRoute(studentId: string, route: PrintRoute) {
    if (!activeRunId) return
    setError(null)
    const res = await fetch(`/api/teacher/assignments/${assignmentId}/print-routes/${activeRunId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'routeOverride', studentId, route }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to override route'); return }
    setRoutes(prev => prev.map(r => (r.student_id === studentId ? { ...r, route, source: 'teacher_override' } : r)))
  }

  async function approve() {
    if (!activeRunId) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/print-routes/${activeRunId}/approve`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to approve'); return }
      await loadRuns()
    } finally {
      setLoading(false)
    }
  }

  function openPrint(mode: 'grouped' | 'named') {
    if (!activeRunId) return
    window.open(`/api/teacher/assignments/${assignmentId}/print-routes/${activeRunId}/print?mode=${mode}`, '_blank')
  }

  const counts: Record<PrintRoute, number> = { guided: 0, core: 0, extension: 0 }
  for (const r of routes) counts[r.route]++

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gray-500" />
          <span className="font-black text-gray-900 text-sm">Prepare Printable Routes</span>
        </div>
        {!activeRun && (
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 bg-teal-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-teal-700 transition disabled:opacity-60"
          >
            {loading ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Prepare Printable Routes
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {!activeRun && !loading && (
        <p className="text-xs text-gray-500">
          Suggests three routes — Guided, Core, Extension — from current class evidence. Nothing is printable until you review and approve it.
        </p>
      )}

      {activeRun && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-bold ${activeRun.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {activeRun.status === 'approved' ? 'Approved' : 'Draft — not yet printable'}
              </span>
              <span className="text-gray-400">Guided {counts.guided} &middot; Core {counts.core} &middot; Extension {counts.extension}</span>
            </div>
            {activeRun.status === 'draft' && (
              <button onClick={regenerate} disabled={loading} className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-800">
                <RefreshCcw className="w-3.5 h-3.5" /> Regenerate
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-xl mb-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-left text-[10px] uppercase text-gray-400">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Route</th>
                  <th className="px-3 py-2">Basis</th>
                </tr>
              </thead>
              <tbody>
                {routes.map(r => (
                  <tr key={r.student_id} className="border-t border-gray-50">
                    <td className="px-3 py-1.5 font-semibold text-gray-800">{nameFor(r.student_id)}</td>
                    <td className="px-3 py-1.5">
                      {activeRun.status === 'draft' ? (
                        <select
                          value={r.route}
                          onChange={e => overrideRoute(r.student_id, e.target.value as PrintRoute)}
                          className={`text-[11px] font-bold rounded-lg border px-2 py-1 ${ROUTE_STYLE[r.route]}`}
                        >
                          <option value="guided">Guided Practice</option>
                          <option value="core">Core Practice</option>
                          <option value="extension">Extension Practice</option>
                        </select>
                      ) : (
                        <span className={`text-[11px] font-bold rounded-lg border px-2 py-1 ${ROUTE_STYLE[r.route]}`}>{ROUTE_LABEL[r.route]}</span>
                      )}
                      {r.source === 'teacher_override' && <span className="ml-1 text-[10px] text-gray-400">(overridden)</span>}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{r.evidence_note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activeRun.status === 'draft' ? (
            <button
              onClick={approve}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-gray-700 transition disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve Printable Routes
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => openPrint('grouped')} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-gray-700 transition">
                <Printer className="w-3.5 h-3.5" /> Print Class Set
              </button>
              <button onClick={() => openPrint('named')} className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 text-gray-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-gray-50 transition">
                <Printer className="w-3.5 h-3.5" /> Print Named Copies
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
