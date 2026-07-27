-- ─────────────────────────────────────────────────────────────────────────────
-- BLUEPRINT COMPASS DELIVERY — Phase 2C of
-- docs/architecture/blueprint-living-action-plan-audit.md, per
-- docs/architecture/blueprint-compass-delivery-phase2c.md.
--
-- A dedicated delivery/provenance table, not a nullable column on
-- `compass_sessions` — chosen because Phase 2C's delivery model (Option A,
-- "queued objective") never creates a `compass_sessions` row at delivery
-- time at all (see the design doc §3): the teacher's delivery only writes
-- `student_learning_context.compass_bridge` (via the newly-extracted
-- `lib/compass/objective.ts#setTeacherSuggestedTopic`, itself unchanged by
-- this migration), which `getNextSubject()` reads the next time the learner
-- starts or resumes a session through the existing, untouched Compass flow.
-- A single mutable JSON field with no id/history cannot hold provenance that
-- survives being overwritten by a later write (another delivery, or a
-- teacher's own direct PATCH) — this table is what makes "this action item
-- was delivered to Compass, once, traceably" a durable fact independent of
-- whatever `compass_bridge` currently contains.
--
-- Ownership: written exclusively by
-- lib/learnerBlueprint/actionPlan/delivery/compass.ts via
-- lib/repositories/blueprintCompassDelivery.repository.ts — no other module
-- may write to this table, matching `blueprint_action_items`' own
-- single-owner discipline.
--
-- `compass_session_id` is reserved, nullable, and NOT populated by Phase 2C
-- (Option A creates no session at delivery time) — kept now so a future
-- phase that wires the reverse "which delivery started this session" link
-- never needs a migration to introduce the column, mirroring
-- `blueprint_action_items.blueprint_snapshot_id`'s own reserved-for-later
-- precedent from Phase 1.
--
-- `status` similarly reserves 'started'/'completed'/'expired' for a future
-- phase that mirrors real Compass-side progression back into this table;
-- Phase 2C's own code only ever writes 'available' — Blueprint does not
-- observe or record when the learner actually begins tutoring, by design
-- (Compass owns session state, not Blueprint).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blueprint_compass_deliveries (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core learner identity, matching blueprint_action_items' own convention
  -- (never legacy students.id — the legacy bridge is resolved at delivery
  -- time via resolveLegacyStudentId(), only to reach the compass_bridge
  -- write itself, never stored here).
  learner_id                uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id                 uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- One active Compass delivery per action item (Phase 2C's chosen minimum
  -- — see the design doc §5). A plain UNIQUE constraint, not partial: unlike
  -- assignments (where every ordinary, non-Blueprint row also touches this
  -- column and must be excluded from the constraint), every row in this
  -- table is a Blueprint delivery by definition, so there is no "ordinary"
  -- row to exclude.
  blueprint_action_item_id  uuid        NOT NULL UNIQUE REFERENCES blueprint_action_items(id) ON DELETE CASCADE,

  status                    text        NOT NULL DEFAULT 'available'
                              CHECK (status IN ('available','started','completed','expired')),

  -- ── Bounded instructional contract (design doc §8) — never a full
  -- Blueprint snapshot or evidence history. ────────────────────────────────
  subject                   text        NOT NULL,
  objective                 text        NOT NULL,
  learner_instructions      text        NOT NULL,
  success_indicator         text,
  curriculum_reference      text,
  review_date               date,

  -- Reserved, not populated in Phase 2C — see header.
  compass_session_id        uuid        REFERENCES compass_sessions(id) ON DELETE SET NULL,

  created_by                uuid        REFERENCES school_users(id) ON DELETE SET NULL,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_compass_deliveries_learner_id ON blueprint_compass_deliveries (learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blueprint_compass_deliveries_school_id  ON blueprint_compass_deliveries (school_id);
-- blueprint_action_item_id already has a unique index from the UNIQUE
-- constraint above — no separate index needed for the idempotency lookup.

ALTER TABLE blueprint_compass_deliveries ENABLE ROW LEVEL SECURITY;

-- Same coarse school-isolation + staff-only role filter as
-- blueprint_action_items (Phase 1) — fine-grained "does this teacher
-- actually manage this learner" enforcement happens at the application
-- layer (canManageLearnerRecordCore), not here. Learners/parents never read
-- this table directly: their "access" to a delivered objective is entirely
-- through the existing, unmodified Compass flow reading `compass_bridge`
-- server-side (getNextSubject()) — never a direct authenticated-role SELECT
-- against this table, so no learner/parent branch is needed here either,
-- matching blueprint_action_items' identical reasoning.
CREATE POLICY "blueprint_compass_deliveries_school_staff_read"
  ON blueprint_compass_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = blueprint_compass_deliveries.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
    )
  );

-- No INSERT/UPDATE/DELETE policy for `authenticated` — service-role only,
-- written exclusively by the Phase 2C delivery adapter (see header).

CREATE OR REPLACE FUNCTION set_blueprint_compass_deliveries_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blueprint_compass_deliveries_updated_at
  BEFORE UPDATE ON blueprint_compass_deliveries
  FOR EACH ROW EXECUTE FUNCTION set_blueprint_compass_deliveries_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- Widen `blueprint_action_item_history.event_type` again to admit
-- 'delivered_to_compass' alongside Phase 1's set and Phase 2B's
-- 'delivered' — purely additive, every previously-valid value stays valid.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE blueprint_action_item_history
  DROP CONSTRAINT IF EXISTS blueprint_action_item_history_event_type_check;

ALTER TABLE blueprint_action_item_history
  ADD CONSTRAINT blueprint_action_item_history_event_type_check
  CHECK (event_type IN ('proposed','edited','approved','rejected','deferred','delivered','delivered_to_compass'));

COMMENT ON COLUMN blueprint_action_item_history.event_type IS
  'proposed/edited/approved/rejected/deferred (Phase 1), delivered (Phase 2B - assignment), delivered_to_compass (Phase 2C - Compass objective). None of these change the action item''s own status, which remains approved after either delivery type.';
