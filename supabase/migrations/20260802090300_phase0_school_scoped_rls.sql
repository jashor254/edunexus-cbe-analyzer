-- Phase 0 — additive RLS: school-scoped staff access on teacher_classes and
-- students, alongside (not instead of) each table's existing owner policy.
--
-- Postgres combines multiple PERMISSIVE policies for the same command with
-- OR (both existing policies here are plain CREATE POLICY with no
-- RESTRICTIVE keyword, i.e. PERMISSIVE, confirmed by direct inspection of
-- teacher_portal_migration.sql / final_schema.sql) — so this widens access
-- for school-admin-tier staff without narrowing or replacing the existing
-- teacher_id/user_id-owner policies. No existing teacher or consumer/
-- self-serve student loses any access they have today.
--
-- The `school_id IS NOT NULL` guard is what keeps this from ever applying
-- to historical rows (still NULL until the later backfill sprint) or to
-- consumer/self-serve `students` rows (deliberately left NULL forever,
-- app/api/students/create/route.ts) — those keep exactly their current,
-- user-owned-only access model, unchanged.
CREATE POLICY "teacher_classes: school staff manage"
  ON teacher_classes FOR ALL
  USING (
    school_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = teacher_classes.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher')
    )
  );

CREATE POLICY "students: school staff manage"
  ON students FOR ALL
  USING (
    school_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = students.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher')
    )
  );
