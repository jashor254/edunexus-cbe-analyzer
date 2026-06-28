-- ═══════════════════════════════════════════════════════════════════════════════
-- EduNexus Core — Foundation Migration
-- 2026-06-29
--
-- Comprehensive school management layer for PP1–Grade 9 schools.
-- 100% additive — zero modifications to existing OS tables or logic.
--
-- New tables (16):
--   academic_years, terms, school_settings, grades, streams,
--   subjects, grade_subjects, class_subjects, school_users,
--   learners, learner_guardians, learner_enrollments,
--   learner_promotions, learner_transfers,
--   term_subject_summaries, school_report_cards
--
-- Extended tables (2 — ADD COLUMN only, no existing column touched):
--   schools  → sub_county, ward, address, logo_url, motto, is_active
--   classes  → grade_id, stream_id, class_teacher_id, capacity,
--              display_name, academic_year_id
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTEND EXISTING TABLES (additive only)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS sub_county  text,
  ADD COLUMN IF NOT EXISTS ward        text,
  ADD COLUMN IF NOT EXISTS address     text,
  ADD COLUMN IF NOT EXISTS logo_url    text,
  ADD COLUMN IF NOT EXISTS motto       text,
  ADD COLUMN IF NOT EXISTS is_active   boolean NOT NULL DEFAULT true;

-- classes gets FK columns after we create grades/streams/school_users below
-- (done at the bottom of this file)


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ACADEMIC YEARS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS academic_years (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name         text        NOT NULL,        -- "2026"
  start_date   date        NOT NULL,
  end_date     date        NOT NULL,
  is_current   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_academic_years_school_id  ON academic_years (school_id);
CREATE INDEX IF NOT EXISTS idx_academic_years_is_current ON academic_years (school_id, is_current) WHERE is_current = true;

ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academic_years_school_users"
  ON academic_years FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = academic_years.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TERMS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS terms (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id uuid        NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_number      int         NOT NULL CHECK (term_number IN (1, 2, 3)),
  name             text        NOT NULL,    -- "Term 1 2026"
  start_date       date        NOT NULL,
  end_date         date        NOT NULL,
  is_current       boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id, term_number)
);

CREATE INDEX IF NOT EXISTS idx_terms_school_id        ON terms (school_id);
CREATE INDEX IF NOT EXISTS idx_terms_academic_year_id ON terms (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_terms_is_current       ON terms (school_id, is_current) WHERE is_current = true;

ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terms_school_users"
  ON terms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = terms.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SCHOOL SETTINGS
--    One row per school. intelligence_enabled = the bridge to OS modules.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id               uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE UNIQUE,
  curriculum_type         text        NOT NULL DEFAULT 'cbc'
                            CHECK (curriculum_type IN ('cbc', '844', 'igcse')),
  cbc_levels              jsonb       NOT NULL DEFAULT '["EE","ME","AE","BE"]',
  grade_boundaries        jsonb       NOT NULL DEFAULT
                            '{"EE":{"min":75},"ME":{"min":50},"AE":{"min":25},"BE":{"min":0}}',
  school_open_days        int         NOT NULL DEFAULT 5,
  report_footer           text,
  -- Intelligence Bridge: flip to true when school pays for OS intelligence
  intelligence_enabled    boolean     NOT NULL DEFAULT false,
  intelligence_enabled_at timestamptz,
  sms_enabled             boolean     NOT NULL DEFAULT false,
  timezone                text        NOT NULL DEFAULT 'Africa/Nairobi',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_settings_school_id ON school_settings (school_id);

ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_settings_admin_only"
  ON school_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = school_settings.school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher')
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. GRADES — global CBC catalogue, seeded once
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grades (
  id           uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text  NOT NULL,              -- "Grade 7"
  code         text  NOT NULL UNIQUE,       -- "G7"
  level_order  int   NOT NULL UNIQUE,       -- 1–11, drives sort order
  category     text  NOT NULL CHECK (category IN (
                 'pre_primary', 'lower_primary', 'upper_primary', 'junior_secondary')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed: full CBC ladder PP1 → Grade 9
INSERT INTO grades (name, code, level_order, category) VALUES
  ('PP1',     'PP1', 1,  'pre_primary'),
  ('PP2',     'PP2', 2,  'pre_primary'),
  ('Grade 1', 'G1',  3,  'lower_primary'),
  ('Grade 2', 'G2',  4,  'lower_primary'),
  ('Grade 3', 'G3',  5,  'lower_primary'),
  ('Grade 4', 'G4',  6,  'upper_primary'),
  ('Grade 5', 'G5',  7,  'upper_primary'),
  ('Grade 6', 'G6',  8,  'upper_primary'),
  ('Grade 7', 'G7',  9,  'junior_secondary'),
  ('Grade 8', 'G8',  10, 'junior_secondary'),
  ('Grade 9', 'G9',  11, 'junior_secondary')
ON CONFLICT (code) DO NOTHING;

-- Grades are global read-only reference data — no RLS needed
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grades_public_read" ON grades FOR SELECT USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. STREAMS — per school (Eagles, Lions, A, B, Blue, Gold …)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS streams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_streams_school_id ON streams (school_id);

ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streams_school_users"
  ON streams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = streams.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SCHOOL USERS — full role matrix for Core schools
--    Distinct from school_teachers (OS teacher-school link — untouched)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN (
                'school_admin', 'headteacher', 'deputy_headteacher',
                'teacher', 'parent')),
  is_active   boolean     NOT NULL DEFAULT true,
  invited_by  uuid        REFERENCES auth.users(id),
  joined_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_school_users_school_id ON school_users (school_id);
CREATE INDEX IF NOT EXISTS idx_school_users_user_id   ON school_users (user_id);
CREATE INDEX IF NOT EXISTS idx_school_users_role      ON school_users (school_id, role);

ALTER TABLE school_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_users_own_school"
  ON school_users FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = school_users.school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher')
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. EXTEND classes — FK columns alongside existing text columns
--    Existing columns (grade int, stream text) stay — OS routes unchanged
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS grade_id         uuid REFERENCES grades(id),
  ADD COLUMN IF NOT EXISTS stream_id        uuid REFERENCES streams(id),
  ADD COLUMN IF NOT EXISTS class_teacher_id uuid REFERENCES school_users(id),
  ADD COLUMN IF NOT EXISTS capacity         int,
  ADD COLUMN IF NOT EXISTS display_name     text,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES academic_years(id);

CREATE INDEX IF NOT EXISTS idx_classes_grade_id         ON classes (grade_id);
CREATE INDEX IF NOT EXISTS idx_classes_stream_id        ON classes (stream_id);
CREATE INDEX IF NOT EXISTS idx_classes_academic_year_id ON classes (academic_year_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SUBJECTS — global CBC catalogue, seeded once
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subjects (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text  NOT NULL,
  code        text  NOT NULL UNIQUE,
  category    text  NOT NULL CHECK (category IN ('pre_primary', 'primary', 'junior_secondary')),
  is_core     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed: CBC subject catalogue
INSERT INTO subjects (name, code, category, is_core) VALUES
  -- Pre-Primary (PP1–PP2)
  ('Mathematical Activities',          'PP-MATH',  'pre_primary',      true),
  ('Language Activities',              'PP-LANG',  'pre_primary',      true),
  ('Environmental Activities',         'PP-ENV',   'pre_primary',      true),
  ('Psychomotor & Creative Activities','PP-PSYC',  'pre_primary',      true),
  ('Religious Education Activities',   'PP-RE',    'pre_primary',      false),
  -- Lower Primary (Grade 1–3)
  ('Mathematics',                      'LP-MATH',  'primary',          true),
  ('English Activities',               'LP-ENG',   'primary',          true),
  ('Kiswahili Language Activities',    'LP-KIS',   'primary',          true),
  ('Environmental Activities',         'LP-ENV',   'primary',          true),
  ('Creative Arts',                    'LP-CRE',   'primary',          true),
  ('Religious Education',              'LP-RE',    'primary',          false),
  -- Upper Primary (Grade 4–6)
  ('Mathematics',                      'UP-MATH',  'primary',          true),
  ('English',                          'UP-ENG',   'primary',          true),
  ('Kiswahili',                        'UP-KIS',   'primary',          true),
  ('Integrated Science',               'UP-SCI',   'primary',          true),
  ('Social Studies',                   'UP-SST',   'primary',          true),
  ('Creative Arts & Sports',           'UP-CRE',   'primary',          true),
  ('Agriculture',                      'UP-AGR',   'primary',          false),
  ('Home Science',                     'UP-HSC',   'primary',          false),
  ('Religious Education',              'UP-RE',    'primary',          false),
  -- Junior Secondary (Grade 7–9)
  ('Mathematics',                      'JS-MATH',  'junior_secondary', true),
  ('English',                          'JS-ENG',   'junior_secondary', true),
  ('Kiswahili',                        'JS-KIS',   'junior_secondary', true),
  ('Integrated Science',               'JS-SCI',   'junior_secondary', true),
  ('Social Studies',                   'JS-SST',   'junior_secondary', true),
  ('Creative Arts & Sports',           'JS-CRE',   'junior_secondary', true),
  ('Pre-Technical Studies',            'JS-PTS',   'junior_secondary', true),
  ('Agriculture & Nutrition',          'JS-AGN',   'junior_secondary', false),
  ('Business Studies',                 'JS-BUS',   'junior_secondary', false),
  ('Christian Religious Education',    'JS-CRE2',  'junior_secondary', false),
  ('Islamic Religious Education',      'JS-IRE',   'junior_secondary', false),
  ('Hindu Religious Education',        'JS-HRE',   'junior_secondary', false)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects_public_read" ON subjects FOR SELECT USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. GRADE SUBJECTS — which subjects a school offers per grade
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grade_subjects (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_id       uuid        NOT NULL REFERENCES grades(id),
  subject_id     uuid        NOT NULL REFERENCES subjects(id),
  is_compulsory  boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, grade_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_grade_subjects_school_id  ON grade_subjects (school_id);
CREATE INDEX IF NOT EXISTS idx_grade_subjects_grade_id   ON grade_subjects (grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_subjects_subject_id ON grade_subjects (subject_id);

ALTER TABLE grade_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_subjects_school_users"
  ON grade_subjects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = grade_subjects.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. CLASS SUBJECTS — teacher assigned to a subject in a class
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS class_subjects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id    uuid        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id  uuid        NOT NULL REFERENCES subjects(id),
  teacher_id  uuid        NOT NULL REFERENCES school_users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_class_subjects_school_id  ON class_subjects (school_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_class_id   ON class_subjects (class_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_teacher_id ON class_subjects (teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_subject_id ON class_subjects (subject_id);

ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_subjects_school_users"
  ON class_subjects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = class_subjects.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. LEARNERS — school registry
--     Distinct from OS `students` (app accounts). A learner is a school record.
--     Optional future bridge: students.learner_id → learners.id
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learners (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  admission_number text        NOT NULL,
  upi              text,                    -- NEMIS Unique Pupil Identifier
  first_name       text        NOT NULL,
  middle_name      text,
  last_name        text        NOT NULL,
  date_of_birth    date,
  gender           text        CHECK (gender IN ('male', 'female', 'other')),
  photo_url        text,
  nationality      text        NOT NULL DEFAULT 'Kenyan',
  county_of_origin text,
  special_needs    text[]      NOT NULL DEFAULT '{}',
  status           text        NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'transferred', 'graduated', 'archived', 'deceased')),
  admission_date   date        NOT NULL DEFAULT CURRENT_DATE,
  graduation_date  date,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, admission_number)
);

CREATE INDEX IF NOT EXISTS idx_learners_school_id        ON learners (school_id);
CREATE INDEX IF NOT EXISTS idx_learners_status           ON learners (school_id, status);
CREATE INDEX IF NOT EXISTS idx_learners_upi              ON learners (upi) WHERE upi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learners_admission_number ON learners (school_id, admission_number);
CREATE INDEX IF NOT EXISTS idx_learners_name             ON learners (school_id, last_name, first_name);

ALTER TABLE learners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learners_school_staff"
  ON learners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learners.school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
        AND su.is_active = true
    )
  );

CREATE POLICY "learners_parent_own_child"
  ON learners FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_guardians lg
      WHERE lg.learner_id = learners.id
        AND lg.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. LEARNER GUARDIANS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_guardians (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  learner_id          uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  user_id             uuid        REFERENCES auth.users(id),  -- if guardian has app account
  relationship        text        NOT NULL CHECK (relationship IN (
                        'father', 'mother', 'guardian', 'grandparent', 'sibling', 'other')),
  full_name           text        NOT NULL,
  phone               text        NOT NULL,
  email               text,
  national_id         text,
  is_primary          boolean     NOT NULL DEFAULT false,
  can_receive_reports boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_guardians_learner_id ON learner_guardians (learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_guardians_school_id  ON learner_guardians (school_id);
CREATE INDEX IF NOT EXISTS idx_learner_guardians_user_id    ON learner_guardians (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE learner_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_guardians_school_staff"
  ON learner_guardians FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_guardians.school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
        AND su.is_active = true
    )
  );

CREATE POLICY "learner_guardians_own_record"
  ON learner_guardians FOR SELECT
  USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 13. LEARNER ENROLLMENTS — learner in class per term
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_enrollments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  learner_id       uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  class_id         uuid        NOT NULL REFERENCES classes(id),
  term_id          uuid        NOT NULL REFERENCES terms(id),
  academic_year_id uuid        NOT NULL REFERENCES academic_years(id),
  enrollment_date  date        NOT NULL DEFAULT CURRENT_DATE,
  status           text        NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'withdrawn', 'transferred')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_learner_enrollments_school_id        ON learner_enrollments (school_id);
CREATE INDEX IF NOT EXISTS idx_learner_enrollments_learner_id       ON learner_enrollments (learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_enrollments_class_id         ON learner_enrollments (class_id);
CREATE INDEX IF NOT EXISTS idx_learner_enrollments_term_id          ON learner_enrollments (term_id);
CREATE INDEX IF NOT EXISTS idx_learner_enrollments_academic_year_id ON learner_enrollments (academic_year_id);

ALTER TABLE learner_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_enrollments_school_staff"
  ON learner_enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_enrollments.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 14. LEARNER PROMOTIONS — full audit trail of every promotion decision
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_promotions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  learner_id            uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  from_class_id         uuid        NOT NULL REFERENCES classes(id),
  to_class_id           uuid        REFERENCES classes(id),   -- null = graduated out
  from_academic_year_id uuid        NOT NULL REFERENCES academic_years(id),
  to_academic_year_id   uuid        REFERENCES academic_years(id),
  promotion_type        text        NOT NULL CHECK (promotion_type IN (
                          'promoted', 'repeated', 'graduated')),
  processed_by          uuid        NOT NULL REFERENCES school_users(id),
  notes                 text,
  promoted_at           timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_promotions_school_id  ON learner_promotions (school_id);
CREATE INDEX IF NOT EXISTS idx_learner_promotions_learner_id ON learner_promotions (learner_id);

ALTER TABLE learner_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_promotions_school_staff"
  ON learner_promotions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_promotions.school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher')
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 15. LEARNER TRANSFERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_transfers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id      uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  from_school_id  uuid        NOT NULL REFERENCES schools(id),
  to_school_id    uuid        REFERENCES schools(id),   -- null = external school
  to_school_name  text,                                  -- free text if external
  direction       text        NOT NULL CHECK (direction IN ('in', 'out')),
  transfer_date   date        NOT NULL,
  reason          text,
  document_urls   text[]      NOT NULL DEFAULT '{}',
  processed_by    uuid        NOT NULL REFERENCES school_users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_transfers_learner_id     ON learner_transfers (learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_transfers_from_school_id ON learner_transfers (from_school_id);
CREATE INDEX IF NOT EXISTS idx_learner_transfers_to_school_id   ON learner_transfers (to_school_id) WHERE to_school_id IS NOT NULL;

ALTER TABLE learner_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_transfers_school_staff"
  ON learner_transfers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_transfers.from_school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher')
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 16. EXTEND class_assessments — Core assessment config columns
--     Existing columns (class_id, teacher_id, title, subjects array …) untouched
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE class_assessments
  ADD COLUMN IF NOT EXISTS weight_percent numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS grading_type   text    NOT NULL DEFAULT 'both'
                             CHECK (grading_type IN ('marks', 'cbc_level', 'both')),
  ADD COLUMN IF NOT EXISTS is_published   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grade_id       uuid    REFERENCES grades(id);

CREATE INDEX IF NOT EXISTS idx_class_assessments_grade_id ON class_assessments (grade_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 17. TERM SUBJECT SUMMARIES
--     Computed after each assessment — drives report cards and intelligence
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS term_subject_summaries (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  learner_id        uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  term_id           uuid        NOT NULL REFERENCES terms(id),
  class_id          uuid        NOT NULL REFERENCES classes(id),
  subject_id        uuid        NOT NULL REFERENCES subjects(id),
  weighted_score    numeric(5,2),
  cbc_level         text        CHECK (cbc_level IN ('EE', 'ME', 'AE', 'BE')),
  position_in_class int,
  teacher_comment   text,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, term_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_term_subject_summaries_school_id  ON term_subject_summaries (school_id);
CREATE INDEX IF NOT EXISTS idx_term_subject_summaries_learner_id ON term_subject_summaries (learner_id);
CREATE INDEX IF NOT EXISTS idx_term_subject_summaries_term_id    ON term_subject_summaries (term_id);
CREATE INDEX IF NOT EXISTS idx_term_subject_summaries_class_id   ON term_subject_summaries (class_id);
CREATE INDEX IF NOT EXISTS idx_term_subject_summaries_subject_id ON term_subject_summaries (subject_id);

ALTER TABLE term_subject_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "term_subject_summaries_school_staff"
  ON term_subject_summaries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = term_subject_summaries.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "term_subject_summaries_parent_own_child"
  ON term_subject_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_guardians lg
      WHERE lg.learner_id = term_subject_summaries.learner_id
        AND lg.user_id = auth.uid()
        AND lg.can_receive_reports = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 18. SCHOOL REPORT CARDS
--     Distinct from academic_reports (OS Career Intelligence — untouched)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_report_cards (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  learner_id            uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  term_id               uuid        NOT NULL REFERENCES terms(id),
  class_id              uuid        NOT NULL REFERENCES classes(id),
  overall_score         numeric(5,2),
  overall_cbc_level     text        CHECK (overall_cbc_level IN ('EE', 'ME', 'AE', 'BE')),
  position_in_class     int,
  total_learners        int,
  days_present          int,
  days_absent           int,
  class_teacher_comment text,
  headteacher_comment   text,
  pdf_url               text,
  is_published          boolean     NOT NULL DEFAULT false,
  published_at          timestamptz,
  generated_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_school_report_cards_school_id  ON school_report_cards (school_id);
CREATE INDEX IF NOT EXISTS idx_school_report_cards_learner_id ON school_report_cards (learner_id);
CREATE INDEX IF NOT EXISTS idx_school_report_cards_term_id    ON school_report_cards (term_id);
CREATE INDEX IF NOT EXISTS idx_school_report_cards_class_id   ON school_report_cards (class_id);
CREATE INDEX IF NOT EXISTS idx_school_report_cards_published  ON school_report_cards (is_published, term_id) WHERE is_published = true;

ALTER TABLE school_report_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_report_cards_staff"
  ON school_report_cards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = school_report_cards.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "school_report_cards_parent_published"
  ON school_report_cards FOR SELECT
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM learner_guardians lg
      WHERE lg.learner_id = school_report_cards.learner_id
        AND lg.user_id = auth.uid()
        AND lg.can_receive_reports = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 19. UPDATED_AT TRIGGERS — all new tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'academic_years', 'terms', 'school_settings', 'grades', 'streams',
    'subjects', 'grade_subjects', 'class_subjects', 'school_users',
    'learners', 'learner_guardians', 'learner_enrollments',
    'learner_promotions', 'learner_transfers',
    'term_subject_summaries', 'school_report_cards'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
       CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t, t, t, t
    );
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 20. INTELLIGENCE BRIDGE VIEW
--     When school_settings.intelligence_enabled = true, this view exposes
--     the OS learner_profiles to Core consumers. Zero table changes.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW core_learner_intelligence AS
  SELECT
    l.id           AS learner_id,
    l.school_id,
    lp.overall_risk_level,
    lp.knowledge_state,
    lp.capability_dimensions,
    lp.confirmed_gaps,
    lp.persistent_gaps,
    lp.pathway_readiness,
    lp.learning_behaviour,
    lp.growth_milestones,
    lp.last_assessment_date,
    lp.updated_at  AS intelligence_updated_at
  FROM learners l
  JOIN students s  ON s.id = lp.student_id          -- bridge when linked
  JOIN learner_profiles lp ON lp.student_id = s.id
  JOIN school_settings ss  ON ss.school_id = l.school_id
  WHERE ss.intelligence_enabled = true;

COMMENT ON VIEW core_learner_intelligence IS
  'Read-only bridge: Core learners → OS intelligence. Only visible when school pays for intelligence module.';
