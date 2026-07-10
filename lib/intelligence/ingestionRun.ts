// lib/intelligence/ingestionRun.ts
// Ingestion Run lifecycle — the "first-class object" per import execution
// (Evidence Domain Model §5, lineage). Thin domain wrapper around
// EvidenceRepository's run methods.

import { repos } from '@/lib/repositories'
import type { EvidenceSource } from './evidence'
import type { IngestionRun } from '@/lib/repositories/evidence.repository'

export async function startIngestionRun(input: {
  source: EvidenceSource
  initiatedBy: string
  teacherId: string | null
  institution: string | null
}): Promise<{ id: string }> {
  return repos.evidence.createIngestionRun(input)
}

export async function completeIngestionRun(
  runId: string,
  stats: { recordCount: number; confirmedCount: number; pendingReviewCount: number; rejectedCount: number; processingDurationMs: number },
): Promise<void> {
  return repos.evidence.completeIngestionRun(runId, stats)
}

export async function failIngestionRun(runId: string, reason: string): Promise<void> {
  return repos.evidence.failIngestionRun(runId, reason)
}

export async function getIngestionRun(runId: string): Promise<IngestionRun | null> {
  return repos.evidence.findIngestionRun(runId)
}

/** Live counts by lifecycle_state, as of now — distinct from the frozen at-completion snapshot. */
export async function getIngestionRunLiveStats(runId: string): Promise<Record<string, number>> {
  return repos.evidence.getLiveBatchStats(runId)
}
