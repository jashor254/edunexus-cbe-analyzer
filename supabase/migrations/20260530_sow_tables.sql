-- 20260530_sow_tables.sql
--
-- Creates (or completes) the six tables in the SOW → Lesson Plan → ROW chain.
-- Safe to run on a fresh database OR one where the loose *.sql files were
-- previously applied: all statements use IF NOT EXISTS / IF NOT EXISTS guards.
--
-- Table ownership model:
--   schemes_of_work.teacher_id   → teachers.id
--   scheme_lessons               → secured via scheme_id FK
--   lesson_plans.teacher_id      → auth.users(id)  (routes pass user.id directly)
--   records_of_work.teacher_id   → teachers.id
--   row_entries                  → secured via row_id FK
--   generation_jobs.teacher_id   → auth.users(id)
--
-- Rollback (drop in reverse dependency order):
--   DROP TABLE IF EXISTS row_entries, generation_jobs, records_of_work,
--     lesson_plans, scheme_lessons, schemes_of_work CASCADE;
--   DROP FUNCTION IF EXISTS auth_teacher_id();

BEGIN;

-- ============================================================
-- HELPER FUNCTION
-- Returns the teachers.id for the current auth user.
-- SECURITY DEFINER + fixed search_path prevents injection.
-- ============================================================

CREATE OR REPLACE FUNCTION auth_teacher_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM teachers WHERE user_id = auth.uid()
$$;


-- ============================================================
-- schemes_of_work
-- ============================================================

CREATE TABLE IF NOT EXISTS schemes_of_work (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id         UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school             TEXT        NOT NULL DEFAULT '',
  grade              TEXT        NOT NULL DEFAULT '',
  learning_area      TEXT        NOT NULL DEFAULT '',
  term               TEXT        NOT NULL DEFAULT '1',
  year               INTEGER     NOT NULL,
  textbook           TEXT,
  curriculum_mode    TEXT        NOT NULL DEFAULT 'cbc',
  total_lessons      INTEGER     NOT NULL DEFAULT 0,
  total_weeks        INTEGER     NOT NULL DEFAULT 0,
  average_confidence NUMERIC,
  breaks             JSONB       NOT NULL DEFAULT '[]',
  -- lessons and timeline are stored as JSONB on the row so that the lesson
  -- plan generator can read the full structure in a single query, without
  -- an extra join to scheme_lessons.
  lessons            JSONB       NOT NULL DEFAULT '[]',
  timeline           JSONB       NOT NULL DEFAULT '[]',
  teacher_name       TEXT,
  tsc_number         TEXT,
  status             TEXT        NOT NULL DEFAULT 'saved'
                                 CHECK (status IN ('saved', 'draft', 'active', 'archived')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if the table was partially created by an earlier loose migration
ALTER TABLE schemes_of_work ADD COLUMN IF NOT EXISTS lessons      JSONB NOT NULL DEFAULT '[]';
ALTER TABLE schemes_of_work ADD COLUMN IF NOT EXISTS timeline     JSONB NOT NULL DEFAULT '[]';
ALTER TABLE schemes_of_work ADD COLUMN IF NOT EXISTS teacher_name TEXT;
ALTER TABLE schemes_of_work ADD COLUMN IF NOT EXISTS tsc_number   TEXT;
ALTER TABLE schemes_of_work ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE schemes_of_work ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schemes_of_work: own"          ON schemes_of_work;
DROP POLICY IF EXISTS "schemes_of_work: service role" ON schemes_of_work;

CREATE POLICY "schemes_of_work: own"
  ON schemes_of_work FOR ALL
  USING      (teacher_id = auth_teacher_id())
  WITH CHECK (teacher_id = auth_teacher_id());

CREATE POLICY "schemes_of_work: service role"
  ON schemes_of_work FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sow_teacher_id ON schemes_of_work(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sow_status     ON schemes_of_work(status);


-- ============================================================
-- scheme_lessons
-- ============================================================

CREATE TABLE IF NOT EXISTS scheme_lessons (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id             UUID        NOT NULL REFERENCES schemes_of_work(id) ON DELETE CASCADE,
  week                  INTEGER     NOT NULL,
  lesson                INTEGER     NOT NULL,
  strand                TEXT        NOT NULL DEFAULT '',
  substrand             TEXT        NOT NULL DEFAULT '',
  learning_outcomes     JSONB       NOT NULL DEFAULT '[]',
  learning_experiences  JSONB       NOT NULL DEFAULT '[]',
  key_inquiry_questions JSONB       NOT NULL DEFAULT '[]',
  learning_resources    JSONB       NOT NULL DEFAULT '[]',
  assessment_methods    JSONB       NOT NULL DEFAULT '[]',
  core_competencies     TEXT,
  values                TEXT,
  pci_links             TEXT,
  reflection            TEXT,
  confidence            NUMERIC,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (scheme_id, week, lesson)
);

ALTER TABLE scheme_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheme_lessons: own via sow"    ON scheme_lessons;
DROP POLICY IF EXISTS "scheme_lessons: service role"   ON scheme_lessons;

CREATE POLICY "scheme_lessons: own via sow"
  ON scheme_lessons FOR ALL
  USING (
    scheme_id IN (
      SELECT id FROM schemes_of_work WHERE teacher_id = auth_teacher_id()
    )
  )
  WITH CHECK (
    scheme_id IN (
      SELECT id FROM schemes_of_work WHERE teacher_id = auth_teacher_id()
    )
  );

CREATE POLICY "scheme_lessons: service role"
  ON scheme_lessons FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_scheme_lessons_scheme_id ON scheme_lessons(scheme_id);
CREATE INDEX IF NOT EXISTS idx_scheme_lessons_week      ON scheme_lessons(scheme_id, week, lesson);


-- ============================================================
-- lesson_plans
-- NOTE: teacher_id stores auth.users.id (not teachers.id) because
-- the generate routes pass user.id directly to weeklyGenerator.
-- ============================================================

CREATE TABLE IF NOT EXISTS lesson_plans (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id                   UUID        REFERENCES schemes_of_work(id) ON DELETE SET NULL,
  teacher_id               UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number              INTEGER     NOT NULL,
  lesson_number            INTEGER     NOT NULL,
  strand                   TEXT        NOT NULL DEFAULT '',
  sub_strand               TEXT        NOT NULL DEFAULT '',
  learning_outcomes        JSONB       NOT NULL DEFAULT '[]',
  key_inquiry_questions    JSONB       NOT NULL DEFAULT '[]',
  learning_resources       JSONB       NOT NULL DEFAULT '[]',
  organisation_of_learning TEXT,
  introduction             TEXT,
  step_1                   TEXT,
  step_2                   TEXT,
  step_3                   TEXT,
  conclusion               TEXT,
  extended_activities      TEXT,
  reflection               TEXT,
  status                   TEXT        NOT NULL DEFAULT 'generated'
                                        CHECK (status IN ('generated', 'edited', 'taught')),
  taught_date              DATE,
  generated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (sow_id, week_number, lesson_number)
);

-- Add missing columns if lesson_plans already exists from the loose migration
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

-- Drop both the old loose-migration policy and any new ones before recreating
DROP POLICY IF EXISTS "teacher_own_plans"      ON lesson_plans;
DROP POLICY IF EXISTS "lesson_plans: own"      ON lesson_plans;
DROP POLICY IF EXISTS "lesson_plans: service role" ON lesson_plans;

CREATE POLICY "lesson_plans: own"
  ON lesson_plans FOR ALL
  USING      (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "lesson_plans: service role"
  ON lesson_plans FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher_id  ON lesson_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_sow_id      ON lesson_plans(sow_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_week        ON lesson_plans(sow_id, week_number);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_status      ON lesson_plans(status);


-- ============================================================
-- records_of_work
-- ============================================================

CREATE TABLE IF NOT EXISTS records_of_work (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  scheme_id       UUID        REFERENCES schemes_of_work(id) ON DELETE SET NULL,
  school          TEXT        NOT NULL DEFAULT '',
  grade           TEXT        NOT NULL DEFAULT '',
  learning_area   TEXT        NOT NULL DEFAULT '',
  term            TEXT        NOT NULL DEFAULT '1',
  year            INTEGER     NOT NULL DEFAULT 2025,
  curriculum_mode TEXT,
  teacher_name    TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if the table was partially created
ALTER TABLE records_of_work ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE records_of_work ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all_row"         ON records_of_work;
DROP POLICY IF EXISTS "records_of_work: own"    ON records_of_work;
DROP POLICY IF EXISTS "records_of_work: service role" ON records_of_work;

CREATE POLICY "records_of_work: own"
  ON records_of_work FOR ALL
  USING      (teacher_id = auth_teacher_id())
  WITH CHECK (teacher_id = auth_teacher_id());

CREATE POLICY "records_of_work: service role"
  ON records_of_work FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_records_of_work_teacher_id ON records_of_work(teacher_id);
CREATE INDEX IF NOT EXISTS idx_records_of_work_scheme_id  ON records_of_work(scheme_id);


-- ============================================================
-- row_entries
-- ============================================================

CREATE TABLE IF NOT EXISTS row_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id      UUID        NOT NULL REFERENCES records_of_work(id) ON DELETE CASCADE,
  week        INTEGER     NOT NULL,
  lesson      INTEGER     NOT NULL DEFAULT 1,
  date_taught DATE,
  strand      TEXT        NOT NULL DEFAULT '',
  substrand   TEXT        NOT NULL DEFAULT '',
  reflection  TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (row_id, week, lesson)
);

-- Add missing columns if the table was partially created
ALTER TABLE row_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE row_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all_entries"     ON row_entries;
DROP POLICY IF EXISTS "row_entries: own via row" ON row_entries;
DROP POLICY IF EXISTS "row_entries: service role" ON row_entries;

CREATE POLICY "row_entries: own via row"
  ON row_entries FOR ALL
  USING (
    row_id IN (
      SELECT id FROM records_of_work WHERE teacher_id = auth_teacher_id()
    )
  )
  WITH CHECK (
    row_id IN (
      SELECT id FROM records_of_work WHERE teacher_id = auth_teacher_id()
    )
  );

CREATE POLICY "row_entries: service role"
  ON row_entries FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_row_entries_row_id ON row_entries(row_id);
CREATE INDEX IF NOT EXISTS idx_row_entries_week   ON row_entries(row_id, week, lesson);


-- ============================================================
-- generation_jobs
-- NOTE: teacher_id stores auth.users.id (same pattern as lesson_plans).
-- completed_at is nullable — set when a job finishes or fails.
-- ============================================================

CREATE TABLE IF NOT EXISTS generation_jobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  sow_id       UUID,
  week_number  INTEGER,
  status       TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if the table was partially created
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "generation_jobs: own"          ON generation_jobs;
DROP POLICY IF EXISTS "generation_jobs: service role" ON generation_jobs;

CREATE POLICY "generation_jobs: own"
  ON generation_jobs FOR ALL
  USING      (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "generation_jobs: service role"
  ON generation_jobs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_teacher_id  ON generation_jobs(teacher_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_sow_id      ON generation_jobs(sow_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status      ON generation_jobs(status);

COMMIT;
