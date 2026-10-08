'use client'

// Paper Intelligence — mobile marking flow (Phase 1, Commit 3 slice: scheme
// capture → editable rubric → confirm). Script capture + review-by-question
// arrive in Commits 4-5. Mobile-first: big touch targets, one column, works on
// a cheap Android phone. UI only — all logic lives behind the API routes.

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { compressImage, formatBytes, type CompressedImage } from '@/lib/paperIntelligence/clientImage'
import type { ExtractedRubric } from '@/lib/paperIntelligence/types'

type Stage = 'capture' | 'extracting' | 'edit' | 'saving' | 'done'
type RejectedRubric = { questionId: string; reason: string }

export default function PaperIntelligencePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const router = useRouter()

  const [stage, setStage] = useState<Stage>('capture')
  const [images, setImages] = useState<CompressedImage[]>([])
  const [rubrics, setRubrics] = useState<ExtractedRubric[]>([])
  const [rejected, setRejected] = useState<RejectedRubric[]>([])
  const [error, setError] = useState<string | null>(null)

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
      setStage('done')
    } catch {
      setError('Network error while saving — retry.')
      setStage('edit')
    }
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

      {/* ── Done ──────────────────────────────────────────────────────── */}
      {stage === 'done' && (
        <section className="text-center pt-10">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-xl font-bold text-gray-800 mb-1">Rubric saved</h1>
          <p className="text-sm text-gray-500 mb-6">{rubrics.length} questions ready. Script capture is the next step (coming soon).</p>
          <button onClick={() => router.push(`/teacher/assignments/${assignmentId}`)} className="rounded-2xl bg-teal-600 text-white font-bold py-3 px-6">
            Back to assignment
          </button>
        </section>
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
