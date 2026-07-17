-- Learner Portfolio domain (Sprint 12V, ADR-0011 + ADR-0012).
--
-- Phase 1 audit (sprint-12v doc §1) confirmed no existing table, upload
-- pipeline, or storage bucket owns any part of a learner-facing Portfolio —
-- `lib/academy/portfolio.ts` is an unrelated teacher badge system (ADR-0011
-- Phase 1). This is a genuinely new canonical domain, not a duplicate.
--
-- Categories exclude every concept ADR-0012 assigns to the (not-yet-built)
-- Achievement domain: Awards, Certificates, Leadership, Competitions,
-- Community Service, Innovation. Portfolio owns only the raw, unverified
-- artefact — never a verifiable claim (ADR-0012 Phase 6).
--
-- No upload/storage system is introduced here (out of scope this sprint,
-- ADR-0011 Phase 13 "Storage explosion" risk, explicitly deferred) —
-- `portfolio_media` stores external link-out URLs only, never file bytes.

CREATE TABLE IF NOT EXISTS learner_portfolios (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id   uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id    uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- One portfolio per learner (ADR-0011 Phase 2: the learner's own single
  -- curated collection, never a per-term or per-category container).
  UNIQUE (learner_id)
);

CREATE INDEX IF NOT EXISTS idx_learner_portfolios_school_id ON learner_portfolios (school_id);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id           uuid        NOT NULL REFERENCES learner_portfolios(id) ON DELETE CASCADE,
  -- Denormalized for direct RLS/query use, matching teacher_reflections'
  -- own convention — never re-derived by joining through portfolio_id.
  learner_id             uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id              uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  category               text        NOT NULL CHECK (category IN (
                             'projects', 'creative_work', 'research', 'presentations',
                             'writing', 'design', 'photography', 'programming', 'media', 'other'
                           )),
  title                  text        NOT NULL,
  description            text,
  -- The learner's own reflection on this entry (ADR-0011 Phase 3) —
  -- distinct from, never a duplicate of, Teacher Reflection.
  reflection             text,

  -- Reference-not-copy, mirroring learner_projections' own
  -- supporting_evidence_ids pattern (ADR-0011 Phase 7). Optional: a purely
  -- creative artefact may legitimately have no Evidence at all.
  supporting_evidence_ids uuid[]     NOT NULL DEFAULT '{}',

  status                 text        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'submitted', 'verified', 'rejected', 'published', 'archived')),

  -- Attribution only (CLAUDE.md: teacher_id/creator means "who entered
  -- this," never an access gate).
  created_by             uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  verified_by            uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  verified_at            timestamptz,
  rejected_reason        text,
  published_at           timestamptz,
  archived_at            timestamptz,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_items_portfolio_id ON portfolio_items (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_learner_id   ON portfolio_items (learner_id, status);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_school_id    ON portfolio_items (school_id);

CREATE TABLE IF NOT EXISTS portfolio_media (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_item_id  uuid        NOT NULL REFERENCES portfolio_items(id) ON DELETE CASCADE,
  -- Link-out only (ADR-0011 Phase 10: "link-out never embedded storage
  -- this ADR decides") — no file bytes, no bucket, no upload path.
  url                text        NOT NULL,
  label              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_media_item_id ON portfolio_media (portfolio_item_id);

CREATE TABLE IF NOT EXISTS portfolio_tags (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_item_id  uuid        NOT NULL REFERENCES portfolio_items(id) ON DELETE CASCADE,
  tag                text        NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (portfolio_item_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_tags_item_id ON portfolio_tags (portfolio_item_id);

ALTER TABLE learner_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_media    ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_tags     ENABLE ROW LEVEL SECURITY;

-- School-isolation only, matching teacher_reflections' convention — RLS
-- enforces the tenant boundary; the service layer (lib/learnerPortfolio/)
-- enforces the finer rule that most callers only ever see *published*
-- items via listPublished(). No write policy for the `authenticated`
-- role — every write goes through the service-role client.
CREATE POLICY "learner_portfolios_school_staff_read"
  ON learner_portfolios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_portfolios.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "portfolio_items_school_staff_read"
  ON portfolio_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = portfolio_items.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "portfolio_media_school_staff_read"
  ON portfolio_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portfolio_items pi
      JOIN school_users su ON su.school_id = pi.school_id
      WHERE pi.id = portfolio_media.portfolio_item_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "portfolio_tags_school_staff_read"
  ON portfolio_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portfolio_items pi
      JOIN school_users su ON su.school_id = pi.school_id
      WHERE pi.id = portfolio_tags.portfolio_item_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- Immutability after publication (mirrors teacher_reflections' own
-- trigger-enforced discipline, CLAUDE.md). Unlike teacher_reflections,
-- Published -> Archived is a legitimate transition (Phase 4 lifecycle) —
-- the trigger allows exactly that one status change on an already-published
-- row and rejects every other field mutation.
CREATE OR REPLACE FUNCTION enforce_portfolio_item_immutability() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('published', 'archived') THEN
      RAISE EXCEPTION 'portfolio_items row % is published/archived and can never be deleted (Sprint 12V).', OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'published' THEN
    IF NEW.status = 'archived'
       AND NEW.id = OLD.id AND NEW.portfolio_id = OLD.portfolio_id
       AND NEW.learner_id = OLD.learner_id AND NEW.school_id = OLD.school_id
       AND NEW.category = OLD.category AND NEW.title = OLD.title
       AND NEW.description IS NOT DISTINCT FROM OLD.description
       AND NEW.reflection IS NOT DISTINCT FROM OLD.reflection
       AND NEW.supporting_evidence_ids = OLD.supporting_evidence_ids
       AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
       AND NEW.verified_by IS NOT DISTINCT FROM OLD.verified_by
       AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at
       AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'portfolio_items row % is published and immutable except archiving (Sprint 12V). Archive it instead of editing it.', OLD.id;
  END IF;

  IF OLD.status = 'archived' THEN
    RAISE EXCEPTION 'portfolio_items row % is archived and immutable (Sprint 12V).', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_portfolio_items_immutability_update
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION enforce_portfolio_item_immutability();

CREATE TRIGGER trg_portfolio_items_immutability_delete
  BEFORE DELETE ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION enforce_portfolio_item_immutability();

CREATE OR REPLACE FUNCTION set_learner_portfolios_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_portfolios_updated_at
  BEFORE UPDATE ON learner_portfolios
  FOR EACH ROW EXECUTE FUNCTION set_learner_portfolios_updated_at();

CREATE OR REPLACE FUNCTION set_portfolio_items_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_portfolio_items_updated_at
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION set_portfolio_items_updated_at();
