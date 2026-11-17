// lib/assessments/reportCardProvenance.ts
//
// SEC-02A — who is allowed to be believed about a report-card (`assessments`)
// row, and what that row may become in the Evidence Domain.
//
// The threat this closes (SEC-01, NF-1)
// -------------------------------------
// `assessments.source` is written by the data owner: the live parent/learner
// page inserts the row from the browser with `source: 'parent'` chosen in
// JavaScript, and the deprecated `POST /api/assessments/create` used to copy a
// client-supplied `'teacher'` into a service-role insert. The evidence producer
// then read that stored label back and treated every value other than
// `'parent'` — `'teacher'`, NULL, a typo — as a TEACHER assessment: tier 3,
// auto-confirmed, eligible to establish verified academic proficiency.
//
// The rule now
// ------------
// A stored `assessments.source` value is DESCRIPTIVE METADATA, never proof of
// authority. Nothing a client can write into that column — and nothing the
// server cannot independently verify — may raise a row above the unverified,
// reported tier. This module therefore has exactly one trusted outcome for a
// report-card row: `parent_observation` (tier 1, below the auto-confirm
// threshold, always `pending_review`, never performance evidence).
//
// Teacher-authored assessment evidence is NOT produced from this table. It
// enters through the established, separately authorised teacher pathways that
// derive provenance from an authenticated, authorised workflow:
//   - the class gradebook (`lib/assessments/evidence.ts`, `teacher_upload`),
//   - teacher marking of assignments (`lib/assignments/evidence.ts`),
//   - auto-graded quizzes (`lib/quiz/quizEvidence.ts`).
// No code path authors `assessments` rows on behalf of a teacher, so there is
// no authentic teacher-authorship signal for this table to honour. If one is
// introduced it must be a server-side, verifiable marker (not this label) and
// a deliberate, reviewed addition here — fail closed until then.
//
// The stored label is still recorded on the evidence row (as an enumerated
// value, never the raw string) so an auditor can see what the client claimed.

/** What the stored `assessments.source` value claims. Descriptive only. */
export type ClaimedAssessmentSource = 'parent' | 'teacher' | 'unlabelled' | 'unrecognised'

/** The only evidence source a report-card row may produce. Explicit, not a default branch. */
export type ReportCardEvidenceSource = 'parent_observation'

export type ReportCardProvenance = {
  /** The trusted classification — independent of the claimed label. */
  evidenceSource: ReportCardEvidenceSource
  /** What the stored column claimed, normalised to a closed set for auditing. */
  claimedSource: ClaimedAssessmentSource
  /** Always false: a stored label is never accepted as proof of authority. */
  claimTrusted: false
  /** Audit marker persisted on the evidence row's `issues` (closed vocabulary). */
  issues: string[]
}

export function classifyClaimedSource(stored: unknown): ClaimedAssessmentSource {
  if (stored === null || stored === undefined) return 'unlabelled'
  if (typeof stored !== 'string') return 'unrecognised'
  const normalised = stored.trim()
  if (normalised === '') return 'unlabelled'
  if (normalised === 'parent') return 'parent'
  if (normalised === 'teacher') return 'teacher'
  return 'unrecognised'
}

/**
 * Resolves the provenance of one report-card row. Pure. The claimed label is
 * normalised for the audit trail only; it cannot change `evidenceSource`.
 */
export function resolveReportCardProvenance(storedSource: unknown): ReportCardProvenance {
  const claimedSource = classifyClaimedSource(storedSource)
  return {
    evidenceSource: 'parent_observation',
    claimedSource,
    claimTrusted: false,
    issues: [`assessment_source_claim_unverified:${claimedSource}`],
  }
}
