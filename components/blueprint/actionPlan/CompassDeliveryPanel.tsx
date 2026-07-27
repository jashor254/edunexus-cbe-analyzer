'use client'

// components/blueprint/actionPlan/CompassDeliveryPanel.tsx
//
// The smallest safe teacher interaction over the existing Phase 2C
// delivery endpoint (Phase 3A). Submits ONLY to
// `POST /api/teacher/blueprint/actions/[actionItemId]/deliver-compass` —
// never calls `setTeacherSuggestedTopic()` or writes to
// `blueprint_compass_deliveries`/`student_learning_context` itself. There
// is no learner or class selector anywhere in this form BY DESIGN — the
// route resolves the learner from the action item server-side
// (`action.learner_id`) and the request body has no field capable of
// naming a different one, so there is structurally no way for this UI to
// substitute another learner.
//
// Prefill mirrors (never re-implements) `mapActionToCompassObjective`'s
// own formula — see AssignmentDeliveryPanel.tsx's identical note.

import { useEffect, useId, useRef, useState } from 'react'

export type CompassDeliveryResult = {
  delivery: { id: string; subject: string; objective: string; blueprint_action_item_id: string }
  alreadyDelivered: boolean
}

function mirroredObjective(learnerAction: string | null, intendedOutcome: string): string {
  return learnerAction?.trim() || intendedOutcome.trim()
}

function mirroredInstructions(learnerAction: string | null, intendedOutcome: string, successIndicator: string): string {
  const objective = mirroredObjective(learnerAction, intendedOutcome)
  const parts = [objective]
  if (successIndicator.trim()) parts.push(`Success looks like: ${successIndicator.trim()}`)
  return parts.join('\n\n')
}

export default function CompassDeliveryPanel({
  actionId,
  actionTitle,
  learnerAction,
  intendedOutcome,
  successIndicator,
  onClose,
  onDelivered,
}: {
  actionId: string
  actionTitle: string
  learnerAction: string | null
  intendedOutcome: string
  successIndicator: string
  onClose: () => void
  onDelivered: (result: CompassDeliveryResult) => void
}) {
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const [subject, setSubject] = useState('')
  const [objective, setObjective] = useState(mirroredObjective(learnerAction, intendedOutcome))
  const [learnerInstructions, setLearnerInstructions] = useState(mirroredInstructions(learnerAction, intendedOutcome, successIndicator))
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [identityUnavailable, setIdentityUnavailable] = useState(false)

  useEffect(() => { firstFieldRef.current?.focus() }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setIdentityUnavailable(false)

    if (!subject.trim()) return setValidationError('Enter a Compass subject.')
    if (!confirmed) return setValidationError('You must confirm this objective will be sent to Learning Compass.')
    setValidationError(null)
    setSubmitting(true)

    try {
      const res = await fetch(`/api/teacher/blueprint/actions/${actionId}/deliver-compass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmCompassDelivery: confirmed,
          subject: subject.trim(),
          objective: objective.trim() || undefined,
          learnerInstructions: learnerInstructions.trim() || undefined,
        }),
      })
      const body = await res.json().catch(() => null)
      if (res.status === 404 && /compass/i.test(body?.error ?? '')) {
        setIdentityUnavailable(true)
        return
      }
      if (!res.ok) {
        setSubmitError(body?.error ?? 'Could not deliver this objective. Please try again.')
        return
      }
      onDelivered(body.data)
    } catch {
      setSubmitError('A connection problem prevented delivery. Your entries have not been lost — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-black text-gray-900 mb-1">Send to Learning Compass</h2>
        <p className="text-xs text-gray-500 mb-4">Based on the approved action: {actionTitle}</p>

        {identityUnavailable ? (
          <div className="space-y-3">
            <div role="alert" className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              This learner is not yet linked to Learning Compass, so an objective cannot be sent there yet.
            </div>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl font-black text-sm text-gray-600 hover:bg-gray-100">
              Close
            </button>
          </div>
        ) : (
          <>
            <div role="alert" className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
              This will make the approved objective available in Learning Compass for this learner. It will not start a tutoring session automatically.
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-3">
              <div>
                <label htmlFor={`${titleId}-subject`} className="block text-sm font-bold text-gray-800 mb-1">Subject</label>
                <input
                  id={`${titleId}-subject`} ref={firstFieldRef} type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Mathematics"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                />
              </div>

              <div>
                <label htmlFor={`${titleId}-objective`} className="block text-sm font-bold text-gray-800 mb-1">Learner-facing objective</label>
                <textarea
                  id={`${titleId}-objective`} rows={2} value={objective} onChange={e => setObjective(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                />
              </div>

              <div>
                <label htmlFor={`${titleId}-instructions`} className="block text-sm font-bold text-gray-800 mb-1">Learner-facing instructions (optional)</label>
                <textarea
                  id={`${titleId}-instructions`} rows={3} value={learnerInstructions} onChange={e => setLearnerInstructions(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                />
              </div>

              <label htmlFor={`${titleId}-confirm`} className="flex items-start gap-2 text-sm font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 cursor-pointer">
                <input
                  id={`${titleId}-confirm`} type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                I confirm this objective should be sent to Learning Compass for this learner.
              </label>

              {validationError && (
                <div role="alert" className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{validationError}</div>
              )}
              {submitError && (
                <div role="alert" className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{submitError}</div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Sending…' : 'Send to Learning Compass'}
                </button>
                <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl font-black text-sm text-gray-600 hover:bg-gray-100">
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
