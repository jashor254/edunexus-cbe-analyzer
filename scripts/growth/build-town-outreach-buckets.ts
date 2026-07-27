import fs from 'node:fs/promises'
import path from 'node:path'

import { readCsvTable, writeCsvTable } from '@/scripts/growth/lib/csv'

type Args = {
  input: string
  county: string
  town: string
}

type Bucket = 'call_now' | 'verify_first' | 'discard_noisy'

type BucketedRow = Record<string, string> & {
  outreach_bucket: Bucket
  outreach_bucket_reason: string
}

const OUT_OF_SCOPE_PATTERN = /out of scope|junk|references .* county/i
const VERIFY_PATTERN = /suspected|verify|shares website/i
const NOISY_NAME_PATTERN = /\b(houses|football field)\b/i

function parseArgs(argv: string[]): Args {
  const parsed: Partial<Args> = {}
  for (const arg of argv) {
    if (arg.startsWith('--input=')) parsed.input = arg.slice('--input='.length)
    else if (arg.startsWith('--county=')) parsed.county = arg.slice('--county='.length)
    else if (arg.startsWith('--town=')) parsed.town = arg.slice('--town='.length)
  }

  if (!parsed.input || !parsed.county || !parsed.town) {
    throw new Error('Usage: tsx scripts/growth/build-town-outreach-buckets.ts --input=...csv --county=Kirinyaga --town=Kutus')
  }

  return parsed as Args
}

function isSchoolLike(row: Record<string, string>): boolean {
  const haystack = `${row.name ?? ''} ${row.category_guess ?? ''}`.toLowerCase()
  return /(school|academy|secondary|high|college|institute)/.test(haystack)
}

function classifyRow(row: Record<string, string>): { bucket: Bucket; reason: string } {
  const flagReason = row.flag_reason ?? ''
  const name = row.name ?? ''
  const phone = row.phone?.trim() ?? ''
  const hasDigitalTrail = Boolean(
    row.website?.trim() || row.email?.trim() || row.facebook_url?.trim() || row.contact_page?.trim(),
  )

  if (OUT_OF_SCOPE_PATTERN.test(flagReason)) {
    return { bucket: 'discard_noisy', reason: `out_of_scope:${flagReason}` }
  }

  if (NOISY_NAME_PATTERN.test(name)) {
    return { bucket: 'discard_noisy', reason: `non_school_like_name:${name}` }
  }

  if (VERIFY_PATTERN.test(flagReason)) {
    return { bucket: 'verify_first', reason: `manual_verification_flag:${flagReason}` }
  }

  if (phone) {
    return {
      bucket: 'call_now',
      reason: row.notes?.includes('Currently closed')
        ? 'phone_present_call_and_confirm_status'
        : 'phone_present',
    }
  }

  if (hasDigitalTrail) {
    return { bucket: 'verify_first', reason: 'no_phone_but_has_digital_trail' }
  }

  if (isSchoolLike(row)) {
    return { bucket: 'verify_first', reason: 'likely_school_but_missing_contact' }
  }

  return { bucket: 'discard_noisy', reason: 'no_phone_no_digital_trail' }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const inputPath = path.resolve(process.cwd(), args.input)
  const text = await fs.readFile(inputPath, 'utf8')
  const { header, records } = readCsvTable(text)

  const townRows = records.filter((row) =>
    row.county?.trim().toLowerCase() === args.county.toLowerCase()
    && row.town?.trim().toLowerCase() === args.town.toLowerCase(),
  )

  const bucketedRows: BucketedRow[] = townRows.map((row) => {
    const { bucket, reason } = classifyRow(row)
    return {
      ...row,
      outreach_bucket: bucket,
      outreach_bucket_reason: reason,
    }
  })

  const bucketOrder: Bucket[] = ['call_now', 'verify_first', 'discard_noisy']
  bucketedRows.sort((a, b) => {
    const bucketDiff = bucketOrder.indexOf(a.outreach_bucket) - bucketOrder.indexOf(b.outreach_bucket)
    if (bucketDiff !== 0) return bucketDiff
    return (a.name ?? '').localeCompare(b.name ?? '')
  })

  const outputHeader = [...header, 'outreach_bucket', 'outreach_bucket_reason']
  const slug = `${args.county}-${args.town}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const outputDir = path.join(process.cwd(), 'scripts', 'growth', 'output')
  const csvPath = path.join(outputDir, `${slug}-outreach-buckets.csv`)
  const summaryPath = path.join(outputDir, `${slug}-outreach-buckets-summary.md`)

  await fs.writeFile(csvPath, writeCsvTable(outputHeader, bucketedRows), 'utf8')

  const counts = {
    call_now: bucketedRows.filter((row) => row.outreach_bucket === 'call_now').length,
    verify_first: bucketedRows.filter((row) => row.outreach_bucket === 'verify_first').length,
    discard_noisy: bucketedRows.filter((row) => row.outreach_bucket === 'discard_noisy').length,
  }

  const summary = [
    `# ${args.county} / ${args.town} Outreach Buckets`,
    '',
    `Source: \`${path.relative(process.cwd(), inputPath)}\``,
    `Generated: ${new Date().toISOString()}`,
    '',
    `- Total rows: ${bucketedRows.length}`,
    `- Call now: ${counts.call_now}`,
    `- Verify first: ${counts.verify_first}`,
    `- Discard/noisy: ${counts.discard_noisy}`,
    '',
    '## Rules',
    '',
    '- `call_now`: row has a phone number and no stronger out-of-scope/manual-verification blocker.',
    '- `verify_first`: plausible school lead, but needs manual checking due to missing phone or mismatch/duplicate signals.',
    '- `discard_noisy`: out-of-scope, cross-county mismatch, or obvious non-school/noisy row.',
  ].join('\n')

  await fs.writeFile(summaryPath, summary, 'utf8')

  process.stdout.write(
    `Wrote ${path.relative(process.cwd(), csvPath)} and ${path.relative(process.cwd(), summaryPath)} for ${bucketedRows.length} rows.\n`,
  )
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
