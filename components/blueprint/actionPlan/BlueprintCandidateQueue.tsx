'use client'

// components/blueprint/actionPlan/BlueprintCandidateQueue.tsx
//
// The candidate-review front half of the Blueprint action-plan pipeline —
// the teacher-facing entry point onto
// lib/learnerBlueprint/actionPlan/{lifecycle,candidateGeneration}.ts, which
// were code-complete and tested but had no product surface before this
// component existed (see the section header comment on the routes this
// calls: app/api/teacher/blueprint/actions/**). Two things happen here:
// (1) a teacher can ask for a system-generated suggestion for a learner in
// one subject — never automatic, never a loop over every subject — and (2)
// review every action item still awaiting a decision (proposed / edited /
// deferred, teacher-authored or system-generated alike) with Approve /
// Reject / Defer. Nothing here writes evidence, creates an assignment, or
// starts a Compass session — approval only changes the action item's own
// status; delivery is a separate, already-existing step
// (BlueprintActionPlanSection, once an item is approved).

import { useEffect, useId, useState } from 'react'

type PendingAction = {
  id: string
  status: 'proposed' | 'edited' | 'deferred'
  title: string
  rationale: string
  intendedOutcome: string
  proposalSource: 'teacher' | 'system'
  priority: 'low' | 'medium' | 'high'
  createdAt: string
}

type DecisionKind = 'approve' | 'reject' | 'defer'

export default function BlueprintCandidateQueue({
  learnerId,
  schoolId,
}: {
  learnerId: string
  schoolId: string
}) {
  const formId = useId()

  const [items, setItems] = useState<PendingAction[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [subject, setSubject] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [openDecision, setOpenDecision] = useState<{ id: string; kind: DecisionKind } | null>(null)
  const [reasonDraft, setReasonDraft] = useState('')
  const [deciding, setDeciding] = useState(false)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  async function loadPending() {
    try {
      const res = await fetch(`/api/teacher/blueprint/actions?learnerId=${learnerId}`)
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setLoadError(body?.error ?? 'Could not load pending suggestions.')
        return
      }
      setItems(body.data.actions)
      setLoadError(null)
    } catch {
      setLoadError('A connection problem prevented loading pending suggestions.')
    }
  }

  useEffect(() => {
    loadPending()
  }, [learnerId])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) {
      setGenerateError('Enter a subject.')
      return
    }
    setGenerateError(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/teacher/blueprint/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, schoolId, subject: subject.trim() }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setGenerateError(body?.error ?? 'Could not generate a suggestion. Please try again.')
        return
      }
      setSubject('')
      setAnnouncement('A new suggestion was proposed — review it below before it can be delivered.')
      await loadPending()
    } catch {
      setGenerateError('A connection problem prevented generation. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function submitDecision(kind: DecisionKind, actionId: string, reason: string) {
    setDeciding(true)
    setDecisionError(null)
    try {
      const path = kind === 'approve' ? 'approve' : kind === 'reject' ? 'reject' : 'defer'
      const res = await fetch(`/api/teacher/blueprint/actions/${actionId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          kind === 'approve'
            ? (reason.trim() ? { decisionReason: reason.trim() } : {})
            : { reason: reason.trim() }
        ),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setDecisionError(body?.error ?? `Could not ${kind} this action. Please try again.`)
        return
      }
      setOpenDecision(null)
      setReasonDraft('')
      setAnnouncement(
        kind === 'approve' ? 'Action approved — it can now be delivered from the Blueprint Action Plan below.'
        : kind === 'reject' ? 'Action rejected.'
        : 'Action deferred — it will remain available to revisit.'
      )
      await loadPending()
    } catch {
      setDecisionError('A connection problem prevented this decision. Please try again.')
    } finally {
      setDeciding(false)
    }
  }

  return (
    <section aria-labelledby={`${formId}-heading`} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <h2 id={`${formId}-heading`} className="text-sm font-black text-gray-900 uppercase tracking-wide">
        Suggested &amp; Pending Actions
      </h2>
      <div aria-live="polite" className="sr-only">{announcement}</div>
      {announcement && (
        <div role="status" className="text-sm font-bold text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
          {announcement}
        </div>
      )}

      <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-40">
          <label htmlFor={`${formId}-subject`} className="block text-xs font-bold text-gray-600 mb-1">
            Suggest an action for a subject
          </label>
          <input
            id={`${formId}-subject`}
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Mathematics"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          />
        </div>
        <button
          type="submit"
          disabled={generating}
          className="bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? 'Generating…' : 'Generate suggestion'}
        </button>
      </form>
      {generateError && (
        <div role="alert" className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{generateError}</div>
      )}

      {loadError && (
        <div role="alert" className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{loadError}</div>
      )}

      {items === null && !loadError && (
        <p className="text-sm text-gray-500">Loading pending suggestions…</p>
      )}

      {items !== null && items.length === 0 && (
        <p className="text-sm text-gray-500">No suggestions awaiting a decision right now.</p>
      )}

      {items !== null && items.length > 0 && (
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.id} className="border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    {item.proposalSource === 'system' ? 'System-suggested' : 'Teacher-authored'} · {item.status} · {item.priority} priority
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-700">{item.rationale}</p>
              <p className="text-xs text-gray-500"><span className="font-bold">Intended outcome:</span> {item.intendedOutcome}</p>

              {openDecision?.id === item.id ? (
                <div className="pt-2 space-y-2">
                  {openDecision.kind !== 'approve' && (
                    <textarea
                      value={reasonDraft}
                      onChange={e => setReasonDraft(e.target.value)}
                      placeholder={openDecision.kind === 'reject' ? 'Reason for rejecting (required)' : 'Reason for deferring (required)'}
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    />
                  )}
                  {decisionError && (
                    <div role="alert" className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{decisionError}</div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={deciding || (openDecision.kind !== 'approve' && !reasonDraft.trim())}
                      onClick={() => submitDecision(openDecision.kind, item.id, reasonDraft)}
                      className="bg-teal-600 text-white px-3 py-1.5 rounded-lg font-black text-xs hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deciding ? 'Saving…' : `Confirm ${openDecision.kind}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOpenDecision(null); setReasonDraft(''); setDecisionError(null) }}
                      className="px-3 py-1.5 rounded-lg font-black text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpenDecision({ id: item.id, kind: 'approve' })}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg font-black text-xs hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOpenDecision({ id: item.id, kind: 'reject' }); setReasonDraft('') }}
                    className="bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg font-black text-xs hover:bg-red-100"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOpenDecision({ id: item.id, kind: 'defer' }); setReasonDraft('') }}
                    className="bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg font-black text-xs hover:bg-gray-100"
                  >
                    Defer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
