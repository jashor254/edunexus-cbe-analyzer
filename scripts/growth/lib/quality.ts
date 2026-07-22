import { CLOSED_BUSINESS_STATUSES, isReadyForImport, type DiscoveryCsvRow } from './schema'

// ── Part 4: classification ───────────────────────────────────────────────────

export type SchoolCategory =
  | 'Junior Secondary' | 'Academy' | 'Girls' | 'Boys' | 'Mixed Day' | 'Private Secondary' | 'Public Secondary' | 'Unknown'

/**
 * A heuristic guess from the school's name only — never claimed as certain
 * (every downstream CSV/report labels this "category_guess", not "category").
 * Order matters: more distinctive signals (junior/academy/girls/boys) are
 * checked before the generic public/private/mixed fallbacks so a name like
 * "St. Mary's Girls Academy" resolves to the more specific "Academy" — order
 * chosen for stability, not precision; a human still verifies before import.
 */
export function classifySchool(name: string): SchoolCategory {
  const n = name.toLowerCase()
  if (/junior/.test(n)) return 'Junior Secondary'
  if (/(academy|preparatory|montessori)/.test(n)) return 'Academy'
  if (/girls/.test(n)) return 'Girls'
  if (/boys/.test(n)) return 'Boys'
  if (/(mixed|day school|day secondary)/.test(n)) return 'Mixed Day'
  if (/(international|private)/.test(n)) return 'Private Secondary'
  if (/(secondary school|high school)/.test(n)) return 'Public Secondary'
  return 'Unknown'
}

// ── Part 5: discovery score (contactability, not quality) ───────────────────

export const REVIEW_COUNT_THRESHOLD = 10

/**
 * "Prioritize schools that are easiest to contact" (PE-4 Part 5) — deliberately
 * NOT a quality/fit score. +20 per available contact/verification signal,
 * capped implicitly at 100 by construction (5 signals × 20).
 */
export function computeDiscoveryScore(input: { website: string; phone: string; email: string; googleRating: string; reviewCount: string }): number {
  let score = 0
  if (input.website.trim()) score += 20
  if (input.phone.trim()) score += 20
  if (input.email.trim()) score += 20
  if (input.googleRating.trim()) score += 20
  const reviewCount = Number(input.reviewCount)
  if (Number.isFinite(reviewCount) && reviewCount > REVIEW_COUNT_THRESHOLD) score += 20
  return score
}

// ── Part 7: contact quality ──────────────────────────────────────────────────

export type ContactQuality = 'High' | 'Medium' | 'Low' | 'Unknown'

/** Based purely on how many of {phone, website, email} are present — completeness, not correctness. */
export function computeContactQuality(input: { phone: string; website: string; email: string }): ContactQuality {
  const present = [input.phone, input.website, input.email].filter((v) => v.trim().length > 0).length
  if (present >= 3) return 'High'
  if (present === 2) return 'Medium'
  if (present === 1) return 'Low'
  return 'Unknown'
}

// ── Part 3: duplicate detection beyond place_id ──────────────────────────────

/** Lowercase, punctuation-stripped, whitespace-collapsed — for name-based dedup only, never displayed. */
export function normalizeSchoolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A composite key preferring the strongest available signal: phone beats
 * website beats name, because Google sometimes issues a second Place ID for
 * the same school (a re-listing, a branch entry, a data-quality glitch) —
 * matching place_id alone misses these (PE-4 Part 3).
 */
export function dedupKey(input: { name: string; phone: string; website: string }): string {
  if (input.phone.trim()) return `phone:${input.phone.trim()}`
  if (input.website.trim()) return `website:${input.website.trim().toLowerCase().replace(/\/+$/, '')}`
  return `name:${normalizeSchoolName(input.name)}`
}

// ── Part 11: research notes ──────────────────────────────────────────────────

/** Auto-generated, specific notes instead of one generic line (PE-4 Part 11). Joined with "; " for the single `notes` CSV column. */
export function buildResearchNotes(input: {
  website: string
  phone: string
  emailSource: 'mailto' | 'inferred' | 'none'
  websiteUnreachable: boolean
  openNow: boolean | null
}): string {
  const notes: string[] = []
  if (!input.website.trim()) notes.push('No website')
  if (input.websiteUnreachable) notes.push('Website unreachable')
  if (input.emailSource === 'inferred') notes.push('Email inferred')
  if (!input.phone.trim()) notes.push('Phone missing')
  if (input.openNow === false) notes.push('Currently closed (per Google)')
  return notes.join('; ')
}

// ── Part 9: summary report ───────────────────────────────────────────────────

export type DiscoverySummary = {
  schoolsDiscovered: number
  duplicatesRemoved: number
  missingPhone: number
  missingEmail: number
  contactQuality: Record<ContactQuality, number>
  readyForImportCount: number
  closedSchools: string[]
  duplicatePhones: string[][]
  duplicateWebsites: string[][]
  duplicatePlaceIds: string[][]
}

function findDuplicates(rows: DiscoveryCsvRow[], key: 'phone' | 'website' | 'place_id'): string[][] {
  const byValue = new Map<string, string[]>()
  for (const row of rows) {
    const value = row[key].trim()
    if (!value) continue
    const names = byValue.get(value) ?? []
    names.push(row.name)
    byValue.set(value, names)
  }
  return Array.from(byValue.entries())
    .filter(([, names]) => names.length > 1)
    .map(([value, names]) => [value, ...names])
}

/** Computed purely from the rows in a CSV — `duplicatesRemoved` (only known during a live discovery run, not derivable after the fact) is passed in separately by the caller and defaults to 0. */
export function summarizeDiscovery(rows: DiscoveryCsvRow[], duplicatesRemoved = 0): DiscoverySummary {
  const contactQuality: Record<ContactQuality, number> = { High: 0, Medium: 0, Low: 0, Unknown: 0 }
  let missingPhone = 0
  let missingEmail = 0
  let readyForImportCount = 0
  const closedSchools: string[] = []

  for (const row of rows) {
    if (!row.phone.trim()) missingPhone += 1
    if (!row.email.trim()) missingEmail += 1
    if ((CLOSED_BUSINESS_STATUSES as readonly string[]).includes(row.business_status.trim())) closedSchools.push(row.name)
    if (row.contact_quality in contactQuality) contactQuality[row.contact_quality as ContactQuality] += 1
    if (isReadyForImport(row.ready_for_import)) readyForImportCount += 1
  }

  return {
    schoolsDiscovered: rows.length,
    duplicatesRemoved,
    missingPhone,
    missingEmail,
    contactQuality,
    readyForImportCount,
    closedSchools,
    duplicatePhones: findDuplicates(rows, 'phone'),
    duplicateWebsites: findDuplicates(rows, 'website'),
    duplicatePlaceIds: findDuplicates(rows, 'place_id'),
  }
}

export function formatDiscoverySummary(summary: DiscoverySummary, csvPath?: string): string {
  const lines: string[] = []
  lines.push('# School Discovery Engine — Summary Report')
  lines.push('')
  lines.push(`Schools discovered: ${summary.schoolsDiscovered}`)
  lines.push(`Duplicates removed: ${summary.duplicatesRemoved}`)
  lines.push(`Missing phone: ${summary.missingPhone}`)
  lines.push(`Missing email: ${summary.missingEmail}`)
  lines.push(`High quality contacts: ${summary.contactQuality.High}`)
  lines.push(`Medium quality contacts: ${summary.contactQuality.Medium}`)
  lines.push(`Low quality contacts: ${summary.contactQuality.Low}`)
  lines.push(`Unknown quality contacts: ${summary.contactQuality.Unknown}`)
  lines.push(`Marked ready for import: ${summary.readyForImportCount}`)
  if (csvPath) lines.push(`CSV path: ${csvPath}`)

  if (summary.closedSchools.length > 0) {
    lines.push('', '## Schools marked closed by Google')
    for (const name of summary.closedSchools) lines.push(`- ${name}`)
  }
  if (summary.duplicatePhones.length > 0) {
    lines.push('', '## Duplicate phone numbers still present')
    for (const [phone, ...names] of summary.duplicatePhones) lines.push(`- ${phone}: ${names.join(', ')}`)
  }
  if (summary.duplicateWebsites.length > 0) {
    lines.push('', '## Duplicate websites still present')
    for (const [website, ...names] of summary.duplicateWebsites) lines.push(`- ${website}: ${names.join(', ')}`)
  }
  if (summary.duplicatePlaceIds.length > 0) {
    lines.push('', '## Duplicate Google Place IDs still present')
    for (const [placeId, ...names] of summary.duplicatePlaceIds) lines.push(`- ${placeId}: ${names.join(', ')}`)
  }

  return lines.join('\n')
}
