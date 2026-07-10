// lib/remedial/interventionEvidence.ts
// Connects the intervention check-in workflow (a teacher's follow-up
// judgement on a remediation they already ran — see
// app/api/teacher/intervention-checkin/route.ts) to the Evidence Domain.
// Same pattern and same conservative-level reasoning as
// lib/formativeSignals/evidence.ts's got_it/confused/lost mapping: a
// directional teacher check ("did this improve?") is not a scored
// assessment, so it is capped below Exceeds Expectations (4) and never
// asserts a raw score. classroom_observation is the correct EvidenceSource
// — a teacher attesting to something they reviewed, not something they
// personally set and scored, exactly like a formative check.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence, CBCLevel } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'

const SOURCE = 'classroom_observation' as const

const OUTCOME_TO_CBC_LEVEL: Record<'improved' | 'same' | 'worsened', CBCLevel> = {
  improved: 3,
  same: 2,
  worsened: 1,
}

export type InterventionCheckinEvidenceInput = {
  studentId: string
  teacherId: string       // teachers.id
  teacherUserId: string   // auth user id — the ingestion run's initiator
  subject: string | null
  subStrand: string | null
  outcome: 'improved' | 'same' | 'worsened'
  recordedAt: string
}

export async function recordInterventionCheckinEvidence(input: InterventionCheckinEvidenceInput): Promise<void> {
  if (!input.subject) return // no subject on this intervention — nothing to attribute the evidence to

  const confidence = computeConfidence({
    identityConfidence: 100, // studentId is a real FK, already verified against the class roster
    identityMatchType: 'external_id',
    fieldIssueCount: 0,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)
  const academicYear = new Date(input.recordedAt).getFullYear()
  const importedAt = new Date().toISOString()

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: input.teacherUserId,
    teacherId: input.teacherId,
    institution: null,
  })

  const evidenceBatch: LearnerEvidence[] = [{
    learnerId: input.studentId,
    extractedName: '',
    extractedExternalId: null,
    subject: input.subject,
    rawSubject: input.subject,
    score: null,
    cbcLevel: OUTCOME_TO_CBC_LEVEL[input.outcome],
    assessmentType: 'assignment',
    academicYear,
    term: null,
    evidenceSource: SOURCE,
    trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
    evidenceConfidence: confidence,
    extractionMethod: 'intervention_checkin_v1',
    reviewStatus,
    rawInputRef: `intervention_checkin:${input.subject}:${input.subStrand ?? 'unknown'}:${input.outcome}`,
    importedAt,
    issues: [],
    strand: null,
    subStrand: input.subStrand,
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
