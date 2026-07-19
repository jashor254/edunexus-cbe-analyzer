// lib/intelligence/evidence.ts
// The shared LearnerEvidence model — per docs/architecture/intelligence-ingestion-engine.md
// §2 and docs/architecture/learner-intelligence-engineering-principles.md LI-2/LI-6.
// This is the one intermediate representation every ingestion source (CSV today,
// OCR/PDF/API sources later) normalizes into before anything is written to the
// Learner Intelligence Engine. No source-specific code downstream of extraction
// should know it came from a CSV row.

export type EvidenceSource =
  | 'csv_export'
  | 'excel_import'
  | 'report_card_photo'
  | 'report_card_pdf'
  | 'sms_api'
  | 'lms_api'
  | 'teacher_upload'
  | 'parent_observation'
  | 'compass_session'
  | 'classroom_observation'
  | 'national_dataset'
  | 'holiday_return'
  | 'teacher_remark'
  /** ADR-0024 Sprint C — deterministic auto-grading of a teacher-authored MCQ quiz. See EVIDENCE_SOURCE_TRUST_TIER for why this is its own source, not a reuse of teacher_upload or compass_session. */
  | 'quiz_auto_grade'

export type EvidenceReviewStatus =
  | 'auto_confirmed'
  | 'pending_review'
  | 'reviewed_confirmed'
  | 'reviewed_rejected'

export type CBCLevel = 1 | 2 | 3 | 4

export type LearnerEvidence = {
  /** Present once a learner has been resolved (see identityResolution.ts); null while pending. */
  learnerId: string | null
  /** Raw identity fields as extracted, kept regardless of resolution outcome — the audit trail. */
  extractedName: string
  extractedExternalId: string | null

  subject: string        // canonical, post-mapping (see subjectMapping.ts)
  rawSubject: string      // exactly what the source said, before mapping — kept for traceability
  score: number | null
  cbcLevel: CBCLevel | null

  assessmentType: 'term_exam' | 'cat' | 'assignment'
  academicYear: number
  term: number | null

  evidenceSource: EvidenceSource
  /** Frozen snapshot of the source's trust tier at creation time — never re-derived later (LI-6, invariant 7). */
  trustTier: 1 | 2 | 3
  /** 0-100. See confidence.ts for how this is computed. */
  evidenceConfidence: number
  /** Which extraction method/version produced this record — e.g. "csv_parser_v1". */
  extractionMethod: string
  reviewStatus: EvidenceReviewStatus

  /** Pointer to the originating artifact (e.g. "csv_row:14") — never re-parsed after ingestion, per LI-5. */
  rawInputRef: string
  importedAt: string

  /** Populated only if a validation/mapping/identity issue kept this out of auto-confirmation. */
  issues: string[]

  // ── Curriculum context (Projection V2.1, additive) ──────────────────────
  // Optional — most sources have no strand/substrand-level detail to offer.
  // Only set these when the producer genuinely knows them at creation time;
  // never inferred after the fact. See docs/architecture/migration-ledger.md.
  strand?: string | null
  subStrand?: string | null
  knowledgeNodeId?: string | null
  /** ADR-0024 Sprint B, additive — a real sow_substrands.id when the producer resolved one from a canonical curriculum picker (never fabricated/guessed from strand/subStrand text). Null on every row created before this sprint and on any producer whose source has no canonical anchor to offer. */
  subStrandId?: string | null

  // ── Phase -1 (learner-record-layer-signoff.md), additive ────────────────
  // Both optional: no resolution heuristic (teacher-school-text -> schools.id,
  // or a default curriculum version) is specified anywhere in the ratified
  // architecture, so none is invented here. Producers that already know
  // these values at creation time may set them; producers that don't leave
  // them null rather than guessing — same rule as strand/subStrand above.
  schoolId?: string | null
  curriculumVersionId?: string | null

  // ── Phase G (learner-record-layer-decisions.md Decision 2), additive ────
  // Educational meaning independent of the surface assessment-type label.
  // Optional, same rule as schoolId/curriculumVersionId above: only set
  // when the producer genuinely knows it (e.g. resolved from the
  // assessment's assessment_type_id -> assessment_types.default_purpose_id),
  // never guessed.
  purposeId?: string | null

  // ── Phase C (learner-record-layer-decisions.md Decision 1), additive ────
  // Shape-specific content for narrative/non-scored evidence, discriminated
  // by evidenceSource. One shared column (payload jsonb), not a new
  // nullable scalar column per source — see EvidencePayload below. Null for
  // measured (scored) evidence.
  payload?: EvidencePayload | null
}

/**
 * Discriminated by `kind`, which tracks evidenceSource (not 1:1 forever —
 * a source could in principle produce more than one payload shape). Every
 * variant carries its own `payloadVersion` so a future shape change is
 * detectable on already-written rows instead of requiring runtime shape
 * sniffing (learner-record-layer-adversarial-challenge.md: "add
 * payload_version... before the first row ships").
 */
export type EvidencePayload =
  | { kind: 'remark'; payloadVersion: 1; body: string }

/** LI-6: each source has a declared trust tier. Confidence scoring (confidence.ts) is capped by this. */
export const EVIDENCE_SOURCE_TRUST_TIER: Record<EvidenceSource, 1 | 2 | 3> = {
  teacher_upload:          3, // highest — a teacher directly attests to this data
  sms_api:                 3, // a school's own system of record
  lms_api:                 2,
  csv_export:              2,
  excel_import:            2,
  national_dataset:        2,
  classroom_observation:   2,
  // Adaptive Learning v2 Architecture §4/§7 (FROZEN): teacher-mediated intake
  // of returned holiday work — not teacher-administered (that would be tier
  // 3, like teacher_upload), not raw AI/self-report (tier 1). Matches
  // classroom_observation's precedent exactly: a teacher attesting to
  // something they reviewed, not something they personally set and scored.
  holiday_return:          2,
  report_card_pdf:         1, // requires extraction (future OCR) — inherently lower trust until reviewed
  report_card_photo:       1,
  compass_session:         1, // AI-inferred, per LI-3 — never equated with human-verified evidence
  parent_observation:      1,
  // Phase C (learner-record-layer-decisions.md Decision 1): same tier as
  // teacher_upload — a teacher directly attests to this observation, same
  // epistemic standing as a mark they entered themselves.
  teacher_remark:          3,
  // ADR-0024 Sprint C — deliberately its own tier, not a reuse of an
  // existing one. Not tier 3 (teacher_upload/teacher_remark): no teacher
  // looked at this specific answer and attested to it — the sprint's own
  // non-negotiable invariant is that machine-scored evidence must stay
  // distinguishable from teacher-verified evidence, and silently reusing
  // tier 3 would erase that distinction. Not tier 1 (compass_session/
  // report_card_*/parent_observation): those are probabilistic —
  // AI-inferred judgment or unverified self-report. A quiz auto-grade is
  // deterministic index equality against a correct_index a teacher
  // personally authored and approved (Phase 3a's mandatory review gate) —
  // categorically more reliable than an AI inference, even though no
  // teacher reviewed this particular submission. Tier 2 — same standing as
  // lms_api/csv_export: a trustworthy structured process, not a per-row
  // human attestation.
  quiz_auto_grade:         2,
}
