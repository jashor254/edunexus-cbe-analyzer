-- ADR-0024 Sprint A, Objective 1 — baseline the canonical curriculum spine
-- (sow_levels/sow_grades/sow_learning_areas/sow_strands/sow_substrands/
-- sow_learning_outcomes) into a repository migration for the first time.
--
-- These six tables were created directly against the live database, never
-- through a tracked migration (confirmed by grep across supabase/*.sql and
-- supabase/migrations/*.sql before writing this file — zero hits). This
-- migration is a faithful reproduction of the live schema, introspected
-- directly (information_schema.columns, table_constraints, pg_indexes,
-- pg_policies) immediately before writing it — not a redesign, not a
-- guess. Every statement is IF NOT EXISTS / OR REPLACE, so running this
-- against the current production database is a verified no-op; its
-- purpose is making a fresh environment (a new branch, a disaster-recovery
-- restore, a local dev setup) able to reproduce this schema, which is not
-- true today.
--
-- Two pre-existing oddities reproduced exactly, not silently fixed, per
-- "do not redesign it" — Objective 1 is reproducibility, not cleanup:
--   1. sow_learning_outcomes.substrand_id has NO foreign key constraint on
--      the live database — it's an untyped uuid column. This is the exact
--      mechanism behind ADR-0024's "~98% of learning-outcome rows don't
--      resolve" finding: there's no FK to violate, so an orphaned
--      substrand_id was always possible. Left un-enforced here on purpose
--      — adding a FK now could fail against real orphaned rows; that's a
--      data-integrity fix for ADR-0024 Phase D, not this migration.
--   2. sow_strands and sow_substrands each carry two functionally
--      identical indexes on the same FK column (idx_sow_strands_learning_area
--      / idx_sow_strands_learning_area_id, and the substrand equivalent).
--      Reproduced as-is for fidelity to the live database.

CREATE TABLE IF NOT EXISTS sow_levels (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  curriculum_type text       NOT NULL,
  name           text        NOT NULL,
  order_index    integer     NOT NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sow_grades (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  level_id       uuid        NOT NULL REFERENCES sow_levels(id),
  name           text        NOT NULL,
  numeric_grade  integer,
  order_index    integer     NOT NULL,
  is_active      boolean     DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sow_grades_level_id ON sow_grades (level_id);

CREATE TABLE IF NOT EXISTS sow_learning_areas (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade_id           uuid        NOT NULL REFERENCES sow_grades(id),
  name               text        NOT NULL,
  short_name         text,
  order_index        integer     NOT NULL,
  kicd_subject_data  jsonb       DEFAULT '{}'::jsonb,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sow_learning_areas_grade_id ON sow_learning_areas (grade_id);

CREATE TABLE IF NOT EXISTS sow_strands (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_area_id  uuid        NOT NULL REFERENCES sow_learning_areas(id),
  title             text        NOT NULL,
  order_index       integer     NOT NULL,
  source_type       text        DEFAULT 'kicd',
  kicd_data         jsonb       DEFAULT '[]'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sow_strands_learning_area    ON sow_strands (learning_area_id);
CREATE INDEX IF NOT EXISTS idx_sow_strands_learning_area_id ON sow_strands (learning_area_id);

CREATE TABLE IF NOT EXISTS sow_substrands (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  strand_id          uuid        NOT NULL REFERENCES sow_strands(id),
  title              text        NOT NULL,
  suggested_lessons  integer     DEFAULT 4,
  order_index        integer     NOT NULL,
  content            jsonb,
  source_type        text        DEFAULT 'kicd',
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sow_substrands_strand    ON sow_substrands (strand_id);
CREATE INDEX IF NOT EXISTS idx_sow_substrands_strand_id ON sow_substrands (strand_id);

CREATE TABLE IF NOT EXISTS sow_learning_outcomes (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- No FK — reproduced exactly as it exists on the live database. See
  -- header note 1.
  substrand_id   uuid,
  outcome        text        NOT NULL,
  outcome_type   text        DEFAULT 'knowledge',
  order_index    integer     DEFAULT 1,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sow_outcomes_substrand_id ON sow_learning_outcomes (substrand_id);

ALTER TABLE sow_levels             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_grades             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_learning_areas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_strands            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_substrands         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_learning_outcomes  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_levels' AND policyname = 'sow_levels: public read') THEN
    CREATE POLICY "sow_levels: public read" ON sow_levels FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_levels' AND policyname = 'sow_levels: service insert') THEN
    CREATE POLICY "sow_levels: service insert" ON sow_levels FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_grades' AND policyname = 'sow_grades: public read') THEN
    CREATE POLICY "sow_grades: public read" ON sow_grades FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_grades' AND policyname = 'sow_grades: service insert') THEN
    CREATE POLICY "sow_grades: service insert" ON sow_grades FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_learning_areas' AND policyname = 'sow_la: public read') THEN
    CREATE POLICY "sow_la: public read" ON sow_learning_areas FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_learning_areas' AND policyname = 'sow_la: service insert') THEN
    CREATE POLICY "sow_la: service insert" ON sow_learning_areas FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_strands' AND policyname = 'sow_strands: public read') THEN
    CREATE POLICY "sow_strands: public read" ON sow_strands FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_strands' AND policyname = 'sow_strands: service insert') THEN
    CREATE POLICY "sow_strands: service insert" ON sow_strands FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_substrands' AND policyname = 'sow_substrands: public read') THEN
    CREATE POLICY "sow_substrands: public read" ON sow_substrands FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_substrands' AND policyname = 'sow_substrands: service insert') THEN
    CREATE POLICY "sow_substrands: service insert" ON sow_substrands FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_learning_outcomes' AND policyname = 'sow_lo: public read') THEN
    CREATE POLICY "sow_lo: public read" ON sow_learning_outcomes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sow_learning_outcomes' AND policyname = 'sow_lo: service insert') THEN
    CREATE POLICY "sow_lo: service insert" ON sow_learning_outcomes FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Verified against the live database immediately before writing this file:
-- sow_levels=4, sow_grades=13, sow_learning_areas=195, sow_strands=1173,
-- sow_substrands=18789, sow_learning_outcomes=608 rows. This migration
-- creates no rows — data already exists in production; only the schema
-- was previously unreproducible.
