/**
 * Sprint PE-4 — School Discovery Engine v1.
 *
 * One-off Growth Engine tool (not part of the app runtime): finds real
 * secondary/junior school candidates via Google Places for one or every
 * configured county, scores each row for contactability, and writes a
 * founder-review CSV. Deliberately does NOT write to growth_schools/
 * growth_contacts directly — output is reviewed by hand first (flip
 * `ready_for_import` to TRUE), then validated (validate-review-csv.ts),
 * then imported (prepare-import.ts + import-schools-csv.ts).
 *
 * To expand to a new county: add a file under scripts/growth/config/ and
 * register it in scripts/growth/config/index.ts. No other file changes.
 *
 * Usage:
 *   npm run growth:discover-schools -- --county=kirinyaga
 *   npm run growth:discover-schools -- --county=all
 *   (reads GOOGLE_PLACES_API_KEY from .env.local via --env-file)
 */

import { writeCsv } from './lib/csv'
import { classifySchool, computeContactQuality, computeDiscoveryScore, buildResearchNotes, dedupKey, summarizeDiscovery, formatDiscoverySummary, type DiscoverySummary } from './lib/quality'
import { newDiscoveryRow, DISCOVERY_CSV_HEADER, type DiscoveryCsvRow } from './lib/schema'
import { COUNTY_CONFIGS, findCountyConfig, availableSlugs, type CountyConfig } from './config'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
if (!API_KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY (set in .env.local or the environment).')
  process.exit(1)
}

const REQUEST_DELAY_MS = 250
const FETCH_TIMEOUT_MS = 8000

type PlaceSearchResult = {
  place_id: string
  name: string
  formatted_address?: string
  business_status?: string
  rating?: number
  user_ratings_total?: number
}

type PlaceDetails = {
  formatted_phone_number?: string
  international_phone_number?: string
  website?: string
  opening_hours?: { open_now?: boolean }
}

type EmailLookup = { email: string; source: 'mailto' | 'inferred' | 'none'; unreachable: boolean }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function textSearch(query: string): Promise<PlaceSearchResult[]> {
  const results: PlaceSearchResult[] = []
  let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}`
  let pageCount = 0

  while (url && pageCount < 3) {
    const res = await fetchWithTimeout(url)
    const json = await res.json()
    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      console.warn(`  [warn] "${query}": ${json.status} ${json.error_message ?? ''}`)
      break
    }
    for (const r of json.results ?? []) {
      results.push({
        place_id: r.place_id,
        name: r.name,
        formatted_address: r.formatted_address,
        business_status: r.business_status,
        rating: r.rating,
        user_ratings_total: r.user_ratings_total,
      })
    }
    pageCount += 1
    if (json.next_page_token) {
      // Google requires a short delay before a next_page_token becomes valid.
      await sleep(2000)
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${json.next_page_token}&key=${API_KEY}`
    } else {
      url = ''
    }
  }
  return results
}

async function placeDetails(placeId: string): Promise<PlaceDetails> {
  const fields = 'formatted_phone_number,international_phone_number,website,opening_hours'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`
  const res = await fetchWithTimeout(url)
  const json = await res.json()
  if (json.status !== 'OK') return {}
  return json.result ?? {}
}

async function bestEffortEmail(website: string | undefined): Promise<EmailLookup> {
  if (!website) return { email: '', source: 'none', unreachable: false }
  try {
    const res = await fetchWithTimeout(website)
    const html = await res.text()
    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
    if (mailtoMatch) return { email: mailtoMatch[1], source: 'mailto', unreachable: false }
    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:com|org|co\.ke|ac\.ke|sc\.ke|net)/)
    if (emailMatch) return { email: emailMatch[0], source: 'inferred', unreachable: false }
    return { email: '', source: 'none', unreachable: false }
  } catch {
    // best-effort only — a broken or slow school website is not worth failing the run over
    return { email: '', source: 'none', unreachable: true }
  }
}

async function discoverCounty(config: CountyConfig): Promise<{ rows: DiscoveryCsvRow[]; duplicatesRemoved: number }> {
  const seenPlaceIds = new Set<string>()
  const seenCompositeKeys = new Set<string>()
  const rows: DiscoveryCsvRow[] = []
  let duplicatesRemoved = 0
  const exclusions = config.exclusions ?? []

  for (const town of config.towns) {
    for (const term of config.searchTerms) {
      const query = `${term} in ${town} ${config.county} County Kenya`
      console.log(`[${config.county}] Searching: ${query}`)
      const results = await textSearch(query)
      console.log(`  -> ${results.length} result(s)`)

      for (const r of results) {
        // Part 1: dedup by place_id — never trust names alone.
        if (seenPlaceIds.has(r.place_id)) continue
        if (exclusions.some((ex) => ex === r.place_id || r.name.toLowerCase().includes(ex.toLowerCase()))) {
          seenPlaceIds.add(r.place_id)
          continue
        }
        seenPlaceIds.add(r.place_id)

        const details = await placeDetails(r.place_id)
        const phone = details.international_phone_number ?? details.formatted_phone_number ?? ''
        const website = details.website ?? ''
        const emailLookup = await bestEffortEmail(website)

        // Part 3: a second dedup pass beyond place_id — Google sometimes
        // issues a distinct Place ID for what is, in reality, the same
        // school (a re-listing or branch entry). Composite key prefers
        // phone, then website, then normalized name.
        const compositeKey = dedupKey({ name: r.name, phone, website })
        if (seenCompositeKeys.has(compositeKey)) {
          duplicatesRemoved += 1
          continue
        }
        seenCompositeKeys.add(compositeKey)

        const googleRating = r.rating !== undefined ? String(r.rating) : ''
        const reviewCount = r.user_ratings_total !== undefined ? String(r.user_ratings_total) : ''

        rows.push(
          newDiscoveryRow({
            name: r.name,
            county: config.county,
            town,
            category_guess: classifySchool(r.name),
            address: r.formatted_address ?? '',
            phone,
            website,
            email: emailLookup.email,
            google_rating: googleRating,
            review_count: reviewCount,
            business_status: r.business_status ?? '',
            contact_source: 'google_places',
            google_maps_url: `https://www.google.com/maps/place/?q=place_id:${r.place_id}`,
            place_id: r.place_id,
            contact_quality: computeContactQuality({ phone, website, email: emailLookup.email }),
            discovery_score: String(computeDiscoveryScore({ website, phone, email: emailLookup.email, googleRating, reviewCount })),
            notes: buildResearchNotes({
              website,
              phone,
              emailSource: emailLookup.source,
              websiteUnreachable: emailLookup.unreachable,
              openNow: details.opening_hours?.open_now ?? null,
            }),
          }),
        )

        await sleep(REQUEST_DELAY_MS)
      }
    }
  }

  rows.sort((a, b) => a.name.localeCompare(b.name))
  return { rows, duplicatesRemoved }
}

async function writeCountyOutput(config: CountyConfig, rows: DiscoveryCsvRow[], duplicatesRemoved: number): Promise<{ outPath: string; summary: DiscoverySummary }> {
  const csv = writeCsv(
    DISCOVERY_CSV_HEADER as unknown as string[],
    rows.map((row) => DISCOVERY_CSV_HEADER.map((col) => row[col])),
  )

  const outDir = `${__dirname}/output`
  const fs = await import('node:fs/promises')
  await fs.mkdir(outDir, { recursive: true })
  const dateStamp = new Date().toISOString().slice(0, 10)
  const outPath = `${outDir}/${config.slug}-schools-${dateStamp}.csv`
  await fs.writeFile(outPath, csv)

  const summary = summarizeDiscovery(rows, duplicatesRemoved)
  const summaryText = formatDiscoverySummary(summary, outPath)
  console.log(`\n${summaryText}`)

  const summaryPath = outPath.replace(/\.csv$/, '-summary.md')
  await fs.writeFile(summaryPath, summaryText)

  return { outPath, summary }
}

function parseCountyArg(): string {
  const arg = process.argv.find((a) => a.startsWith('--county='))
  if (!arg) {
    console.error(`Usage: npm run growth:discover-schools -- --county=<${availableSlugs().join('|')}|all>`)
    process.exit(1)
  }
  return arg.split('=')[1] ?? ''
}

function mergeSummaries(summaries: DiscoverySummary[]): DiscoverySummary {
  const merged: DiscoverySummary = {
    schoolsDiscovered: 0,
    duplicatesRemoved: 0,
    missingPhone: 0,
    missingEmail: 0,
    contactQuality: { High: 0, Medium: 0, Low: 0, Unknown: 0 },
    readyForImportCount: 0,
    closedSchools: [],
    duplicatePhones: [],
    duplicateWebsites: [],
    duplicatePlaceIds: [],
  }
  for (const s of summaries) {
    merged.schoolsDiscovered += s.schoolsDiscovered
    merged.duplicatesRemoved += s.duplicatesRemoved
    merged.missingPhone += s.missingPhone
    merged.missingEmail += s.missingEmail
    merged.readyForImportCount += s.readyForImportCount
    merged.closedSchools.push(...s.closedSchools)
    merged.duplicatePhones.push(...s.duplicatePhones)
    merged.duplicateWebsites.push(...s.duplicateWebsites)
    merged.duplicatePlaceIds.push(...s.duplicatePlaceIds)
    for (const key of ['High', 'Medium', 'Low', 'Unknown'] as const) {
      merged.contactQuality[key] += s.contactQuality[key]
    }
  }
  return merged
}

async function main(): Promise<void> {
  const slug = parseCountyArg()

  const configs = slug === 'all' ? COUNTY_CONFIGS : [findCountyConfig(slug)].filter((c): c is CountyConfig => !!c)
  if (configs.length === 0) {
    console.error(`Unknown county "${slug}". Available: ${availableSlugs().join(', ')}, or "all".`)
    process.exit(1)
  }

  const summaries: DiscoverySummary[] = []
  for (const config of configs) {
    const { rows, duplicatesRemoved } = await discoverCounty(config)
    const { summary } = await writeCountyOutput(config, rows, duplicatesRemoved)
    summaries.push(summary)
  }

  if (configs.length > 1) {
    console.log('\n' + formatDiscoverySummary(mergeSummaries(summaries)).replace('Summary Report', 'Combined Summary (all counties)'))
  }

  console.log('\nNext: open each CSV, review category_guess/contact info, flip ready_for_import to TRUE for schools worth contacting, then run:')
  console.log('  npm run growth:validate-schools -- <path-to-csv>')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
