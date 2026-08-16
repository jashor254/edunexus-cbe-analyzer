-- Discovered by H1D-3B D1 expansion Wave D (lib/compass/endSession.integration.test.ts,
-- whose own header comment explicitly documents "no FK on learner_id, so no
-- user or student rows are needed"). final_schema.sql (the T0 baseline)
-- includes compass_sessions_learner_id_fkey REFERENCES auth.users(id), but
-- production has ZERO foreign keys on compass_sessions today (confirmed via
-- pg_constraint 2026-08-16) -- an undocumented production change with no
-- tracked migration. Dropped here to match production's actual final state.

ALTER TABLE compass_sessions DROP CONSTRAINT IF EXISTS compass_sessions_learner_id_fkey;
