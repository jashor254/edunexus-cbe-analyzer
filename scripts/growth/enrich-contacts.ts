/**
 * Sprint PE-5v2 — School Discovery Engine v2 (Contact Enrichment).
 *
 * Takes an existing Discovery Engine v1 CSV (plain or annotated — any
 * header is preserved) and adds 15 new contact-enrichment columns per
 * school, sourced only from the school's own website and (as a narrow
 * fallback) its public Facebook page. Never invents a value, never
 * modifies an existing column, never touches ready_for_import, never
 * writes to the database or imports anything — CSV in, CSV out.
 *
 * Verification-first by design: defaults to a small sample so you can
 * check the output looks right before spending the time (and external
 * site load) on a full run.
 *
 * Usage:
 *   npm run growth:enrich-contacts -- <path-to-csv>                 # sample of 10
 *   npm run growth:enrich-contacts -- <path-to-csv> --sample=25      # a bigger sample
 *   npm run growth:enrich-contacts -- <path-to-csv> --full           # every row
 */

import { readCsvTable, writeCsvTable } from './lib/csv'
import { enrichSchool } from './enrich/enrichSchool'
import { buildEnrichmentReport, formatEnrichmentReport, type EnrichedRowSummary } from './enrich/report'
import type { EnrichmentResult } from './enrich/types'

const REQUEST_DELAY_MS = 300
const DEFAULT_SAMPLE_SIZE = 10

const NEW_COLUMNS = [
  'official_email', 'official_phone', 'whatsapp_number', 'facebook_url', 'contact_page',
  'principal_name', 'deputy_name', 'ict_contact', 'admissions_contact',
  'email_source', 'phone_source', 'website_source', 'facebook_source',
  'contact_confidence', 'last_verified',
] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseArgs(): { inputPath: string; sampleSize: number | null } {
  const inputPath = process.argv[2]
  if (!inputPath || inputPath.startsWith('--')) {
    console.error('Usage: npm run growth:enrich-contacts -- <path-to-csv> [--sample=N | --full]')
    process.exit(1)
  }
  const full = process.argv.includes('--full')
  const sampleArg = process.argv.find((a) => a.startsWith('--sample='))
  const sampleSize = full ? null : sampleArg ? Number(sampleArg.split('=')[1]) : DEFAULT_SAMPLE_SIZE
  return { inputPath, sampleSize }
}

/** Prefers rows that actually have a website so a small sample run demonstrates real enrichment, not no-ops. Falls back to plain file order if fewer than N rows have a website. */
function selectSample(records: Record<string, string>[], sampleSize: number): Record<string, string>[] {
  const withWebsite = records.filter((r) => (r.website ?? '').trim())
  if (withWebsite.length >= sampleSize) return withWebsite.slice(0, sampleSize)
  return records.slice(0, sampleSize)
}

function resultToColumns(result: EnrichmentResult): Record<string, string> {
  return {
    official_email: result.officialEmail?.value ?? '',
    official_phone: result.officialPhone?.value ?? '',
    whatsapp_number: result.whatsappNumber?.value ?? '',
    facebook_url: result.facebookUrl?.value ?? '',
    contact_page: result.contactPage ?? '',
    principal_name: result.principalName?.value ?? '',
    deputy_name: result.deputyName?.value ?? '',
    ict_contact: result.ictContact?.value ?? '',
    admissions_contact: result.admissionsContact?.value ?? '',
    email_source: result.officialEmail ? `${result.officialEmail.sourceType}:${result.officialEmail.sourceUrl}` : '',
    phone_source: result.officialPhone ? `${result.officialPhone.sourceType}:${result.officialPhone.sourceUrl}` : '',
    website_source: result.websiteSource.join('; '),
    facebook_source: result.facebookSource ?? (result.facebookUrl ? `${result.facebookUrl.sourceType}:${result.facebookUrl.sourceUrl}` : ''),
    contact_confidence: result.contactConfidence,
    last_verified: result.lastVerified,
  }
}

function toRowSummary(name: string, original: Record<string, string>, result: EnrichmentResult): EnrichedRowSummary {
  const hasEmailAfter = !!(original.email?.trim() || result.officialEmail)
  const hasPhoneAfter = !!(original.phone?.trim() || result.officialPhone)
  const hasWhatsapp = !!result.whatsappNumber
  const hasFacebook = !!result.facebookUrl
  const contactChannelCount = [hasEmailAfter, hasPhoneAfter, hasWhatsapp, hasFacebook].filter(Boolean).length
  return {
    name,
    hadEmailBefore: !!original.email?.trim(),
    hasEmailAfter,
    hadPhoneBefore: !!original.phone?.trim(),
    hasPhoneAfter,
    hasWhatsapp,
    hasFacebook,
    hasPrincipal: !!result.principalName,
    hasIctContact: !!result.ictContact,
    contactConfidence: result.contactConfidence,
    contactChannelCount,
  }
}

async function main(): Promise<void> {
  const { inputPath, sampleSize } = parseArgs()

  const fs = await import('node:fs/promises')
  const text = await fs.readFile(inputPath, 'utf-8')
  const { header, records } = readCsvTable(text)
  if (records.length === 0) {
    console.error('No rows found in input CSV.')
    process.exit(1)
  }

  const targetRecords = sampleSize !== null ? selectSample(records, sampleSize) : records
  const targetIds = new Set(targetRecords)
  console.log(sampleSize !== null
    ? `Running a SAMPLE enrichment: ${targetRecords.length} of ${records.length} rows. Re-run with --full once this looks correct.`
    : `Running FULL enrichment: ${records.length} rows.`)

  const summaries: EnrichedRowSummary[] = []
  const enrichedColumnsByRow = new Map<Record<string, string>, Record<string, string>>()

  for (const record of records) {
    if (!targetIds.has(record)) continue
    console.log(`Enriching: ${record.name} ${record.website ? `(${record.website})` : '(no website — skipping crawl)'}`)
    const result = await enrichSchool({ website: record.website ?? '', phone: record.phone ?? '', email: record.email ?? '' })
    enrichedColumnsByRow.set(record, resultToColumns(result))
    summaries.push(toRowSummary(record.name, record, result))
    await sleep(REQUEST_DELAY_MS)
  }

  const outputHeader = [...header, ...NEW_COLUMNS]
  const outputRecords = records.map((record) => {
    const enrichedColumns = enrichedColumnsByRow.get(record)
    return enrichedColumns ? { ...record, ...enrichedColumns } : { ...record, ...Object.fromEntries(NEW_COLUMNS.map((c) => [c, ''])) }
  })

  const csv = writeCsvTable(outputHeader, outputRecords)
  const outDir = `${__dirname}/output`
  await fs.mkdir(outDir, { recursive: true })
  const dateStamp = new Date().toISOString().slice(0, 10)
  const suffix = sampleSize !== null ? `-sample${targetRecords.length}` : ''
  const outPath = `${outDir}/kirinyaga-schools-${dateStamp}-enriched${suffix}.csv`
  await fs.writeFile(outPath, csv)

  const report = buildEnrichmentReport(summaries)
  const reportText = formatEnrichmentReport(report, outPath)
  const reportPath = `${outDir}/contact-enrichment-report${suffix}.md`
  await fs.writeFile(reportPath, reportText)

  console.log(`\n${reportText}`)
  console.log(`\nEnriched CSV: ${outPath}`)
  console.log(`Report: ${reportPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
