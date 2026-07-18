-- Learner Projects domain (Sprint 12Z, ADR-0013).
--
-- Phase 1 audit (sprint-12z doc) confirmed no existing table, repository,
-- or module owns learner-created project work — `lib/learnerPortfolio/`'s
-- `projects` category is a raw artefact label with no goal/lifecycle/team/
-- mentor/verification (ADR-0013 Phase 1's own naming-collision finding),
-- and `lib/projection/`/`learner_projections` is the unrelated Learner
-- Intelligence computed-state engine. This is a genuinely new domain.
--
-- Lifecycle is ADR-0013 Phase 5's frozen ten states: Draft, Planning,
-- In Progress, Submitted, Reviewed, Verified, Published, Archived,
-- Rejected, Cancelled. Rejected reachable only from Submitted/Reviewed;
-- Cancelled reachable only from Draft/Planning/In Progress (never after
-- Submitted — a submitted claim gets a real disposition, never a silent
-- withdrawal). No "Expired" state (ADR-0013 Phase 5/6, extending
-- ADR-0004's derived-data discipline).
--
-- Verification types are ADR-0013 Phase 6's frozen six values — no
-- numeric trust score (Constitution Article XI).
--
-- Categories are ADR-0013 Phase 4's frozen sixteen values, a closed enum.
--
-- No upload/storage system is introduced here (Forbidden list) —
-- `project_artifacts` stores external link-out URLs only, never file bytes.

CREATE TABLE IF NOT EXISTS learner_projects (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id                uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id                 uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  title                     text        NOT NULL,
  description               text,
  goal                      text,
  category                  text        NOT NULL CHECK (category IN (
                               'academic', 'cbc', 'research', 'innovation', 'technology',
                               'creative_arts', 'music', 'drama', 'business', 'agriculture',
                               'engineering', 'community', 'environmental', 'leadership',
                               'entrepreneurship', 'digital'
                             )),

  status                    text        NOT NULL DEFAULT 'draft' CHECK (status IN (
                               'draft', 'planning', 'in_progress', 'submitted', 'reviewed',
                               'verified', 'published', 'archived', 'rejected', 'cancelled'
                             )),

  start_date                date,
  completion_date           date,
  reflection                text,

  -- Reference-not-copy, mirroring learner_projections'/learner_portfolios'/
  -- learner_achievements' own supporting_evidence_ids pattern (ADR-0013 Phase 7).
  supporting_evidence_ids   uuid[]      NOT NULL DEFAULT '{}',

  -- ADR-0013 Phase 6 — six named verification types, no numeric score.
  -- Set only at verifyProject(); null before then (submitted/reviewed
  -- projects are implicitly "pending" via status, never a separate stored value).
  verification_type         text        CHECK (verification_type IN (
                               'teacher_verified', 'school_verified', 'competition_verified',
                               'external_verified', 'self_only', 'pending'
                             )),
  verifying_document_reference text,
  verified_by               uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  verified_at                timestamptz,

  review_notes              text,
  reviewed_by                uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  reviewed_at                timestamptz,

  rejected_reason            text,
  published_at                timestamptz,
  archived_at                timestamptz,
  cancelled_at                timestamptz,

  -- Attribution only (CLAUDE.md: never an access gate).
  created_by                 uuid        REFERENCES school_users(id) ON DELETE SET NULL,

  version                    int         NOT NULL DEFAULT 1,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_projects_learner_id ON learner_projects (learner_id, status);
CREATE INDEX IF NOT EXISTS idx_learner_projects_school_id  ON learner_projects (school_id);

-- The project's team — additional learner teammates beyond the primary
-- owning `learner_id` on learner_projects itself.
CREATE TABLE IF NOT EXISTS project_members (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid        NOT NULL REFERENCES learner_projects(id) ON DELETE CASCADE,
  learner_id        uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  role              text,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (project_id, learner_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members (project_id);

-- A named supporting adult, explicitly distinct from Verifier (ADR-0013
-- Phase 10 "teacher ownership" risk — Mentor and Verifier are never
-- conflated). May be internal (a school_users row) or external (name only).
CREATE TABLE IF NOT EXISTS project_mentors (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                uuid        NOT NULL REFERENCES learner_projects(id) ON DELETE CASCADE,
  mentor_name               text        NOT NULL,
  mentor_school_user_id     uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  role                      text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_mentors_project_id ON project_mentors (project_id);

-- Progress log (ADR-0013 Phase 3 "Progress" ownership item) — an
-- append-only trail of updates on an in-flight project, distinct from the
-- project's own single `reflection` field.
CREATE TABLE IF NOT EXISTS project_updates (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid        NOT NULL REFERENCES learner_projects(id) ON DELETE CASCADE,
  note              text        NOT NULL,
  created_by        uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project_id ON project_updates (project_id, created_at);

-- Link-out only (ADR-0013 Phase 8/Forbidden list) — no file bytes, no
-- bucket, no upload path.
CREATE TABLE IF NOT EXISTS project_artifacts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid        NOT NULL REFERENCES learner_projects(id) ON DELETE CASCADE,
  url               text        NOT NULL,
  label             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_artifacts_project_id ON project_artifacts (project_id);

-- ADR-0013 "Relationship to ADR-0011" — Portfolio references Projects,
-- never duplicates. Nullable: a `projects`-category Portfolio item with no
-- link yet is Reserved (service layer), never fabricated as a real link.
ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES learner_projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_portfolio_items_project_id ON portfolio_items (project_id) WHERE project_id IS NOT NULL;

ALTER TABLE learner_projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_mentors    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_updates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_artifacts  ENABLE ROW LEVEL SECURITY;

-- School-isolation only, matching learner_portfolios/learner_achievements'
-- convention — RLS enforces the tenant boundary; the service layer
-- (lib/learnerProjects/) enforces the finer rule that most callers only
-- ever see *published* projects via listPublished(). No write policy for
-- the `authenticated` role — every write goes through the service-role client.
CREATE POLICY "learner_projects_school_staff_read"
  ON learner_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_projects.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "project_members_school_staff_read"
  ON project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_projects lp
      JOIN school_users su ON su.school_id = lp.school_id
      WHERE lp.id = project_members.project_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "project_mentors_school_staff_read"
  ON project_mentors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_projects lp
      JOIN school_users su ON su.school_id = lp.school_id
      WHERE lp.id = project_mentors.project_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "project_updates_school_staff_read"
  ON project_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_projects lp
      JOIN school_users su ON su.school_id = lp.school_id
      WHERE lp.id = project_updates.project_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "project_artifacts_school_staff_read"
  ON project_artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_projects lp
      JOIN school_users su ON su.school_id = lp.school_id
      WHERE lp.id = project_artifacts.project_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- Immutability (ADR-0013 Phase 5/9, same three-layer discipline as Report
-- Cards/Teacher Reflections/Blueprint Snapshots/Portfolio/Achievement).
-- `rejected`/`cancelled`/`archived` are fully terminal. `published` allows
-- exactly one further transition — to `archived` — with every other field
-- frozen. `draft`/`planning`/`in_progress`/`submitted`/`reviewed`/`verified`
-- remain editable by the service layer. No delete path exists once a
-- project has left `draft` (matching ADR-0012 Phase 11's identical
-- "no delete path in the frozen lifecycle" rule).
CREATE OR REPLACE FUNCTION enforce_learner_project_immutability() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status != 'draft' THEN
      RAISE EXCEPTION 'learner_projects row % has left draft (status=%) and can never be deleted (Sprint 12Z, ADR-0013).', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('rejected', 'cancelled', 'archived') THEN
    RAISE EXCEPTION 'learner_projects row % is % and permanently immutable (Sprint 12Z, ADR-0013).', OLD.id, OLD.status;
  END IF;

  IF OLD.status = 'published' THEN
    IF NEW.status = 'archived'
       AND NEW.id = OLD.id AND NEW.learner_id = OLD.learner_id AND NEW.school_id = OLD.school_id
       AND NEW.title = OLD.title AND NEW.category = OLD.category
       AND NEW.description IS NOT DISTINCT FROM OLD.description
       AND NEW.goal IS NOT DISTINCT FROM OLD.goal
       AND NEW.start_date IS NOT DISTINCT FROM OLD.start_date
       AND NEW.completion_date IS NOT DISTINCT FROM OLD.completion_date
       AND NEW.reflection IS NOT DISTINCT FROM OLD.reflection
       AND NEW.supporting_evidence_ids = OLD.supporting_evidence_ids
       AND NEW.verification_type IS NOT DISTINCT FROM OLD.verification_type
       AND NEW.verified_by IS NOT DISTINCT FROM OLD.verified_by
       AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at
       AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
       AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'learner_projects row % is published and immutable except archiving (Sprint 12Z, ADR-0013).', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_projects_immutability_update
  BEFORE UPDATE ON learner_projects
  FOR EACH ROW EXECUTE FUNCTION enforce_learner_project_immutability();

CREATE TRIGGER trg_learner_projects_immutability_delete
  BEFORE DELETE ON learner_projects
  FOR EACH ROW EXECUTE FUNCTION enforce_learner_project_immutability();

CREATE OR REPLACE FUNCTION set_learner_projects_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_projects_updated_at
  BEFORE UPDATE ON learner_projects
  FOR EACH ROW EXECUTE FUNCTION set_learner_projects_updated_at();
