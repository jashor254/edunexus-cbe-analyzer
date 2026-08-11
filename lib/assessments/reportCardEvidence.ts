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
//
// ── Phase 1 / P0-B ──────────────────────────────────────────────────────────
// Widened to serve BOTH Academic Clinic intake routes rather than only the
// teacher one. The parent route (app/api/parent/assessments/process) ran
// the same pipeline, wrote the same `assessments` row and the same
// `student_learning_context`, and emitted no evidence at all — so a
// parent-entered assessment shaped what Compass taught while remaining
// invisible to the learner's canonical record.
//
// Three deliberately small changes, no new producer:
//   1. the evidence source is chosen from `assessments.source`, which
//      already records which intake path was used;
//   2. `teacherId` accepts null, because the parent path has no teacher
//      (createIngestionRun already allowed this — lib/compass/evidence.ts
//      has always passed null);
//   3. an idempotency guard on this producer's own provenance prefix, so
//      re-processing the same assessment does not add a redundant set.
//
// Nothing about the Evidence Domain changed: no new source, no new trust
// tier, no new review semantics, no change to claim keys or supersession.
// Parent-entered scores land at tier 1, whose confidence ceiling (60) sits
// below the auto-confirm threshold (85) — so they are structurally
// incapable of becoming confirmed mastery without a teacher's review.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence, CBCLevel } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { reportCardResultKey } from '@/lib/intelligence/correctionKey'
import { mapSubject } from '@/lib/intelligence/subjectMapping'
import { createServiceClient } from '@/utils/supabase/service'

const EXTRACTION_METHOD = 'report_card_pipeline_v1'

/**
 * Who entered this assessment — the one thing that decides its evidence
 * source, and therefore its trust tier and whether it can auto-confirm.
 *
 * Read from `assessments.source`, a column that already distinguishes the
 * two intake paths. Neither value is new: `teacher_upload` (tier 3) is
 * exactly what this producer has always emitted for the teacher path, and
 * `parent_observation` (tier 1) already exists in EVIDENCE_SOURCE_TRUST_TIER
 * for precisely this shape of claim — a score reported by a parent, not
 * administered or attested by a teacher.
 *
 * Tier 1 caps confidence at 60, below the 85 auto-confirm threshold, so a
 * parent-entered score is STRUCTURALLY incapable of becoming confirmed
 * evidence without a teacher's review. That is a property of the existing
 * Evidence Domain, not a rule this file enforces — which is exactly why no
 * new source, tier, or review semantics were invented here.
 */
function resolveEvidenceSource(assessmentSource: string | null): 'teacher_upload' | 'parent_observation' {
  return assessmentSource === 'parent' ? 'parent_observation' : 'teacher_upload'
}

/** The provenance prefix every row this producer emits shares, per assessment. */
function rawInputRefPrefix(assessmentId: string): string {
  return `assessments:${assessmentId}:`
}

/**
 * Emits Evidence for every scored subject on a processed report-card
 * assessment. Fire-and-forget from the caller (mirrors
 * recomputeCapabilityProfile/triggerLearnerModelUpdate in the process
 * route) — never blocks or fails the processing request.
 *
 * `teacherId` is nullable as of Phase 1 / P0-B: the parent intake path
 * (app/api/parent/assessments/process) has no teacher, and
 * `createIngestionRun` already accepts a null teacher — lib/compass/evidence.ts
 * has always passed one. Nothing else about the teacher path changed.
 */
export async function recordReportCardAssessmentEvidence(
  assessmentId: string,
  studentId: string,
  teacherId: string | null,
  initiatedByUserId: string,
): Promise<void> {
  const startedAt = new Date()
  const db = createServiceClient()

  const { data: assessment } = await db
    .from('assessments')
    .select('id, subject_scores, subject_marks, term, year, created_at, source')
    .eq('id', assessmentId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (!assessment) return

  const scores = (assessment.subject_scores as Record<string, number>) ?? {}
  const rawMarksMap = (assessment.subject_marks as Record<string, { marks?: number }>) ?? {}
  if (Object.keys(scores).length === 0) return

  // Idempotency (Phase 1 / P0-B). Both intake routes can be re-run for the
  // same assessment — the parent UI retries the pipeline on failure, and a
  // teacher can reprocess a batch. Without this guard a re-run would not
  // create a visible duplicate (claim-key supersession chains the new row
  // onto the old one, which is the Evidence Domain working correctly) but
  // it WOULD add a redundant row and a redundant supersession per subject
  // per re-run. Detected via this producer's own provenance prefix, which
  // is unique per assessment — deliberately NOT by changing the global
  // claim-key or supersession semantics, which stay exactly as they are for
  // genuine corrections.
  const { data: alreadyEmitted, error: alreadyEmittedError } = await db
    .from('learner_evidence')
    .select('id')
    .eq('learner_id', studentId)
    .like('raw_input_ref', `${rawInputRefPrefix(assessmentId)}%`)
    .limit(1)

  if (alreadyEmittedError) {
    // Cannot prove this is a first run — emitting anyway risks a redundant
    // set, so the conservative choice is to skip and log. A genuine first
    // run is recoverable by reprocessing; a duplicated evidence set is not
    // as cleanly reversible.
    console.error('[reportCardEvidence] idempotency check failed, skipping emission:', alreadyEmittedError.message)
    return
  }
  if (alreadyEmitted && alreadyEmitted.length > 0) return

  const academicYear = (assessment.year as number) ?? new Date().getFullYear()
  const term = (assessment.term as number) ?? null
  const importedAt = startedAt.toISOString()

  const SOURCE = resolveEvidenceSource(assessment.source as string | null)

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
      rawInputRef: `${rawInputRefPrefix(assessmentId)}${rawSubject}:${studentId}`,
      // Phase E2 — one report-card result cell. The teacher and parent paths
      // describe the SAME artifact family and therefore share this namespace;
      // what differs between them (trust tier, review status) is carried by
      // `evidence_source`, which is unchanged.
      correctionKey: reportCardResultKey({
        assessmentId, studentId, canonicalSubject, source: SOURCE,
      }),
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
