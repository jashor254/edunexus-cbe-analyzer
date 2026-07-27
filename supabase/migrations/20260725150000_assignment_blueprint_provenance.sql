-- ─────────────────────────────────────────────────────────────────────────────
-- ASSIGNMENT BLUEPRINT PROVENANCE — Phase 2B of
-- docs/architecture/blueprint-living-action-plan-audit.md, per
-- docs/architecture/blueprint-assignment-delivery-phase2b.md.
--
-- Adds the smallest additive linkage from `assignments` back to the
-- Blueprint action item it was delivered from, when it was. Nullable for
-- every pre-existing and ordinary-route-created assignment — this column
-- means nothing unless a real delivery happened.
--
-- Ownership: written exactly once, at assignment-creation time, by
-- lib/assignments/create.ts's `createAssignment()` (the Phase 2A canonical
-- assignment writer) when called with server-derived `blueprintActionItemId`
-- provenance by lib/learnerBlueprint/actionPlan/delivery/assignment.ts (the
-- Phase 2B delivery adapter). The ordinary teacher-facing assignment route
-- (app/api/teacher/assignments/route.ts) never sets this column — it has no
-- field in its request schema for it. Never updated after insert.
--
-- Idempotency: "one Blueprint action item may create at most one assignment
-- delivery" (Phase 2B's chosen rule) is enforced here at the database level
-- via a partial unique index, not only in application code — the delivery
-- adapter's own existence check is a fast path, this index is the backstop
-- against a genuine concurrent-request race.
--
-- ON DELETE SET NULL (not CASCADE): a Blueprint action item is
-- near-immutable once decided (see the action-item migration's own
-- immutability trigger) and is never expected to be deleted in practice,
-- but if it ever were, the resulting assignment must survive — an assignment
-- that already exists and may have real submissions is never deleted as a
-- side effect of unrelated Blueprint-domain housekeeping.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS blueprint_action_item_id uuid REFERENCES blueprint_action_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN assignments.blueprint_action_item_id IS
  'Provenance only. NULL for every assignment created via the ordinary teacher route. Set exactly once, at creation, by the Phase 2B Blueprint delivery adapter via the Phase 2A canonical assignment service — never written directly, never updated after insert. See docs/architecture/blueprint-assignment-delivery-phase2b.md.';

-- Provenance lookup ("has this action already been delivered, and to which
-- assignment") — the exact query the delivery adapter's idempotency check
-- runs.
CREATE INDEX IF NOT EXISTS idx_assignments_blueprint_action_item_id
  ON assignments (blueprint_action_item_id) WHERE blueprint_action_item_id IS NOT NULL;

-- The "at most one assignment per action item" rule, enforced at the
-- database level. Partial (WHERE ... IS NOT NULL) so it never constrains
-- the overwhelming majority of assignment rows, which have no Blueprint
-- provenance at all.
CREATE UNIQUE INDEX IF NOT EXISTS uq_assignments_blueprint_action_item_id
  ON assignments (blueprint_action_item_id) WHERE blueprint_action_item_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- Widen `blueprint_action_item_history.event_type` to admit 'delivered' —
-- Phase 1's CHECK constraint only anticipated the propose/edit/decide
-- lifecycle; Phase 2B adds one more auditable event type without touching
-- the decision-immutability trigger or any existing row. Purely additive:
-- every previously-valid value remains valid.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE blueprint_action_item_history
  DROP CONSTRAINT IF EXISTS blueprint_action_item_history_event_type_check;

ALTER TABLE blueprint_action_item_history
  ADD CONSTRAINT blueprint_action_item_history_event_type_check
  CHECK (event_type IN ('proposed','edited','approved','rejected','deferred','delivered'));

COMMENT ON COLUMN blueprint_action_item_history.event_type IS
  'proposed/edited/approved/rejected/deferred (Phase 1) plus delivered (Phase 2B — an approved action item was converted into a real assignment; does not change the action item''s own status, which remains approved).';
