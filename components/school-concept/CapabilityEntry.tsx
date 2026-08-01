import Link from 'next/link'
import { buildCapabilityLink } from '@/lib/schoolConcepts/buildCapabilityLink'
import type { ResolvedSchoolCapability } from '@/data/schoolConcepts/types'

/** Renders nothing for a disabled capability, and a single subordinate
 * entry link for an enabled one. Knows nothing about routes, roles, school
 * membership, or authorization — it only renders what resolveSchoolCapability
 * already decided. Intentionally not a card: this is a small institutional
 * utility link, not a feature advertisement. */
export function CapabilityEntry({ capability }: { capability: ResolvedSchoolCapability }) {
  const href = buildCapabilityLink(capability)
  if (!href || capability.state !== 'enabled') return null

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md border border-[var(--concept-charcoal)]/20 px-4 py-2 text-sm font-medium text-[var(--concept-charcoal)] hover:border-[var(--concept-primary)] hover:text-[var(--concept-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--concept-primary)]"
    >
      {capability.label}
    </Link>
  )
}
