import { readCsvTable } from '@/scripts/growth/lib/csv'
import { isReadyForImport } from '@/scripts/growth/lib/schema'
import { growthRepos } from '@/lib/growth/repositories'

/**
 * Sprint PE-7 (Pilot Campaign Launch) Parts 1-2 — the shared CSV-import
 * core, used by both the CLI script (scripts/growth/import-schools-csv.ts)
 * and the new /growth/import web page's API routes, so the two never drift
 * out of sync on what "ready" or "duplicate" means. CSV parsing itself
 * (readCsvTable) and the ready_for_import convention (isReadyForImport)
 * are still owned by scripts/growth — this file is the one place that
 * reaches across that boundary, deliberately, rather than duplicating
 * ~90 lines of already-tested CSV parsing.
 */

export type ImportRow = Record<string, string>

export type ImportReadinessStats = {
  totalReviewed: number
  readyForImport: number
  heldBack: number
  missingPhone: number
  missingEmail: number
  needsManualVerification: number
  outOfScope: number
}

const NEEDS_VERIFICATION_PATTERN = /suspected|verify|duplicate/i
const OUT_OF_SCOPE_PATTERN = /out of scope|junk|references .* county/i

/** Part 1 — computed purely from the CSV rows already on disk, before anything touches the database. */
export function computeImportReadiness(records: ImportRow[]): ImportReadinessStats {
  let readyForImport = 0
  let missingPhone = 0
  let missingEmail = 0
  let needsManualVerification = 0
  let outOfScope = 0

  for (const row of records) {
    if (isReadyForImport(row.ready_for_import ?? '')) readyForImport += 1
    if (!row.phone?.trim()) missingPhone += 1
    if (!row.email?.trim()) missingEmail += 1
    const flagReason = row.flag_reason ?? ''
    if (NEEDS_VERIFICATION_PATTERN.test(flagReason)) needsManualVerification += 1
    if (OUT_OF_SCOPE_PATTERN.test(flagReason)) outOfScope += 1
  }

  return {
    totalReviewed: records.length,
    readyForImport,
    heldBack: records.length - readyForImport,
    missingPhone,
    missingEmail,
    needsManualVerification,
    outOfScope,
  }
}

export async function readImportCsv(path: string): Promise<{ header: string[]; records: ImportRow[] }> {
  const fs = await import('node:fs/promises')
  const text = await fs.readFile(path, 'utf-8')
  return readCsvTable(text)
}

// scripts/growth/output/ is where every discovery/enrichment CSV in this
// pipeline is written — this whole tool operates on the founder's local
// machine (same way the discovery/enrichment scripts always have), so
// reading it from a Next.js API route running via `npm run dev` locally is
// safe. It would not work against a deployed, filesystem-ephemeral host.
const OUTPUT_DIR_SEGMENTS = ['scripts', 'growth', 'output']
const SAFE_FILENAME = /^[a-zA-Z0-9_.-]+\.csv$/

export async function resolveOutputCsvPath(filename: string): Promise<string> {
  const path = await import('node:path')
  if (!SAFE_FILENAME.test(filename)) throw new Error(`Invalid filename: ${filename}`)
  const outputDir = path.join(process.cwd(), ...OUTPUT_DIR_SEGMENTS)
  const resolved = path.join(outputDir, filename)
  if (!resolved.startsWith(outputDir + path.sep) && resolved !== outputDir) {
    throw new Error('Invalid file path')
  }
  return resolved
}

export async function listOutputCsvFiles(): Promise<string[]> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const outputDir = path.join(process.cwd(), ...OUTPUT_DIR_SEGMENTS)
  try {
    const files = await fs.readdir(outputDir)
    return files.filter((f) => f.endsWith('.csv')).sort().reverse()
  } catch {
    return []
  }
}

export type ImportSummary = {
  schoolsImported: number
  duplicatesSkipped: number
  contactsCreated: number
  schoolsUpdated: number
  timeTakenMs: number
  errors: string[]
  importedNames: string[]
  duplicateNames: string[]
  invalidNames: string[]
}

/**
 * Part 2 — the actual import, moved here from scripts/growth/
 * import-schools-csv.ts so the web UI and the CLI script run identically.
 * Never overwrites an existing school (schoolsUpdated is always 0 today —
 * a duplicate is skipped, not merged); never creates a growth_contacts row
 * (contactsCreated is always 0 — the importer only ever touches
 * growth_schools). Both fields are kept in the summary for honesty about
 * what this import actually does, not because either currently happens.
 */
export async function runImport(records: ImportRow[], founderId: string): Promise<ImportSummary> {
  const startedAt = Date.now()
  let schoolsImported = 0
  let duplicatesSkipped = 0
  const errors: string[] = []
  const importedNames: string[] = []
  const duplicateNames: string[] = []
  const invalidNames: string[] = []

  for (const row of records) {
    try {
      if (!isReadyForImport(row.ready_for_import ?? '')) continue
      const name = (row.name ?? '').trim()
      if (!name) {
        invalidNames.push('(missing name)')
        continue
      }

      const placeId = (row.place_id ?? '').trim()
      if (placeId) {
        const existingByPlaceId = await growthRepos.schools.findByPlaceId(placeId)
        if (existingByPlaceId) {
          duplicateNames.push(`${name} (place_id already imported as "${existingByPlaceId.name}")`)
          duplicatesSkipped += 1
          continue
        }
      }
      const existingByName = await growthRepos.schools.findByNameFuzzy(name)
      if (existingByName) {
        duplicateNames.push(`${name} (name matches existing "${existingByName.name}")`)
        duplicatesSkipped += 1
        continue
      }

      await growthRepos.schools.insert({
        name,
        county: row.county?.trim() || null,
        category: row.category_guess?.trim() || null,
        students_count: null,
        notes: row.notes?.trim() || null,
        contact_source: row.contact_source?.trim() || null,
        existing_ict_activity: null,
        selection_reason: null,
        phone: row.phone?.trim() || null,
        website: row.website?.trim() || null,
        email: row.email?.trim() || null,
        google_place_id: placeId || null,
        google_maps_url: row.google_maps_url?.trim() || null,
        google_rating: row.google_rating?.trim() ? Number(row.google_rating) : null,
        google_review_count: row.review_count?.trim() ? Number(row.review_count) : null,
        business_status: row.business_status?.trim() || null,
        whatsapp_number: row.whatsapp_number?.trim() || null,
        discovery_score: row.discovery_score?.trim() ? Number(row.discovery_score) : null,
        contact_quality: row.contact_quality?.trim() || null,
        created_by: founderId,
      })
      importedNames.push(name)
      schoolsImported += 1
    } catch (err) {
      errors.push(`${row.name || '(unnamed row)'}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return {
    schoolsImported,
    duplicatesSkipped,
    contactsCreated: 0,
    schoolsUpdated: 0,
    timeTakenMs: Date.now() - startedAt,
    errors,
    importedNames,
    duplicateNames,
    invalidNames,
  }
}
