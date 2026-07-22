/**
 * Sprint PE-5v2 (Contact Enrichment) — shared types for the modular
 * enrichment engine. Each concern (extraction, website crawl, Facebook
 * crawl, confidence scoring, CSV writing, reporting) is its own file; this
 * is the vocabulary they share.
 */

export type SourceType = 'google_places' | 'official_website' | 'contact_page' | 'facebook' | 'manual'

export type Confidence = 'Verified' | 'High' | 'Medium' | 'Low' | 'Unknown'

/** A single extracted value with full provenance — never a bare string, so every value stays auditable. */
export type SourcedValue = {
  value: string
  sourceType: SourceType
  sourceUrl: string
}

/** What one fetched page (homepage, /contact, /about, a Facebook page, …) yielded. */
export type PageExtraction = {
  url: string
  emails: string[]
  phones: string[]
  whatsapp: string[]
  facebookUrls: string[]
  instagramUrls: string[]
  linkedinUrls: string[]
  principalName: string | null
  deputyName: string | null
  ictContact: string | null
  admissionsContact: string | null
}

/** The complete enrichment outcome for one school row — maps 1:1 onto the 15 new CSV columns. */
export type EnrichmentResult = {
  officialEmail: SourcedValue | null
  officialPhone: SourcedValue | null
  whatsappNumber: SourcedValue | null
  facebookUrl: SourcedValue | null
  contactPage: string | null
  principalName: SourcedValue | null
  deputyName: SourcedValue | null
  ictContact: SourcedValue | null
  admissionsContact: SourcedValue | null
  /** Every page URL actually fetched (successfully or not) for this school — the crawl audit trail, distinct from any single field's source. */
  websiteSource: string[]
  facebookSource: string | null
  contactConfidence: Confidence
  lastVerified: string
}
