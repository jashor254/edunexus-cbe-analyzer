import Link from 'next/link'
import type { SchoolConceptConfig } from '@/data/schoolConcepts/types'

/** School Structure: a directory of the school's configured levels,
 * rendered as numbered rows rather than equal-width cards. Whatever number
 * of levels a school configures — one, three, five — renders identically;
 * nothing here assumes exactly three. */
export function EducationJourneyCards({ config }: { config: SchoolConceptConfig }) {
  const base = `/school-concepts/${config.slug}`

  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--concept-clay)]">School Structure</p>
      <h2 className="mt-1 font-[family-name:var(--font-institutional)] text-2xl font-bold text-[var(--concept-primary-dark)] sm:text-3xl">
        Education Levels
      </h2>

      <ol className="mt-6 divide-y divide-[var(--concept-charcoal)]/10 border-y border-[var(--concept-charcoal)]/10">
        {config.levels.map((level, index) => (
          <li key={level.id}>
            <Link
              href={`${base}/${level.slug}`}
              className="group flex flex-col gap-1 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--concept-primary)] sm:flex-row sm:items-baseline sm:gap-6"
            >
              <span className="font-[family-name:var(--font-institutional)] text-sm font-semibold text-[var(--concept-clay)] sm:w-10">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="sm:w-48 sm:shrink-0">
                <span className="font-[family-name:var(--font-institutional)] text-lg font-bold text-[var(--concept-primary-dark)] group-hover:underline">
                  {level.name}
                </span>
              </span>
              <span className="text-sm leading-relaxed text-[var(--concept-charcoal)]/75">{level.description}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
