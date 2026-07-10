// lib/intelligence/pipeline.ts
// Orchestrates the full ingestion journey for one CSV file:
// extraction -> field validation -> subject mapping -> identity resolution
// -> normalization into LearnerEvidence -> confidence scoring -> split into
// auto-confirmed vs. pending-review.
//
// The row->evidence transformation (buildEvidenceForRow) is extracted as its
// own function, separate from CSV-specific orchestration (roster fetching,
// file parsing) — per the Phase 1 architecture review's finding that this
// logic needs to be reusable by a future source, not copy-pasted into a
// second orchestrator. A future OCR/API source produces ExtractedRow-shaped
// output and calls buildEvidenceForRow directly.
//
// This module only produces LearnerEvidence values in memory — it does not
// persist them. Persistence (Phase 2) is evidenceLifecycle.ts's job, kept
// separate per "separate orchestration from persistence."

import { extractFromCsv, type ExtractedRow } from './csvSource'
import { mapSubject } from './subjectMapping'
import { resolveAgainstRoster, fetchRosterForTeacher } from './identityResolution'
import type { StudentIdentityCandidate } from '@/lib/repositories/intelligence.repository'
import { computeConfidence, resolveReviewStatus } from './confidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from './evidence'
import { marksToLevel } from './cbcScale'
import type { LearnerEvidence, EvidenceSource } from './evidence'

export type IngestCsvInput = {
  fileContents: string
  teacherId: string
  academicYear: number
  term: number | null
  assessmentType: 'term_exam' | 'cat' | 'assignment'
  maxScore?: number   // default 100
}

export type IngestCsvResult = {
  evidence: LearnerEvidence[]   // both auto_confirmed and pending_review — persistence decides what happens to each
  fatalIssues: string[]         // whole-file problems (e.g. no name column) — nothing was processed
}

const SOURCE: EvidenceSource = 'csv_export'
const EXTRACTION_METHOD = 'csv_parser_v1'

/**
 * Turns one already-extracted row into LearnerEvidence records (one per
 * subject cell). Source-agnostic in principle — a future extraction stage
 * for another source calls this the same way, given the same row shape.
 */
export function buildEvidenceForRow(
  row: ExtractedRow,
  roster: StudentIdentityCandidate[],
  context: { source: EvidenceSource; extractionMethod: string; assessmentType: 'term_exam' | 'cat' | 'assignment'; academicYear: number; term: number | null; maxScore: number; importedAt: string },
): LearnerEvidence[] {
  const identity = resolveAgainstRoster({ name: row.name, externalId: row.externalId }, roster)
  const results: LearnerEvidence[] = []

  for (const [rawSubject, rawValue] of Object.entries(row.subjectScores)) {
    const issues: string[] = []
    const { canonicalSubject } = mapSubject(rawSubject)

    const numericScore = Number(rawValue)
    let score: number | null = null
    if (Number.isNaN(numericScore)) {
      issues.push(`Non-numeric score "${rawValue}"`)
    } else if (numericScore < 0 || numericScore > context.maxScore) {
      issues.push(`Score ${numericScore} out of range [0, ${context.maxScore}]`)
    } else {
      score = numericScore
    }

    if (identity.learnerId === null) {
      issues.push(`Could not confidently resolve learner identity for "${row.name}"`)
    }

    const confidence = computeConfidence({
      identityConfidence: identity.confidence,
      identityMatchType: identity.matchType,
      fieldIssueCount: issues.length,
      source: context.source,
    })

    results.push({
      learnerId: identity.learnerId,
      extractedName: row.name,
      extractedExternalId: row.externalId,
      subject: canonicalSubject,
      rawSubject,
      score,
      cbcLevel: score !== null ? marksToLevel(Math.round((score / context.maxScore) * 100)) : null,
      assessmentType: context.assessmentType,
      academicYear: context.academicYear,
      term: context.term,
      evidenceSource: context.source,
      trustTier: EVIDENCE_SOURCE_TRUST_TIER[context.source],
      evidenceConfidence: confidence,
      extractionMethod: context.extractionMethod,
      reviewStatus: resolveReviewStatus(confidence),
      rawInputRef: `csv_row:${row.rowIndex}:${rawSubject}`,
      importedAt: context.importedAt,
      issues,
    })
  }

  return results
}

export async function ingestCsv(input: IngestCsvInput): Promise<IngestCsvResult> {
  const maxScore = input.maxScore ?? 100
  const extraction = extractFromCsv(input.fileContents)

  if (extraction.headerIssues.length > 0) {
    return { evidence: [], fatalIssues: extraction.headerIssues }
  }

  const roster = await fetchRosterForTeacher(input.teacherId)
  const importedAt = new Date().toISOString()
  const context = {
    source: SOURCE,
    extractionMethod: EXTRACTION_METHOD,
    assessmentType: input.assessmentType,
    academicYear: input.academicYear,
    term: input.term,
    maxScore,
    importedAt,
  }

  const evidence = extraction.rows.flatMap(row => buildEvidenceForRow(row, roster, context))

  return { evidence, fatalIssues: [] }
}
