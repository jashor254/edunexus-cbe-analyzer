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
//
// ADR-0024 Sprint B — prefers canonical curriculum identity over free text.
// When the assignment carries a real substrand_id (Sprint A: the KICD
// picker now persists one), this resolves the real strand/sub-strand
// titles via resolveCurriculumContext() — the same canonical resolver
// Adaptive Learning v2 already uses, not a second lookup — and stores the
// id itself on the evidence row. When no substrand_id exists (every
// assignment created before Sprint A, and every custom/free-text
// assignment), this falls back to exactly the prior behaviour
// (subStrand: topic, strand: null, subStrandId: null) — unchanged,
// verified by a dedicated test, not assumed.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { normaliseScore, marksToLevelForSchool } from '@/lib/assessments/gradeCalculator'
import { resolveCurriculumContext } from '@/lib/curriculum/curriculumContext'

const SOURCE = 'teacher_upload' as const

export type AssignmentMarkEvidenceInput = {
  studentId:     string
  teacherId:     string   // teachers.id
  teacherUserId: string   // auth user id — the ingestion run's initiator
  assignmentId:  string
  subject:       string
  // assignments.topic — the free-text fallback, used only when no
  // canonical substrandId exists (legacy assignments, or custom/free-text
  // mode). Never fabricated further.
  topic:         string | null
  // assignments.substrand_id (Sprint A) — a real sow_substrands.id when
  // the teacher used the KICD picker. Preferred over `topic` whenever set.
  substrandId:   string | null
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

  // Prefer canonical curriculum identity (ADR-0024 Sprint B). Falls back to
  // the free-text topic whenever no substrandId exists, or — defensively —
  // if a substrandId somehow doesn't resolve to a real row (the FK
  // constraint on assignments.substrand_id makes this unreachable in
  // practice, but resolveCurriculumContext's own contract can return null,
  // so this never crashes on it, it just falls back).
  const curriculumContext = input.substrandId
    ? await resolveCurriculumContext(input.substrandId)
    : null

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
    strand: curriculumContext?.strandTitle ?? null,
    subStrand: curriculumContext?.subStrandTitle ?? input.topic,
    subStrandId: curriculumContext?.subStrandId ?? null,
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
