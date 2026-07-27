-- Fix: infinite recursion in "school_users_own_school" RLS policy.
--
-- Discovered during Phase 1 of
-- docs/architecture/blueprint-living-action-plan-audit.md, tests #18/#18b
-- of lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts — the
-- first tests in this codebase to query a table (blueprint_action_items,
-- and even school_users directly) through a real, RLS-enforced,
-- signed-in session rather than the service-role client. Confirmed via an
-- isolated probe (no application code involved) that a plain
-- `SELECT ... FROM school_users` by any real authenticated session already
-- fails with `42P17 infinite recursion detected in policy for relation
-- "school_users"` — a PRE-EXISTING bug, not introduced by this phase, and
-- not specific to blueprint_action_items. It has gone unnoticed until now
-- because almost every read of `school_users` in this codebase goes
-- through `resolveMembership`/`getSchoolUser`, both service-role (RLS
-- bypassed entirely) — no prior test exercised this exact path with a
-- real session.
--
-- Root cause (`supabase/migrations/20260629_core_foundation.sql`,
-- "school_users_own_school"): the policy's admin-tier branch queries
-- `school_users` from directly inside `school_users`' own USING clause —
-- a plain (non-SECURITY-DEFINER) self-referencing subquery, which
-- Postgres's RLS recursion guard rejects. This codebase already has the
-- correct, established fix for exactly this shape of problem —
-- SECURITY DEFINER helper functions that bypass RLS on the table they
-- query because they are called *from* a policy, not by a client
-- directly (`auth_owns_student`, `auth_is_teacher_of_student`,
-- `auth_is_parent_of_student`, `supabase/migrations/20260525_rls_policies
-- .sql`) — this migration applies that same pattern to `school_users`
-- itself, not a new invented approach.
--
-- This also transitively fixes every OTHER table whose policy joins into
-- `school_users` from a real session (academic_years, terms, streams,
-- grade_subjects, blueprint_snapshots, teacher_reflections,
-- blueprint_action_items, blueprint_action_item_history, and any future
-- one) — none of those policies needed to change; they were never the
-- recursive one, `school_users`' own policy was.

CREATE OR REPLACE FUNCTION auth_is_school_admin_of(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM school_users su
    WHERE su.school_id = p_school_id
      AND su.user_id = auth.uid()
      AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher')
      AND su.is_active = true
  )
$$;

DROP POLICY IF EXISTS "school_users_own_school" ON school_users;

CREATE POLICY "school_users_own_school"
  ON school_users FOR ALL
  USING (
    user_id = auth.uid()
    OR auth_is_school_admin_of(school_id)
  );

-- Rollback:
--   DROP POLICY IF EXISTS "school_users_own_school" ON school_users;
--   CREATE POLICY "school_users_own_school"
--     ON school_users FOR ALL
--     USING (
--       user_id = auth.uid()
--       OR EXISTS (
--         SELECT 1 FROM school_users su
--         WHERE su.school_id = school_users.school_id
--           AND su.user_id = auth.uid()
--           AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher')
--           AND su.is_active = true
--       )
--     );
--   DROP FUNCTION IF EXISTS auth_is_school_admin_of(uuid);
