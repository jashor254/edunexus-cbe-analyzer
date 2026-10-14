// components/paperIntelligence/QuestionReviewPanel.tsx
//
// Paper Intelligence — review ONE question across the whole class. UI only:
// the parent page sends the decisions. Three areas, in the order a teacher
// works: agree-with-AI groups (one tap per group), "your call" cards (one tap
// per learner, or adjust), and already-reviewed marks (tap to change).

'use client'

import { useState } from 'react'
import type { QuestionReview, ReviewItem } from '@/lib/paperIntelligence/reviewGrouping'
import type { MarkedPoint } from '@/lib/paperIntelligence/types'

export type ReviewDecision = { submissionId: string; rubricId: string; finalMark: number }

type Props = {
  question: QuestionReview
  busy: boolean
  onConfirm: (decisions: ReviewDecision[]) => void
  onViewScript: (submissionId: string, learnerName: string) => void
}

export function QuestionReviewPanel({ question, busy, onConfirm, onViewScript }: Props) {
  const [showAnswers, setShowAnswers] = useState(false)
  const remaining = question.yourCall.length + question.agreeGroups.reduce((n, g) => n + g.items.length, 0)

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-800">Question {question.label} <span className="text-gray-400 font-medium">· {question.maxMarks} marks</span></h2>
        <p className="text-sm text-gray-600">{question.questionText}</p>
        {question.acceptedAnswers.length > 0 && (
          <button onClick={() => setShowAnswers(v => !v)} className="text-xs text-teal-700 underline mt-1">
            {showAnswers ? 'Hide' : 'Show'} scheme answers ({question.acceptedAnswers.length})
          </button>
        )}
        {showAnswers && <p className="mt-1 text-xs text-gray-500 bg-gray-50 rounded-xl p-2">{question.acceptedAnswers.join(' · ')}</p>}
      </div>

      {remaining === 0 && question.reviewed.length > 0 && (
        <p className="mb-4 rounded-xl bg-teal-50 text-teal-800 text-sm font-semibold px-3 py-2">✓ Every learner reviewed on this question.</p>
      )}

      {question.agreeGroups.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">AI is confident — confirm in one tap</h3>
          <div className="space-y-2">
            {question.agreeGroups.map(g => (
              <AgreeGroupRow key={g.mark} mark={g.mark} max={question.maxMarks} items={g.items} busy={busy}
                onConfirm={() => onConfirm(g.items.map(i => ({ submissionId: i.submissionId, rubricId: question.id, finalMark: g.mark })))} />
            ))}
          </div>
        </div>
      )}

      {question.yourCall.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-2">Your call ({question.yourCall.length})</h3>
          <div className="space-y-3">
            {question.yourCall.map(item => (
              <ReviewCard key={item.submissionId} item={item} busy={busy} mode={question.mode}
                onConfirm={mark => onConfirm([{ submissionId: item.submissionId, rubricId: question.id, finalMark: mark }])}
                onViewScript={() => onViewScript(item.submissionId, item.learnerName)} />
            ))}
          </div>
        </div>
      )}

      {question.reviewed.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Reviewed ({question.reviewed.length})</h3>
          <div className="space-y-2">
            {question.reviewed.map(item => (
              <ReviewedRow key={item.submissionId} item={item} busy={busy} mode={question.mode}
                onConfirm={mark => onConfirm([{ submissionId: item.submissionId, rubricId: question.id, finalMark: mark }])}
                onViewScript={() => onViewScript(item.submissionId, item.learnerName)} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function AgreeGroupRow({ mark, max, items, busy, onConfirm }: { mark: number; max: number; items: ReviewItem[]; busy: boolean; onConfirm: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setOpen(v => !v)} className="text-left">
          <span className="block font-bold text-gray-800">{mark}/{max} <span className="font-medium text-gray-500">· {items.length} learner{items.length > 1 ? 's' : ''}</span></span>
          <span className="block text-xs text-teal-700">{open ? 'Hide answers' : 'See answers'}</span>
        </button>
        <button onClick={onConfirm} disabled={busy} className="shrink-0 rounded-xl bg-teal-600 text-white text-sm font-bold px-4 py-2.5 disabled:opacity-40">
          Confirm all
        </button>
      </div>
      {open && (
        <ul className="mt-3 space-y-2">
          {items.map(i => (
            <li key={i.submissionId} className="text-sm">
              <span className="font-semibold text-gray-700">{i.learnerName}</span>
              <Points points={i.points} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Mode = QuestionReview['mode']

function ReviewCard({ item, busy, mode, onConfirm, onViewScript }: { item: ReviewItem; busy: boolean; mode: Mode; onConfirm: (mark: number) => void; onViewScript: () => void }) {
  // On "accept relevant" questions the teacher's mark matched the AI's
  // if-accepted total far more often than its scheme-only one (Phase 1 live
  // review, 2026-10-14: 9/16 vs 4/16), so that is the pre-selected default.
  // Strict questions default to scheme-only. Either way the teacher decides.
  const [mark, setMark] = useState(item.finalMark ?? (mode === 'accept_relevant' ? item.plausibleMark : item.proposedMark))
  const options = [...new Set([item.proposedMark, item.plausibleMark])]
  return (
    <div className="rounded-2xl bg-white border border-amber-200 p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-bold text-gray-800">{item.learnerName}</span>
        <button onClick={onViewScript} className="shrink-0 text-xs font-bold text-teal-700 underline">View script</button>
      </div>
      {item.status === 'missing'
        ? <p className="text-sm text-amber-700">No answer found on the script for this question.</p>
        : <Points points={item.points} />}
      {item.uncertain && item.status !== 'missing' && <p className="mt-1 text-xs font-semibold text-amber-700">⚑ Part of this answer was hard to read — check the script.</p>}
      {item.rationale && <p className="mt-1 text-xs text-gray-500">AI: {item.rationale}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.status !== 'missing' && options.map(o => (
          <button key={o} onClick={() => setMark(o)}
            className={`rounded-xl px-3 py-2 text-xs font-bold ${mark === o ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {o === item.proposedMark ? 'Scheme only' : 'Accept plausible'} {o}
          </button>
        ))}
        <Stepper value={mark} max={item.maxMark} onChange={setMark} />
      </div>
      <button onClick={() => onConfirm(mark)} disabled={busy} className="mt-3 w-full rounded-xl bg-teal-600 text-white font-bold py-3 disabled:opacity-40">
        Confirm {mark}/{item.maxMark}
      </button>
    </div>
  )
}

function ReviewedRow({ item, busy, mode, onConfirm, onViewScript }: { item: ReviewItem; busy: boolean; mode: Mode; onConfirm: (mark: number) => void; onViewScript: () => void }) {
  const [editing, setEditing] = useState(false)
  if (editing) return <ReviewCard item={item} busy={busy} mode={mode} onConfirm={m => { setEditing(false); onConfirm(m) }} onViewScript={onViewScript} />
  return (
    <button onClick={() => setEditing(true)} className="w-full flex items-center justify-between rounded-2xl bg-white border border-gray-100 px-4 py-2.5 text-left">
      <span className="text-sm font-semibold text-gray-700">{item.learnerName}</span>
      <span className="text-sm font-bold text-gray-800">
        {item.finalMark}/{item.maxMark}
        <span className={`ml-2 text-[11px] ${item.status === 'confirmed' ? 'text-teal-600' : 'text-amber-600'}`}>{item.status === 'confirmed' ? 'as AI' : 'changed'}</span>
      </span>
    </button>
  )
}

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => onChange(Math.max(0, value - 1))} className="px-3 py-2 text-gray-600 font-bold" aria-label="One mark less">−</button>
      <span className="w-12 text-center font-bold text-gray-800">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="px-3 py-2 text-gray-600 font-bold" aria-label="One mark more">+</button>
    </span>
  )
}

const CHIP: Record<MarkedPoint['classification'], { icon: string; cls: string; title: string }> = {
  matches_scheme: { icon: '✓', cls: 'text-teal-700', title: 'In the scheme' },
  plausible_not_in_scheme: { icon: '?', cls: 'text-amber-700', title: 'Plausible, not in the scheme' },
  incorrect: { icon: '✗', cls: 'text-gray-400 line-through', title: 'Incorrect or repeated' },
}

function Points({ points }: { points: MarkedPoint[] }) {
  if (points.length === 0) return <p className="text-sm text-gray-400">(blank)</p>
  return (
    <ul className="mt-1 space-y-0.5">
      {points.map((p, i) => {
        const chip = CHIP[p.classification]
        return (
          <li key={i} className={`text-sm ${p.counted ? '' : 'opacity-40'}`} title={p.counted ? chip.title : 'Beyond the number of points the question asks for — not counted'}>
            <span className={`font-bold mr-1 ${chip.cls.split(' ')[0]}`}>{chip.icon}</span>
            <span className={chip.cls}>{p.text}</span>
            {p.explained && <span className="ml-1 text-[11px] text-teal-600">+explained</span>}
            {p.note && p.classification !== 'matches_scheme' && <span className="block ml-4 text-[11px] text-gray-400">{p.note}</span>}
          </li>
        )
      })}
    </ul>
  )
}
