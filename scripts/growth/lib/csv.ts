/**
 * Minimal RFC4180-ish CSV helpers shared by the Pilot Discovery Engine
 * scripts (discover-schools, validate-review-csv, prepare-import,
 * import-schools-csv). Every field is always double-quoted on write, with
 * `"` escaped as `""` — matching the format Excel/Sheets/Numbers all read
 * and write natively, so a founder can open, edit, and re-save any of
 * these CSVs by hand between pipeline steps.
 */

export function toCsvValue(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

export function writeCsv(header: string[], rows: string[][]): string {
  const lines = [header.map(toCsvValue).join(',')]
  for (const row of rows) {
    lines.push(row.map(toCsvValue).join(','))
  }
  return lines.join('\n')
}

/** Parses a full CSV document into rows of raw string cells, handling quoted fields with embedded commas/newlines/escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  // Strip a leading BOM, which spreadsheet apps commonly add on save.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (char === '\r') {
      i += 1
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += char
    i += 1
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

/** Parses a CSV document into header-keyed row objects (first row is treated as the header). */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const header = rows[0]
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {}
    header.forEach((key, idx) => {
      record[key] = row[idx] ?? ''
    })
    return record
  })
}

/**
 * Sprint PE-5v2 (Contact Enrichment) — reads a CSV whose exact column set
 * isn't known ahead of time (the enrichment script accepts either the plain
 * discovery CSV or the annotated review CSV, which has one extra
 * `flag_reason` column). Returns the header actually present, so a caller
 * can append new columns without needing to know or reconstruct the input
 * schema — never loses or reorders a column it didn't ask for.
 */
export function readCsvTable(text: string): { header: string[]; records: Record<string, string>[] } {
  const rows = parseCsv(text)
  if (rows.length === 0) return { header: [], records: [] }
  const header = rows[0]
  const records = rows.slice(1).map((row) => {
    const record: Record<string, string> = {}
    header.forEach((key, idx) => {
      record[key] = row[idx] ?? ''
    })
    return record
  })
  return { header, records }
}

/** Writes a header-keyed table back to CSV text, in the exact column order given. */
export function writeCsvTable(header: string[], records: Record<string, string>[]): string {
  return writeCsv(
    header,
    records.map((record) => header.map((col) => record[col] ?? '')),
  )
}
