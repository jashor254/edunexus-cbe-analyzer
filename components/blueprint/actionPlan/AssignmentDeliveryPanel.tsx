'use client'

// components/blueprint/actionPlan/AssignmentDeliveryPanel.tsx
//
// The smallest safe teacher interaction over the existing Phase 2B
// delivery endpoint (Phase 3A). Submits ONLY to
// `POST /api/teacher/blueprint/actions/[actionItemId]/deliver-assignment`
// — this component never calls `createAssignment()` or inserts into
// `assignments` itself. The class dropdown is populated from the existing,
// unmodified `GET /api/teacher/classes` (already session-scoped to the
// signed-in teacher's own classes — never a client-supplied teacher id),
// so a teacher can only ever select a class they already own; the server
// route re-verifies ownership independently regardless.
//
// Prefill for title/instructions mirrors (never re-implements)
// `mapActionToAssignmentDraft`'s own formula
// (lib/learnerBlueprint/actionPlan/delivery/assignment.ts) purely for
// display — the teacher sees exactly what the server would derive if the
// fields were left blank, and can edit before submitting. If unedited, the
// value sent is text-identical to the server's own deterministic mapping;
// the server itself remains the authoritative source, this is not a
// second implementation of the mapping's business meaning.

import { useEffect, useId, useRef, useState } from 'react'

export type TeacherClassOption = { id: string; name: string; grade: number; subject: string }

export type AssignmentDeliveryResult = {
  assignment: { id: string; blueprint_action_item_id: string | null }
  alreadyDelivered: boolean
}

function mirroredInstructions(learnerAction: string | null, intendedOutcome: string, successIndicator: string): string {
  const objective = learnerAction?.trim() || intendedOutcome.trim()
  const parts = [objective]
  if (successIndicator.trim()) parts.push(`Success looks like: ${successIndicator.trim()}`)
  return parts.join('\n\n')
}

export default function AssignmentDeliveryPanel({
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
  onDelivered: (result: AssignmentDeliveryResult) => void
}) {
  const titleId = useId()
  const firstFieldRef = useRef<HTMLSelectElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const [classes, setClasses] = useState<TeacherClassOption[] | null>(null)
  const [classesError, setClassesError] = useState<string | null>(null)
  const [classId, setClassId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [title, setTitle] = useState(actionTitle)
  const [instructions, setInstructions] = useState(mirroredInstructions(learnerAction, intendedOutcome, successIndicator))
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
    fetch('/api/teacher/classes')
      .then(res => res.json())
      .then(body => setClasses((body.data?.classes ?? []).map((c: TeacherClassOption) => ({ id: c.id, name: c.name, grade: c.grade, subject: c.subject }))))
      .catch(() => setClassesError('Could not load your classes. Please try again.'))
  }, [])

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

    if (!classId) return setValidationError('Choose a class.')
    if (!confirmed) return setValidationError('You must confirm this assignment will be issued to the whole class.')
    if (!title.trim()) return setValidationError('Enter a title.')
    if (!instructions.trim()) return setValidationError('Enter learner-facing instructions.')
    if (!subject.trim()) return setValidationError('Enter a subject.')
    if (!topic.trim()) return setValidationError('Enter a topic.')
    if (!dueDate) return setValidationError('Choose a due date.')
    setValidationError(null)
    setSubmitting(true)

    try {
      const res = await fetch(`/api/teacher/blueprint/actions/${actionId}/deliver-assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId, confirmClassWideDelivery: confirmed,
          subject: subject.trim(), topic: topic.trim(),
          title: title.trim(), instructions: instructions.trim(),
          dueDate,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setSubmitError(body?.error ?? 'Could not deliver this assignment. Please try again.')
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-black text-gray-900 mb-1">Create class assignment</h2>
        <p className="text-xs text-gray-500 mb-4">Based on the approved action: {actionTitle}</p>

        <div role="alert" className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
          This assignment will be issued to every learner in the selected class.
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <label htmlFor={`${titleId}-class`} className="block text-sm font-bold text-gray-800 mb-1">Class</label>
            {classesError && <p role="alert" className="text-xs text-red-700 mb-1">{classesError}</p>}
            <select
              id={`${titleId}-class`}
              ref={firstFieldRef}
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <option value="">{classes === null ? 'Loading your classes…' : 'Select a class'}</option>
              {(classes ?? []).map(c => (
                <option key={c.id} value={c.id}>{c.name} — Grade {c.grade}, {c.subject}</option>
              ))}
            </select>
          </div>

          <label htmlFor={`${titleId}-confirm`} className="flex items-start gap-2 text-sm font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 cursor-pointer">
            <input
              id={`${titleId}-confirm`}
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            I confirm this assignment will be issued to the whole selected class.
          </label>

          <div>
            <label htmlFor={`${titleId}-title`} className="block text-sm font-bold text-gray-800 mb-1">Title</label>
            <input
              id={`${titleId}-title`} type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${titleId}-subject`} className="block text-sm font-bold text-gray-800 mb-1">Subject</label>
              <input
                id={`${titleId}-subject`} type="text" value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              />
            </div>
            <div>
              <label htmlFor={`${titleId}-topic`} className="block text-sm font-bold text-gray-800 mb-1">Topic</label>
              <input
                id={`${titleId}-topic`} type="text" value={topic} onChange={e => setTopic(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor={`${titleId}-instructions`} className="block text-sm font-bold text-gray-800 mb-1">Learner-facing instructions</label>
            <textarea
              id={`${titleId}-instructions`} rows={4} value={instructions} onChange={e => setInstructions(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            />
          </div>

          <div>
            <label htmlFor={`${titleId}-due`} className="block text-sm font-bold text-gray-800 mb-1">Due date</label>
            <input
              id={`${titleId}-due`} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            />
          </div>

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
              {submitting ? 'Delivering…' : 'Create class assignment'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-black text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
