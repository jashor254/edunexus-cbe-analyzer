-- Recovered from production migration 20260628100131_learning_intelligence_foundation.
-- No repo file exists. Needed by 20260707_holiday_plans_publish_gate.sql
-- (a real repo file) which assumes holiday_plans already exists.
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS knowledge_state       jsonb    DEFAULT '{}'  NOT NULL,
  ADD COLUMN IF NOT EXISTS capability_dimensions jsonb    DEFAULT '{}'  NOT NULL,
  ADD COLUMN IF NOT EXISTS career_signals        jsonb    DEFAULT '{}'  NOT NULL,
  ADD COLUMN IF NOT EXISTS engagement_patterns   jsonb    DEFAULT '{}'  NOT NULL,
  ADD COLUMN IF NOT EXISTS risk_flags            jsonb    DEFAULT '[]'  NOT NULL,
  ADD COLUMN IF NOT EXISTS formative_signals     jsonb    DEFAULT '[]'  NOT NULL,
  ADD COLUMN IF NOT EXISTS overall_risk_level    text     DEFAULT 'normal' NOT NULL
    CHECK (overall_risk_level IN ('normal', 'watch', 'at_risk', 'critical')),
  ADD COLUMN IF NOT EXISTS last_assessment_date  timestamptz,
  ADD COLUMN IF NOT EXISTS current_term          integer,
  ADD COLUMN IF NOT EXISTS current_year          integer;

CREATE INDEX IF NOT EXISTS idx_learner_profiles_student_id ON learner_profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_learner_profiles_risk_level ON learner_profiles(overall_risk_level);

ALTER TABLE learner_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view learner profiles for their students" ON learner_profiles;
CREATE POLICY "Teachers can view learner profiles for their students"
  ON learner_profiles FOR SELECT
  USING (
    student_id IN (
      SELECT cs.student_id FROM class_students cs
      JOIN teacher_classes tc ON tc.id = cs.class_id
      JOIN teachers t ON t.id = tc.teacher_id
      WHERE t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can view their own learner profile" ON learner_profiles;
CREATE POLICY "Students can view their own learner profile"
  ON learner_profiles FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role manages learner profiles" ON learner_profiles;
CREATE POLICY "Service role manages learner profiles"
  ON learner_profiles FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS nemis_code        text,
  ADD COLUMN IF NOT EXISTS county            text,
  ADD COLUMN IF NOT EXISTS school_type       text    DEFAULT 'secondary'
    CHECK (school_type IN ('primary', 'secondary', 'mixed', 'special')),
  ADD COLUMN IF NOT EXISTS contact_phone     text,
  ADD COLUMN IF NOT EXISTS contact_email     text,
  ADD COLUMN IF NOT EXISTS subscription_tier text    DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'basic', 'intelligence', 'full'));

CREATE TABLE IF NOT EXISTS school_teachers (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id  uuid NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  role       text DEFAULT 'subject_teacher'
    CHECK (role IN ('principal','deputy','head_of_department','class_teacher','subject_teacher')),
  joined_at  timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_school_teachers_school_id  ON school_teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_school_teachers_teacher_id ON school_teachers(teacher_id);
ALTER TABLE school_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view their own school association"
  ON school_teachers FOR SELECT
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Principals manage their school teachers"
  ON school_teachers FOR ALL
  USING (
    school_id IN (
      SELECT st.school_id FROM school_teachers st
      JOIN teachers t ON t.id = st.teacher_id
      WHERE t.user_id = auth.uid() AND st.role IN ('principal','deputy')
    )
  );

CREATE POLICY "Service role manages school teachers"
  ON school_teachers FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS formative_signals (
  id               uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id       uuid    NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_id         uuid    NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  sow_id           uuid    REFERENCES schemes_of_work(id),
  lesson_plan_id   uuid    REFERENCES lesson_plans(id),
  week_number      integer,
  lesson_number    integer,
  subject          text    NOT NULL,
  strand           text,
  sub_strand       text,
  got_it_ids       jsonb   DEFAULT '[]' NOT NULL,
  confused_ids     jsonb   DEFAULT '[]' NOT NULL,
  lost_ids         jsonb   DEFAULT '[]' NOT NULL,
  teacher_note     text,
  recorded_at      timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formative_signals_teacher_id ON formative_signals(teacher_id);
CREATE INDEX IF NOT EXISTS idx_formative_signals_class_id   ON formative_signals(class_id);
CREATE INDEX IF NOT EXISTS idx_formative_signals_sow_id     ON formative_signals(sow_id);
ALTER TABLE formative_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their own formative signals"
  ON formative_signals FOR ALL
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Service role manages formative signals"
  ON formative_signals FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS remedial_plans (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  sow_id       uuid    NOT NULL REFERENCES schemes_of_work(id) ON DELETE CASCADE,
  teacher_id   uuid    NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_id     uuid    REFERENCES teacher_classes(id),
  term         integer NOT NULL,
  year         integer NOT NULL,
  week_start   integer NOT NULL,
  week_end     integer NOT NULL,
  subject      text    NOT NULL,
  strand       text    NOT NULL,
  sub_strand   text    NOT NULL,
  groups       jsonb   DEFAULT '[]' NOT NULL,
  allocation   jsonb   DEFAULT '{}' NOT NULL,
  check_in_week integer,
  generated_at timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remedial_plans_sow_id     ON remedial_plans(sow_id);
CREATE INDEX IF NOT EXISTS idx_remedial_plans_teacher_id ON remedial_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_remedial_plans_class_id   ON remedial_plans(class_id);
ALTER TABLE remedial_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their own remedial plans"
  ON remedial_plans FOR ALL
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Service role manages remedial plans"
  ON remedial_plans FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS holiday_plans (
  id                uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id        uuid    NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id        uuid    REFERENCES teachers(id),
  school_id         uuid    REFERENCES schools(id),
  term              integer NOT NULL,
  year              integer NOT NULL,
  holiday_period    text    NOT NULL,
  holiday_days      integer NOT NULL DEFAULT 14,
  plan_data         jsonb   DEFAULT '{}' NOT NULL,
  whatsapp_sent     boolean DEFAULT false,
  whatsapp_sent_at  timestamptz,
  parent_opened_at  timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(student_id, term, year)
);

CREATE INDEX IF NOT EXISTS idx_holiday_plans_student_id ON holiday_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_holiday_plans_teacher_id ON holiday_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_holiday_plans_school_id  ON holiday_plans(school_id);
ALTER TABLE holiday_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage holiday plans for their students"
  ON holiday_plans FOR ALL
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

-- "Parents view their child holiday plans" policy omitted: references
-- students.parent_user_id, which does not exist in this schema (neither
-- locally nor apparently correctly in the source migration — students has
-- parent_email/parent_phone/parent_first_name, not a parent auth link
-- column under this name). Same class of bug as core_foundation's broken
-- view. Non-blocking — service role and teacher policies still apply.

CREATE POLICY "Service role manages holiday plans"
  ON holiday_plans FOR ALL USING (auth.role() = 'service_role');
