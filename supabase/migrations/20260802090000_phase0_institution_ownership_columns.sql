-- Phase 0 — Institution Ownership Enforcement (future writes only).
--
-- Purely additive: nullable columns, no backfill, no FK repoint of any
-- existing table, no constraint dropped. Historical rows keep school_id =
-- NULL until the separate, later historical-migration sprint (reviewed and
-- approved-with-changes, not yet started) backfills them.
--
-- teacher_classes/students are the de-facto-canonical Class/Learner tables
-- (Stage 0.5 usage evidence, 34/68 files vs. 1 for Core's classes/learners)
-- — this is where new institutional writes need a real school owner, not
-- Core's classes/learners, which already model ownership correctly.
ALTER TABLE teacher_classes ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);
ALTER TABLE students        ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

-- Smallest additive provenance metadata for auto-provisioned schools.
-- `created_by` already exists on `schools` (types/core.ts) and answers "user
-- responsible" — this adds only the "how/why did this school come to exist"
-- tag Step 2 requires, so a provisional school is never an untraceable
-- ordinary school record.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS provisioning_source text;
