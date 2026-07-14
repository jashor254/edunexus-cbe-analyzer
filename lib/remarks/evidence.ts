// lib/remarks/evidence.ts
//
// Teacher remarks as Evidence (Phase C —
// docs/architecture/learner-record-layer-decisions.md Decision 1, and the
// corrected design in learner-record-layer.md §4 — the original,
// withdrawn proposal was a standalone teacher_remarks table; this reuses
// the Evidence Domain instead, matching every other evidence source's
// pattern exactly: build one LearnerEvidence, call persistEvidenceBatch).
//
// Permanent, never edited or superseded by another remark — see
// claimKey()'s teacher_remark carve-out in evidenceLifecycle.ts. A
// correction is a retraction of the wrong remark plus a new one, never an
// edit of the existing row's payload.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch, getEvidenceHistoryForLearner } from '@/lib/intelligence/evidenceLifecycle'

const SOURCE = 'teacher_remark' as const
const EXTRACTION_METHOD = 'teacher_remark_v1'
const PAYLOAD_VERSION = 1 as const

export type RecordRemarkEvidenceInput = {
  studentId: string
  studentName: string
  teacherId: string        // legacy teachers.id — attribution only (CLAUDE.md), never a read-access gate
  initiatedByUserId: string // auth.users id ingestion_runs.initiated_by actually FKs to
  body: string
  /** Null for a general remark not tied to one subject — see academic-evidence-layer.md §4. */
  subject: string | null
  term: number | null
  academicYear: number
}

export async function recordRemarkEvidence(input: RecordRemarkEvidenceInput): Promise<void> {
  const body = input.body.trim()
  if (!body) return // an empty remark is not a claim worth making

  const confidence = computeConfidence({
    identityConfidence: 100, // studentId is a real FK, entered directly by the teacher, not name/fuzzy-matched
    identityMatchType: 'external_id',
    fieldIssueCount: 0,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)
  const importedAt = new Date().toISOString()

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: input.initiatedByUserId,
    teacherId: input.teacherId,
    institution: null,
  })

  const evidenceBatch: LearnerEvidence[] = [{
    learnerId: input.studentId,
    extractedName: input.studentName,
    extractedExternalId: null,
    // subject is NOT NULL on learner_evidence — 'general' is the same
    // sentinel this codebase already uses elsewhere (e.g. mutations.ts's
    // triggerLearnerModelUpdates: strand/subStrand 'general') for "no
    // specific X applies here," not a new convention invented for remarks.
    subject: input.subject ?? 'general',
    rawSubject: input.subject ?? 'general',
    score: null,
    cbcLevel: null,
    // No assessmentType value in the CHECK constraint actually fits a
    // remark — 'assignment' is the same closest-fit placeholder every
    // other non-scored writer already uses (holiday/return.ts,
    // compass/evidence.ts, remedial/interventionEvidence.ts,
    // parentPulse/observationEvidence.ts), not a new choice made here.
    assessmentType: 'assignment',
    academicYear: input.academicYear,
    term: input.term,
    evidenceSource: SOURCE,
    trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
    evidenceConfidence: confidence,
    extractionMethod: EXTRACTION_METHOD,
    reviewStatus,
    rawInputRef: `teacher_remark:${input.studentId}:${importedAt}`,
    importedAt,
    issues: [],
    payload: { kind: 'remark', payloadVersion: PAYLOAD_VERSION, body },
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

export type RemarkSummary = {
  id: string
  subject: string
  term: number | null
  academicYear: number
  body: string
  createdAt: string
  lifecycleState: string
}

/**
 * Every non-superseded, non-retracted, non-erased remark for a learner,
 * oldest first — the chronological "quiet learner" -> "confidence
 * improving" sequence the whole point of Phase C exists to preserve.
 * Reads via getEvidenceHistoryForLearner (the sanctioned lib/intelligence/
 * entry point), never repos.evidence directly, same read-path guardrail
 * as everything else (CLAUDE.md, Decision 5).
 */
export async function getRemarksForStudent(studentId: string): Promise<RemarkSummary[]> {
  const history = await getEvidenceHistoryForLearner(studentId)
  return history
    .filter(e => e.evidence_source === 'teacher_remark' && e.lifecycle_state !== 'retracted' && e.lifecycle_state !== 'erased')
    .map(e => ({
      id: e.id,
      subject: e.subject,
      term: e.term,
      academicYear: e.academic_year,
      body: (e.payload as { body?: string } | null)?.body ?? '',
      createdAt: e.created_at,
      lifecycleState: e.lifecycle_state,
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}
