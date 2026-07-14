-- ═══════════════════════════════════════════════════════════════════════════════
-- Fix — ingestion_runs.source missing 'teacher_remark'
-- 2026-07-14
--
-- Objectively demonstrable production bug, found running Phase C's own
-- integration test (lib/remarks/evidence.integration.test.ts) against the
-- live database: Phase C (20260713210000_phase_c_teacher_remarks.sql)
-- widened learner_evidence.evidence_source's CHECK to add 'teacher_remark'
-- but missed the separate, identically-shaped CHECK on ingestion_runs.source
-- — the same two-constraints-must-move-together gap
-- 20260708_holiday_return_evidence_source.sql already fixed once for
-- 'holiday_return'. Every teacher-remark write calls
-- repos.evidence.createIngestionRun() first (lib/remarks/evidence.ts),
-- which fails outright without this. Additive only — every existing
-- allowed value is preserved.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE ingestion_runs DROP CONSTRAINT IF EXISTS ingestion_runs_source_check;
ALTER TABLE ingestion_runs ADD CONSTRAINT ingestion_runs_source_check
  CHECK (source = ANY (ARRAY[
    'csv_export', 'excel_import', 'report_card_photo', 'report_card_pdf',
    'sms_api', 'lms_api', 'teacher_upload', 'parent_observation',
    'compass_session', 'classroom_observation', 'national_dataset',
    'holiday_return', 'teacher_remark'
  ]::text[]));
