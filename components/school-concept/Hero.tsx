import Link from 'next/link'
import type { SchoolConceptConfig } from '@/data/schoolConcepts/types'

/** Institutional masthead, not a SaaS hero: a static nameplate bounded by
 * thin rules (the print/gazette device this route's identity strategy is
 * built on), one primary action, one restrained secondary link. No
 * decorative background pattern, no stacked value-proposition badges. */
export function Hero({ config }: { config: SchoolConceptConfig }) {
  const base = `/school-concepts/${config.slug}`

  return (
    <section className="bg-[var(--concept-cream)]">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="border-y-2 border-[var(--concept-charcoal)]/80 py-6 sm:py-8">
          <h1 className="font-[family-name:var(--font-institutional)] text-3xl font-bold leading-tight text-[var(--concept-primary-dark)] sm:text-5xl">
            {config.schoolName}
          </h1>
          <p className="mt-3 max-w-xl text-base text-[var(--concept-charcoal)]/80 sm:text-lg">{config.heroTagline}</p>
        </div>

        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--concept-charcoal)]/75">{config.shortDescription}</p>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href={`${base}/admissions`}
            className="rounded-md bg-[var(--concept-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--concept-primary-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--concept-primary)]"
          >
            Admissions Information
          </Link>
          <Link
            href={`${base}/about`}
            className="text-sm font-medium text-[var(--concept-primary-dark)] underline decoration-[var(--concept-primary)]/40 underline-offset-4 hover:decoration-[var(--concept-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--concept-primary)]"
          >
            About the School
          </Link>
        </div>
      </div>
    </section>
  )
}
