-- Recovered from production migration 20260404113140_create_sow_curriculum_tables
-- (exact statement text, H1M-R2). True origin of the SOW cluster and
-- generation_jobs' dependency graph — NOT 20260530_sow_tables.sql or
-- 20260723100000_baseline_sow_curriculum_schema.sql, which are later,
-- largely redundant normalizations.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS sow_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curriculum_type TEXT NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sow_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level_id UUID NOT NULL REFERENCES sow_levels(id),
  name TEXT NOT NULL,
  numeric_grade INTEGER,
  order_index INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sow_learning_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade_id UUID NOT NULL REFERENCES sow_grades(id),
  name TEXT NOT NULL,
  short_name TEXT,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sow_strands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_area_id UUID NOT NULL REFERENCES sow_learning_areas(id),
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sow_substrands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strand_id UUID NOT NULL REFERENCES sow_strands(id),
  title TEXT NOT NULL,
  suggested_lessons INTEGER DEFAULT 4,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schemes_of_work (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  curriculum_type TEXT NOT NULL,
  school TEXT NOT NULL,
  grade_name TEXT NOT NULL,
  learning_area TEXT NOT NULL,
  term INTEGER NOT NULL CHECK (term IN (1,2,3)),
  year INTEGER NOT NULL,
  lessons_per_week INTEGER NOT NULL,
  status TEXT DEFAULT 'complete',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheme_lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id UUID NOT NULL REFERENCES schemes_of_work(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  lesson INTEGER NOT NULL,
  strand TEXT NOT NULL,
  substrand TEXT NOT NULL,
  learning_outcomes TEXT NOT NULL,
  learning_experiences TEXT NOT NULL,
  key_inquiry_questions TEXT NOT NULL,
  learning_resources TEXT NOT NULL,
  assessment_methods TEXT NOT NULL,
  core_competencies TEXT,
  values TEXT,
  reflection TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sow_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_learning_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_strands ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_substrands ENABLE ROW LEVEL SECURITY;
ALTER TABLE schemes_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheme_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sow_levels: public read" ON sow_levels FOR SELECT USING (TRUE);
CREATE POLICY "sow_grades: public read" ON sow_grades FOR SELECT USING (TRUE);
CREATE POLICY "sow_la: public read" ON sow_learning_areas FOR SELECT USING (TRUE);
CREATE POLICY "sow_strands: public read" ON sow_strands FOR SELECT USING (TRUE);
CREATE POLICY "sow_substrands: public read" ON sow_substrands FOR SELECT USING (TRUE);

CREATE POLICY "schemes: teacher own" ON schemes_of_work FOR ALL
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "scheme_lessons: own" ON scheme_lessons FOR ALL
  USING (scheme_id IN (
    SELECT id FROM schemes_of_work
    WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  ));

CREATE POLICY "sow_levels: service insert" ON sow_levels FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "sow_grades: service insert" ON sow_grades FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "sow_la: service insert" ON sow_learning_areas FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "sow_strands: service insert" ON sow_strands FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "sow_substrands: service insert" ON sow_substrands FOR INSERT WITH CHECK (TRUE);
