// lib/intelligence/csvSource.ts
// CSV recognition + extraction stage — the one shared, library-backed parser
// replacing the three independent hand-rolled `.split(',')` implementations
// found in the ingestion audit (none had quote/escape handling; a comma
// inside a name field silently corrupted columns in all three).
//
// Expected format: one row per learner, a `name` column, an optional
// `external_id` column, and one column per subject holding a raw score.
// This does not decide identity or subject canonicalization — it only
// recognizes and extracts raw fields. Those are separate pipeline stages
// (identityResolution.ts, subjectMapping.ts) by design, so a future
// PDF/OCR source can produce the exact same intermediate shape.

import Papa from 'papaparse'

export type ExtractedRow = {
  rowIndex: number   // 1-based, header excluded — used for rawInputRef traceability
  name: string
  externalId: string | null
  subjectScores: Record<string, string>   // raw string values — validation happens in the next stage, not here
}

export type CsvExtractionResult = {
  rows: ExtractedRow[]
  headerIssues: string[]   // e.g. no recognizable name column — fatal, whole file rejected
}

const NAME_COLUMN_CANDIDATES = ['name', 'student_name', 'learner_name', 'full_name']
const EXTERNAL_ID_COLUMN_CANDIDATES = ['external_id', 'admission_number', 'admission_no', 'student_id']

export function extractFromCsv(fileContents: string): CsvExtractionResult {
  const parsed = Papa.parse<Record<string, string>>(fileContents, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase(),
  })

  if (parsed.data.length === 0) {
    return { rows: [], headerIssues: ['File contains no data rows'] }
  }

  const headers = parsed.meta.fields ?? []
  const nameColumn = headers.find(h => NAME_COLUMN_CANDIDATES.includes(h))
  if (!nameColumn) {
    return { rows: [], headerIssues: [`No recognizable name column found (expected one of: ${NAME_COLUMN_CANDIDATES.join(', ')})`] }
  }
  const externalIdColumn = headers.find(h => EXTERNAL_ID_COLUMN_CANDIDATES.includes(h)) ?? null
  const subjectColumns = headers.filter(h => h !== nameColumn && h !== externalIdColumn)

  const rows: ExtractedRow[] = parsed.data.map((record, i) => {
    const subjectScores: Record<string, string> = {}
    for (const col of subjectColumns) {
      const value = record[col]
      if (value !== undefined && value.trim() !== '') subjectScores[col] = value.trim()
    }
    return {
      rowIndex: i + 1,
      name: (record[nameColumn] ?? '').trim(),
      externalId: externalIdColumn ? (record[externalIdColumn]?.trim() || null) : null,
      subjectScores,
    }
  })

  return { rows, headerIssues: [] }
}
