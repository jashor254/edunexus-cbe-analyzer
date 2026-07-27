-- Fix: `school_users` write privilege escalation via implicit WITH CHECK.
--
-- Discovered during Phase 1.5 (docs/architecture/school-users-rls-regression
-- -audit.md), while auditing the Phase 1 recursion fix
-- (20260725130000_fix_school_users_rls_recursion.sql) for privilege
-- escalation. PRE-EXISTING since the table's original migration
-- (20260629_core_foundation.sql) — not introduced by the Phase 1 fix,
-- which only replaced the recursive EXISTS subquery with a SECURITY
-- DEFINER call and did not change the policy's FOR ALL / single-USING-
-- clause shape.
--
-- Root cause: `school_users_own_school` was declared `FOR ALL` with only a
-- `USING` clause, no separate `WITH CHECK`. Per Postgres semantics, a
-- `FOR ALL` policy with no explicit `WITH CHECK` uses the `USING`
-- expression for both read filtering AND the write-time check. The
-- `USING` expression was `user_id = auth.uid() OR auth_is_school_admin_of
-- (school_id)` — for an INSERT, `user_id = auth.uid()` is trivially true
-- of a caller inserting a row naming themselves, REGARDLESS of school_id
-- or role. Verified empirically with a real signed-in session with zero
-- prior relationship to a school: a plain `authenticated` INSERT of
-- `{ school_id: <any>, user_id: auth.uid(), role: 'school_admin',
-- is_active: true }` succeeded, self-granting school-admin at an
-- arbitrary school. `anon`/`authenticated` hold full table-level
-- INSERT/UPDATE/DELETE grants on `school_users` (Supabase's default
-- public-schema grants) — RLS was the only thing standing between this
-- and a real client, and it was not actually stopping it.
--
-- No legitimate application code path needs `authenticated` to write to
-- `school_users` directly — every write (`upsertSchoolUser`,
-- `updateSchoolUserRole`, `deactivateSchoolUser` in
-- `lib/repositories/teacher.repository.ts`, and school creation in
-- `lib/repositories/school.repository.ts`) already goes exclusively
-- through the service-role client (confirmed by a full-codebase search —
-- every `.from('school_users')` write call site uses
-- `BaseRepository`'s `createServiceClient()`). Restricting the RLS
-- policy to `FOR SELECT` only removes zero legitimate functionality and
-- closes the escalation path entirely: with no INSERT/UPDATE/DELETE
-- policy defined, RLS's default-deny applies to those operations for any
-- role subject to RLS (anon, authenticated) — only the service-role
-- client (which bypasses RLS) can still write.
--
-- Read access is UNCHANGED — same expression, same roles, same school
-- boundary (own row, or `auth_is_school_admin_of` for admin-tier).

DROP POLICY IF EXISTS "school_users_own_school" ON school_users;

CREATE POLICY "school_users_own_school_read"
  ON school_users FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth_is_school_admin_of(school_id)
  );

-- Deliberately no INSERT/UPDATE/DELETE policy — see rationale above.
-- Every write goes through the service-role client only.

-- Rollback (NOT recommended — reintroduces the self-escalation path):
--   DROP POLICY IF EXISTS "school_users_own_school_read" ON school_users;
--   CREATE POLICY "school_users_own_school"
--     ON school_users FOR ALL
--     USING (
--       user_id = auth.uid()
--       OR auth_is_school_admin_of(school_id)
--     );
