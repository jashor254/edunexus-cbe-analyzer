// lib/assessments/evidence.ts
// Connects the real teacher gradebook (class_assessments + learner_marks —
// CATs/exams/assignments entered via CSV upload or manual bulk-save) to the
// Evidence Domain. Per the pilot-readiness audit: this pipeline previously
// fed only the legacy learner model (updateFromAssessment, via
// triggerLearnerModelUpdates in mutations.ts) and never produced a single
// row in learner_evidence — meaning Blueprint/Career Intelligence/Adaptive
// Learning (all Projection-driven) never moved from a teacher's own
// assessment marks, only from Compass sessions. This is additive: it does
// not change triggerLearnerModelUpdates or the legacy write path, which
// stays in place per the same migration-ledger reasoning as
// lib/compass/evidence.ts.
//
// Mirrors lib/compass/evidence.ts's shape exactly (ingestion run -> batch of
// LearnerEvidence -> persistEvidenceBatch -> complete run) but for a source
// whose identity is already exactly resolved (a real learner_marks.student_id
// FK, not name-matched) and whose scores are raw marks, not a chat session —
// so it reuses mapSubject/marksToLevel from the CSV pipeline stages rather
// than Compass's claim-type split.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { classAssessmentResultKey } from '@/lib/intelligence/correctionKey'
import { mapSubject } from '@/lib/intelligence/subjectMapping'
import { marksToLevel, type MarksThresholds } from '@/lib/assessments/gradeCalculator'
import type { AssessmentType } from '@/lib/assessments/types'
import { resolveTeacherGradeBoundaries } from '@/lib/core/school'

const SOURCE = 'teacher_upload' as const
const EXTRACTION_METHOD = 'teacher_gradebook_v1'

// LearnerEvidence's assessmentType is narrower than class_assessments' full
// AssessmentType check constraint — map the rest onto the closest fit.
function toEvidenceAssessmentType(t: AssessmentType): 'term_exam' | 'cat' | 'assignment' {
  if (t === 'cat') return 'cat'
  if (t === 'assignment') return 'assignment'
  return 'term_exam' // exam | midterm | endterm | opener
}

/**
 * Emits Evidence for every scored subject on an already-graded assessment.
 * Fire-and-forget from the caller, same as triggerLearnerModelUpdates —
 * never blocks or fails the marks-save request.
 *
 * teacherId is the legacy `teachers.id` (class_assessments/learner_marks are
 * scoped by it); initiatedByUserId is the auth.users id that
 * ingestion_runs.initiated_by actually FKs to — these are two different
 * identity spaces and ingestion_runs rejects a teachers.id there.
 */
export async function recordAssessmentEvidence(
  assessmentId: string,
  teacherId: string,
  initiatedByUserId: string,
  // Real signal of doubt about the SCORES THEMSELVES (not identity —
  // student_id is already a verified FK), for sources where the person
  // recording marks already knows they're uncertain (e.g. a bulk import
  // from a photographed marksheet that was hard to read). Defaults to 0
  // (identical to every caller before this parameter existed) — never
  // silently changes existing behaviour. computeConfidence() already
  // treats fieldIssueCount as "a real reason for doubt, not a hard
  // block" (-20 confidence per issue); this just lets a caller who
  // genuinely knows the data is shaky say so, instead of every import
  // landing at the same auto_confirmed trust as a cleanly-read sheet.
  knownFieldIssueCount = 0,
): Promise<void> {
  const startedAt = new Date()

  const [assessment, marks] = await Promise.all([
    repos.assessments.findAssessmentById(assessmentId, teacherId),
    repos.assessments.findMarksByAssessment(assessmentId, teacherId),
  ])
  if (!assessment || !marks.length) return

  // Sprint 12 Wave 2 (High 2/6, Release Blocker Remediation) — defense in
  // depth. In the normal flow this never fires: marks are saved (assessment
  // still unpublished) before this function runs, and publishing happens
  // later. This guards the hypothetical case of a caller reaching this
  // function for an assessment that was locked in the meantime (or by a
  // future caller that bypasses the marks-save guards this sprint added) —
  // silently returns rather than throws, matching this function's own
  // established fire-and-forget, no-evidence-to-produce contract
  // immediately above (`if (!assessment || !marks.length) return`).
  if (assessment.is_published) return

  // Phase G (learner-record-layer-decisions.md Decision 2): resolve a
  // purpose from this assessment's assessment_type_id (Phase B), when one
  // was set. Null on any assessment created before Phase B/G, or whose
  // type has no default_purpose_id yet (a custom name a teacher registered
  // via resolve-or-create, with no purpose chosen for it) — never guessed.
  const purposeId = assessment.assessment_type_id
    ? (await repos.assessmentTypes.findById(assessment.assessment_type_id))?.default_purpose_id ?? null
    : null

  // student_id is selected by the repository but not on the LearnerMark type
  // (same gap triggerLearnerModelUpdates already works around).
  type MarkWithStudentId = (typeof marks[number]) & { student_id: string | null }
  const gradedMarks = (marks as MarkWithStudentId[]).filter(m => m.student_id != null)
  if (!gradedMarks.length) return

  const assessmentType = toEvidenceAssessmentType(assessment.assessment_type)
  const academicYear = assessment.year
  const term = Number(assessment.term)
  const importedAt = startedAt.toISOString()

  const confidence = computeConfidence({
    identityConfidence: 100, // student_id is a real FK, not name/fuzzy-matched
    identityMatchType: 'external_id',
    fieldIssueCount: knownFieldIssueCount,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)

  // Was marksToLevel(...) with NO thresholds argument — always the hardcoded
  // DEFAULT_MARKS_THRESHOLDS (75/50/30), completely ignoring
  // school_settings.grade_boundaries. lib/core/assessments.ts's
  // computeTermSummaries() (the report-card path) already honours the
  // school's configured boundaries (75/50/25 fallback) via the same
  // resolveTeacherGradeBoundaries() this reuses — so the exact same raw
  // score could land on a different CBC level in evidence than it does on
  // the report card it supposedly backs. A school with AE set to 25 (e.g.
  // Kangai Junior School) had every 25-29% score in evidence silently
  // treated as Level 1 (Below) while term summaries correctly called it
  // Level 2 (Approaching). resolveTeacherGradeBoundaries() already falls
  // back to {} defensively (a teacher with no resolvable school, or no
  // settings row yet), which marksToLevel's own default parameter then
  // covers with 75/50/30 — never a thrown error.
  const gradeBoundaries = await resolveTeacherGradeBoundaries(teacherId)
  const thresholds: MarksThresholds | undefined = Object.keys(gradeBoundaries).length
    ? {
        level4: gradeBoundaries.EE?.min ?? 75,
        level3: gradeBoundaries.ME?.min ?? 50,
        level2: gradeBoundaries.AE?.min ?? 25,
      }
    : undefined

  const evidenceBatch: LearnerEvidence[] = []
  for (const mark of gradedMarks) {
    const subjectScores = mark.subject_scores as Record<string, number>
    for (const [rawSubject, rawScore] of Object.entries(subjectScores)) {
      const score = Number(rawScore)
      if (Number.isNaN(score)) continue
      const { canonicalSubject } = mapSubject(rawSubject)
      const percentScore = assessment.max_score > 0 ? (score / assessment.max_score) * 100 : score

      evidenceBatch.push({
        learnerId: mark.student_id,
        extractedName: mark.student_name,
        extractedExternalId: mark.admission_number,
        subject: canonicalSubject,
        rawSubject,
        score,
        cbcLevel: marksToLevel(Math.round(percentScore), thresholds),
        assessmentType,
        academicYear,
        term,
        evidenceSource: SOURCE,
        trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
        evidenceConfidence: confidence,
        extractionMethod: EXTRACTION_METHOD,
        reviewStatus,
        rawInputRef: `class_assessments:${assessmentId}:${rawSubject}:${mark.student_id}`,
        // Phase E2 — one correctable RESULT CELL, not the whole mark row: a
        // single learner_marks row carries a subject_scores map, so
        // correcting Maths must never touch English. Keyed on the canonical
        // subject so a raw-name change cannot fork the identity.
        correctionKey: classAssessmentResultKey({
          assessmentId, studentId: mark.student_id, canonicalSubject, source: SOURCE,
        }),
        importedAt,
        issues: [],
        purposeId,
      })
    }
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
