import Link from 'next/link'
import type { SchoolConceptConfig } from '@/data/schoolConcepts/types'

/** Notice board, not an image-card feed: rows differentiated by a small
 * category label and a left rule, read top to bottom like a real school
 * notice board rather than scanned as equal-weight tiles. */
export function NewsPreview({ config }: { config: SchoolConceptConfig }) {
  const base = `/school-concepts/${config.slug}`

  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--concept-clay)]">Notice Board</p>
          <h2 className="mt-1 font-[family-name:var(--font-institutional)] text-2xl font-bold text-[var(--concept-primary-dark)] sm:text-3xl">
            News &amp; Events
          </h2>
        </div>
        <Link href={`${base}/news-events`} className="shrink-0 text-sm font-semibold text-[var(--concept-primary)] hover:underline">
          View all →
        </Link>
      </div>

      <ul className="mt-6 divide-y divide-[var(--concept-charcoal)]/10 border-y border-[var(--concept-charcoal)]/10">
        {config.sampleNews.map((item) => (
          <li key={item.title} className="border-l-2 border-[var(--concept-clay)]/50 py-4 pl-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--concept-clay)]">{item.category}</span>
            <h3 className="mt-1 font-[family-name:var(--font-institutional)] text-base font-bold text-[var(--concept-primary-dark)]">
              {item.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--concept-charcoal)]/75">{item.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
