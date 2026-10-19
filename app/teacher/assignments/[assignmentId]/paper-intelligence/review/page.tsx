'use client'

// Paper Intelligence — review AI marks question by question across the class
// (Phase 1, Commit 5). A teacher confirms a confident group in one tap, makes
// the judgment calls one card at a time, and each learner's script total is
// reported complete once its last question is reviewed; the teacher uploads
// the whole paper's marks when satisfied (mark first, file after).
// UI only — all logic lives behind the review routes.

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { AssignmentReview } from '@/lib/paperIntelligence/review'
import type { ConfirmResponse } from '@/app/api/teacher/assignments/[id]/paper-intelligence/review/confirm/route'
import { QuestionReviewPanel, type ReviewDecision, type AnswerDecisionRequest } from '@/components/paperIntelligence/QuestionReviewPanel'
import { ScriptPhotos } from '@/components/paperIntelligence/ScriptPhotos'

type Photos = { learnerName: string; pages: Array<{ pageNumber: number; url: string }> | null; error: string | null }

export default function PaperIntelligenceReviewPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const base = `/api/teacher/assignments/${assignmentId}/paper-intelligence`

  const [review, setReview] = useState<AssignmentReview | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [overOutOf, setOverOutOf] = useState<ConfirmResponse['overMarkedOutOf']>([])
  const [photos, setPhotos] = useState<Photos | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${base}/review`)
      const body = await res.json()
      if (!res.ok) { setError(body?.error ?? 'Could not load the marks to review.'); return }
      const data = body.data as AssignmentReview
      setReview(data)
      // Stay on the current question; otherwise open the first with work left.
      setActive(prev => prev ?? (data.questions.find(q => q.yourCall.length + q.agreeGroups.length > 0) ?? data.questions[0])?.id ?? null)
    } catch {
      setError('Network error — check your connection and reload.')
    }
  }, [base])

  useEffect(() => { load() }, [load])

  async function confirm(decisions: ReviewDecision[]) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`${base}/review/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body?.error ?? 'Could not save those marks — try again.'); return }
      const data = body.data as ConfirmResponse
      setNotice(data.completed.length > 0
        ? `Saved. Script complete: ${data.completed.map(f => `${f.learnerName} ${f.total}${review?.markedOutOf ? `/${review.markedOutOf}` : ''}`).join(', ')} — upload the marks when you are happy with the whole paper.`
        : `Saved ${data.saved} mark${data.saved === 1 ? '' : 's'}.`)
      if (data.overMarkedOutOf.length > 0) {
        setOverOutOf(prev => [...prev.filter(p => !data.overMarkedOutOf.some(o => o.submissionId === p.submissionId)), ...data.overMarkedOutOf])
      }
      await load()
    } catch {
      setError('Network error while saving — try again.')
    } finally {
      setBusy(false)
    }
  }

  async function decideAnswer(request: AnswerDecisionRequest) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`${base}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rubricId: request.rubricId, answerKey: request.answerKey, decision: request.decision }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body?.error ?? 'Could not record that decision — try again.'); await load(); return }
      const n = body.data.learnersAffected as number
      setNotice(request.decision === 'accept'
        ? `“${request.answerText}” is now in the scheme — ${n} learner${n === 1 ? '' : 's'} re-marked.`
        : `“${request.answerText}” doesn’t earn marks — ${n} learner${n === 1 ? '' : 's'} re-marked.`)
      await load()
    } catch {
      setError('Network error while saving — try again.')
    } finally {
      setBusy(false)
    }
  }

  async function viewScript(submissionId: string, learnerName: string) {
    setPhotos({ learnerName, pages: null, error: null })
    try {
      const res = await fetch(`${base}/pages?submissionId=${submissionId}`)
      const body = await res.json()
      setPhotos(res.ok ? { learnerName, pages: body.data.pages, error: null } : { learnerName, pages: null, error: body?.error ?? 'Could not load the pages.' })
    } catch {
      setPhotos({ learnerName, pages: null, error: 'Network error — could not load the pages.' })
    }
  }

  const question = review?.questions.find(q => q.id === active) ?? null

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-5 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href={`/teacher/assignments/${assignmentId}/paper-intelligence`} className="text-sm text-gray-400 font-medium">← Scripts</Link>
        <span className="text-xs font-bold text-teal-600">Paper Intelligence · Review</span>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3">{error}</div>}
      {notice && <div className="mb-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-sm font-medium px-4 py-3">{notice}</div>}
      {overOutOf.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm px-4 py-3">
          <p className="font-bold mb-1">Not saved to the gradebook — total is above the paper’s “marked out of”:</p>
          <ul className="list-disc ml-5">
            {overOutOf.map(o => <li key={o.submissionId}>{o.learnerName}: {o.total}/{o.markedOutOf}. Lower a mark for questions the learner should not have answered.</li>)}
          </ul>
        </div>
      )}

      {!review && !error && <p className="text-sm text-gray-400 text-center pt-10">Loading…</p>}

      {review && review.scripts.marked === 0 && (
        <p className="text-sm text-gray-500 text-center pt-10">No scripts have been marked yet. Photograph some scripts first.</p>
      )}

      {review && review.scripts.marked > 0 && (
        <>
          <p className="text-sm text-gray-500 mb-3">
            <span className="font-bold text-gray-800">{review.scripts.complete}</span> of {review.scripts.marked} marked scripts fully reviewed
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
            {review.questions.map(q => {
              const left = q.plausibleAnswers.length + q.yourCall.length + q.agreeGroups.reduce((n, g) => n + g.items.length, 0)
              return (
                <button key={q.id} onClick={() => setActive(q.id)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold ${q.id === active ? 'bg-teal-600 text-white' : left > 0 ? 'bg-white border border-gray-200 text-gray-700' : 'bg-teal-50 text-teal-700'}`}>
                  {q.label}
                  <span className="ml-1 text-[11px] font-semibold opacity-80">{left > 0 ? left : '✓'}</span>
                </button>
              )
            })}
          </div>
          {question && <QuestionReviewPanel key={question.id} question={question} busy={busy} onConfirm={confirm} onDecideAnswer={decideAnswer} onViewScript={viewScript} />}
        </>
      )}

      {photos && <ScriptPhotos learnerName={photos.learnerName} pages={photos.pages} error={photos.error} onClose={() => setPhotos(null)} />}
    </main>
  )
}
