-- ─────────────────────────────────────────────────────────────────────────────
-- BLUEPRINT ACTION ITEMS — Phase 1 of
-- docs/architecture/blueprint-living-action-plan-audit.md, per ADR-0030's
-- context rule.
--
-- The canonical Blueprint-owned decision/coordination record for "what
-- should this learner do next" — a teacher-approved action plan spanning
-- multiple simultaneous contexts (current_term/intervention/extension/
-- end_of_term/holiday). Owned exclusively by
-- `lib/learnerBlueprint/actionPlan/` (via `lib/repositories/
-- blueprintActionItem.repository.ts` and `blueprintActionItemHistory
-- .repository.ts`) — no other module may write to these tables, matching
-- `blueprint_snapshots`' own single-owner discipline (Sprint 12K) exactly.
--
-- Design verification performed before writing this migration (per Phase
-- 1's explicit instruction) — see
-- docs/architecture/blueprint-action-plan-phase1.md §1 for the full record.
-- Key findings that shaped this schema:
--
--  1. Core-native identity, not legacy: `blueprint_snapshots` and
--     `teacher_reflections` (the two most recent Blueprint-adjacent tables)
--     both key on `learners.id`, never legacy `students.id` — this table
--     follows the same convention. Candidate generation internally bridges
--     to legacy space via `resolveLegacyStudentId()` only when reading
--     Projection; nothing is stored here in legacy identity space.
--
--  2. RLS helper functions (`auth_is_teacher_of_student`,
--     `auth_is_direct_teacher_of_student`) all key on legacy
--     `students.id`, not Core `learners.id` — and not every Core learner
--     has a legacy bridge yet (a legitimate, common state, per
--     `lib/core/identity.ts`'s own documented gap). Reusing those
--     functions directly in RLS here would deny real teachers of
--     not-yet-bridged learners. `blueprint_snapshots`/`teacher_reflections`
--     resolved this identical conflict by using coarse school-level RLS
--     (any active `school_users` member of the school may read) with the
--     fine-grained "does this teacher actually teach this learner" rule
--     enforced at the application layer instead (Phase 0's corrected
--     `canViewLearner`/`canManageLearnerRecord`,
--     `lib/core/permissions.ts`). This migration follows that same
--     precedent — but narrows the coarse RLS read policy to staff roles
--     only (excluding `parent`), since unlike a whole composed Blueprint
--     or a single reflection, a row here may carry teacher-private content
--     (`teacher_notes`) that must never be broadly readable. This is a
--     deliberate strengthening of the established pattern for this
--     specific table, not a new invented style.
--
--  3. `learner_projections.confidence` is a real, computed 0-100 value
--     (never a fabricated one) — `evidence_basis` below stores exactly
--     that number, copied verbatim from a real `Projection<T>` at
--     generation time, never invented.
--
-- Schema only. No repository/service/route logic in this migration.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blueprint_action_items (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core learner identity (finding #1 above) — never legacy `students.id`.
  learner_id            uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id             uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id      uuid        REFERENCES academic_years(id),
  term_id               uuid        REFERENCES terms(id),
  -- Optional link to the Blueprint Snapshot this item was proposed against,
  -- when one exists (e.g. a review conducted against a frozen end-of-term
  -- snapshot rather than the live Blueprint). Always NULL in Phase 1 — no
  -- code path populates it yet; reserved for a future phase, kept nullable
  -- and additive now so it never requires a later migration to introduce.
  blueprint_snapshot_id uuid        REFERENCES blueprint_snapshots(id) ON DELETE SET NULL,

  -- ADR-0030: teacher-selected/confirmed, NEVER derived or overwritten from
  -- calendar data. No DEFAULT on purpose — every insert must supply this
  -- explicitly (a system candidate generator picks a value by its own
  -- documented scope, e.g. always 'current_term'; it is not a date lookup).
  context               text        NOT NULL
                          CHECK (context IN ('current_term','intervention','extension','end_of_term','holiday')),
  priority              text        NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low','medium','high')),
  -- Lifecycle per the audit's Part B target model. Phase 1 implements only
  -- propose/edit/approve/reject/defer (-> 'proposed'/'edited'/'approved'/
  -- 'rejected'/'deferred'). 'published'/'completed'/'reviewed' are RESERVED
  -- for later phases — included in the CHECK now so the column never needs
  -- a future migration to widen it, but `lib/learnerBlueprint/actionPlan/
  -- lifecycle.ts` contains no code path that can ever set them; attempting
  -- to reach them from application code throws, not silently no-ops.
  status                text        NOT NULL DEFAULT 'proposed'
                          CHECK (status IN ('proposed','edited','approved','rejected','deferred','published','completed','reviewed')),
  -- The teacher's own declared intent for this item's eventual audience —
  -- distinct from `teacher_notes` below, which is unconditionally private
  -- regardless of this value. Governs `lib/learnerBlueprint/actionPlan/
  -- projections.ts`'s stakeholder views: `toParentView`/`toLearnerView`
  -- return null unless visibility permits AND status = 'approved'.
  visibility            text        NOT NULL DEFAULT 'teacher_only'
                          CHECK (visibility IN ('teacher_only','learner_visible','parent_visible','shared')),

  -- ── Content ────────────────────────────────────────────────────────────
  -- Normalized, not one JSON blob — every field here is independently
  -- editable/validatable. Written in plain, stakeholder-safe language by
  -- convention (enforced by `validation.ts`'s length/required checks, not
  -- by scanning content — see Sprint 12O's `teacher_reflections` precedent
  -- for why content-level judgment stays a human editorial responsibility).
  title                 text        NOT NULL,
  rationale             text        NOT NULL,
  intended_outcome      text        NOT NULL,
  learner_action        text,
  teacher_action        text,
  parent_support        text,
  school_support        text,
  success_indicator     text        NOT NULL,
  -- Free-text curriculum/capability reference (e.g. "Grade 7 Mathematics —
  -- Fractions") — deliberately not a hard FK into the curriculum domain;
  -- Phase 1 does not invent a new cross-domain relationship for this.
  target_capability     text,
  review_date           date,
  -- Unconditionally teacher-private. Never returned by `toParentView` or
  -- `toLearnerView` regardless of the `visibility` column above — the one
  -- field in this table that visibility settings cannot override.
  teacher_notes         text,

  -- ── Evidence basis / provenance ───────────────────────────────────────
  proposal_source       text        NOT NULL CHECK (proposal_source IN ('teacher','system')),
  -- Which deterministic rule/candidate generator produced a 'system'
  -- proposal (e.g. 'deterministic-adaptive-v1') — NULL for 'teacher'.
  source_generator      text,
  -- Real Projection references only, never fabricated: {projectorType,
  -- supportingEvidenceIds, confidence, lastComputed, projectionVersion} —
  -- shape mirrors `Projection<T>` (lib/projection/types.ts) exactly, values
  -- copied verbatim at proposal time, never recomputed or invented here.
  -- Genuinely polymorphic (which projector, how many evidence ids) — the
  -- one field in this table where JSONB is justified per the phase's own
  -- "use JSONB only where the value is genuinely polymorphic or references
  -- multiple evidence records" rule.
  evidence_basis        jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- ── Attribution ────────────────────────────────────────────────────────
  -- Always the human actor who caused this row to exist — whether they
  -- authored the content themselves (proposal_source='teacher') or
  -- triggered a system-generated candidate to be saved
  -- (proposal_source='system'). Never confused with content authorship,
  -- which `proposal_source`/`source_generator`/`evidence_basis` already
  -- capture. SET NULL (not CASCADE) matching `blueprint_snapshots
  -- .created_by`'s precedent — a proposal outlives the proposer's own
  -- membership row.
  proposed_by           uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  reviewed_by           uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  reviewed_at           timestamptz,
  decision_reason       text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_action_items_learner_id ON blueprint_action_items (learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blueprint_action_items_school_id  ON blueprint_action_items (school_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_action_items_status     ON blueprint_action_items (status);
CREATE INDEX IF NOT EXISTS idx_blueprint_action_items_context    ON blueprint_action_items (context);
-- The exact query `listApprovedBlueprintActionsForStakeholder` runs —
-- approved + visible rows for one learner.
CREATE INDEX IF NOT EXISTS idx_blueprint_action_items_learner_approved
  ON blueprint_action_items (learner_id, status, visibility) WHERE status = 'approved';

ALTER TABLE blueprint_action_items ENABLE ROW LEVEL SECURITY;

-- Coarse school-isolation + staff-only role filter (design finding #2
-- above) — deliberately narrower than `blueprint_snapshots`'/
-- `teacher_reflections`' "any active school_users member" policy: `parent`
-- is excluded here because, unlike those two tables, a row here may carry
-- `teacher_notes`. Fine-grained "does this specific teacher teach this
-- specific learner" enforcement happens in
-- `lib/learnerBlueprint/actionPlan/` via `canManageLearnerRecordCore`
-- (Phase 0), not here — this policy is the outer tenant/role boundary,
-- not the final word on any single row. No parent- or learner-facing route
-- reads this table directly in Phase 1 ("No broad UI") — Phase 4's
-- stakeholder projections will read through
-- `listApprovedBlueprintActionsForStakeholder` (service-role), never a
-- direct authenticated-role SELECT, so this policy never needs a `parent`
-- branch even then.
CREATE POLICY "blueprint_action_items_school_staff_read"
  ON blueprint_action_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = blueprint_action_items.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
    )
  );

-- No INSERT/UPDATE/DELETE policy for the `authenticated` role at all —
-- matching `blueprint_snapshots`/`teacher_reflections`' precedent exactly.
-- Every write goes through the service-role client from
-- `lib/repositories/blueprintActionItem.repository.ts`, called only by
-- `lib/learnerBlueprint/actionPlan/lifecycle.ts`, which is what actually
-- enforces "is this specific teacher allowed to act on this specific
-- learner" before any write happens. This is also what makes "learners
-- cannot edit or approve" / "parents cannot edit or approve" true at the
-- strongest layer: neither role can write to this table under any
-- circumstance, regardless of any future application-layer bug.

-- Decision immutability, enforced by the database (mirrors
-- `teacher_reflections`' conditional immutability-after-publish pattern).
-- A row with a final decision (approved/rejected) may never be changed
-- again — a new decision requires a new proposal row, preserving "the
-- original proposal and decision history" per the phase's own requirement.
-- 'deferred' is deliberately NOT included here — a deferred item remains
-- revisitable (re-approve/reject/re-defer later), it is not a final
-- decision.
CREATE OR REPLACE FUNCTION enforce_blueprint_action_item_decision_immutability() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'blueprint_action_items row % has a final decision (%) and is immutable — propose a new action item instead of editing this one.', OLD.id, OLD.status;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blueprint_action_items_no_edit_after_decision
  BEFORE UPDATE ON blueprint_action_items
  FOR EACH ROW EXECUTE FUNCTION enforce_blueprint_action_item_decision_immutability();

CREATE TRIGGER trg_blueprint_action_items_no_delete_after_decision
  BEFORE DELETE ON blueprint_action_items
  FOR EACH ROW EXECUTE FUNCTION enforce_blueprint_action_item_decision_immutability();

CREATE OR REPLACE FUNCTION set_blueprint_action_items_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blueprint_action_items_updated_at
  BEFORE UPDATE ON blueprint_action_items
  FOR EACH ROW EXECUTE FUNCTION set_blueprint_action_items_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- BLUEPRINT ACTION ITEM HISTORY — the append-only audit trail a teacher
-- decision requires ("the system must preserve: the original proposal;
-- teacher edits; approval/rejection/defer decision; actor; timestamp;
-- previous and resulting state"). One row per lifecycle transition, never
-- updated or deleted — matching `blueprint_snapshots`' own unconditional
-- immutability (not the conditional kind `blueprint_action_items` itself
-- uses above, since history rows have no "draft" phase at all).
--
-- Deliberately its own narrow table, not a generic platform-wide event
-- table — Phase 1's own instruction is explicit that a general event
-- architecture is out of scope here (the existing `lib/events` pipeline
-- publishes cross-cutting integration events; this table is a domain-
-- internal audit log, a different and narrower concern, matching how
-- `intervention_log` and `teacher_reflections` each keep their own history
-- inline rather than routing through a shared event bus for pure
-- record-keeping).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blueprint_action_item_history (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_item_id   uuid        NOT NULL REFERENCES blueprint_action_items(id) ON DELETE CASCADE,
  event_type       text        NOT NULL CHECK (event_type IN ('proposed','edited','approved','rejected','deferred')),
  previous_status  text,
  resulting_status text        NOT NULL,
  -- The full row content immediately after this event — not a diff.
  -- Mirrors `blueprint_snapshots.blueprint_payload`'s own "store exactly
  -- the result, no derived reshaping" discipline: a reader reconstructs
  -- exactly what the row looked like after this event without re-deriving
  -- anything.
  snapshot         jsonb       NOT NULL,
  actor_id         uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_action_item_history_item_id ON blueprint_action_item_history (action_item_id, created_at);

ALTER TABLE blueprint_action_item_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blueprint_action_item_history_school_staff_read"
  ON blueprint_action_item_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM blueprint_action_items bai
      JOIN school_users su ON su.school_id = bai.school_id
      WHERE bai.id = blueprint_action_item_history.action_item_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
    )
  );

-- No write policy for `authenticated` — service-role only, written by
-- `lib/learnerBlueprint/actionPlan/lifecycle.ts` alongside every
-- `blueprint_action_items` mutation.

CREATE OR REPLACE FUNCTION enforce_blueprint_action_item_history_immutability() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'blueprint_action_item_history rows are immutable forever. Row % may never be updated or deleted.', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blueprint_action_item_history_no_update
  BEFORE UPDATE ON blueprint_action_item_history
  FOR EACH ROW EXECUTE FUNCTION enforce_blueprint_action_item_history_immutability();

CREATE TRIGGER trg_blueprint_action_item_history_no_delete
  BEFORE DELETE ON blueprint_action_item_history
  FOR EACH ROW EXECUTE FUNCTION enforce_blueprint_action_item_history_immutability();
