// The one place school-concept page metadata (title, description,
// canonical, robots, Open Graph) is built. Every page.tsx in
// app/school-concepts/[schoolSlug]/ calls one of these two functions
// instead of hand-writing a metadata object, so the concept-safety rules
// below apply uniformly and can't be forgotten on a new page.
//
// Root cause this exists to fix (Phase 6 audit, Part 12): every
// school-concept page was inheriting app/layout.tsx's EduNexus-branded
// title template, its unrelated Swahili CBC marketing description, and its
// hardcoded `alternates.canonical: 'https://edunexus.co.ke'` — meaning a
// shared link or a search result for an unapproved school concept could
// read as an EduNexus product page and self-declare EduNexus's own
// homepage as its canonical source.
import type { Metadata } from 'next'
import type { SchoolConceptConfig } from '@/data/schoolConcepts/types'

function isIndexable(config: SchoolConceptConfig): boolean {
  return config.publicationStatus === 'approved'
}

function conceptTitleSuffix(config: SchoolConceptConfig): string {
  return isIndexable(config) ? '' : ' — Website Concept'
}

function conceptDescription(config: SchoolConceptConfig): string {
  return `A private website concept prepared for ${config.schoolName}. Content marked as sample or pending requires confirmation by the school. This is not an official or approved website.`
}

// Canonical is deliberately omitted (never set to the EduNexus homepage,
// never invented as a fake school domain) until a real, approved public
// domain exists for this school's site — see the Phase 6A brief's
// "Preferred option 1." Explicitly setting `canonical: undefined` replaces
// app/layout.tsx's hardcoded value rather than inheriting it, since Next's
// metadata resolution replaces the whole `alternates` object per route
// rather than deep-merging it with the parent layout's.
function conceptAlternates(): Metadata['alternates'] {
  return { canonical: undefined }
}

function conceptRobots(config: SchoolConceptConfig): Metadata['robots'] {
  const indexable = isIndexable(config)
  return { index: indexable, follow: indexable }
}

export function buildHomeMetadata(config: SchoolConceptConfig): Metadata {
  const title = `${config.schoolName}${conceptTitleSuffix(config)}`
  const description = conceptDescription(config)
  return {
    // `absolute` (not a plain string) is required here: a plain string
    // title is still composed through EVERY ancestor layout's title
    // template, including app/layout.tsx's '%s | EduNexus Kenya' — this
    // route group's own layout.tsx sets its own template as a fallback
    // safety net, but only `absolute` reliably stops the root template
    // from being applied on top of it for a page that sets its own full,
    // final title (verified against the live rendered <title> tag).
    title: { absolute: title },
    description,
    alternates: conceptAlternates(),
    robots: conceptRobots(config),
    openGraph: { title, description, type: 'website' },
  }
}

export function buildPageMetadata(config: SchoolConceptConfig, pageLabel: string): Metadata {
  const title = isIndexable(config)
    ? `${pageLabel} — ${config.schoolName}`
    : `${pageLabel} — ${config.schoolName} Website Concept`
  const description = conceptDescription(config)
  return {
    title: { absolute: title },
    description,
    alternates: conceptAlternates(),
    robots: conceptRobots(config),
    openGraph: { title, description, type: 'website' },
  }
}
