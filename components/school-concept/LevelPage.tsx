import { notFound } from 'next/navigation'
import { PageIntro } from './PageIntro'
import type { SchoolConceptConfig } from '@/data/schoolConcepts/types'

export function LevelPage({ config, levelSlug }: { config: SchoolConceptConfig; levelSlug: string }) {
  const level = config.levels.find((l) => l.slug === levelSlug)
  if (!level) notFound()

  return (
    <>
      <PageIntro title={`${level.name} — ${config.schoolName}`} description={level.description} />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <h2 className="font-[family-name:var(--font-institutional)] text-lg font-bold text-[var(--concept-primary-dark)]">
          General focus areas
        </h2>
        <p className="mt-2 text-xs font-medium text-[var(--concept-clay)]">
          General concept copy — not a verified official school statement.
        </p>
        <ul className="mt-4 space-y-2 border-l-2 border-[var(--concept-charcoal)]/10 pl-4">
          {level.focusAreas.map((area) => (
            <li key={area} className="text-sm leading-relaxed text-[var(--concept-charcoal)]/85">
              {area}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
