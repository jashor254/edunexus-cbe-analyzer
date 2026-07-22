/**
 * Sprint PE-5v2 (Contact Enrichment) — pure regex/heuristic extractors over
 * already-fetched HTML. No network calls here (that's websiteEnrichment.ts/
 * facebookEnrichment.ts); this module is deliberately pure so it can be unit
 * tested with canned HTML and never needs a live site to verify.
 *
 * "Never invent, never assume" is enforced structurally: every extractor
 * returns only what it can find with a specific, checkable pattern, or an
 * empty result — there is no fallback that guesses.
 */

// Common non-contact domains that show up constantly in page source (analytics,
// trackers, CSS/JS libraries, placeholder/schema addresses) — excluding these
// is noise reduction, not invention; the regex still only ever reports an
// email that's literally present in the HTML.
const EMAIL_DOMAIN_DENYLIST = [
  'sentry.io', 'wixpress.com', 'example.com', 'godaddy.com', 'cloudflare.com',
  'google-analytics.com', 'googletagmanager.com', 'schema.org', 'w3.org',
  'gstatic.com', 'googleapis.com', 'facebook.com', 'fontawesome.com',
]

export function extractEmails(html: string): string[] {
  const matches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []
  const seen = new Set<string>()
  for (const raw of matches) {
    const email = raw.toLowerCase()
    const domain = email.split('@')[1] ?? ''
    if (EMAIL_DOMAIN_DENYLIST.some((d) => domain.endsWith(d))) continue
    seen.add(email)
  }
  return Array.from(seen)
}

// Kenyan phone numbers: +254 7xx/1xx xxx xxx, or local 07xx/01xx xxx xxx.
const PHONE_PATTERN = /(\+254|0)(7\d{2}|1\d{2})[\s-]?\d{3}[\s-]?\d{3}/g

/** Normalizes a local 07xx/01xx number to +254 international format so the same real number in either format dedupes to one entry. */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s-]/g, '')
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`
  return digits
}

export function extractPhones(html: string): string[] {
  const matches = html.match(PHONE_PATTERN) ?? []
  const seen = new Set<string>()
  for (const raw of matches) {
    seen.add(normalizePhone(raw))
  }
  return Array.from(seen)
}

/** wa.me/<number> and api.whatsapp.com/send?phone=<number> links only — never a phone number merely near the word "WhatsApp." */
export function extractWhatsAppNumbers(html: string): string[] {
  const seen = new Set<string>()
  const waMeMatches = html.match(/wa\.me\/(\d{7,15})/g) ?? []
  for (const m of waMeMatches) seen.add(m.replace('wa.me/', ''))
  const apiMatches = html.match(/api\.whatsapp\.com\/send\?phone=(\d{7,15})/g) ?? []
  for (const m of apiMatches) seen.add(m.replace(/^.*phone=/, ''))
  return Array.from(seen)
}

function extractFirstLinkMatching(html: string, hostPattern: RegExp, excludePattern?: RegExp): string | null {
  const matches = html.match(new RegExp(`https?:\\/\\/[^\\s"'<>]*${hostPattern.source}[^\\s"'<>]*`, 'gi')) ?? []
  for (const m of matches) {
    if (excludePattern && excludePattern.test(m)) continue
    return m
  }
  return null
}

/** Excludes generic share-button links (facebook.com/sharer, /share.php) — those aren't the school's own page. */
export function extractFacebookUrl(html: string): string | null {
  return extractFirstLinkMatching(html, /(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/, /sharer|share\.php|plugins/)
}

export function extractInstagramUrl(html: string): string | null {
  return extractFirstLinkMatching(html, /(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+/, /explore\/tags/)
}

export function extractLinkedinUrl(html: string): string | null {
  return extractFirstLinkMatching(html, /(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9._-]+/)
}

/**
 * A labeled-name extractor for principal/deputy/ICT/admissions mentions —
 * requires the label to be immediately followed by a plausible 2-4 word
 * capitalized name within a short distance. Returns null (never a guess)
 * when no such pattern is found; a page that only says "Our Principal"
 * with no name attached yields nothing, by design.
 */
export function extractLabeledName(html: string, labelPattern: RegExp): string | null {
  // Two-step, not one combined case-insensitive regex: a single `i` flag
  // across the whole pattern would also make the name's capital-letter
  // requirement case-insensitive, defeating the "must look like a real
  // proper name" check (e.g. "leads" would satisfy [A-Za-z] under /i).
  const labelMatch = labelPattern.exec(html)
  if (!labelMatch) return null
  const tail = html.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 80)
  const nameMatch = tail.match(/^[\s:.-]{1,10}([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,3})/)
  return nameMatch ? nameMatch[1].trim() : null
}

export const LABEL_PATTERNS = {
  principal: /\bprincipal\b(?!\s*['’]s\s*office)/i,
  deputy: /\bdeputy\s+(?:principal|head\s*teacher)\b/i,
  ict: /\bict\s*(?:administrator|coordinator|teacher|contact)\b/i,
  admissions: /\badmissions?\s*(?:office|officer|contact|coordinator)\b/i,
}

/** Runs every pure extractor over one page's HTML in one pass. */
export function extractAll(html: string): {
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
} {
  const facebookUrl = extractFacebookUrl(html)
  const instagramUrl = extractInstagramUrl(html)
  const linkedinUrl = extractLinkedinUrl(html)
  return {
    emails: extractEmails(html),
    phones: extractPhones(html),
    whatsapp: extractWhatsAppNumbers(html),
    facebookUrls: facebookUrl ? [facebookUrl] : [],
    instagramUrls: instagramUrl ? [instagramUrl] : [],
    linkedinUrls: linkedinUrl ? [linkedinUrl] : [],
    principalName: extractLabeledName(html, LABEL_PATTERNS.principal),
    deputyName: extractLabeledName(html, LABEL_PATTERNS.deputy),
    ictContact: extractLabeledName(html, LABEL_PATTERNS.ict),
    admissionsContact: extractLabeledName(html, LABEL_PATTERNS.admissions),
  }
}
