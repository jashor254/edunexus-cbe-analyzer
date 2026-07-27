'use client'

// components/blueprint/review/BlueprintReviewForm.tsx
//
// Records a teacher's professional judgement on a Blueprint action item
// (Phase 2E). Submits ONLY through the existing Phase 2D route
// (`POST /api/teacher/blueprint/actions/[actionItemId]/review`), which
// calls the canonical `reviewBlueprintAction()` — this component never
// writes to `blueprint_action_reviews` or any other table directly, and
// never infers a decision on the teacher's behalf. Exactly the five
// established Phase 2D decisions are offered; no new synonym or status is
// introduced here.

import { useId, useState } from 'react'
import type { BlueprintActionReviewDecision } from '@/lib/repositories/blueprintActionReview.repository'
import { DECISION_LABEL, isNoteRequiredForDecision } from './reviewFormatting'

const DECISIONS: BlueprintActionReviewDecision[] = ['complete', 'needs_revision', 'reopen', 'defer', 'no_decision']

export type BlueprintReviewFormSubmitResult = {
  review: unknown
  snapshot: unknown
}

export default function BlueprintReviewForm({
  actionId,
  onSubmitted,
}: {
  actionId: string
  onSubmitted: (result: BlueprintReviewFormSubmitResult) => void
}) {
  const formId = useId()
  const [decision, setDecision] = useState<BlueprintActionReviewDecision | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const noteRequired = decision !== null && isNoteRequiredForDecision(decision)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSuccessMessage(null)

    if (!decision) {
      setValidationError('Choose a review decision before submitting.')
      return
    }
    if (noteRequired && !notes.trim()) {
      setValidationError(`A note is required for "${DECISION_LABEL[decision]}".`)
      return
    }
    setValidationError(null)
    setSubmitting(true)

    try {
      const res = await fetch(`/api/teacher/blueprint/actions/${actionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: notes.trim() || undefined }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setSubmitError(body?.error ?? 'Could not record this review. Please try again.')
        return
      }
      onSubmitted(body.data)
      setSuccessMessage(`Review recorded: ${DECISION_LABEL[decision]}.`)
      setDecision(null)
      setNotes('')
    } catch {
      setSubmitError('A connection problem prevented this review from being recorded. Your note has not been lost — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby={`${formId}-heading`} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <h3 id={`${formId}-heading`} className="text-xs font-black text-gray-900 uppercase tracking-wide">Record Your Review</h3>

      <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
        Assignment or Compass activity does not automatically determine whether the action succeeded. Record your
        professional judgement after reviewing the available information.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <fieldset>
          <legend className="text-sm font-bold text-gray-800 mb-1.5">Decision</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DECISIONS.map(value => {
              const inputId = `${formId}-decision-${value}`
              return (
                <label
                  key={value}
                  htmlFor={inputId}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold cursor-pointer ${
                    decision === value ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  <input
                    id={inputId}
                    type="radio"
                    name={`${formId}-decision`}
                    value={value}
                    checked={decision === value}
                    onChange={() => setDecision(value)}
                    className="h-4 w-4"
                  />
                  {DECISION_LABEL[value]}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor={`${formId}-notes`} className="block text-sm font-bold text-gray-800 mb-1">
            Educator note{noteRequired ? ' (required)' : ' (optional, encouraged)'}
          </label>
          <textarea
            id={`${formId}-notes`}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            aria-required={noteRequired}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            placeholder="What did you observe, and what is your professional judgement?"
          />
        </div>

        {validationError && (
          <div role="alert" className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {validationError}
          </div>
        )}
        {submitError && (
          <div role="alert" className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {submitError}
          </div>
        )}
        <div aria-live="polite" className="sr-only">
          {successMessage}
        </div>
        {successMessage && (
          <div role="status" className="text-sm font-bold text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Recording…' : 'Record review'}
        </button>
      </form>
    </section>
  )
}
