'use client'

// Mark first, file after — the review screen's "Upload marks" panel
// (docs/engineering/mark-papers-flow-plan.md). Once the teacher is satisfied,
// they file every fully reviewed script to ONE place: a topical assignment
// (gradebook) or a termly assessment (Opener, CAT, Mid-Term, End-Term, Exam,
// KJSEA SBA → report cards). After the first upload the destination is fixed;
// uploading again updates the marks there. UI only —
// GET/POST /api/teacher/assignments/[id]/paper-intelligence/upload.

import { useCallback, useEffect, useState } from 'react'
import { Upload, CheckCircle2 } from 'lucide-react'
import { KNOWN_ASSESSMENT_TYPES, getTitleLabel } from '@/lib/assessments/assessmentTypeCatalog'
import { convertScore } from '@/lib/assessments/subjectMarkMerge'
import type { UploadStatusResponse, UploadResponse } from '@/app/api/teacher/assignments/[id]/paper-intelligence/upload/route'

const TERMLY_TYPES = KNOWN_ASSESSMENT_TYPES.filter(t => t !== 'assignment')
const NEW = 'new'

function currentTerm(): '1' | '2' | '3' {
  const month = new Date().getMonth() + 1
  return month <= 3 ? '1' : month <= 7 ? '2' : '3'
}

export function UploadMarksPanel({ assignmentId, refreshKey }: { assignmentId: string; refreshKey: number }) {
  const url = `/api/teacher/assignments/${assignmentId}/paper-intelligence/upload`
  const [status, setStatus] = useState<UploadStatusResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [destination, setDestination] = useState<'topical' | 'termly'>('topical')
  const [assessmentId, setAssessmentId] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [newType, setNewType] = useState<string>('endterm')
  const [newTerm, setNewTerm] = useState<'1' | '2' | '3'>(currentTerm())
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()))
  const [newMax, setNewMax] = useState('100')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResponse | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(url)
      const body = await res.json().catch(() => null)
      if (!res.ok) { setLoadError(body?.error ?? 'Could not check which marks are ready.'); return }
      const data = body.data as UploadStatusResponse
      setStatus(data)
      setLoadError(null)
      setSubject(prev => prev || data.existing?.subject || data.paper.subject)
      if (data.existing) {
        setDestination(data.existing.destination)
        if (data.existing.classAssessmentId) setAssessmentId(data.existing.classAssessmentId)
      }
    } catch {
      setLoadError('Network error — could not check which marks are ready.')
    }
  }, [url])

  useEffect(() => { void load() }, [load, refreshKey])

  if (loadError) return <div className="mt-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{loadError}</div>
  if (!status) return null

  const ready = status.complete.length
  const locked = status.existing !== null
  const selected = status.assessments.find(a => a.id === assessmentId) ?? null
  const targetMax = assessmentId === NEW ? Number(newMax) : selected?.maxScore ?? null
  const sample = status.complete[0]

  async function upload() {
    setError(null); setResult(null)
    let payload: Record<string, unknown> = { destination: 'topical' }
    if (destination === 'termly') {
      if (!subject.trim()) { setError('Which subject are these marks for?'); return }
      if (!assessmentId) { setError('Choose the assessment, or create a new one.'); return }
      payload = assessmentId === NEW
        ? { destination: 'termly', subject: subject.trim(), newAssessment: { assessmentType: newType, term: newTerm, year: Number(newYear), maxScore: Number(newMax) } }
        : { destination: 'termly', subject: subject.trim(), assessmentId }
    }
    setBusy(true)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(body?.error ?? 'Could not upload the marks — try again.'); return }
      setResult(body.data as UploadResponse)
      await load()
    } catch {
      setError('Network error — the marks were not uploaded.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-6 rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
      <h2 className="font-black text-gray-900 flex items-center gap-2"><Upload className="w-4 h-4 text-teal-600" /> Upload marks</h2>
      <p className="text-sm text-gray-500 mt-1">
        <span className="font-bold text-gray-800">{ready}</span> of {status.rosterCount} learners ready to upload
        {status.incomplete > 0 && <> · {status.incomplete} still being reviewed</>}
        {status.overMarkedOutOf.length > 0 && <> · {status.overMarkedOutOf.length} above “out of {status.paper.maxScore}” (fix first)</>}
      </p>

      {status.existing && (
        <p className="mt-2 text-sm text-green-700 flex items-start gap-1.5">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          Uploaded to {status.existing.destination === 'topical' ? 'a topical assignment' : `a termly assessment (${status.existing.subject})`} on {new Date(status.existing.uploadedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })} · {status.existing.learnerCount} learners. Uploading again updates the marks there.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mt-4">
        {(['topical', 'termly'] as const).map(d => (
          <button key={d} type="button" disabled={locked && d !== destination} onClick={() => setDestination(d)}
            className={`rounded-xl border-2 px-3 py-2.5 text-left text-sm transition disabled:opacity-40 ${destination === d ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'}`}>
            <div className="font-bold text-gray-900">{d === 'topical' ? 'Topical assignment' : 'Termly assessment'}</div>
            <div className="text-xs text-gray-500">{d === 'topical' ? 'Goes to the gradebook' : 'Opener, CAT, Mid/End-Term, SBA → report cards'}</div>
          </button>
        ))}
      </div>

      {destination === 'termly' && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-gray-600">Assessment</span>
            <select value={assessmentId} onChange={e => setAssessmentId(e.target.value)} disabled={locked} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
              <option value="">Choose…</option>
              {status.assessments.map(a => (
                <option key={a.id} value={a.id} disabled={a.isPublished}>{a.title} · out of {a.maxScore}{a.isPublished ? ' (locked)' : ''}</option>
              ))}
              {!locked && <option value={NEW}>+ New assessment…</option>}
            </select>
          </label>

          {assessmentId === NEW && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block col-span-2">
                <span className="text-xs font-bold text-gray-600">Type</span>
                <select value={newType} onChange={e => setNewType(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
                  {TERMLY_TYPES.map(t => <option key={t} value={t}>{getTitleLabel(t)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-gray-600">Term</span>
                <select value={newTerm} onChange={e => setNewTerm(e.target.value as '1' | '2' | '3')} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
                  {(['1', '2', '3'] as const).map(t => <option key={t} value={t}>Term {t}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-gray-600">Year</span>
                <input value={newYear} onChange={e => setNewYear(e.target.value)} inputMode="numeric" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              </label>
              <label className="block col-span-2">
                <span className="text-xs font-bold text-gray-600">Each subject out of</span>
                <input value={newMax} onChange={e => setNewMax(e.target.value)} inputMode="numeric" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              </label>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-bold text-gray-600">Subject</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} disabled={locked} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
          </label>

          {targetMax && targetMax > 0 && targetMax !== status.paper.maxScore && sample && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              This paper is out of {status.paper.maxScore}; the assessment is out of {targetMax}. Marks are converted — e.g. {sample.learnerName} {sample.total}/{status.paper.maxScore} → {convertScore(sample.total, status.paper.maxScore, targetMax)}/{targetMax}.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-sm px-3 py-2">
          Uploaded {result.filed.length} learner{result.filed.length === 1 ? '' : 's'} to {result.destination === 'topical' ? 'the gradebook' : 'the termly assessment'}.
          {result.refused.length > 0 && (
            <ul className="list-disc ml-5 mt-1 text-amber-800">
              {result.refused.map(r => <li key={r.learnerName}>{r.learnerName}: {r.reason}</li>)}
            </ul>
          )}
        </div>
      )}

      <button type="button" onClick={upload} disabled={busy || ready === 0}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold px-4 py-3 rounded-xl transition">
        <Upload className="w-4 h-4" />
        {busy ? 'Uploading…' : ready === 0 ? 'Review at least one full script first' : `${locked ? 'Upload again' : 'Upload'} ${ready} learner${ready === 1 ? '' : 's'}’ marks`}
      </button>
    </section>
  )
}
