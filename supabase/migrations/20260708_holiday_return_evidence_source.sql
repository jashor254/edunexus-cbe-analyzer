-- Adaptive Learning v2 Architecture §4/§7 (FROZEN) added a new
-- EvidenceSource value, 'holiday_return', to lib/intelligence/evidence.ts's
-- TypeScript union — but the DB CHECK constraints on
-- ingestion_runs.source and learner_evidence.evidence_source (added when
-- the Evidence Domain shipped, 20260707_evidence_domain.sql) enumerate the
-- allowed values explicitly and were not aware of it. Additive only —
-- every existing allowed value is preserved.

ALTER TABLE ingestion_runs DROP CONSTRAINT ingestion_runs_source_check;
ALTER TABLE ingestion_runs ADD CONSTRAINT ingestion_runs_source_check
  CHECK (source = ANY (ARRAY[
    'csv_export', 'excel_import', 'report_card_photo', 'report_card_pdf',
    'sms_api', 'lms_api', 'teacher_upload', 'parent_observation',
    'compass_session', 'classroom_observation', 'national_dataset',
    'holiday_return'
  ]::text[]));

ALTER TABLE learner_evidence DROP CONSTRAINT learner_evidence_evidence_source_check;
ALTER TABLE learner_evidence ADD CONSTRAINT learner_evidence_evidence_source_check
  CHECK (evidence_source = ANY (ARRAY[
    'csv_export', 'excel_import', 'report_card_photo', 'report_card_pdf',
    'sms_api', 'lms_api', 'teacher_upload', 'parent_observation',
    'compass_session', 'classroom_observation', 'national_dataset',
    'holiday_return'
  ]::text[]));
