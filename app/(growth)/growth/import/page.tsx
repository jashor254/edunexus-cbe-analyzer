'use client'

import { useEffect, useState } from 'react'
import type { ApiResponse } from '@/lib/api/response'

// Sprint PE-7 (Pilot Campaign Launch) Parts 1-2 — the Import Readiness
// Dashboard and Import Summary, as a real web page so the founder never
// has to leave the browser to run the CLI import script. Reads CSV files
// from scripts/growth/output/ on the local machine this is running on
// (same as every discovery/enrichment script in this pipeline) — this
// page only works via `npm run dev` locally, not a deployed host.

type ReadinessStats = {
  totalReviewed: number
  readyForImport: number
  heldBack: number
  missingPhone: number
  missingEmail: number
  needsManualVerification: number
  outOfScope: number
}

type ImportSummary = {
  schoolsImported: number
  duplicatesSkipped: number
  contactsCreated: number
  schoolsUpdated: number
  timeTakenMs: number
  errors: string[]
  importedNames: string[]
  duplicateNames: string[]
  invalidNames: string[]
}

export default function ImportPage() {
  const [files, setFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [stats, setStats] = useState<ReadinessStats | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/growth/import/files')
      .then((res) => res.json() as Promise<ApiResponse<{ files: string[] }>>)
      .then((json) => {
        if (json.success && json.data) {
          setFiles(json.data.files)
          if (json.data.files.length > 0) setSelectedFile(json.data.files[0])
        }
      })
  }, [])

  useEffect(() => {
    if (!selectedFile) return
    setError(null)
    setStats(null)
    fetch(`/api/growth/import/readiness?file=${encodeURIComponent(selectedFile)}`)
      .then((res) => res.json() as Promise<ApiResponse<{ stats: ReadinessStats }>>)
      .then((json) => {
        if (!json.success || !json.data) throw new Error(json.error ?? 'Failed to read readiness stats')
        setStats(json.data.stats)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to read readiness stats'))
  }, [selectedFile])

  async function runImport() {
    setLoading(true)
    setError(null)
    setSummary(null)
    try {
      const res = await fetch('/api/growth/import/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: selectedFile }),
      })
      const json = (await res.json()) as ApiResponse<{ summary: ImportSummary }>
      if (!json.success || !json.data) throw new Error(json.error ?? 'Import failed')
      setSummary(json.data.summary)
      // Readiness stats are now stale (rows just got imported) — refresh.
      fetch(`/api/growth/import/readiness?file=${encodeURIComponent(selectedFile)}`)
        .then((r) => r.json() as Promise<ApiResponse<{ stats: ReadinessStats }>>)
        .then((j) => j.success && j.data && setStats(j.data.stats))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-base font-bold uppercase tracking-wide text-neutral-800">Import Reviewed Schools</h1>

      {files.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
          No CSV files found in scripts/growth/output/. Run discovery/enrichment first.
        </p>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">CSV file</label>
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {files.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Part 1 — Import Readiness Dashboard */}
      {stats && (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Import Readiness</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total reviewed" value={stats.totalReviewed} />
            <Stat label="Ready for import" value={stats.readyForImport} highlight="text-emerald-700" />
            <Stat label="Held back" value={stats.heldBack} />
            <Stat label="Missing phone" value={stats.missingPhone} />
            <Stat label="Missing email" value={stats.missingEmail} />
            <Stat label="Needs manual verification" value={stats.needsManualVerification} highlight="text-amber-700" />
            <Stat label="Out of scope" value={stats.outOfScope} />
          </div>
          <button
            onClick={runImport}
            disabled={stats.readyForImport === 0 || loading}
            className="mt-4 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Importing…' : `Import ${stats.readyForImport} School${stats.readyForImport === 1 ? '' : 's'}`}
          </button>
          {stats.readyForImport === 0 && <p className="mt-2 text-xs text-neutral-400">Mark at least one row ready_for_import = TRUE in the CSV before importing.</p>}
        </section>
      )}

      {/* Part 2 — Import Summary, nothing hidden */}
      {summary && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-800">Import Summary</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Schools imported" value={summary.schoolsImported} highlight="text-emerald-700" />
            <Stat label="Duplicates skipped" value={summary.duplicatesSkipped} />
            <Stat label="Contacts created" value={summary.contactsCreated} />
            <Stat label="Schools updated" value={summary.schoolsUpdated} />
            <Stat label="Time taken" value={`${(summary.timeTakenMs / 1000).toFixed(1)}s`} />
            <Stat label="Errors" value={summary.errors.length} highlight={summary.errors.length > 0 ? 'text-red-700' : undefined} />
          </div>
          {summary.duplicateNames.length > 0 && (
            <Detail title="Duplicates skipped" items={summary.duplicateNames} />
          )}
          {summary.errors.length > 0 && (
            <Detail title="Errors" items={summary.errors} className="text-red-700" />
          )}
          {summary.schoolsImported > 0 && (
            <p className="mt-3 text-sm text-emerald-800">
              ✅ Imported into the Growth Engine — check <a href="/growth" className="underline">Mission Control</a> for your First Contact Queue.
            </p>
          )}
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-2.5">
      <p className="text-[11px] text-neutral-400">{label}</p>
      <p className={`text-lg font-semibold ${highlight ?? 'text-neutral-800'}`}>{value}</p>
    </div>
  )
}

function Detail({ title, items, className }: { title: string; items: string[]; className?: string }) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-medium text-neutral-500">{title}</p>
      <ul className={`space-y-0.5 text-xs ${className ?? 'text-neutral-600'}`}>
        {items.map((item, i) => <li key={i}>- {item}</li>)}
      </ul>
    </div>
  )
}
