'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { ConceptBadge } from './ConceptBadge'
import { PortalEntry } from './PortalEntry'
import type { ResolvedSchoolCapability, SchoolConceptConfig } from '@/data/schoolConcepts/types'

export function SiteHeader({
  config,
  portalCapabilities = [],
}: {
  config: SchoolConceptConfig
  portalCapabilities?: ResolvedSchoolCapability[]
}) {
  const [open, setOpen] = useState(false)
  const base = `/school-concepts/${config.slug}`

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--concept-charcoal)]/10 bg-[var(--concept-cream)]/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link href={base} className="flex flex-col">
            <span className="font-[family-name:var(--font-institutional)] text-base font-bold text-[var(--concept-primary-dark)] sm:text-lg">
              {config.schoolName}
            </span>
            <ConceptBadge />
          </Link>

          <div className="hidden shrink-0 items-center gap-3 md:flex">
            <PortalEntry capabilities={portalCapabilities} />
            <Link
              href={`${base}/admissions`}
              className="rounded-md bg-[var(--concept-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--concept-primary-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--concept-primary)]"
            >
              Admissions Information
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--concept-charcoal)]/20 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <nav className="mt-3 hidden flex-wrap items-center gap-x-6 gap-y-1 border-t border-[var(--concept-charcoal)]/10 pt-3 md:flex" aria-label="Main navigation">
          {config.nav.map((link) => (
            <Link
              key={link.label}
              href={`${base}${link.href}`}
              className="text-sm font-medium text-[var(--concept-charcoal)] hover:text-[var(--concept-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--concept-primary)] rounded"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {open && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-[var(--concept-charcoal)]/10 bg-[var(--concept-cream)] px-4 py-3 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {config.nav.map((link) => (
              <li key={link.label}>
                <Link
                  href={`${base}${link.href}`}
                  className="block rounded-md px-2 py-2.5 text-base font-medium text-[var(--concept-charcoal)] hover:bg-[var(--concept-primary)]/10"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {portalCapabilities.length > 0 && (
              <li className="pt-1" onClick={() => setOpen(false)}>
                <PortalEntry capabilities={portalCapabilities} />
              </li>
            )}
            <li>
              <Link
                href={`${base}/admissions`}
                className="mt-1 block rounded-md bg-[var(--concept-primary)] px-3 py-2.5 text-center text-base font-semibold text-white"
                onClick={() => setOpen(false)}
              >
                Admissions Information
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
