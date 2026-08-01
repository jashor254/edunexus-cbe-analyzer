import type { SchoolConceptConfig } from '@/data/schoolConcepts/types'

/** Practical information sheet, not four empty cards: one bordered panel,
 * labelled rows, each with its confirmation status inline — closer to a
 * school office notice than a dashboard's empty states. */
export function ParentInfoSection({ config }: { config: SchoolConceptConfig }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--concept-clay)]">For Parents</p>
      <h2 className="mt-1 font-[family-name:var(--font-institutional)] text-2xl font-bold text-[var(--concept-primary-dark)] sm:text-3xl">
        Parent Information
      </h2>

      <dl className="mt-6 divide-y divide-[var(--concept-charcoal)]/10 border border-[var(--concept-charcoal)]/10">
        {config.parentInfo.map((item) => (
          <div key={item.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
            <dt className="text-sm font-semibold text-[var(--concept-charcoal)]">{item.label}</dt>
            <dd className="text-xs font-medium text-[var(--concept-clay)]">{item.status}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
