'use client'

import { useState, type FormEvent } from 'react'

export function DemoEnquiryForm() {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="rounded-xl border border-[var(--concept-charcoal)]/10 bg-white p-6">
      <p className="mb-4 inline-block rounded-full bg-[var(--concept-clay)]/15 px-3 py-1 text-xs font-semibold text-[var(--concept-clay)]">
        Demonstration form — no message is sent
      </p>

      {submitted ? (
        <p role="status" className="text-sm font-medium text-[var(--concept-primary-dark)]">
          Demonstration only — the school&apos;s official enquiry channel will be added after approval.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4" aria-label="Demonstration enquiry form">
          <div>
            <label htmlFor="demo-name" className="mb-1 block text-sm font-medium text-[var(--concept-charcoal)]">
              Your name
            </label>
            <input
              id="demo-name"
              name="name"
              type="text"
              className="w-full rounded-md border border-[var(--concept-charcoal)]/20 px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--concept-primary)]"
              placeholder="e.g. Jane Wanjiru"
            />
          </div>
          <div>
            <label htmlFor="demo-message" className="mb-1 block text-sm font-medium text-[var(--concept-charcoal)]">
              Your enquiry
            </label>
            <textarea
              id="demo-message"
              name="message"
              rows={4}
              className="w-full rounded-md border border-[var(--concept-charcoal)]/20 px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--concept-primary)]"
              placeholder="This is a demonstration form — nothing is sent."
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--concept-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--concept-primary-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--concept-primary)] sm:w-auto"
          >
            Preview submit (demo only)
          </button>
        </form>
      )}
    </div>
  )
}
