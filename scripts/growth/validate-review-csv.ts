/**
 * Sprint PE-4 — School Discovery Engine v1, Part 9.
 *
 * Re-validates a discovery CSV (produced by discover-schools.ts, possibly
 * hand-edited since — a founder may have merged files, corrected a phone
 * number, or flipped ready_for_import) and writes a fresh Summary Report
 * next to it. Never modifies or drops rows from the input CSV.
 *
 * Usage:
 *   npm run growth:validate-schools -- scripts/growth/output/kirinyaga-schools-2026-07-22.csv
 */

import { parseCsvRecords } from './lib/csv'
import { formatDiscoverySummary, summarizeDiscovery } from './lib/quality'
import type { DiscoveryCsvRow } from './lib/schema'

async function main(): Promise<void> {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: npm run growth:validate-schools -- <path-to-discovery-csv>')
    process.exit(1)
  }

  const fs = await import('node:fs/promises')
  const text = await fs.readFile(inputPath, 'utf-8')
  const rows = parseCsvRecords(text) as unknown as DiscoveryCsvRow[]

  const summary = summarizeDiscovery(rows)
  const formatted = formatDiscoverySummary(summary, inputPath)

  const outPath = inputPath.replace(/\.csv$/, '') + '-validation-report.md'
  await fs.writeFile(outPath, formatted)

  console.log(formatted)
  console.log(`\nValidation report written to ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
