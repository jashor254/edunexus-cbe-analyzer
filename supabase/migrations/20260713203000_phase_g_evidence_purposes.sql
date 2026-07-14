-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase G — Evidence Purposes
-- 2026-07-13
--
-- Implements docs/architecture/learner-record-layer-decisions.md Decision 2
-- (amended from learner-record-layer.md §3): a small, platform-governed
-- lookup table capturing educational MEANING, independent of whatever a
-- school calls an assessment type. Deliberately a lookup table, not a
-- Postgres ENUM (adding a purpose for a new curriculum region should be an
-- INSERT, not a migration), and deliberately general-scoped — purpose_id
-- lives on learner_evidence itself, not only on assessment_types, since
-- "educational meaning independent of the surface label" is not an
-- assessment-only concept.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EVIDENCE_PURPOSES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_purposes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text        UNIQUE NOT NULL,
  label      text        NOT NULL,
  applies_to text[]      NOT NULL DEFAULT '{}',  -- which evidence_source values this purpose is meaningful for; empty = unrestricted
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE evidence_purposes ENABLE ROW LEVEL SECURITY;

-- Platform-governed only, same shape as curriculum_versions
-- (20260713190000_phase_minus1_evidence_foundation.sql): readable by
-- everyone, writable by nobody except the service role.
CREATE POLICY "evidence_purposes_read_all"
  ON evidence_purposes FOR SELECT
  USING (true);

INSERT INTO evidence_purposes (code, label, applies_to) VALUES
  ('diagnostic', 'Diagnostic',  '{teacher_upload,csv_export,excel_import}'),
  ('formative',  'Formative',   '{teacher_upload,csv_export,excel_import,classroom_observation}'),
  ('summative',  'Summative',   '{teacher_upload,csv_export,excel_import,sms_api,lms_api}'),
  ('practice',   'Practice',    '{teacher_upload,csv_export,excel_import}'),
  ('practical',  'Practical',   '{teacher_upload,classroom_observation}')
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ASSESSMENT_TYPES — one-time purpose mapping, per school-configured type
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE assessment_types
  ADD COLUMN IF NOT EXISTS default_purpose_id uuid REFERENCES evidence_purposes(id);

-- Reasonable default mapping for the 6 previously-hardcoded, Phase-B-seeded
-- names only — a school customizing their own types later chooses their
-- own mapping (no UI for that yet, same "schema now, UI later" pattern as
-- every other phase this series). Not applied to any custom name a teacher
-- has already registered via resolve-or-create — those stay NULL until
-- deliberately set.
UPDATE assessment_types at
SET default_purpose_id = ep.id
FROM evidence_purposes ep
WHERE at.default_purpose_id IS NULL
  AND (
    (at.name = 'opener'     AND ep.code = 'diagnostic') OR
    (at.name = 'cat'        AND ep.code = 'formative')  OR
    (at.name = 'midterm'    AND ep.code = 'summative')  OR
    (at.name = 'endterm'    AND ep.code = 'summative')  OR
    (at.name = 'exam'       AND ep.code = 'summative')  OR
    (at.name = 'assignment' AND ep.code = 'practice')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LEARNER_EVIDENCE — purpose_id (fact, captured at write time)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE learner_evidence
  ADD COLUMN IF NOT EXISTS purpose_id uuid REFERENCES evidence_purposes(id);

CREATE INDEX IF NOT EXISTS idx_learner_evidence_purpose_id ON learner_evidence (purpose_id);

-- Protect purpose_id under the same fact-immutability trigger every other
-- fact column already has (mirrors the school_id/curriculum_version_id
-- extension in Phase -1 exactly — additive, not a redefinition).
CREATE OR REPLACE FUNCTION enforce_evidence_immutability() RETURNS trigger AS $$
DECLARE
  is_erasure boolean := (OLD.lifecycle_state <> 'erased' AND NEW.lifecycle_state = 'erased');
BEGIN
  IF NEW.learner_id                 IS DISTINCT FROM OLD.learner_id
     OR NEW.subject                 IS DISTINCT FROM OLD.subject
     OR NEW.raw_subject             IS DISTINCT FROM OLD.raw_subject
     OR NEW.cbc_level                IS DISTINCT FROM OLD.cbc_level
     OR NEW.assessment_type         IS DISTINCT FROM OLD.assessment_type
     OR NEW.academic_year           IS DISTINCT FROM OLD.academic_year
     OR NEW.term                    IS DISTINCT FROM OLD.term
     OR NEW.evidence_source         IS DISTINCT FROM OLD.evidence_source
     OR NEW.extraction_method       IS DISTINCT FROM OLD.extraction_method
     OR NEW.raw_input_ref           IS DISTINCT FROM OLD.raw_input_ref
     OR NEW.ingestion_run_id        IS DISTINCT FROM OLD.ingestion_run_id
     OR NEW.trust_tier              IS DISTINCT FROM OLD.trust_tier
     OR NEW.evidence_confidence     IS DISTINCT FROM OLD.evidence_confidence
     OR NEW.confidence_formula_version IS DISTINCT FROM OLD.confidence_formula_version
     OR NEW.created_at              IS DISTINCT FROM OLD.created_at
     OR NEW.school_id               IS DISTINCT FROM OLD.school_id
     OR NEW.curriculum_version_id   IS DISTINCT FROM OLD.curriculum_version_id
     OR NEW.purpose_id              IS DISTINCT FROM OLD.purpose_id
  THEN
    RAISE EXCEPTION 'learner_evidence factual columns are immutable (Evidence Domain Model invariant 2). Create superseding evidence instead of editing row %.', OLD.id;
  END IF;

  IF NOT is_erasure AND (
     NEW.extracted_name          IS DISTINCT FROM OLD.extracted_name
     OR NEW.extracted_external_id IS DISTINCT FROM OLD.extracted_external_id
     OR NEW.score                 IS DISTINCT FROM OLD.score
  ) THEN
    RAISE EXCEPTION 'learner_evidence factual columns are immutable (Evidence Domain Model invariant 2). Create superseding evidence instead of editing row %.', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
