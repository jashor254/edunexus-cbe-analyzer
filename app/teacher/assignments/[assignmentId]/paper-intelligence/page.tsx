'use client'

// Paper Intelligence — mobile marking flow. Phase 1 so far: scheme capture →
// editable rubric → confirm (Commit 3), then the class list → photograph each
// learner's script page by page → AI marks it in the background while the
// teacher moves to the next learner (Commit 4). Review-by-question arrives in
// Commit 5. Mobile-first: big touch targets, one column, works on a cheap
// Android phone. UI only — all logic lives behind the API routes.

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { compressImage, formatBytes, type CompressedImage } from '@/lib/paperIntelligence/clientImage'
import { PAPER_INTELLIGENCE_LIMITS } from '@/lib/config/paperIntelligence'
import type { ExtractedRubric } from '@/lib/paperIntelligence/types'
import type { ScriptRosterEntry } from '@/lib/paperIntelligence/scriptRoster'
import type { ScriptsResponse } from '@/app/api/teacher/assignments/[id]/paper-intelligence/scripts/route'
import { ScriptRosterList, type MarkingState } from '@/components/paperIntelligence/ScriptRosterList'
import { ScriptCapture, type CapturedPage } from '@/components/paperIntelligence/ScriptCapture'

type Stage = 'loading' | 'capture' | 'extracting' | 'edit' | 'saving' | 'scripts' | 'learner'
type RejectedRubric = { questionId: string; reason: string }
type PageState = CapturedPage & { onServer: boolean }

const BLURRY_MESSAGE = 'Too blurry to read — hold the phone steady and retake'

export default function PaperIntelligencePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const base = `/api/teacher/assignments/${assignmentId}/paper-intelligence`

  const [stage, setStage] = useState<Stage>('loading')
  const [images, setImages] = useState<CompressedImage[]>([])
  const [rubrics, setRubrics] = useState<ExtractedRubric[]>([])
  const [rejected, setRejected] = useState<RejectedRubric[]>([])
  const [error, setError] = useState<string | null>(null)

  const [roster, setRoster] = useState<ScriptsResponse | null>(null)
  const [learner, setLearner] = useState<ScriptRosterEntry | null>(null)
  const [pages, setPages] = useState<PageState[]>([])
  const [pageBusy, setPageBusy] = useState(false)
  const [marking, setMarking] = useState<Record<string, MarkingState>>({})

  const loadRoster = useCallback(async (): Promise<ScriptsResponse | null> => {
    try {
      const res = await fetch(`${base}/scripts`)
      const body = await res.json()
      if (!res.ok) {
        setError(body?.error ?? 'Could not load the class list.')
        return null
      }
      setRoster(body.data)
      return body.data as ScriptsResponse
    } catch {
      setError('Network error — check your connection and reload.')
      return null
    }
  }, [base])

  useEffect(() => {
    loadRoster().then(r => setStage(r && r.rubricCount > 0 ? 'scripts' : 'capture'))
  }, [loadRoster])

  // Closing the tab mid-mark could cut a marking request short.
  const anyMarking = Object.values(marking).includes('marking')
  useEffect(() => {
    if (!anyMarking) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [anyMarking])

  const avgBytes = images.length ? Math.round(images.reduce((s, i) => s + i.bytes, 0) / images.length) : 0

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    try {
      const compressed = await Promise.all(files.map(f => compressImage(f)))
      setImages(prev => [...prev, ...compressed])
    } catch {
      setError('One of the photos could not be processed. Try again.')
    }
    e.target.value = ''
  }

  async function extract() {
    if (images.length === 0) return
    setStage('extracting')
    setError(null)
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/paper-intelligence/extract-rubric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: images.map(i => ({ imageBase64: i.imageBase64, mimeType: i.mimeType })) }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body?.error ?? 'Could not read the scheme. Try clearer photos.')
        setStage('capture')
        return
      }
      setRubrics(body.data.rubrics ?? [])
      setRejected(body.data.rejected ?? [])
      setStage('edit')
    } catch {
      setError('Network error — check your connection and retry.')
      setStage('capture')
    }
  }

  function updateRubric(index: number, patch: Partial<ExtractedRubric>) {
    setRubrics(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  async function save() {
    setStage('saving')
    setError(null)
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/paper-intelligence/rubrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rubrics }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body?.error ?? 'Could not save the rubric.')
        setStage('edit')
        return
      }
      setImages([])
      await loadRoster()
      setStage('scripts')
    } catch {
      setError('Network error while saving — retry.')
      setStage('edit')
    }
  }

  // ── Script capture ──────────────────────────────────────────────────────
  function openLearner(l: ScriptRosterEntry) {
    setError(null)
    setLearner(l)
    setPages(l.pageNumbers.map(n => ({ pageNumber: n, previewUrl: null, status: 'saved', onServer: true })))
    setStage('learner')
  }

  function putPage(page: PageState) {
    setPages(prev => [...prev.filter(p => p.pageNumber !== page.pageNumber), page].sort((a, b) => a.pageNumber - b.pageNumber))
  }

  async function onPhoto(file: File, pageNumber: number) {
    if (!learner) return
    const wasOnServer = pages.find(p => p.pageNumber === pageNumber)?.onServer ?? false
    let img: CompressedImage
    try {
      img = await compressImage(file)
    } catch {
      putPage({ pageNumber, previewUrl: null, status: 'failed', message: 'That photo could not be processed — retake', onServer: wasOnServer })
      return
    }
    const previewUrl = `data:${img.mimeType};base64,${img.imageBase64}`
    if (!img.sharpness.acceptable) {
      putPage({ pageNumber, previewUrl, status: 'blurry', message: BLURRY_MESSAGE, onServer: wasOnServer })
      return
    }
    putPage({ pageNumber, previewUrl, status: 'uploading', onServer: wasOnServer })
    try {
      const res = await fetch(`${base}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: learner.submissionId, pageNumber, imageBase64: img.imageBase64, mimeType: img.mimeType }),
      })
      const body = await res.json()
      if (res.status === 422) putPage({ pageNumber, previewUrl, status: 'blurry', message: BLURRY_MESSAGE, onServer: wasOnServer })
      else if (!res.ok) putPage({ pageNumber, previewUrl, status: 'failed', message: body?.error ?? 'Upload failed — retake', onServer: wasOnServer })
      else putPage({ pageNumber, previewUrl, status: 'saved', onServer: true })
    } catch {
      putPage({ pageNumber, previewUrl, status: 'failed', message: 'No connection — retake when back online', onServer: wasOnServer })
    }
  }

  async function onRemove(pageNumber: number) {
    if (!learner) return
    const page = pages.find(p => p.pageNumber === pageNumber)
    if (page?.onServer) {
      setPageBusy(true)
      try {
        const res = await fetch(`${base}/pages`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId: learner.submissionId, pageNumber }),
        })
        if (!res.ok && res.status !== 404) {
          setError('Could not remove that page — try again.')
          return
        }
      } catch {
        setError('No connection — could not remove the page.')
        return
      } finally {
        setPageBusy(false)
      }
    }
    setPages(prev => prev.filter(p => p.pageNumber !== pageNumber))
  }

  function markAndContinue() {
    if (!learner || !roster) return
    const { submissionId } = learner
    setMarking(prev => ({ ...prev, [submissionId]: 'marking' }))

    // Marking runs in the background (~10-20s); the teacher moves straight on.
    fetch(`${base}/mark-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId }),
    })
      .then(async res => {
        if (!res.ok) throw new Error(String(res.status))
        setMarking(prev => { const next = { ...prev }; delete next[submissionId]; return next })
        await loadRoster()
      })
      .catch(() => setMarking(prev => ({ ...prev, [submissionId]: 'failed' })))

    const order = roster.learners
    const from = order.findIndex(l => l.submissionId === submissionId)
    const next = [...order.slice(from + 1), ...order.slice(0, from)]
      .find(l => l.pageNumbers.length === 0 && !l.marks && !marking[l.submissionId])
    if (next) openLearner(next)
    else backToList()
  }

  function backToList() {
    setLearner(null)
    setPages([])
    setStage('scripts')
    loadRoster()
  }

  function rephotographScheme() {
    const marked = roster?.learners.some(l => l.marks) ?? false
    if (marked && !window.confirm('Scripts have already been marked against this scheme. Confirming a new scheme clears those AI marks. Continue?')) return
    setRubrics([])
    setRejected([])
    setStage('capture')
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-5 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href={`/teacher/assignments/${assignmentId}`} className="text-sm text-gray-400 font-medium">← Assignment</Link>
        <span className="text-xs font-bold text-teal-600">Paper Intelligence</span>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3">{error}</div>
      )}

      {/* ── Step 1: scheme capture ─────────────────────────────────────── */}
      {(stage === 'capture' || stage === 'extracting') && (
        <section>
          <h1 className="text-xl font-bold text-gray-800 mb-1">Photograph the marking scheme</h1>
          <p className="text-sm text-gray-500 mb-4">Capture every page. We read it into a rubric you can edit before marking.</p>

          <label className="block w-full rounded-2xl border-2 border-dashed border-teal-300 bg-white py-10 text-center cursor-pointer active:bg-teal-50">
            <span className="text-teal-600 font-bold">+ Add scheme photo(s)</span>
            <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onPick} disabled={stage === 'extracting'} />
          </label>

          {images.length > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              <p className="font-semibold">{images.length} page{images.length > 1 ? 's' : ''} ready · avg {formatBytes(avgBytes)}/page</p>
              <button onClick={() => setImages([])} className="text-xs text-gray-400 underline mt-1">Clear</button>
            </div>
          )}

          <button
            onClick={extract}
            disabled={images.length === 0 || stage === 'extracting'}
            className="mt-5 w-full rounded-2xl bg-teal-600 text-white font-bold py-4 disabled:opacity-40"
          >
            {stage === 'extracting' ? 'Reading scheme…' : 'Extract rubric'}
          </button>
        </section>
      )}

      {/* ── Step 2: editable rubric ────────────────────────────────────── */}
      {(stage === 'edit' || stage === 'saving') && (
        <section>
          <h1 className="text-xl font-bold text-gray-800 mb-1">Check the rubric</h1>
          <p className="text-sm text-gray-500 mb-4">Fix anything the AI misread. Nothing is used until you confirm.</p>

          {rejected.length > 0 && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">
              Couldn’t read {rejected.length} question(s): {rejected.map(r => `${r.questionId} (${r.reason})`).join('; ')}. Re-photograph or add later.
            </div>
          )}

          <div className="space-y-4">
            {rubrics.map((r, i) => (
              <div key={i} className={`rounded-2xl bg-white border p-4 ${r.uncertain ? 'border-amber-300' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={r.questionId}
                    onChange={e => updateRubric(i, { questionId: e.target.value })}
                    className="w-14 font-bold text-gray-800 border-b border-gray-200 focus:outline-none"
                    aria-label="Question label"
                  />
                  {r.uncertain && <span className="text-xs font-bold text-amber-600">⚠ check</span>}
                </div>
                <input
                  value={r.topic}
                  onChange={e => updateRubric(i, { topic: e.target.value })}
                  className="w-full text-sm text-gray-700 border-b border-gray-100 pb-1 mb-3 focus:outline-none"
                  aria-label="Topic"
                />
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <NumField label="Points" value={r.pointsRequired} onChange={v => updateRubric(i, { pointsRequired: v })} />
                  <NumField label="Marks each" value={r.marksPerPoint} onChange={v => updateRubric(i, { marksPerPoint: v })} />
                  <NumField label="Max" value={r.maxMarks} onChange={v => updateRubric(i, { maxMarks: v })} />
                </div>
                {r.maxMarks !== r.pointsRequired * r.marksPerPoint && (
                  <p className="text-xs text-red-600 mb-2">Points × marks-each must equal Max ({r.pointsRequired * r.marksPerPoint}).</p>
                )}
                <div className="flex gap-2 mb-3">
                  {(['accept_relevant', 'strict'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => updateRubric(i, { mode: m })}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold ${r.mode === m ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {m === 'accept_relevant' ? 'Accept relevant' : 'Strict list'}
                    </button>
                  ))}
                </div>
                <textarea
                  value={r.acceptedAnswers.map(a => a.text).join('\n')}
                  onChange={e => updateRubric(i, { acceptedAnswers: e.target.value.split('\n').filter(Boolean).map(text => ({ text, synonyms: [] })) })}
                  rows={Math.min(8, Math.max(2, r.acceptedAnswers.length))}
                  className="w-full text-sm text-gray-700 bg-gray-50 rounded-xl p-2 focus:outline-none"
                  aria-label="Accepted answers, one per line"
                  placeholder="One accepted answer per line"
                />
              </div>
            ))}
          </div>

          <button
            onClick={save}
            disabled={stage === 'saving' || rubrics.length === 0 || rubrics.some(r => r.maxMarks !== r.pointsRequired * r.marksPerPoint)}
            className="mt-5 w-full rounded-2xl bg-teal-600 text-white font-bold py-4 disabled:opacity-40"
          >
            {stage === 'saving' ? 'Saving…' : `Confirm rubric (${rubrics.length})`}
          </button>
        </section>
      )}

      {stage === 'loading' && <p className="text-sm text-gray-400 text-center pt-10">Loading…</p>}

      {/* ── Step 3: class list ─────────────────────────────────────────── */}
      {stage === 'scripts' && roster && (
        <section>
          <h1 className="text-xl font-bold text-gray-800 mb-1">Learner scripts</h1>
          <p className="text-sm text-gray-500 mb-4">
            {roster.assignmentTitle ? `${roster.assignmentTitle} · ` : ''}{roster.rubricCount} questions · {roster.maxTotal} marks. Tap a learner to photograph their script.
          </p>
          <ScriptRosterList learners={roster.learners} maxTotal={roster.maxTotal} marking={marking} onPick={openLearner} />
          <p className="mt-6 text-xs text-gray-400">
            AI marks are proposals only — nothing counts until you review it.{' '}
            <button onClick={rephotographScheme} className="underline">Re-photograph the scheme</button>
          </p>
        </section>
      )}

      {/* ── Step 4: one learner's script ───────────────────────────────── */}
      {stage === 'learner' && learner && (
        <ScriptCapture
          learnerName={learner.name}
          pages={pages}
          maxPages={PAPER_INTELLIGENCE_LIMITS.maxPagesPerScript}
          busy={pageBusy || marking[learner.submissionId] === 'marking'}
          alreadyMarked={!!learner.marks}
          onPhoto={onPhoto}
          onRemove={onRemove}
          onMark={markAndContinue}
          onBack={backToList}
        />
      )}
    </main>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-1">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={Number.isFinite(value) ? value : ''}
        onChange={e => onChange(parseInt(e.target.value, 10) || 0)}
        className="w-full rounded-xl border border-gray-200 py-2 px-2 text-center font-bold text-gray-800 focus:outline-none focus:border-teal-400"
      />
    </label>
  )
}
