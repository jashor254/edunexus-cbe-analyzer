import { crawlWebsite } from './websiteEnrichment'
import { crawlFacebookPage } from './facebookEnrichment'
import { computeFieldConfidence, bestConfidence } from './confidence'
import type { EnrichmentResult, PageExtraction, SourcedValue, SourceType } from './types'

export type EnrichSchoolInput = {
  website: string
  phone: string
  email: string
}

function pageSourceType(url: string): SourceType {
  return /\/contact(-us)?\/?$/i.test(url) ? 'contact_page' : 'official_website'
}

/** First non-empty match across pages, in crawl order (homepage, then contact, then about — see websiteEnrichment's CANDIDATE_PATHS), with its source page attached. */
function firstAcrossPages(pages: PageExtraction[], pick: (p: PageExtraction) => string[]): SourcedValue | null {
  for (const page of pages) {
    const values = pick(page)
    if (values.length > 0) return { value: values[0], sourceType: pageSourceType(page.url), sourceUrl: page.url }
  }
  return null
}

function firstNameAcrossPages(pages: PageExtraction[], pick: (p: PageExtraction) => string | null): SourcedValue | null {
  for (const page of pages) {
    const value = pick(page)
    if (value) return { value, sourceType: pageSourceType(page.url), sourceUrl: page.url }
  }
  return null
}

/**
 * Sprint PE-5v2 — orchestrates Steps 1-4 for one school. Never invents,
 * never overwrites an existing `email`/`phone` value (those columns are
 * left exactly as Discovery Engine v1 produced them; this only ever adds
 * to the 15 new columns). Google Maps re-verification (Step 5) is
 * deliberately not run automatically — see the sprint doc's Technical Debt
 * section for why.
 */
export async function enrichSchool(input: EnrichSchoolInput): Promise<EnrichmentResult> {
  const lastVerified = new Date().toISOString().slice(0, 10)

  const empty: EnrichmentResult = {
    officialEmail: null,
    officialPhone: null,
    whatsappNumber: null,
    facebookUrl: null,
    contactPage: null,
    principalName: null,
    deputyName: null,
    ictContact: null,
    admissionsContact: null,
    websiteSource: [],
    facebookSource: null,
    contactConfidence: 'Unknown',
    lastVerified,
  }

  if (!input.website.trim()) return empty

  // Step 1 — crawl homepage + contact/about candidates.
  const pages = await crawlWebsite(input.website)
  if (pages.length === 0) return empty

  const websiteSource = pages.map((p) => p.url)
  const contactPageHit = pages.find((p) => pageSourceType(p.url) === 'contact_page')
  const contactPage = contactPageHit?.url ?? null

  const facebookUrl = firstAcrossPages(pages, (p) => p.facebookUrls)
  const principalName = firstNameAcrossPages(pages, (p) => p.principalName)
  const deputyName = firstNameAcrossPages(pages, (p) => p.deputyName)
  const ictContact = firstNameAcrossPages(pages, (p) => p.ictContact)
  const admissionsContact = firstNameAcrossPages(pages, (p) => p.admissionsContact)

  // Step 2 — email: only searched if the original CSV had none; if it did,
  // only cross-confirm (never surface a differing "second guess").
  let officialEmail: SourcedValue | null = null
  let emailCrossConfirmed = false
  if (!input.email.trim()) {
    officialEmail = firstAcrossPages(pages, (p) => p.emails)
  } else {
    const crossConfirm = pages.find((p) => p.emails.includes(input.email.trim().toLowerCase()))
    if (crossConfirm) {
      officialEmail = { value: input.email.trim(), sourceType: pageSourceType(crossConfirm.url), sourceUrl: crossConfirm.url }
      emailCrossConfirmed = true
    }
  }

  // Step 3 — phone: website first; Facebook only as a fallback, and only
  // when the original CSV had no phone AND the website crawl found none.
  let officialPhone: SourcedValue | null = null
  let phoneCrossConfirmed = false
  let facebookSource: string | null = null
  let whatsappNumber = firstAcrossPages(pages, (p) => p.whatsapp)

  if (!input.phone.trim()) {
    officialPhone = firstAcrossPages(pages, (p) => p.phones)
    if (!officialPhone && facebookUrl) {
      const fb = await crawlFacebookPage(facebookUrl.value)
      if (fb) {
        facebookSource = fb.url
        if (fb.phones.length > 0) officialPhone = { value: fb.phones[0], sourceType: 'facebook', sourceUrl: fb.url }
        if (!whatsappNumber && fb.whatsapp.length > 0) whatsappNumber = { value: fb.whatsapp[0], sourceType: 'facebook', sourceUrl: fb.url }
      }
    }
  } else {
    const crossConfirm = pages.find((p) => p.phones.includes(input.phone.trim()))
    if (crossConfirm) {
      officialPhone = { value: input.phone.trim(), sourceType: pageSourceType(crossConfirm.url), sourceUrl: crossConfirm.url }
      phoneCrossConfirmed = true
    }
  }

  const confidences: ReturnType<typeof computeFieldConfidence>[] = []
  if (officialEmail) confidences.push(computeFieldConfidence(officialEmail.sourceType, emailCrossConfirmed))
  if (officialPhone) confidences.push(computeFieldConfidence(officialPhone.sourceType, phoneCrossConfirmed))
  for (const v of [whatsappNumber, facebookUrl, principalName, deputyName, ictContact, admissionsContact]) {
    if (v) confidences.push(computeFieldConfidence(v.sourceType, false))
  }

  return {
    officialEmail,
    officialPhone,
    whatsappNumber,
    facebookUrl,
    contactPage,
    principalName,
    deputyName,
    ictContact,
    admissionsContact,
    websiteSource,
    facebookSource,
    contactConfidence: bestConfidence(confidences),
    lastVerified,
  }
}
