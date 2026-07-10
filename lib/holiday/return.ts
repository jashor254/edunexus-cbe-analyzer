// lib/holiday/return.ts
// Holiday Return intake — Adaptive Learning v2 Architecture §4/§7/§9/§10
// (docs/architecture/adaptive-learning-v2-architecture.md, FROZEN). This
// is what closes the Evidence Loop the brief names as its most
// consequential ask: a returned holiday pack becomes real, confirmed-or-
// pending Evidence via the exact same persistEvidenceBatch pipeline every
// other source uses (lib/intelligence/evidenceLifecycle.ts) — not a
// second store, not a learner_profiles patch.
//
// Two claim shapes per return, mirroring lib/compass/evidence.ts's exact
// pattern for the same reason: `extractionMethod` already means "which
// extraction method/version produced this record," and a completion fact
// and a teacher's academic judgment genuinely are two different claims
// from the same event.
// - engagement: always emitted — "returned N of M weeks" (never an
//   academic claim; score/cbcLevel stay null).
// - mastery: emitted only for subjects the teacher actually assessed on
//   return — the teacher's CBC-level judgment of the returned work.
//
// Both claim types are inserted as pending_review unconditionally — see
// the load-bearing note in lib/holiday/returnAutoConfirm.ts for why this
// module does not rely on resolveReviewStatus()/the trust-tier ceiling
// the way Compass's tier-1 pipeline can: holiday_return is tier 2, whose
// ceiling (95) sits above the auto-confirm threshold (85), so an
// unconditional override here is what keeps mastery claims teacher-
// reviewable, not an incidental side effect of tier math.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { startIngestionRun, completeIngestionRun } from '@/lib/intelligence/ingestionRun'
import { applyHolidayEngagementAutoConfirm } from './returnAutoConfirm'
import { HOLIDAY_ENGAGEMENT_EXTRACTION_METHOD, HOLIDAY_MASTERY_EXTRACTION_METHOD } from './evidenceClaimTypes'
import { notifyParentOfHolidayReturn } from './notify'

const SOURCE = 'holiday_return' as const

export type HolidayReturnMasteryClaim = {
  subject:  string
  cbcLevel: 1 | 2 | 3 | 4
}

export type RecordHolidayReturnInput = {
  studentId:      string
  studentName:    string
  teacherId:      string
  initiatedBy:    string
  academicYear:   number
  term:           number
  weeksAssigned:  number
  weeksCompleted: number
  teacherComment: string | null
  masteryClaims:  HolidayReturnMasteryClaim[]
}

export type RecordHolidayReturnResult = {
  ingestionRunId:     string
  confirmedCount:     number
  pendingReviewCount: number
  holidayReturnId:    string
}

export async function recordHolidayReturn(input: RecordHolidayReturnInput): Promise<RecordHolidayReturnResult> {
  const run = await startIngestionRun({
    source: SOURCE, initiatedBy: input.initiatedBy, teacherId: input.teacherId, institution: null,
  })

  // The learner is already a known, ownership-verified roster row (the
  // caller resolves studentId, never a raw name) — the strongest identity
  // match this pipeline recognizes.
  const identityInput = {
    identityConfidence: 100,
    identityMatchType:  'external_id' as const,
    fieldIssueCount:    0,
    source:             SOURCE,
  }

  const now = new Date().toISOString()
  const evidence: LearnerEvidence[] = []

  evidence.push({
    learnerId:            input.studentId,
    extractedName:        input.studentName,
    extractedExternalId:  null,
    subject:              'general',
    rawSubject:            'general',
    score:                 null,
    cbcLevel:              null,
    assessmentType:        'assignment',
    academicYear:          input.academicYear,
    term:                  input.term,
    evidenceSource:        SOURCE,
    trustTier:             EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
    evidenceConfidence:    computeConfidence(identityInput),
    extractionMethod:      HOLIDAY_ENGAGEMENT_EXTRACTION_METHOD,
    reviewStatus:          'pending_review', // see module header — never resolveReviewStatus() here
    rawInputRef:           `holiday_return:${input.studentId}:${input.academicYear}:${input.term}`,
    importedAt:            now,
    issues:                [],
  })

  for (const claim of input.masteryClaims) {
    evidence.push({
      learnerId:            input.studentId,
      extractedName:        input.studentName,
      extractedExternalId:  null,
      subject:              claim.subject,
      rawSubject:            claim.subject,
      score:                 null,
      cbcLevel:              claim.cbcLevel,
      assessmentType:        'assignment',
      academicYear:          input.academicYear,
      term:                  input.term,
      evidenceSource:        SOURCE,
      trustTier:             EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
      evidenceConfidence:    computeConfidence(identityInput),
      extractionMethod:      HOLIDAY_MASTERY_EXTRACTION_METHOD,
      reviewStatus:          'pending_review', // never auto-promoted — see module header
      rawInputRef:           `holiday_return:${input.studentId}:${claim.subject}:${input.academicYear}:${input.term}`,
      importedAt:            now,
      issues:                [],
    })
  }

  const startedAt = Date.now()
  const { inserted, confirmedCount, pendingReviewCount } = await persistEvidenceBatch(evidence, run.id)

  await applyHolidayEngagementAutoConfirm(inserted)

  await completeIngestionRun(run.id, {
    recordCount: inserted.length,
    confirmedCount,
    pendingReviewCount,
    rejectedCount: 0,
    processingDurationMs: Date.now() - startedAt,
  })

  const holidayReturnId = await repos.learnerIntelligence.upsertHolidayReturn({
    student_id:       input.studentId,
    teacher_id:       input.teacherId,
    ingestion_run_id: run.id,
    term:             input.term,
    year:             input.academicYear,
    weeks_assigned:   input.weeksAssigned,
    weeks_completed:  input.weeksCompleted,
    teacher_comment:  input.teacherComment,
  })

  // Parent Delivery trigger (Adaptive Learning v2 Architecture §6) — fire
  // and forget, after the real intake has already succeeded.
  void notifyParentOfHolidayReturn({
    studentId: input.studentId, weeksAssigned: input.weeksAssigned,
    weeksCompleted: input.weeksCompleted, masteryClaims: input.masteryClaims,
  })

  return { ingestionRunId: run.id, confirmedCount, pendingReviewCount, holidayReturnId }
}
