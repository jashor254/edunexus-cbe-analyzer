-- ═══════════════════════════════════════════════════════════════════════════════
-- EduNexus Core — Senior Secondary Extension
-- 2026-07-07
--
-- The Core school layer (20260629_core_foundation.sql) was scoped to
-- PP1–Grade 9 only. This migration extends the two global reference tables
-- (grades, subjects) to also cover CBC Senior School (Grade 10–12), so a
-- Senior School can be represented in the Core system — starting with the
-- EduNexus Reference School (Mwatate Ridge Senior School), the first school
-- seeded into this schema.
--
-- 100% additive: widens two CHECK constraints, adds reference rows. No
-- existing row, column, or constraint value is removed or altered.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Widen grades.category to allow 'senior_secondary'
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_category_check;
ALTER TABLE grades ADD CONSTRAINT grades_category_check CHECK (category IN (
  'pre_primary', 'lower_primary', 'upper_primary', 'junior_secondary', 'senior_secondary'));

INSERT INTO grades (name, code, level_order, category) VALUES
  ('Grade 10', 'G10', 12, 'senior_secondary'),
  ('Grade 11', 'G11', 13, 'senior_secondary'),
  ('Grade 12', 'G12', 14, 'senior_secondary')
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Widen subjects.category to allow 'senior_secondary'
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_category_check;
ALTER TABLE subjects ADD CONSTRAINT subjects_category_check CHECK (category IN (
  'pre_primary', 'primary', 'junior_secondary', 'senior_secondary'));

-- Seed: CBC Senior School subject catalogue, per the Reference School's
-- frozen Module 2 (Academic Structure) — compulsory subjects plus pathway
-- electives across STEM, Social Sciences, and Arts & Sports Science.
INSERT INTO subjects (name, code, category, is_core) VALUES
  -- Compulsory (all pathways)
  ('English',                          'SS-ENG',   'senior_secondary', true),
  ('Kiswahili',                        'SS-KIS',   'senior_secondary', true),
  ('Mathematics',                      'SS-MATH',  'senior_secondary', true),
  ('Community Service Learning',       'SS-CSL',   'senior_secondary', true),
  -- STEM pathway electives
  ('Physics',                          'SS-PHY',   'senior_secondary', false),
  ('Chemistry',                        'SS-CHEM',  'senior_secondary', false),
  ('Biology',                          'SS-BIO',   'senior_secondary', false),
  ('Computer Studies',                 'SS-COMP',  'senior_secondary', false),
  ('Agriculture',                      'SS-AGR',   'senior_secondary', false),
  -- Social Sciences pathway electives
  ('History',                          'SS-HIST',  'senior_secondary', false),
  ('Geography',                        'SS-GEO',   'senior_secondary', false),
  ('Christian Religious Education',    'SS-CRE',   'senior_secondary', false),
  ('Business Studies',                 'SS-BUS',   'senior_secondary', false),
  -- Arts & Sports Science pathway electives
  ('Music',                            'SS-MUS',   'senior_secondary', false),
  ('Art & Design',                     'SS-ART',   'senior_secondary', false),
  ('Sports Science',                   'SS-SPT',   'senior_secondary', false)
ON CONFLICT (code) DO NOTHING;
