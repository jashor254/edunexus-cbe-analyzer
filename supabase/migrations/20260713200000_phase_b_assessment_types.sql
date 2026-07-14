-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase B — School/Teacher-Configurable Assessment Types
-- 2026-07-13
--
-- Implements docs/architecture/academic-evidence-layer.md §7 (Rule 5: never
-- hardcode assessment type names). `class_assessments.assessment_type` was
-- CHECK-constrained to exactly 6 values (exam/cat/midterm/endterm/opener/
-- assignment), mirrored in a Zod enum at the API layer — both must be
-- removed together, or removing only one is cosmetic (see decisions doc).
--
-- Backward compatible: every existing teacher is seeded with the current 6
-- values as their own real assessment_types rows, so nothing they could do
-- before this migration becomes unavailable after it. The teacher-facing
-- UI (app/teacher/classes/[classId]/assessments/page.tsx) still only ever
-- sends one of those 6 names via its dropdown — no UI work in this phase,
-- only the schema/API foundation for the next client (or a future UI) to
-- submit a genuinely custom name.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ASSESSMENT_TYPES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assessment_types (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid        REFERENCES schools(id),    -- reserved for post-School-Integration teachers; legacy teachers.school is free text with no FK yet, so this path is not wired up in this phase
  teacher_id uuid        REFERENCES teachers(id),
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, teacher_id, name)
);

CREATE INDEX IF NOT EXISTS idx_assessment_types_teacher_id ON assessment_types (teacher_id);
CREATE INDEX IF NOT EXISTS idx_assessment_types_school_id  ON assessment_types (school_id) WHERE school_id IS NOT NULL;

ALTER TABLE assessment_types ENABLE ROW LEVEL SECURITY;

-- Teacher-scoped rows: fully owned by the teacher (read/write). School-scoped
-- rows (school_id NOT NULL, teacher_id NULL) are read-only via RLS for now —
-- no legacy teacher-to-school membership check exists to safely authorize
-- writes to them yet (teachers.school is free text, not a real FK). Writing
-- that authorization is a School Integration Pipeline concern, not this
-- migration's.
CREATE POLICY "assessment_types_own_teacher_rw"
  ON assessment_types FOR ALL
  USING (
    teacher_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM teachers t WHERE t.id = assessment_types.teacher_id AND t.user_id = auth.uid())
  )
  WITH CHECK (
    teacher_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM teachers t WHERE t.id = assessment_types.teacher_id AND t.user_id = auth.uid())
  );

CREATE POLICY "assessment_types_school_scoped_read_only"
  ON assessment_types FOR SELECT
  USING (school_id IS NOT NULL);

-- Backward-compatible backfill: every existing teacher gets their own copy
-- of the 6 previously-hardcoded values, so nothing they could do before
-- this migration becomes unavailable after it. Names use the EXACT casing
-- the existing Zod enum and DB CHECK constraint used (lowercase) — the
-- current UI (app/teacher/classes/[classId]/assessments/page.tsx) submits
-- these exact strings, so resolve-or-create lookups match on first try,
-- with no case-insensitive matching logic needed anywhere downstream.
INSERT INTO assessment_types (teacher_id, name, sort_order)
SELECT t.id, v.name, v.sort_order
FROM teachers t
CROSS JOIN (VALUES
  ('opener', 0), ('cat', 1), ('midterm', 2), ('endterm', 3), ('exam', 4), ('assignment', 5)
) AS v(name, sort_order)
ON CONFLICT (school_id, teacher_id, name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CLASS_ASSESSMENTS — drop the hardcoded CHECK, add the FK column
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE class_assessments DROP CONSTRAINT IF EXISTS class_assessments_assessment_type_check;

ALTER TABLE class_assessments
  ADD COLUMN IF NOT EXISTS assessment_type_id uuid REFERENCES assessment_types(id);
  -- assessment_type (text) column is kept, unconstrained, for backward read
  -- compatibility during rollout — dropped in a later migration once every
  -- reader is migrated to assessment_type_id, per the ratified rollout plan.

CREATE INDEX IF NOT EXISTS idx_class_assessments_assessment_type_id ON class_assessments (assessment_type_id);

-- Backfill assessment_type_id for every existing class_assessments row by
-- matching its current free-text assessment_type against the just-seeded
-- per-teacher assessment_types row of the same (lowercased) name — leaving
-- existing rows permanently unlinked would be a half-finished migration.
UPDATE class_assessments ca
SET assessment_type_id = at.id
FROM assessment_types at
WHERE at.teacher_id = ca.teacher_id
  AND lower(at.name) = lower(ca.assessment_type)
  AND ca.assessment_type_id IS NULL;
