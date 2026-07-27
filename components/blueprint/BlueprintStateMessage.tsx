// components/blueprint/BlueprintStateMessage.tsx
//
// Shared, explicit non-happy-path state for the three Blueprint pages
// (Current, History list, Snapshot detail) — Sprint 12L-R Phase 4. Replaces
// the previous behaviour of collapsing every failure into a generic
// `notFound()` with a labeled explanation, per mission ("no blank pages,
// never expose internals, never reveal IDs"). One component, reused by all
// three pages — no per-page duplicate layout.

import Link from 'next/link'

export type BlueprintStateKind =
  | 'learner-not-found'
  | 'snapshot-not-found'
  | 'permission-denied'
  | 'unavailable'
  // Phase 4A — the Blueprint Intelligence Coherence Engine found a
  // critical contradiction between this Blueprint's claims and the
  // learner's own Evidence/Projection (composeBlueprint()'s `coherence`
  // report). Withheld rather than shown with the contradiction visible,
  // per the phase's own rule: failures prevent publication, warnings do
  // not (a PASS_WITH_WARNINGS Blueprint still renders normally).
  | 'coherence-failed'

const COPY: Record<BlueprintStateKind, { title: string; message: string }> = {
  'learner-not-found': {
    title: 'Learner not found',
    message: 'This learner record could not be found. It may have been removed, or the link may be incorrect.',
  },
  'snapshot-not-found': {
    title: 'Snapshot not found',
    message: 'This historical snapshot could not be found. It may have been removed from view, or the link may be incorrect.',
  },
  'permission-denied': {
    title: 'You do not have access to this Blueprint',
    message: 'Your account does not have permission to view this learner\'s Blueprint. Contact your school administrator if you believe this is an error.',
  },
  unavailable: {
    title: 'Blueprint temporarily unavailable',
    message: 'We couldn\'t load this Blueprint right now. Please try again in a moment.',
  },
  'coherence-failed': {
    title: 'This Blueprint needs review before it can be shown',
    message: 'An automated check found a recommendation that does not match this learner\'s current evidence. It has been withheld until a teacher or school administrator reviews and corrects it.',
  },
}

export default function BlueprintStateMessage({
  kind,
  backHref,
  backLabel,
}: {
  kind: BlueprintStateKind
  /** Optional "go back" link — omitted when there's nowhere safe to send the user (e.g. before the learner is resolved). */
  backHref?: string
  backLabel?: string
}) {
  const { title, message } = COPY[kind]

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div role="alert" className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-2">
        <p className="text-sm font-black text-gray-900">{title}</p>
        <p className="text-xs text-gray-400">{message}</p>
        {backHref && (
          <Link href={backHref} className="inline-block text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none mt-2">
            {backLabel ?? '← Back'}
          </Link>
        )}
      </div>
    </div>
  )
}
