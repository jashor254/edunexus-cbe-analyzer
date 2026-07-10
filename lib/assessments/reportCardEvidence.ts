// lib/assessments/reportCardEvidence.ts
// Connects the term/exam report-card pipeline (the `assessments` table —
// student-scoped, multi-subject, driven by app/api/teacher/assessments/process)
// to the Evidence Domain. Distinct from lib/assessments/evidence.ts, which
// covers the separate class_assessments/learner_marks gradebook — this table
// has no strand/sub_strand (per triggerLearnerModelUpdate's own comment in
// the process route), so evidence here is subject-level only, same shape as
// lib/assignments/evidence.ts. Additive only: does not touch
// recomputeCapabilityProfile or triggerLearnerModelUpdate, which stay as-is.
//
// subject_scores already stores CBC levels (1-4) directly — see
// triggerLearnerModelUpdate's use of `scores` as `level` — so no
// marksToLevel conversion is needed here. subject_marks carries the raw
// mark when the teacher recorded one; otherwise score is left null rather
// than approximated, since an approximated mark is not real evidence.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence, CBCLevel } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { mapSubject } from '@/lib/intelligence/subjectMapping'
import { createServiceClient } from '@/utils/supabase/service'

const SOURCE = 'teacher_upload' as const
const EXTRACTION_METHOD = 'report_card_pipeline_v1'

/**
 * Emits Evidence for every scored subject on a processed report-card
 * assessment. Fire-and-forget from the caller (mirrors
 * recomputeCapabilityProfile/triggerLearnerModelUpdate in the process
 * route) — never blocks or fails the processing request.
 */
export async function recordReportCardAssessmentEvidence(
  assessmentId: string,
  studentId: string,
  teacherId: string,
  initiatedByUserId: string,
): Promise<void> {
  const startedAt = new Date()
  const db = createServiceClient()

  const { data: assessment } = await db
    .from('assessments')
    .select('id, subject_scores, subject_marks, term, year, created_at')
    .eq('id', assessmentId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (!assessment) return

  const scores = (assessment.subject_scores as Record<string, number>) ?? {}
  const rawMarksMap = (assessment.subject_marks as Record<string, { marks?: number }>) ?? {}
  if (Object.keys(scores).length === 0) return

  const academicYear = (assessment.year as number) ?? new Date().getFullYear()
  const term = (assessment.term as number) ?? null
  const importedAt = startedAt.toISOString()

  const confidence = computeConfidence({
    identityConfidence: 100, // studentId is a real FK, not name/fuzzy-matched
    identityMatchType: 'external_id',
    fieldIssueCount: 0,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)

  const evidenceBatch: LearnerEvidence[] = []
  for (const [rawSubject, rawLevel] of Object.entries(scores)) {
    const level = Number(rawLevel)
    if (!Number.isInteger(level) || level < 1 || level > 4) continue
    const { canonicalSubject } = mapSubject(rawSubject)
    const rawMark = rawMarksMap[rawSubject]?.marks

    evidenceBatch.push({
      learnerId: studentId,
      extractedName: '',
      extractedExternalId: null,
      subject: canonicalSubject,
      rawSubject,
      score: typeof rawMark === 'number' ? rawMark : null,
      cbcLevel: level as CBCLevel,
      assessmentType: 'term_exam',
      academicYear,
      term,
      evidenceSource: SOURCE,
      trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
      evidenceConfidence: confidence,
      extractionMethod: EXTRACTION_METHOD,
      reviewStatus,
      rawInputRef: `assessments:${assessmentId}:${rawSubject}:${studentId}`,
      importedAt,
      issues: [],
    })
  }
  if (!evidenceBatch.length) return

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: initiatedByUserId,
    teacherId,
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
