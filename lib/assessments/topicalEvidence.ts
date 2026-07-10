// lib/assessments/topicalEvidence.ts
// Connects topical checks (lib/assessments/topical.ts — a single
// subject/strand/topic rated 1-4 across a class, the fastest and by far the
// highest-volume real teacher workflow in the pilot: 7294 strand_assessments
// rows with source='topical_check' versus 407 total learner_evidence rows
// before this producer existed) to the Evidence Domain.
//
// teacher_upload (tier 3) is correct here, not classroom_observation: the
// teacher personally sets the rating for each student against a specific
// strand/topic, the same "directly attests to this data" reasoning that
// already applies to lib/assignments/evidence.ts and lib/assessments/evidence.ts
// — distinct from formative signals' 30-second got_it/confused/lost check.
// Additive only: does not touch recordTopicalAssessment or
// updateFromAssessment, which stay exactly as they are.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence, CBCLevel } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import type { TopicalRating } from './topical'

const SOURCE = 'teacher_upload' as const
const EXTRACTION_METHOD = 'topical_check_v1'

export type RecordTopicalEvidenceInput = {
  teacherId:     string   // teachers.id
  teacherUserId: string   // auth user id — the ingestion run's initiator
  subject:       string
  strand:        string
  topic:         string
  term:          number
  year:          number
  ratings:       TopicalRating[]
}

/**
 * Emits Evidence for every student rated in a topical check. Fire-and-forget
 * from the caller, same as the other assessment producers — never blocks or
 * fails the check-save request.
 */
export async function recordTopicalEvidence(input: RecordTopicalEvidenceInput): Promise<void> {
  if (input.ratings.length === 0) return

  const startedAt = new Date()
  const importedAt = startedAt.toISOString()

  const confidence = computeConfidence({
    identityConfidence: 100, // studentId is already verified against the class roster by the caller
    identityMatchType: 'external_id',
    fieldIssueCount: 0,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)

  const evidenceBatch: LearnerEvidence[] = input.ratings.map(r => ({
    learnerId: r.studentId,
    extractedName: '',
    extractedExternalId: null,
    subject: input.subject,
    rawSubject: input.subject,
    score: null,
    cbcLevel: r.rating as CBCLevel,
    assessmentType: 'assignment',
    academicYear: input.year,
    term: input.term,
    evidenceSource: SOURCE,
    trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
    evidenceConfidence: confidence,
    extractionMethod: EXTRACTION_METHOD,
    reviewStatus,
    rawInputRef: `strand_assessments:topical_check:${input.subject}:${input.strand}:${input.topic}:${r.studentId}`,
    importedAt,
    issues: [],
    strand: input.strand,
    subStrand: input.topic,
  }))

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: input.teacherUserId,
    teacherId: input.teacherId,
    institution: null,
  })

  const result = await persistEvidenceBatch(evidenceBatch, runId)

  await repos.evidence.completeIngestionRun(runId, {
    recordCount: evidenceBatch.length,
    confirmedCount: result.confirmedCount,
    pendingReviewCount: result.pendingReviewCount,
    rejectedCount: 0,
    processingDurationMs: Date.now() - startedAt.getTime(),
  })
}
