-- ADR-0024 Sprint C, Objective 2 — register 'quiz_auto_grade' as its own
-- EvidenceSource at the database level, matching the TypeScript union in
-- lib/intelligence/evidence.ts. Deliberately its own tier (Tier 2) in
-- lib/intelligence/evidence.ts's EVIDENCE_SOURCE_TRUST_TIER — not a reuse
-- of teacher_upload (no per-answer human attestation) or compass_session
-- (deterministic index-equality grading against a teacher-authored,
-- teacher-approved correct_index, not probabilistic AI inference) — see
-- that file's own comment for the full reasoning. Purely additive: widens
-- an existing CHECK constraint, touches no existing row.

ALTER TABLE learner_evidence DROP CONSTRAINT IF EXISTS learner_evidence_evidence_source_check;

ALTER TABLE learner_evidence ADD CONSTRAINT learner_evidence_evidence_source_check
  CHECK (evidence_source = ANY (ARRAY[
    'csv_export'::text, 'excel_import'::text, 'report_card_photo'::text, 'report_card_pdf'::text,
    'sms_api'::text, 'lms_api'::text, 'teacher_upload'::text, 'parent_observation'::text,
    'compass_session'::text, 'classroom_observation'::text, 'national_dataset'::text,
    'holiday_return'::text, 'teacher_remark'::text, 'quiz_auto_grade'::text
  ]));

-- Same enum, same reason, on the ingestion_runs side (createIngestionRun
-- writes 'quiz_auto_grade' here too — confirmed via pg_constraint before
-- writing this migration, not assumed identical to learner_evidence's.
ALTER TABLE ingestion_runs DROP CONSTRAINT IF EXISTS ingestion_runs_source_check;

ALTER TABLE ingestion_runs ADD CONSTRAINT ingestion_runs_source_check
  CHECK (source = ANY (ARRAY[
    'csv_export'::text, 'excel_import'::text, 'report_card_photo'::text, 'report_card_pdf'::text,
    'sms_api'::text, 'lms_api'::text, 'teacher_upload'::text, 'parent_observation'::text,
    'compass_session'::text, 'classroom_observation'::text, 'national_dataset'::text,
    'holiday_return'::text, 'teacher_remark'::text, 'quiz_auto_grade'::text
  ]));
