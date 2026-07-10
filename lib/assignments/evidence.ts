// lib/assignments/evidence.ts
// Emits Evidence for teacher-marked assignment submissions — Sprint 9's one
// safe, ready producer. Audit found the other seven priority candidates
// (rubric, project work, practical activities, homework, reading
// observation, group participation, parent observations) either lack a real
// capture feature in EduNexus today or lack the teacher-approval workflow
// Rule 8 requires — building producers for those would mean inventing the
// underlying feature, not observing a real classroom interaction.
//
// Dual-write, same pattern as prior Evidence producers: the existing
// assignment_submissions update in
// app/api/teacher/assignments/[id]/mark/route.ts is untouched.
//
// teacher_upload is the correct EvidenceSource (tier 3 — "a teacher directly
// attests to this data") — a teacher marking a specific submission against a
// declared max_score is exactly a teacher-administered, teacher-scored
// assessment, the highest-trust case the Evidence Domain defines.
//
// Reuses the platform's existing, already-canonical marks→CBC-level
// converter (marksToLevelForSchool) rather than inventing a new threshold —
// same school-specific grade boundaries every other assessment surface uses.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { normaliseScore, marksToLevelForSchool } from '@/lib/assessments/gradeCalculator'

const SOURCE = 'teacher_upload' as const

export type AssignmentMarkEvidenceInput = {
  studentId:     string
  teacherId:     string   // teachers.id
  teacherUserId: string   // auth user id — the ingestion run's initiator
  assignmentId:  string
  subject:       string
  // assignments.topic — the closest real proxy for substrand (no dedicated
  // strand/sub_strand column on assignments); never fabricated further.
  topic:         string | null
  score:         number
  maxScore:      number
  academicYear:  number
  term:          number | null
  markedAt:      string
}

export async function recordAssignmentMarkEvidence(input: AssignmentMarkEvidenceInput): Promise<void> {
  const percentage = normaliseScore(input.score, input.maxScore)
  const cbcLevel = marksToLevelForSchool(percentage)

  // studentId is already resolved by the caller (the marking route verified
  // the submission belongs to this assignment/class) — same treatment as
  // every other producer's already-resolved identity.
  const confidence = computeConfidence({
    identityConfidence: 100,
    identityMatchType: 'external_id',
    fieldIssueCount: 0,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)
  const importedAt = new Date().toISOString()

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: input.teacherUserId,
    teacherId: input.teacherId,
    institution: null,
  })

  const evidence: LearnerEvidence = {
    learnerId: input.studentId,
    extractedName: '',
    extractedExternalId: null,
    subject: input.subject,
    rawSubject: input.subject,
    score: percentage,
    cbcLevel,
    assessmentType: 'assignment',
    academicYear: input.academicYear,
    term: input.term,
    evidenceSource: SOURCE,
    trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
    evidenceConfidence: confidence,
    extractionMethod: 'assignment_mark_v1',
    reviewStatus,
    rawInputRef: `assignment:${input.assignmentId}:score=${input.score}/${input.maxScore}`,
    importedAt,
    issues: [],
    strand: null,
    subStrand: input.topic,
  }

  const result = await persistEvidenceBatch([evidence], runId)

  await repos.evidence.completeIngestionRun(runId, {
    recordCount: 1,
    confirmedCount: result.confirmedCount,
    pendingReviewCount: result.pendingReviewCount,
    rejectedCount: 0,
    processingDurationMs: 0,
  })
}
