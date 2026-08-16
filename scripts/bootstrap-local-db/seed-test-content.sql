-- Deterministic synthetic educational content seed (H1D-3C).
--
-- Distinct from and NEVER folded into scripts/bootstrap-local-db/run.sh's
-- schema bootstrap. That bootstrap reconstructs schema/security state only
-- (deliberately, per its own README) — this seeds the minimum canonical/
-- synthetic curriculum and Academy content a small number of DEEP tests
-- need to exist as real rows before they can run (curriculumContext,
-- assignmentSubstrandId, reflections.persist — see
-- docs/architecture/assurance-tiers.md's CONTENT_SEED_REQUIRED class).
--
-- Idempotent (every insert is ON CONFLICT DO NOTHING keyed on a natural
-- unique marker), synthetic/canonical only (a Grade 8 Mathematics strand
-- shape is real CBC structure, not fabricated; no personal data, no
-- production dump, no dependency on Mwatate Ridge or any other reference
-- school), local/test only by the same safety model as run.sh (this file
-- is applied by the same docker-exec-only pattern, never given a
-- connection-string parameter).

-- ── SOW hierarchy: Level -> Grade -> Learning Area -> Strand -> Sub-strand ──

INSERT INTO sow_levels (id, curriculum_type, name, order_index)
VALUES ('00000000-0000-4000-8000-000000000001', 'cbc_junior', 'Junior Secondary', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sow_grades (id, level_id, name, numeric_grade, order_index, is_active)
VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Grade 8', 8, 2, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sow_learning_areas (id, grade_id, name, short_name, order_index)
VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'Mathematics', 'Maths', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sow_strands (id, learning_area_id, title, order_index)
VALUES ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 'Numbers', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sow_substrands (id, strand_id, title, order_index)
VALUES
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', 'Whole Numbers', 1),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000004', 'Fractions', 2),
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000004', 'Decimals', 3),
  ('00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000004', 'Percentages', 4)
ON CONFLICT (id) DO NOTHING;

-- ── Academy: Module -> Lesson, Module -> Mission ────────────────────────────

INSERT INTO academy_modules (id, title, slug, phase, "order", description, published)
VALUES ('00000000-0000-4000-8000-000000000010', 'H1D-3C Synthetic Test Module', 'h1d3c-synthetic-test-module', 1, 1, 'Deterministic content-seed fixture, not real Academy content.', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO academy_lessons (id, module_id, title, "order", content)
VALUES ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000010', 'H1D-3C Synthetic Lesson', 1, 'Synthetic content-seed fixture.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO academy_missions (id, module_id, phase, title, description, instructions, mission_type)
VALUES ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000010', 1, 'H1D-3C Synthetic Mission', 'Deterministic content-seed fixture.', 'N/A', 'create')
ON CONFLICT (id) DO NOTHING;
