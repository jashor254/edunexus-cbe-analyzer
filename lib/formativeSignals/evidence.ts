// lib/formativeSignals/evidence.ts
// Emits Evidence for teacher formative-signal observations (got_it/confused/
// lost) — Projection V2.1, Phases 3+4. This is the one "Lost" interaction
// identified in the audit that is both a real, already-happening,
// teacher-verified observation AND already carries real strand/sub_strand
// curriculum context, so this single producer covers both the
// behavioural-observation and curriculum-context goals of this sprint.
//
// Dual-write, same pattern as lib/compass/evidence.ts: the existing
// formative_signals table insert and updateFromFormativeSignal
// (learner_profiles) call in app/api/formative/signal/route.ts are
// untouched — this is purely additive, fire-and-forget, never blocking the
// existing response.
//
// classroom_observation is the correct, already-defined EvidenceSource here
// (tier 2 — "a teacher attesting to something they reviewed, not something
// they personally set and scored," per its own doc comment in evidence.ts)
// — exactly what a formative check is, as distinct from a scored assessment.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence, CBCLevel } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'

const SOURCE = 'classroom_observation' as const

// A 30-second in-lesson check is not the same rigor as a scored assessment —
// 'got_it' is deliberately capped at Meets Expectations (3), never Exceeds
// (4): a binary teacher check can't distinguish "met" from "exceeded".
const OUTCOME_TO_CBC_LEVEL: Record<'got_it' | 'confused' | 'lost', CBCLevel> = {
  got_it: 3,
  confused: 2,
  lost: 1,
}

export type FormativeSignalEvidenceInput = {
  teacherId:     string   // teachers.id
  teacherUserId: string   // auth user id — the ingestion run's initiator
  subject:       string
  strand:        string | null
  subStrand:     string | null
  gotItIds:      string[]
  confusedIds:   string[]
  lostIds:       string[]
  recordedAt:    string
}

export async function recordFormativeSignalEvidence(input: FormativeSignalEvidenceInput): Promise<void> {
  const students: Array<{ studentId: string; outcome: 'got_it' | 'confused' | 'lost' }> = [
    ...input.gotItIds.map(studentId => ({ studentId, outcome: 'got_it' as const })),
    ...input.confusedIds.map(studentId => ({ studentId, outcome: 'confused' as const })),
    ...input.lostIds.map(studentId => ({ studentId, outcome: 'lost' as const })),
  ]
  if (students.length === 0) return

  // studentId is already verified against the class roster by the caller —
  // same identity-confidence treatment as compass_session's resolved studentId.
  const confidence = computeConfidence({
    identityConfidence: 100,
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

  const evidenceBatch: LearnerEvidence[] = students.map(({ studentId, outcome }) => ({
    learnerId: studentId,
    extractedName: '',
    extractedExternalId: null,
    subject: input.subject,
    rawSubject: input.subject,
    score: null,
    cbcLevel: OUTCOME_TO_CBC_LEVEL[outcome],
    assessmentType: 'assignment',
    academicYear,
    term: null,
    evidenceSource: SOURCE,
    trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
    evidenceConfidence: confidence,
    extractionMethod: 'formative_signal_v1',
    reviewStatus,
    rawInputRef: `formative_signal:${input.subject}:${input.strand ?? 'unknown'}:${input.subStrand ?? 'unknown'}:${outcome}`,
    importedAt,
    issues: [],
    strand: input.strand,
    subStrand: input.subStrand,
  }))

  const result = await persistEvidenceBatch(evidenceBatch, runId)

  await repos.evidence.completeIngestionRun(runId, {
    recordCount: evidenceBatch.length,
    confirmedCount: result.confirmedCount,
    pendingReviewCount: result.pendingReviewCount,
    rejectedCount: 0,
    processingDurationMs: 0,
  })
}
