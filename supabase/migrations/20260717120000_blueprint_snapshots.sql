-- ─────────────────────────────────────────────────────────────────────────────
-- BLUEPRINT SNAPSHOTS — Sprint 12K, per ADR-0008 Part 3 / ADR-0009 §6.
--
-- Audit performed before writing this migration (per this sprint's explicit
-- instruction to check for a reusable mechanism first, documented in full in
-- docs/architecture/sprint-12k-blueprint-snapshots.md §1): every existing
-- table with "snapshot"/"report"/"payload" in its shape was checked against
-- blueprint_snapshots.sql's required schema. `school_intelligence_snapshots`
-- is a school-wide weekly Analytics rollup (mutable Row/Update shape,
-- Analytics-owned, not learner-scoped) — wrong domain. `academic_reports`,
-- `student_clinic_reports`, `clinic_reports` are all Academic-Clinic/legacy-
-- student-keyed (`student_id`, not Core `learner_id`) and Academic-Clinic-
-- owned — reusing them would both cross a forbidden domain boundary (this
-- sprint may not touch lib/academicClinic/) and key Blueprint Snapshots to
-- the wrong identity space (ADR-0005/Sprint 12H: Blueprint is Core-
-- `learners.id`-scoped). `school_report_cards` is deliberately a *different*
-- artifact (ADR-0008 Part 3's three-way distinction: Report Card / Blueprint
-- Snapshot / Current Blueprint each answer a different question) — reusing
-- its storage would collapse that distinction, not honor it. No existing
-- table fits; this is a new, genuinely required table, not a second
-- "learner record" store (RAS §10.7/§10.8 — one domain, one owner: this
-- table is owned exclusively by lib/learnerBlueprint/, nothing else may
-- write to it).
--
-- Schema only. No repository/service/route/UI logic in this migration.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blueprint_snapshots (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Core learner identity (ADR-0005 §2.1, Sprint 12H's canonical bridge) —
  -- never the legacy `students.id` space. Blueprint Snapshots are a Core-
  -- native artifact from the start, unlike the composition engine's own
  -- Academic Record/Compass/Career sections, which still resolve through
  -- the temporary identity bridge internally (that resolution happens
  -- inside composeBlueprint() before a snapshot is ever taken — this table
  -- only ever stores the already-composed result, never a legacy id).
  learner_id        uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id         uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id  uuid        REFERENCES academic_years(id),
  term_id           uuid        REFERENCES terms(id),
  -- Only the three triggers ADR-0008 Part 3 already froze — no fourth
  -- trigger invented here, per this sprint's explicit instruction.
  snapshot_type     text        NOT NULL
                       CHECK (snapshot_type IN ('report_card_publication', 'end_of_term', 'graduation')),
  -- The composed LearnerBlueprint object, exactly as lib/learnerBlueprint's
  -- composeBlueprint() returned it at the moment of the trigger — no
  -- derived analytics, no re-shaping, no second calculation (mission:
  -- "Store exactly the rendered Blueprint composition").
  blueprint_payload jsonb       NOT NULL,
  -- What produced this snapshot and why — trigger type, the source
  -- record's id (report card id / term id / promotion id), and the actor,
  -- so a snapshot's provenance is always reconstructable without re-running
  -- anything (mirrors learner_projections' own supporting_evidence_ids
  -- traceability discipline, ADR-0008 Part 9).
  provenance        jsonb       NOT NULL,
  -- lib/learnerBlueprint's BLUEPRINT_VERSION at composition time. Mission:
  -- "Future schema upgrades must never mutate old snapshots" — this column
  -- is how a future reader knows which shape blueprint_payload is in;
  -- no migration in this table may ever rewrite an existing row's payload
  -- to a newer schema_version.
  schema_version    text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Provenance only, matching attendance_sessions.marked_by_teacher_id's
  -- own precedent (school_users, not teachers; SET NULL not CASCADE, so a
  -- snapshot outlives the actor's own membership row).
  created_by        uuid        REFERENCES school_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_blueprint_snapshots_learner_id ON blueprint_snapshots (learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blueprint_snapshots_school_id  ON blueprint_snapshots (school_id);

ALTER TABLE blueprint_snapshots ENABLE ROW LEVEL SECURITY;

-- School-isolation, matching attendance_sessions'/school_report_cards'
-- existing convention: any active school_users member of this school may
-- read. No write policy for the authenticated role at all — every insert
-- goes through the service-role client (lib/learnerBlueprint's snapshot
-- service), matching the same server-only-write pattern already used for
-- learner_projections/student_clinic_reports.
CREATE POLICY "blueprint_snapshots_school_staff_read"
  ON blueprint_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = blueprint_snapshots.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- Immutability, enforced by the database, not just application discipline
-- (mirrors learner_evidence's own trigger-enforced immutability, per
-- CLAUDE.md: "never mutated after creation... enforced by a database
-- trigger, not just this rule"). Unconditional — a Blueprint Snapshot has
-- no editable field at all, unlike Evidence's field-specific trigger.
CREATE OR REPLACE FUNCTION enforce_blueprint_snapshot_immutability() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'blueprint_snapshots rows are immutable forever (ADR-0008 Part 3, Sprint 12K). Row % may never be updated or deleted.', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blueprint_snapshots_no_update
  BEFORE UPDATE ON blueprint_snapshots
  FOR EACH ROW EXECUTE FUNCTION enforce_blueprint_snapshot_immutability();

CREATE TRIGGER trg_blueprint_snapshots_no_delete
  BEFORE DELETE ON blueprint_snapshots
  FOR EACH ROW EXECUTE FUNCTION enforce_blueprint_snapshot_immutability();
