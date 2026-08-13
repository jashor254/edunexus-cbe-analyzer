import { notFound } from 'next/navigation'
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

// Institutional heading face, scoped to this route group only. Used for
// headings (via --font-institutional); body copy stays on the existing sans
// stack.
//
// A system serif stack rather than next/font/google. This was
// Source_Serif_4, and it broke `npm run build`: Google's CSS API returned
// the @font-face rules, but the .woff2 binary Next requested 404'd at
// fonts.gstatic.com, so Next emitted an unresolvable
// `@vercel/turbopack-next/internal/font/google/font` reference and Turbopack
// failed with 12 module-not-found errors. It was specific to this family —
// Montserrat and Inter, used by the marketing/demo/pitch layouts, resolved
// fine in the same build.
//
// A build that depends on a third party serving one exact binary URL is not
// deterministic, and this is a concept site whose job is to read as a formal
// institutional document. The stack below keeps that serif intent with no
// network dependency and no font assets to ship. The --font-institutional
// abstraction is unchanged, so all 21 consumers are untouched.
const INSTITUTIONAL_SERIF_STACK = 'ui-serif, Georgia, "Times New Roman", serif'

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
    // Declared alongside the theme colours rather than through a font
    // loader's generated className — same variable name, same scope, one
    // fewer build-time dependency.
    '--font-institutional': INSTITUTIONAL_SERIF_STACK,
  } as CSSProperties

  return (
    <div
      data-school-concept-shell="true"
      style={themeVars}
      className="flex min-h-screen flex-col bg-[var(--concept-cream)] font-sans text-[var(--concept-charcoal)]"
    >
      <SiteHeader config={config} portalCapabilities={portalCapabilities} />
      <div className="flex-1">{children}</div>
      <SiteFooter config={config} />
    </div>
  )
}
