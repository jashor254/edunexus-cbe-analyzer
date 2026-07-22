/**
 * Sprint PE-4 — School Discovery Engine v1, Part 10. Extended by Sprint
 * PE-6 to carry `whatsapp_number` through, and by Sprint PE-7 to share its
 * core import logic with the new /growth/import web page
 * (lib/growth/services/csvImport.ts) so the CLI and the UI never drift out
 * of sync on what "ready" or "duplicate" means.
 *
 * Imports an import-ready CSV (see prepare-import.ts — ready_for_import=TRUE
 * rows only) into growth_schools. Rules:
 *   - imports ONLY rows with ready_for_import = TRUE
 *   - never overwrites an existing school: dedup by google_place_id first
 *     (the strongest key), then by fuzzy name match
 *   - skips, never throws, on a duplicate or an invalid row — one bad row
 *     must not abort the whole batch
 *
 * Usage:
 *   npm run growth:import-schools -- scripts/growth/output/kirinyaga-schools-2026-07-22-import-ready.csv
 *   (reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local via --env-file)
 */

import { readImportCsv, runImport } from '@/lib/growth/services/csvImport'
import { growthRepos } from '@/lib/growth/repositories'

async function main(): Promise<void> {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: npm run growth:import-schools -- <path-to-import-ready-csv>')
    process.exit(1)
  }

  const { records } = await readImportCsv(inputPath)
  const founder = await growthRepos.users.findSole()
  const summary = await runImport(records, founder.id)

  const notReady = records.length - summary.schoolsImported - summary.duplicatesSkipped - summary.invalidNames.length - summary.errors.length

  console.log(`\n${records.length} rows reviewed`)
  console.log(`${summary.schoolsImported} imported`)
  console.log(`${summary.duplicatesSkipped} duplicates skipped`)
  console.log(`${notReady} not ready_for_import (skipped)`)
  console.log(`${summary.invalidNames.length} invalid`)
  console.log(`Time taken: ${summary.timeTakenMs}ms`)

  if (summary.duplicateNames.length > 0) console.log('\nDuplicates skipped:\n' + summary.duplicateNames.map((d) => `  - ${d}`).join('\n'))
  if (summary.invalidNames.length > 0) console.log('\nInvalid rows:\n' + summary.invalidNames.map((d) => `  - ${d}`).join('\n'))
  if (summary.errors.length > 0) console.log('\nErrors:\n' + summary.errors.map((d) => `  - ${d}`).join('\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
