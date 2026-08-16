-- Column gaps discovered empirically while running security-hardening
-- phase6 (missing FK indexes) during H1M-SNAPSHOT-2. These columns are
-- live in production (confirmed via information_schema.columns) but
-- absent from every tracked migration / loose file that creates these
-- tables locally.

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS pathway_recommendations jsonb,
  ADD COLUMN IF NOT EXISTS curriculum_type text,
  ADD COLUMN IF NOT EXISTS assessment_style text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS raw_marks jsonb;

ALTER TABLE whatsapp_inbound_log
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES auth.users(id);
