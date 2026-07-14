// lib/parentPulse/observationEvidence.ts
// Bridges the parent WhatsApp pulse-check pipeline (observationPipeline.ts)
// into the Evidence Domain, mirroring lib/remedial/interventionEvidence.ts's
// pattern exactly: a directional, non-scored signal, capped below Exceeds
// Expectations, using the source's own declared trust tier. parent_observation
// is tier 1 (EVIDENCE_SOURCE_TRUST_TIER) — always pending_review, never
// auto-confirmed, which is correct: a parent's WhatsApp reply is the
// lowest-trust evidence source in the system by design, not a gap to fix.
//
// TEMPORARY DUAL-WRITE (same pattern as updateFromCompass in
// lib/learnerModel/updater.ts): this runs alongside, not instead of,
// updateFromParentObservation — Holiday Planner, Remedial Planner, Monday
// Panel, and Prerequisite Readiness still read learner_profiles directly
// (see docs/architecture/migration-ledger.md). This function's only job is
// making sure the same observation also becomes real, audited Evidence
// Domain data instead of existing only in learner_profiles.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence, CBCLevel } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'

const SOURCE = 'parent_observation' as const

// 'not_attempted' is not evidence of a knowledge level — the activity simply
// didn't happen, so there is nothing to attest to. Only outcomes that speak
// to the child's actual understanding produce evidence.
const OUTCOME_TO_CBC_LEVEL: Partial<Record<'demonstrated' | 'struggled' | 'not_attempted', CBCLevel>> = {
  demonstrated: 3,
  struggled: 2,
}

export type ParentObservationEvidenceInput = {
  studentId: string
  parentUserId: string   // auth user id — the ingestion run's initiator
  subject: string | null // may be unresolved when context falls back to substrand-only history
  substrand: string
  outcome: 'demonstrated' | 'struggled' | 'not_attempted'
  recordedAt: string
}

export async function recordParentObservationEvidence(input: ParentObservationEvidenceInput): Promise<void> {
  if (!input.subject) return // subject could not be resolved from context — nothing to attribute evidence to
  const cbcLevel = OUTCOME_TO_CBC_LEVEL[input.outcome]
  if (cbcLevel === undefined) return // 'not_attempted' — no knowledge-level claim to make

  const confidence = computeConfidence({
    identityConfidence: 100, // studentId resolved via a verified whatsapp_opt_ins record
    identityMatchType: 'external_id',
    fieldIssueCount: 0,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)
  const academicYear = new Date(input.recordedAt).getFullYear()
  const importedAt = new Date().toISOString()

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: input.parentUserId,
    teacherId: null,
    institution: null,
  })

  const evidenceBatch: LearnerEvidence[] = [{
    learnerId: input.studentId,
    extractedName: '',
    extractedExternalId: null,
    subject: input.subject,
    rawSubject: input.subject,
    score: null,
    cbcLevel,
    assessmentType: 'assignment',
    academicYear,
    term: null,
    evidenceSource: SOURCE,
    trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
    evidenceConfidence: confidence,
    extractionMethod: 'whatsapp_pulse_reply_v1',
    reviewStatus,
    rawInputRef: `whatsapp_pulse_reply:${input.subject}:${input.substrand}:${input.outcome}`,
    importedAt,
    issues: [],
    strand: null,
    subStrand: input.substrand,
  }]

  const result = await persistEvidenceBatch(evidenceBatch, runId)

  await repos.evidence.completeIngestionRun(runId, {
    recordCount: evidenceBatch.length,
    confirmedCount: result.confirmedCount,
    pendingReviewCount: result.pendingReviewCount,
    rejectedCount: 0,
    processingDurationMs: 0,
  })
}
