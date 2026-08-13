'use client'

// app/teacher/core-admissions/import/page.tsx
//
// Bulk learner roster import. Sits beside the existing single-learner
// admission form (../) rather than replacing it — adding one learner mid-term
// stays a one-screen job; bringing in 400 at onboarding is this.
//
// This page validates nothing itself. It uploads the raw CSV, renders what the
// server's preview returned, and only then asks for confirmation. The server
// re-parses and re-validates the same file on commit, so nothing this page
// does can widen what gets imported.

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, CheckCircle2, Upload, Download, ArrowLeft } from 'lucide-react'
import type { Term } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'

type Membership = { schoolId: string; schoolName: string; role: string; currentTerm: Term | null }

type RosterRow = {
  rowNumber: number
  admissionNumber: string
  firstName: string
  lastName: string
  className: string | null
  verdict: 'new' | 'already_exists' | 'duplicate_in_file' | 'invalid'
  issues: string[]
}

type Analysis = {
  rows: RosterRow[]
  fileIssues: string[]
  summary: { total: number; new: number; alreadyExists: number; duplicateInFile: number; invalid: number; willEnroll: number }
  enrollmentAvailable: boolean
  currentTermName: string | null
}

type ImportResult = {
  analysis: Analysis
  created: number
  enrolled: number
  skippedExisting: number
  skippedInvalid: number
}

const TEMPLATE =
  'admission_number,first_name,last_name,middle_name,gender,class\n' +
  'ADM001,Asha,Mwangi,Nyokabi,female,Grade 7 East\n' +
  'ADM002,Brian,Otieno,,male,Grade 7 East\n' +
  'ADM003,Faith,Njeri,Wambui,female,Grade 8 North\n'

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch('/api/core/learners/import', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

const VERDICT_STYLE: Record<RosterRow['verdict'], { label: string; className: string }> = {
  new:               { label: 'Will import',  className: 'bg-emerald-50 text-emerald-700' },
  already_exists:    { label: 'Already here', className: 'bg-slate-100 text-slate-500' },
  duplicate_in_file: { label: 'Duplicate',    className: 'bg-amber-50 text-amber-700' },
  invalid:           { label: 'Needs fixing', className: 'bg-red-50 text-red-700' },
}

export default function ImportLearnersPage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [csv, setCsv] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/core/my-membership', { credentials: 'include' })
      .then(r => r.json())
      .then(json => { if (!cancelled) setMembership(json.data?.membership ?? null) })
      .catch(() => { if (!cancelled) setMembership(null) })
    return () => { cancelled = true }
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)

  const downloadTemplate = useCallback(() => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'edunexus-learner-roster-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  async function onFile(file: File) {
    setError(''); setAnalysis(null); setResult(null)
    const text = await file.text()
    setCsv(text)
    setFileName(file.name)
    setBusy(true)
    try {
      setAnalysis(await post<Analysis>({ action: 'preview', schoolId: membership!.schoolId, csv: text }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file')
    } finally {
      setBusy(false)
    }
  }

  async function confirmImport() {
    if (!analysis || analysis.summary.new === 0) return
    setBusy(true); setError('')
    try {
      setResult(await post<ImportResult>({ action: 'commit', schoolId: membership!.schoolId, csv }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setCsv(''); setFileName(''); setAnalysis(null); setResult(null); setError('')
  }

  if (membership === undefined) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-5 h-5 text-slate-300 animate-spin" /></div>
  }

  const problemRows = analysis?.rows.filter(r => r.verdict !== 'new') ?? []
  const previewRows = analysis?.rows.filter(r => r.verdict === 'new').slice(0, 10) ?? []

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <a href="/teacher/core-admissions" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600">
        <ArrowLeft className="w-4 h-4" /> Admissions
      </a>

      <header>
        <h1 className="text-xl font-black text-slate-900">Import learners</h1>
        <p className="text-sm text-slate-500">{membership?.schoolName ?? 'Bring your roster into EduNexus'}</p>
      </header>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}
      {membership && !isAdminTier && <p className="text-sm text-slate-500">Importing learners is available to school admins and headteachers.</p>}

      {membership && isAdminTier && !result && (
        <>
          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-700">1. Start from the template</p>
                <p className="text-xs text-slate-500 mt-1">
                  One learner per row. Only these columns are used — please do not include confidential
                  information EduNexus has not asked for.
                </p>
              </div>
              <button
                onClick={downloadTemplate}
                className="shrink-0 flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" /> Template
              </button>
            </div>
            <code className="block text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-slate-600 overflow-x-auto">
              admission_number, first_name, last_name, middle_name (optional), gender (optional), class (optional)
            </code>
            <p className="text-xs text-slate-400">
              In Excel or Google Sheets: File → Save as / Download → CSV.
            </p>
          </div>

          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <p className="text-sm font-bold text-slate-700">2. Upload and preview</p>
            <label className="flex items-center gap-2 border border-dashed border-slate-300 hover:border-teal-400 rounded-xl px-4 py-6 cursor-pointer transition-colors justify-center">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600">{fileName || 'Choose a CSV file…'}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
              />
            </label>
            {busy && !analysis && (
              <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-3 h-3 animate-spin" /> Checking your file…</p>
            )}
            <p className="text-xs text-slate-400">Nothing is saved until you confirm.</p>
          </div>
        </>
      )}

      {analysis && !result && (
        <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4">
          {analysis.fileIssues.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-bold text-red-600">This file cannot be imported</p>
              {analysis.fileIssues.map((issue, i) => <p key={i} className="text-sm text-red-600">{issue}</p>)}
              <button onClick={reset} className="text-sm text-teal-700 hover:underline">Choose a different file</button>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-bold text-slate-700">3. Review</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {[
                    { label: 'Will import',  value: analysis.summary.new,              tone: 'text-emerald-700' },
                    { label: 'Already here', value: analysis.summary.alreadyExists,    tone: 'text-slate-500' },
                    { label: 'Duplicates',   value: analysis.summary.duplicateInFile,  tone: 'text-amber-700' },
                    { label: 'Needs fixing', value: analysis.summary.invalid,          tone: 'text-red-600' },
                  ].map(s => (
                    <div key={s.label} className="border border-slate-100 rounded-xl px-3 py-2">
                      <p className="text-xs text-slate-400">{s.label}</p>
                      <p className={`text-xl font-black ${s.tone}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {analysis.summary.willEnroll > 0 && analysis.currentTermName && (
                  <p className="text-xs text-slate-500 mt-2">
                    {analysis.summary.willEnroll} will also be placed in a class for {analysis.currentTermName}.
                  </p>
                )}
              </div>

              {previewRows.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">First learners to import</p>
                  <div className="space-y-1">
                    {previewRows.map(r => (
                      <div key={r.rowNumber} className="flex items-center gap-3 text-sm text-slate-600 px-3 py-1.5 border border-slate-100 rounded-lg">
                        <span className="text-xs text-slate-300 w-8 shrink-0">{r.rowNumber}</span>
                        <span className="font-mono text-xs text-slate-400 w-24 shrink-0 truncate">{r.admissionNumber}</span>
                        <span className="truncate">{r.firstName} {r.lastName}</span>
                        {r.className && <span className="ml-auto text-xs text-slate-400 shrink-0">{r.className}</span>}
                      </div>
                    ))}
                    {analysis.summary.new > previewRows.length && (
                      <p className="text-xs text-slate-400 px-3">…and {analysis.summary.new - previewRows.length} more.</p>
                    )}
                  </div>
                </div>
              )}

              {problemRows.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Rows needing attention ({problemRows.length})</p>
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {problemRows.slice(0, 50).map(r => (
                      <div key={r.rowNumber} className="px-3 py-2 border border-slate-100 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-300">Row {r.rowNumber}</span>
                          <span className="text-sm text-slate-600 truncate">{r.firstName} {r.lastName}</span>
                          <span className={`ml-auto shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${VERDICT_STYLE[r.verdict].className}`}>
                            {VERDICT_STYLE[r.verdict].label}
                          </span>
                        </div>
                        {r.issues.map((issue, i) => <p key={i} className="text-xs text-slate-500 mt-0.5">{issue}</p>)}
                      </div>
                    ))}
                    {problemRows.length > 50 && (
                      <p className="text-xs text-slate-400 px-3">…and {problemRows.length - 50} more. Fix these in your spreadsheet and upload again.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={confirmImport}
                  disabled={busy || analysis.summary.new === 0}
                  className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Import {analysis.summary.new} learner{analysis.summary.new === 1 ? '' : 's'}
                </button>
                <button onClick={reset} className="text-sm text-slate-500 hover:text-slate-700">Choose a different file</button>
              </div>
              {analysis.summary.new === 0 && (
                <p className="text-xs text-slate-500">
                  There is nothing new to import from this file. Rows already on the roster are skipped so
                  re-uploading the same file never creates duplicates.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {result && (
        <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-5 space-y-3">
          <p className="text-base font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> Import complete
          </p>
          <div className="text-sm text-emerald-900 space-y-1">
            <p>Created: <strong>{result.created}</strong></p>
            {result.enrolled > 0 && <p>Placed in a class: <strong>{result.enrolled}</strong></p>}
            {result.skippedExisting > 0 && <p>Already on the roster, skipped: <strong>{result.skippedExisting}</strong></p>}
            {result.skippedInvalid > 0 && <p>Needed fixing, not imported: <strong>{result.skippedInvalid}</strong></p>}
          </div>
          {result.skippedInvalid > 0 && (
            <p className="text-xs text-emerald-800">
              Correct those rows in your spreadsheet and upload the file again — learners already imported
              will be skipped automatically.
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={reset} className="text-sm font-medium text-teal-700 hover:underline">Import another file</button>
            <a href="/teacher/core-admissions" className="text-sm text-slate-500 hover:text-slate-700">Back to admissions</a>
          </div>
        </div>
      )}
    </div>
  )
}
