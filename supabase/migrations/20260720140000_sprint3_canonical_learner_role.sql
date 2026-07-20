-- Sprint 3 — Canonical Learner Architecture (Platform Audit v1.0, Blocker #5)
-- Widens profiles.role to permit 'student' as a real primary role — the one
-- schema-level blocker preventing any self-login student account from ever
-- existing. Purely additive: existing rows (all 'parent'/'teacher'/'admin'/
-- 'school_admin') are unaffected; this only adds a new legal value.
--
-- Applied directly against the project 2026-07-20; this file is the tracked
-- record of that change, matching this repo's convention that every schema
-- change has a corresponding migration file.
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('parent','school_admin','teacher','admin','student'));

-- Rollback:
--   ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
--   ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
--     CHECK (role IN ('parent','school_admin','teacher','admin'));
