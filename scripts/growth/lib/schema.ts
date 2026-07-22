/**
 * Sprint PE-4 (School Discovery Engine v1) — the CSV column schema shared by
 * every script in the pipeline so the columns stay in lockstep end to end:
 * discover-schools.ts writes them, validate-review-csv.ts reads them,
 * prepare-import.ts filters on them, import-schools-csv.ts consumes them.
 *
 * Supersedes PE-2's schema: `review_status`/`priority`/`selection_reason`/
 * `existing_ict_activity`/`first_contact_person`/`contact_verified`/
 * `follow_up_needed` are gone — PE-4 is explicitly research/discovery only,
 * not a CRM qualification workflow (those Research Workflow fields already
 * exist on growth_schools itself, filled in through the Growth Engine UI
 * after import, not duplicated here). `confidence`/`confidence_reason` are
 * replaced by `discovery_score`/`contact_quality`. The one human decision
 * this CSV asks for is `ready_for_import` (TRUE/FALSE).
 */

export const DISCOVERY_COLUMNS = [
  'name', 'county', 'town', 'category_guess', 'address', 'phone', 'website', 'email',
  'google_rating', 'review_count', 'business_status', 'contact_source',
  'google_maps_url', 'place_id',
] as const

export const SCORING_COLUMNS = ['contact_quality', 'discovery_score'] as const

export const NOTES_COLUMN = ['notes'] as const

// Part 10 — the one founder decision column. Defaults FALSE; the importer
// imports only rows a human has flipped to TRUE.
export const REVIEW_COLUMNS = ['ready_for_import'] as const

export const DISCOVERY_CSV_HEADER = [
  ...DISCOVERY_COLUMNS,
  ...SCORING_COLUMNS,
  ...NOTES_COLUMN,
  ...REVIEW_COLUMNS,
] satisfies readonly string[]

export type DiscoveryCsvColumn = (typeof DISCOVERY_CSV_HEADER)[number]
export type DiscoveryCsvRow = Record<DiscoveryCsvColumn, string>

export const CLOSED_BUSINESS_STATUSES = ['CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY'] as const

export const READY_FOR_IMPORT_TRUE = 'TRUE'
export const READY_FOR_IMPORT_FALSE = 'FALSE'

export function isReadyForImport(value: string): boolean {
  return value.trim().toUpperCase() === READY_FOR_IMPORT_TRUE
}

/** Builds a discovery row with `ready_for_import` at its documented default (FALSE — a human must opt a row in). Every other column is supplied by the caller. */
export function newDiscoveryRow(partial: Omit<DiscoveryCsvRow, (typeof REVIEW_COLUMNS)[number]>): DiscoveryCsvRow {
  return {
    ...partial,
    ready_for_import: READY_FOR_IMPORT_FALSE,
  }
}
