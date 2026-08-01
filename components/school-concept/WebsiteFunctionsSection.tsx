import type { SchoolConceptConfig } from '@/data/schoolConcepts/types'

/** Kept deliberately small and secondary — this is a footnote about what a
 * school website can hold, not a homepage section in its own right. It
 * should never compete with the school's own identity content above it. */
export function WebsiteFunctionsSection({ config }: { config: SchoolConceptConfig }) {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <p className="border-t border-[var(--concept-charcoal)]/10 py-4 text-xs leading-relaxed text-[var(--concept-charcoal)]/55">
        This website can hold {config.websiteFunctions.join(', ').toLowerCase()}, and more, in one place for parents and the community.
      </p>
    </div>
  )
}
