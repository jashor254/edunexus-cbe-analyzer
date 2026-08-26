-- Senior School Programme Truth — Phase 1: Versioned Policy + Canonical
-- Programme + Canonical Subject Membership
--
-- THE GAP THIS CLOSES
-- Grade 10-12 "subject membership" currently has no authoritative owner.
-- students.selected_subjects/current_pathway are free-text, optional, and
-- unenforced. Blueprint/Career Intelligence instead derive a learner's
-- "current subjects" from learner_evidence.subject — i.e. from whichever
-- free-text strings happen to have an assessment attached — which means
-- historical subjects, one-off slug typos (e.g. a single evidence row
-- entered as "kiswahili_lugha" instead of "kiswahili"), and unassessed
-- compulsory subjects (e.g. Community Service Learning) all produce silent
-- wrong answers. See docs/architecture/ (Grade 10 Blueprint audit,
-- 2026-08-26) for the full trace.
--
-- THIS MIGRATION DOES NOT FIX BLUEPRINT. It builds the domain layer
-- Blueprint/Career Intelligence must eventually read from instead. No
-- consumer is repointed here; that is explicitly deferred (see the
-- implementation report for this phase).
--
-- THE MODEL
--   curriculum_policy_versions  — WHAT is permitted, versioned, non-timeless.
--   learner_programmes          — WHAT a specific learner is actually taking,
--                                  keyed to canonical learners.id (never
--                                  legacy students.id), temporal via the same
--                                  supersede-never-edit pattern already used
--                                  by class_subjects (started_at/ended_at) and
--                                  learner_identity_links (superseded_at).
--   learner_programme_subjects  — the membership relation, FK'd to canonical
--                                  subjects.id, never free text.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--   - It does not mark any curriculum_policy_version 'active'. The audit
--     that preceded this phase could not retrieve a primary KICD/KNEC/MoE
--     document (a promising candidate, a knec.ac.ke-hosted PDF, failed to
--     fetch on a TLS error and was never read). Convergent secondary/news
--     reporting exists but is explicitly not treated as authoritative here.
--     Every policy row this migration seeds is status='draft'.
--   - It does not CHECK-constrain learner_programmes.pathway/track to today's
--     three pathway names. That taxonomy has already changed once (a
--     "Languages" pathway was proposed, then absorbed into Social Sciences)
--     — a DB-level enum would silently break the day it changes again.
--     Structural validation of pathway values against the current taxonomy
--     is a domain-service (application-layer) concern, not a schema one.
--   - It does not touch learner_evidence, students, or any existing table.
--     Purely additive.
--   - It does not populate any learner's programme from evidence. That is
--     explicitly prohibited by this phase's spec — evidence existence must
--     never be able to create programme membership.
--
-- IDENTITY
-- learner_programmes.learner_id references canonical learners(id) — never
-- legacy students(id). The already-proven, DB-enforced bridge
-- (students.external_id = learners.id, see
-- 20260814150000_students_external_id_bridge_integrity.sql and
-- lib/core/identity.ts's resolveLegacyStudentId/resolveCoreLearnerIdForStudentId)
-- is reused, not duplicated, whenever a future consumer needs to join
-- programme truth against legacy-space Evidence/Projection.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CURRICULUM_POLICY_VERSIONS — versioned, non-timeless policy identity.
--    Deliberately does not encode enforced elective-count/compulsory-subject
--    rules as executable constraints (policy_notes is advisory free text,
--    not machine-validated structure) — this migration establishes the
--    version/activation *container*; encoding a specific rule set as
--    something a domain service can mechanically validate against is
--    explicitly out of scope until curriculum authority is verified against
--    a primary source (see the phase's closeout report, §12).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS curriculum_policy_versions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_version_id  uuid        NOT NULL REFERENCES curriculum_versions(id),
  code                   text        NOT NULL UNIQUE,
  label                  text        NOT NULL,
  education_level        text        NOT NULL DEFAULT 'senior_secondary'
                                      CHECK (education_level IN ('junior_secondary', 'senior_secondary')),
  status                 text        NOT NULL DEFAULT 'draft'
                                      CHECK (status IN ('draft', 'active', 'superseded')),
  verification_state     text        NOT NULL DEFAULT 'unverified'
                                      CHECK (verification_state IN ('unverified', 'provisional', 'verified')),
  authority              text,
  source_reference       text,
  effective_from         date,
  effective_to           date,
  policy_notes           text,
  superseded_by_id       uuid        REFERENCES curriculum_policy_versions(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE curriculum_policy_versions IS
  'Versioned Senior/Junior School curriculum policy identity. Promotes the curriculum_policies design already specified (but never built) in docs/reference-school/02-academic-structure.md §12. A version''s content (policy_notes) is advisory until status=active — see uq_curriculum_policy_versions_one_active_per_level below. Historical versions are never mutated once superseded; a new row supersedes, it does not edit.';
COMMENT ON COLUMN curriculum_policy_versions.status IS
  'draft = stored for review, must never govern programme validation. active = the one authoritative version currently in force for its education_level. superseded = was active, now retired; historical programmes governed by it remain interpretable via curriculum_policy_version_id, never reinterpreted.';
COMMENT ON COLUMN curriculum_policy_versions.verification_state IS
  'unverified = derived from convergent secondary/news sourcing only, no primary document read. provisional = a primary source was identified but not fully confirmed. verified = confirmed against a primary KICD/KNEC/MoE document. status=active should not be set while verification_state=unverified except by explicit, documented founder override.';

-- At most one ACTIVE policy per (curriculum, education_level) at a time —
-- "policy should not become active merely because it has the newest
-- effective date" (phase spec §6): activation is a deliberate status flip,
-- guarded here so two conflicting policies can never simultaneously govern
-- validation for the same level.
CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_policy_versions_one_active_per_level
  ON curriculum_policy_versions (curriculum_version_id, education_level)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_curriculum_policy_versions_curriculum_version_id
  ON curriculum_policy_versions (curriculum_version_id);

ALTER TABLE curriculum_policy_versions ENABLE ROW LEVEL SECURITY;

-- Same governance shape as curriculum_versions itself: platform-governed
-- reference data, readable by everyone, writable only by the service role.
CREATE POLICY "curriculum_policy_versions_read_all"
  ON curriculum_policy_versions FOR SELECT
  USING (true);

-- Seed one draft, explicitly non-authoritative Senior School policy version
-- so learner_programmes has something real to (optionally) reference. Status
-- stays 'draft' — this is the honest record of "what we currently believe,
-- not yet confirmed," matching the pattern lib/config/kjseaRules.ts already
-- uses for KJSEA placement rules.
INSERT INTO curriculum_policy_versions
  (curriculum_version_id, code, label, education_level, status, verification_state,
   authority, source_reference, effective_from, policy_notes)
SELECT
  cv.id,
  'ke-cbc-senior-2026-draft',
  'Kenya CBC Senior School Programme Policy — 2026 cohort (draft, unverified)',
  'senior_secondary',
  'draft',
  'unverified',
  'Convergent secondary reporting (multiple independent Kenyan education-news outlets), attributed to a KNEC circular; no primary document confirmed',
  'See docs/architecture/ Grade 10 Foundation Gate audit (2026-08-26) for the full source list and confidence breakdown per rule. One promising primary-tier candidate (nac.knec.ac.ke-hosted PDF) failed to fetch (TLS error) and remains unread.',
  '2026-01-01',
  'NOT ENFORCED. Advisory only. Reported (not primary-confirmed): 3 pathways (STEM/Social Sciences/Arts & Sports Science); 7 subjects/learner (4 compulsory + 3 elective); compulsory = English, Kiswahili/KSL, Mathematics (Core or Essential), Community Service Learning; Core Mathematics required only for Pure Sciences track, optional for every other track (non-STEM Core Mathematics is NOT forbidden); KSL restricted to deaf learners; choose exactly one of CRE/IRE/HRE; General Science excludes concurrent Biology/Physics/Chemistry.'
FROM curriculum_versions cv
WHERE cv.code = 'ke-cbc-2017'
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE TRIGGER set_updated_at_curriculum_policy_versions
      BEFORE UPDATE ON curriculum_policy_versions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CANONICAL CORE MATHEMATICS / ESSENTIAL MATHEMATICS SUBJECT IDENTITY
--    subjects.SS-MATH ("Mathematics", generic) is left completely untouched —
--    not renamed, not deleted, not reinterpreted. It remains whatever it
--    currently is: a generic/historical identity that pre-existing evidence
--    may reference. Two NEW canonical subjects are added alongside it. No
--    existing evidence, grade_subjects, or class_subjects row is touched by
--    this migration — reconciling which learners' generic Mathematics
--    evidence means which variant is explicitly out of scope (phase spec
--    §9: "Historical generic Mathematics evidence may remain unresolved
--    until enough context exists").
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO subjects (name, code, category, is_core)
VALUES
  ('Core Mathematics',      'SS-MATH-CORE', 'senior_secondary', true),
  ('Essential Mathematics', 'SS-MATH-ESS',  'senior_secondary', true)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LEARNER_PROGRAMMES — canonical, temporal Senior/Junior programme truth.
--    Keys to learners.id (Core), never legacy students.id. Existence does
--    NOT require a legacy students row / bridge / any Evidence — programme
--    truth must be creatable for a learner with zero assessments.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_programmes (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id                  uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id                   uuid        NOT NULL REFERENCES schools(id),
  academic_year_id            uuid        NOT NULL REFERENCES academic_years(id),
  curriculum_policy_version_id uuid       REFERENCES curriculum_policy_versions(id),
  pathway                     text,
  track                       text,
  combination_code            text,
  source                      text        NOT NULL DEFAULT 'admin_entry'
                                           CHECK (source IN ('admin_entry', 'parent_selection', 'legacy_migration', 'system')),
  effective_from              timestamptz NOT NULL DEFAULT now(),
  superseded_at               timestamptz,
  superseded_by_programme_id  uuid        REFERENCES learner_programmes(id),
  created_by                  uuid        REFERENCES auth.users(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE learner_programmes IS
  'Canonical, temporal record of what a specific learner (learners.id) is actually enrolled in. NOT derived from learner_evidence/learner_projections — creating or reading programme truth must never require Evidence to exist. pathway/track/combination_code are deliberately free text, not enum/CHECK-constrained: the current 3-pathway taxonomy is policy, not schema, and has already changed once historically.';
COMMENT ON COLUMN learner_programmes.superseded_at IS
  'NULL = this is the learner''s CURRENT programme (see uq_learner_programmes_current_per_learner). Non-null = historical, closed at this instant. Never edited in place — a programme change inserts a new row and closes this one, mirroring class_subjects/learner_identity_links.';
COMMENT ON COLUMN learner_programmes.curriculum_policy_version_id IS
  'Nullable: a programme can be recorded before an authoritative policy version exists for its cohort. Once set, this is what "governed by Rule Version A" answers — a later policy version being marked active must never cause this reference to be silently reinterpreted.';

-- At most one CURRENT programme per learner — same pattern as
-- class_subjects_current_assignment_uniq / uq_learner_identity_links_current_per_learner.
CREATE UNIQUE INDEX IF NOT EXISTS uq_learner_programmes_current_per_learner
  ON learner_programmes (learner_id) WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_learner_programmes_learner_id ON learner_programmes (learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_programmes_school_id ON learner_programmes (school_id);
CREATE INDEX IF NOT EXISTS idx_learner_programmes_academic_year_id ON learner_programmes (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_learner_programmes_policy_version_id ON learner_programmes (curriculum_policy_version_id) WHERE curriculum_policy_version_id IS NOT NULL;

ALTER TABLE learner_programmes ENABLE ROW LEVEL SECURITY;

-- School staff of the OWNING school may read. No client INSERT/UPDATE/DELETE
-- policy exists at all — writes go exclusively through the service-role
-- client under a single domain-service boundary (lib/curriculum/programme.ts
-- in this phase), matching CLAUDE.md's server-side-DB rule and the identical
-- posture already used for learner_identity_links.
CREATE POLICY "learner_programmes_school_staff_read"
  ON learner_programmes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_programmes.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE TRIGGER set_updated_at_learner_programmes
      BEFORE UPDATE ON learner_programmes
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. LEARNER_PROGRAMME_SUBJECTS — canonical subject membership. FK'd to
--    subjects.id, never free text. This is the relationship the audited
--    architecture was missing entirely.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_programme_subjects (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid        NOT NULL REFERENCES learner_programmes(id) ON DELETE CASCADE,
  subject_id   uuid        NOT NULL REFERENCES subjects(id),
  role         text        NOT NULL DEFAULT 'elective'
                            CHECK (role IN ('compulsory', 'elective', 'exception')),
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (programme_id, subject_id)
);

COMMENT ON TABLE learner_programme_subjects IS
  'Canonical subject membership for a learner_programmes row. subject_id is a real FK — no free text. A CSL row with zero learner_evidence rows for that learner is a fully valid, meaningful state: "this learner takes CSL, we do not yet have evidence for it" — never collapsed with "this learner does not take CSL."';
COMMENT ON COLUMN learner_programme_subjects.role IS
  'compulsory = required under the applicable policy. elective = learner-selected from a pathway pool. exception = present despite not being the pathway default (e.g. a non-STEM learner approved for Core Mathematics) — role alone does not assert eligibility was verified against an active authoritative policy; see reason.';

CREATE INDEX IF NOT EXISTS idx_learner_programme_subjects_programme_id ON learner_programme_subjects (programme_id);
CREATE INDEX IF NOT EXISTS idx_learner_programme_subjects_subject_id ON learner_programme_subjects (subject_id);

ALTER TABLE learner_programme_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_programme_subjects_school_staff_read"
  ON learner_programme_subjects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_programmes lp
      JOIN school_users su ON su.school_id = lp.school_id
      WHERE lp.id = learner_programme_subjects.programme_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE TRIGGER set_updated_at_learner_programme_subjects
      BEFORE UPDATE ON learner_programme_subjects
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMIT;
