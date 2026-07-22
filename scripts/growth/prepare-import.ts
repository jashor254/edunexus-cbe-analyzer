/**
 * Sprint PE-4 — School Discovery Engine v1, Part 10.
 *
 * Filters a founder-reviewed discovery CSV down to an import-ready CSV:
 * only rows with ready_for_import = TRUE survive. Everything else is left
 * out but never deleted from the source CSV — re-run discover/validate
 * against the original file at any time.
 *
 * Usage:
 *   npm run growth:prepare-import -- scripts/growth/output/kirinyaga-schools-2026-07-22.csv
 */

import { parseCsvRecords, writeCsv } from './lib/csv'
import { DISCOVERY_CSV_HEADER, isReadyForImport, type DiscoveryCsvRow } from './lib/schema'

async function main(): Promise<void> {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: npm run growth:prepare-import -- <path-to-reviewed-csv>')
    process.exit(1)
  }

  const fs = await import('node:fs/promises')
  const text = await fs.readFile(inputPath, 'utf-8')
  const rows = parseCsvRecords(text) as unknown as DiscoveryCsvRow[]

  const ready = rows.filter((row) => isReadyForImport(row.ready_for_import))
  const notReady = rows.length - ready.length

  const csv = writeCsv(
    DISCOVERY_CSV_HEADER as unknown as string[],
    ready.map((row) => DISCOVERY_CSV_HEADER.map((col) => row[col])),
  )

  const outPath = inputPath.replace(/\.csv$/, '') + '-import-ready.csv'
  await fs.writeFile(outPath, csv)

  console.log(`${rows.length} rows reviewed`)
  console.log(`${ready.length} marked ready_for_import=TRUE -> written to ${outPath}`)
  console.log(`${notReady} not ready (excluded — flip ready_for_import to TRUE before they can be imported)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
