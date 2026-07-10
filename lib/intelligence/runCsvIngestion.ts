// lib/intelligence/runCsvIngestion.ts
// Top-level orchestration: ties together Ingestion Run tracking (lineage),
// the pipeline (extraction -> evidence, in-memory), and persistence
// (evidenceLifecycle.ts) into the one operation a caller invokes for a CSV
// import. Kept separate from pipeline.ts (pure transformation) and
// evidenceLifecycle.ts (persistence primitives) so each stays a single
// story, per Constitution 5.4 — this file is the only one that knows the
// full sequence and how failures at each stage should be handled.

import { ingestCsv, type IngestCsvInput } from './pipeline'
import { startIngestionRun, completeIngestionRun, failIngestionRun } from './ingestionRun'
import { persistEvidenceBatch } from './evidenceLifecycle'
import type { EvidenceRow } from '@/lib/repositories/evidence.repository'

export type RunCsvIngestionInput = IngestCsvInput & {
  initiatedBy: string
  institution: string | null
}

export type RunCsvIngestionResult = {
  ingestionRunId: string
  inserted: EvidenceRow[]
  confirmedCount: number
  pendingReviewCount: number
  fatalIssues: string[]
}

export async function runCsvIngestion(input: RunCsvIngestionInput): Promise<RunCsvIngestionResult> {
  const startedAt = Date.now()
  const run = await startIngestionRun({
    source: 'csv_export',
    initiatedBy: input.initiatedBy,
    teacherId: input.teacherId,
    institution: input.institution,
  })

  try {
    const { evidence, fatalIssues } = await ingestCsv(input)

    if (fatalIssues.length > 0) {
      await failIngestionRun(run.id, fatalIssues.join('; '))
      return { ingestionRunId: run.id, inserted: [], confirmedCount: 0, pendingReviewCount: 0, fatalIssues }
    }

    const { inserted, confirmedCount, pendingReviewCount } = await persistEvidenceBatch(evidence, run.id)

    await completeIngestionRun(run.id, {
      recordCount: inserted.length,
      confirmedCount,
      pendingReviewCount,
      rejectedCount: 0, // rejection only happens via later review — never known at ingestion time
      processingDurationMs: Date.now() - startedAt,
    })

    return { ingestionRunId: run.id, inserted, confirmedCount, pendingReviewCount, fatalIssues: [] }
  } catch (err) {
    await failIngestionRun(run.id, err instanceof Error ? err.message : String(err))
    throw err
  }
}
