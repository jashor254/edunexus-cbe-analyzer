import { notFound } from 'next/navigation'
import { Source_Serif_4 } from 'next/font/google'
import type { CSSProperties, ReactNode } from 'react'
import type { Metadata } from 'next'
import { getSchoolConcept } from '@/data/schoolConcepts'
import { getPortalCapabilities } from '@/lib/schoolConcepts/getPortalCapabilities'
import { SiteHeader } from '@/components/school-concept/SiteHeader'
import { SiteFooter } from '@/components/school-concept/SiteFooter'

// Route-group safety net, independent of any single page: resets the root
// layout's '%s | EduNexus Kenya' title template (so a page that ever forgot
// to set its own complete title wouldn't get EduNexus's brand appended to
// it) and defaults every school-concept page to noindex/nofollow. Each
// page's generateMetadata (lib/schoolConcepts/pageMetadata.ts) sets the
// real, config-derived values and overrides this per-field — this is only
// the fail-closed fallback.
export const metadata: Metadata = {
  title: { template: '%s', default: 'School Website Concept' },
  robots: { index: false, follow: false },
}

// Institutional heading face, scoped to this route group only — self-hosted
// at build time by next/font, not a runtime remote fetch. Used for headings
// only (via --font-institutional); body copy stays on the existing sans
// stack. This is the same next/font/google convention already used by
// app/(marketing)/layout.tsx (Sora), applied here with a different,
// deliberately more formal face to read as an institutional document
// heading rather than a product heading.
const institutionalSerif = Source_Serif_4({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-institutional' })

export default async function SchoolConceptLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ schoolSlug: string }>
}) {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)

  if (!config) {
    notFound()
  }

  // Public site: no signed-in viewer context, so this resolves purely from
  // the school's own capability configuration. A school with no
  // `capabilities` key always resolves to an empty array here — never a
  // per-school branch.
  const portalCapabilities = getPortalCapabilities(config)

  const themeVars = {
    '--concept-primary': config.theme.primary,
    '--concept-primary-dark': config.theme.primaryDark,
    '--concept-cream': config.theme.cream,
    '--concept-clay': config.theme.clay,
    '--concept-charcoal': config.theme.charcoal,
  } as CSSProperties

  return (
    <div
      data-school-concept-shell="true"
      style={themeVars}
      className={`${institutionalSerif.variable} flex min-h-screen flex-col bg-[var(--concept-cream)] font-sans text-[var(--concept-charcoal)]`}
    >
      <SiteHeader config={config} portalCapabilities={portalCapabilities} />
      <div className="flex-1">{children}</div>
      <SiteFooter config={config} />
    </div>
  )
}
