import Link from 'next/link'
import type { SchoolConceptConfig } from '@/data/schoolConcepts/types'

export function SiteFooter({ config }: { config: SchoolConceptConfig }) {
  const base = `/school-concepts/${config.slug}`

  return (
    <footer className="border-t border-[var(--concept-charcoal)]/10 bg-[var(--concept-primary-dark)] text-[var(--concept-cream)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="font-[family-name:var(--font-institutional)] text-lg font-bold">{config.schoolName}</p>
            <p className="mt-2 max-w-sm text-sm text-[var(--concept-cream)]/80">{config.shortDescription}</p>
          </div>
          <nav aria-label="Footer navigation">
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {config.nav.map((link) => (
                <li key={link.label}>
                  <Link href={`${base}${link.href}`} className="text-[var(--concept-cream)]/80 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-8 max-w-2xl text-xs leading-relaxed text-[var(--concept-cream)]/60">
          {config.conceptDisclaimer}
        </p>
      </div>
    </footer>
  )
}
