-- Phase 1B — explicit institutional -> legacy assignment-class compatibility
-- bridge.
--
-- THE GAP THIS CLOSES
-- Phase 1 (docs/architecture/teaching-assignment-legacy-boundary.md) proved
-- `class_subjects` is the canonical institutional teaching assignment, but
-- `assignments.class_id` still points at legacy `teacher_classes.id`, and no
-- deterministic mapping exists from a current institutional teaching tenure
-- to the legacy class row the assignment/submission/evidence pipeline still
-- requires. The only existing mapping (`lib/core/academicBridge.ts`,
-- `teacher_classes.external_id`) is explicitly documented as temporary,
-- forbidden to new callers, keyed on (coreClassId, teacherId) rather than on
-- a teaching TENURE, and therefore conflates different teacher tenures of
-- the same class into a shared or ambiguous legacy row over time.
--
-- THE MODEL
-- One teaching TENURE (`class_subjects.id` — already the unique row per
-- assignment period since migration 20260813120000 gave class_subjects
-- started_at/ended_at history) maps to at most one compatibility
-- `teacher_classes` row, and vice versa. Different tenures of the same
-- class+subject (Peter, then Mary after he leaves) get different bridge
-- rows; Peter's historical tenure keeps pointing at Peter's compatibility
-- class even after Mary's replacement tenure gets its own.
--
-- WHY A DEDICATED TABLE, NOT A COLUMN ON EITHER SIDE
-- A column on `class_subjects` (e.g. `legacy_teacher_class_id`) or on
-- `teacher_classes` (e.g. `class_subject_id`) would work mechanically, but
-- would permanently attach a compatibility-only concept to one of the two
-- canonical tables this bridge exists only to reconcile — a table that
-- Constitution-adjacent docs (school-controlled-roster-and-teaching-
-- assignment-audit.md, teaching-assignment-legacy-boundary.md) already
-- describe as needing to shed legacy dependencies over time, not gain new
-- ones. A dedicated table keeps the compatibility relationship maximally
-- explicit, trivially droppable in one statement once the assignment
-- domain migrates off `teacher_classes` entirely (Phase 1B's own retirement
-- goal), and does not reinterpret any existing column on either table.
--
-- WHY NOT `academicBridge.ts`'s existing `external_id` mechanism
-- That column is keyed on (coreClassId, teacherId) — a person, not a
-- tenure — and one `teachers.id` can hold multiple concurrent or
-- sequential `class_subjects` tenures (different subjects, different
-- schools). Reusing it here would make "the compatibility class for this
-- teaching assignment" ambiguous exactly where assignment history matters
-- most: teacher replacement. This bridge is deliberately a second,
-- independent structure — Phase 1B's job is to stop assignment authority
-- from depending on `academicBridge.ts`, not to extend it.
--
-- SAFETY
-- Purely additive: one new table, two new indexes (its own PK/unique
-- indexes), RLS enabled with an explicit read-only policy for the owning
-- school's staff. No existing table, column, constraint, or row is
-- altered. No backfill is performed by this migration — Phase 1B's own
-- audit found only 9 of 148 current teaching tenures have a legacy shadow
-- class producible from data already on hand (via the existing, unrelated
-- academicBridge.ts `external_id` mechanism); populating the other 139
-- requires learner-identity translation this migration deliberately does
-- not perform (see Phase 1B report, Step 12 — roster-bridge gate). Nothing
-- here forces population; the table simply exists for `ensureAssignment
-- CompatibilityClass()` (lib/core/assignmentCompatibilityBridge.ts) to
-- write into once/if that gate clears in a later phase.
--
-- ROLLBACK (reasoning, not a script to run blindly): safe to drop outright
-- at any point before Phase 1B's authority-migration steps (9+) land, since
-- nothing yet depends on rows existing here:
--   DROP TABLE IF EXISTS class_subject_legacy_bridge;

BEGIN;

CREATE TABLE IF NOT EXISTS class_subject_legacy_bridge (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The teaching TENURE this bridge exists for. One row per tenure — a
  -- replacement teacher's new class_subjects row gets its own bridge, the
  -- departed teacher's historical row keeps its own. ON DELETE RESTRICT:
  -- class_subjects rows are never deleted in practice (closed via
  -- ended_at), and a silent cascade here would orphan assignment history
  -- pointing at the compatibility class without any signal.
  class_subject_id  uuid        NOT NULL REFERENCES class_subjects(id) ON DELETE RESTRICT,
  -- The legacy compatibility class this tenure resolves to. Never a
  -- teacher_classes row that predates this bridge and already carries
  -- genuine private/solo-teacher meaning — the helper that writes this
  -- table only ever inserts newly-created teacher_classes rows, never
  -- repoints an existing one.
  teacher_class_id  uuid        NOT NULL REFERENCES teacher_classes(id) ON DELETE RESTRICT,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- At most one bridge per tenure (the compatibility-boundary invariant,
  -- Phase 1B Step 2) and at most one tenure per compatibility class (a
  -- freshly-created teacher_classes row is claimed by exactly the tenure
  -- that created it). Both directions enforced at the database level, not
  -- just in application code — this is also the mechanism concurrent
  -- bridge-creation race-safety (Step 6) relies on: two simultaneous
  -- requests for the same class_subject_id both attempt an insert, the
  -- database allows exactly one, the loser re-reads.
  UNIQUE (class_subject_id),
  UNIQUE (teacher_class_id)
);

COMMENT ON TABLE class_subject_legacy_bridge IS
  'Phase 1B compatibility bridge: maps one institutional teaching tenure (class_subjects.id) to at most one legacy compatibility class (teacher_classes.id), so the still-legacy-keyed assignment/submission/evidence pipeline can keep operating while assignment authority moves onto class_subjects. Explicit and reversible — drop this table, not teacher_classes or class_subjects, to retire it. See lib/core/assignmentCompatibilityBridge.ts and docs/architecture/teaching-assignment-legacy-boundary.md.';
COMMENT ON COLUMN class_subject_legacy_bridge.class_subject_id IS
  'The teaching TENURE (not merely the class) this bridge was created for. A replacement teacher''s tenure gets its own row here; a departed teacher''s historical class_subjects row keeps pointing at its own.';
COMMENT ON COLUMN class_subject_legacy_bridge.teacher_class_id IS
  'The legacy teacher_classes row created specifically as this tenure''s compatibility class. Never an existing teacher_classes row repointed from another purpose.';

CREATE INDEX IF NOT EXISTS idx_class_subject_legacy_bridge_class_subject_id
  ON class_subject_legacy_bridge (class_subject_id);
CREATE INDEX IF NOT EXISTS idx_class_subject_legacy_bridge_teacher_class_id
  ON class_subject_legacy_bridge (teacher_class_id);

DROP TRIGGER IF EXISTS trg_class_subject_legacy_bridge_updated_at ON class_subject_legacy_bridge;
CREATE TRIGGER trg_class_subject_legacy_bridge_updated_at
  BEFORE UPDATE ON class_subject_legacy_bridge
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE class_subject_legacy_bridge ENABLE ROW LEVEL SECURITY;

-- Read-only for the owning school's active staff (mirrors
-- class_subjects_school_staff_read's shape). No INSERT/UPDATE/DELETE policy
-- is defined for anon/authenticated on purpose: the only intended writer is
-- the canonical helper (lib/core/assignmentCompatibilityBridge.ts), which
-- runs on createServiceClient() and therefore bypasses RLS entirely, same
-- pattern as every other privileged Core write path in this codebase. A
-- future admin-facing read surface can rely on this policy as-is.
CREATE POLICY "class_subject_legacy_bridge_school_staff_read"
  ON class_subject_legacy_bridge FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_subjects cs
      JOIN school_users su ON su.school_id = cs.school_id
      WHERE cs.id = class_subject_legacy_bridge.class_subject_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

COMMIT;
