-- 20260525_rls_policies.sql
--
-- Resolves every RLS gap flagged in 20260525_performance_indexes.sql.
-- Covers 18 tables split into two groups:
--   A. RLS disabled entirely (8 tables) → enable RLS + add policies
--   B. RLS enabled but zero policies (10 tables) → add policies only
--
-- Design decisions per table are documented inline.
-- All writes from untrusted clients are blocked unless a WITH CHECK is explicit.
-- Service role bypasses RLS entirely, so cron/webhook routes remain unaffected.
--
-- Rollback:
--   -- Re-disable RLS on group A tables:
--   ALTER TABLE career_review_queue  DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE classes              DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE curriculum_configs   DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE mpesa_payments       DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE parent_profiles      DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE schools              DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE user_cleanup_stats   DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE webhook_errors       DISABLE ROW LEVEL SECURITY;
--   -- Drop all policies created here:
--   DROP POLICY IF EXISTS "career_review_queue: own submissions" ON career_review_queue;
--   DROP POLICY IF EXISTS "career_review_queue: insert own"      ON career_review_queue;
--   DROP POLICY IF EXISTS "classes: authenticated read"          ON classes;
--   DROP POLICY IF EXISTS "curriculum_configs: authenticated read" ON curriculum_configs;
--   DROP POLICY IF EXISTS "mpesa_payments: own read"             ON mpesa_payments;
--   DROP POLICY IF EXISTS "mpesa_payments: own insert"           ON mpesa_payments;
--   DROP POLICY IF EXISTS "parent_profiles: own read"            ON parent_profiles;
--   DROP POLICY IF EXISTS "parent_profiles: own write"           ON parent_profiles;
--   DROP POLICY IF EXISTS "schools: authenticated read"          ON schools;
--   DROP POLICY IF EXISTS "schools: own insert"                  ON schools;
--   DROP POLICY IF EXISTS "schools: own update"                  ON schools;
--   DROP POLICY IF EXISTS "academic_reports: student or guardian" ON academic_reports;
--   DROP POLICY IF EXISTS "bulk_upload_logs: own read"           ON bulk_upload_logs;
--   DROP POLICY IF EXISTS "class_teachers: authenticated read"   ON class_teachers;
--   DROP POLICY IF EXISTS "clinic_reports: student or guardian"  ON clinic_reports;
--   DROP POLICY IF EXISTS "compass_progress: student or guardian" ON compass_progress;
--   DROP POLICY IF EXISTS "learning_compass_configs: student or guardian" ON learning_compass_configs;
--   DROP POLICY IF EXISTS "learning_compass_state: student or guardian" ON learning_compass_state;
--   DROP POLICY IF EXISTS "learning_moments: own"                ON learning_moments;
--   DROP POLICY IF EXISTS "learning_moments: own insert"         ON learning_moments;
--   DROP POLICY IF EXISTS "struggle_patterns: student or guardian or teacher" ON struggle_patterns;
--   DROP POLICY IF EXISTS "student_guardians: own"               ON student_guardians;
--   DROP POLICY IF EXISTS "student_guardians: guardian insert"   ON student_guardians;
--   DROP FUNCTION IF EXISTS auth_owns_student(UUID);
--   DROP FUNCTION IF EXISTS auth_is_guardian_of(UUID);
--   DROP FUNCTION IF EXISTS auth_is_teacher_of_student(UUID);

BEGIN;

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- These bypass RLS on the tables they query, which is correct —
-- they are called *from* an RLS policy, not by a client directly.
-- search_path is pinned to public to prevent search-path injection.
-- ============================================================

-- True if the current user IS this student (student portal access).
CREATE OR REPLACE FUNCTION auth_owns_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND user_id = auth.uid()
  )
$$;

-- True if the current user is a registered guardian of this student.
CREATE OR REPLACE FUNCTION auth_is_guardian_of(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM student_guardians
    WHERE student_id  = p_student_id
      AND guardian_id = auth.uid()
  )
$$;

-- True if the current user is a teacher who has this student in one of their classes.
-- Join path: class_students → teacher_classes → teachers.user_id
CREATE OR REPLACE FUNCTION auth_is_teacher_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   class_students  cs
    JOIN   teacher_classes tc ON tc.id = cs.class_id
    JOIN   teachers        t  ON t.id  = tc.teacher_id
    WHERE  cs.student_id = p_student_id
      AND  t.user_id     = auth.uid()
  )
$$;


-- ============================================================
-- GROUP A: RLS DISABLED — enable + add policies
-- ============================================================

-- ------------------------------------------------------------
-- career_review_queue
-- Anyone authenticated can nominate a career (submitted_by = self).
-- Reviewers operate via service role only — no UPDATE policy for clients.
-- ------------------------------------------------------------
ALTER TABLE career_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_review_queue: own submissions"
  ON career_review_queue FOR SELECT
  USING ( submitted_by = auth.uid() );

CREATE POLICY "career_review_queue: insert own"
  ON career_review_queue FOR INSERT
  WITH CHECK ( submitted_by = auth.uid() );

-- ------------------------------------------------------------
-- classes
-- Structural data (grade, stream, school). Not user-owned directly —
-- teachers are linked via class_teachers / teacher_classes.
-- Read is safe for all authenticated users; writes are admin/service only.
-- ------------------------------------------------------------
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classes: authenticated read"
  ON classes FOR SELECT
  USING ( auth.uid() IS NOT NULL );

-- ------------------------------------------------------------
-- curriculum_configs
-- Static reference data (CBC, 8-4-4, IGCSE configs). No user association.
-- All authenticated users may read; only service role writes.
-- ------------------------------------------------------------
ALTER TABLE curriculum_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "curriculum_configs: authenticated read"
  ON curriculum_configs FOR SELECT
  USING ( auth.uid() IS NOT NULL );

-- ------------------------------------------------------------
-- mpesa_payments  (CRITICAL — financial data)
-- user_id is present. Users may only see and initiate their own payments.
-- Status updates come from the webhook via service role.
-- ------------------------------------------------------------
ALTER TABLE mpesa_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mpesa_payments: own read"
  ON mpesa_payments FOR SELECT
  USING ( user_id = auth.uid() );

CREATE POLICY "mpesa_payments: own insert"
  ON mpesa_payments FOR INSERT
  WITH CHECK ( user_id = auth.uid() );

-- ------------------------------------------------------------
-- parent_profiles
-- BUG FIX: the existing "Service role can do everything" policy was dead
-- because RLS was disabled. Enabling RLS brings it live.
-- id = auth.uid() (parent's profile row uses their auth UID as PK).
-- ------------------------------------------------------------
ALTER TABLE parent_profiles ENABLE ROW LEVEL SECURITY;
-- "Service role can do everything" policy already exists (USING true / WITH CHECK true).

CREATE POLICY "parent_profiles: own read"
  ON parent_profiles FOR SELECT
  USING ( id = auth.uid() );

CREATE POLICY "parent_profiles: own write"
  ON parent_profiles FOR INSERT
  WITH CHECK ( id = auth.uid() );

CREATE POLICY "parent_profiles: own update"
  ON parent_profiles FOR UPDATE
  USING  ( id = auth.uid() )
  WITH CHECK ( id = auth.uid() );

-- ------------------------------------------------------------
-- schools
-- School names are non-sensitive. Any authenticated user may read.
-- Schools are created server-side; created_by tracked for update ownership.
-- ------------------------------------------------------------
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schools: authenticated read"
  ON schools FOR SELECT
  USING ( auth.uid() IS NOT NULL );

CREATE POLICY "schools: own insert"
  ON schools FOR INSERT
  WITH CHECK ( created_by = auth.uid() );

CREATE POLICY "schools: own update"
  ON schools FOR UPDATE
  USING  ( created_by = auth.uid() )
  WITH CHECK ( created_by = auth.uid() );

-- ------------------------------------------------------------
-- user_cleanup_stats
-- Internal cron-job audit log. No user_id column.
-- Enabling RLS with no client policy means all client queries
-- return empty — correct behaviour; service role still has full access.
-- ------------------------------------------------------------
ALTER TABLE user_cleanup_stats ENABLE ROW LEVEL SECURITY;
-- No client policy intentional — cron/service role only.

-- ------------------------------------------------------------
-- webhook_errors
-- Internal payment-webhook error log. No user_id column.
-- Same pattern as user_cleanup_stats.
-- ------------------------------------------------------------
ALTER TABLE webhook_errors ENABLE ROW LEVEL SECURITY;
-- No client policy intentional — service role only.


-- ============================================================
-- GROUP B: RLS ALREADY ENABLED — add missing policies
-- ============================================================

-- ------------------------------------------------------------
-- academic_reports
-- student_id → students.user_id chain. No teacher_id column —
-- teachers access reports through service-role API routes.
-- ------------------------------------------------------------
CREATE POLICY "academic_reports: student or guardian"
  ON academic_reports FOR SELECT
  USING (
    auth_owns_student(student_id)
    OR auth_is_guardian_of(student_id)
  );

-- Writes are always via service role (report generation pipeline).

-- ------------------------------------------------------------
-- bulk_upload_logs
-- uploaded_by is the auth UID of the teacher who ran the upload.
-- Writes are server-side only.
-- ------------------------------------------------------------
CREATE POLICY "bulk_upload_logs: own read"
  ON bulk_upload_logs FOR SELECT
  USING ( uploaded_by = auth.uid() );

-- ------------------------------------------------------------
-- class_teachers
-- Association table: class ↔ teacher ↔ subject.
-- Needed by other RLS joins (e.g. class_students policy).
-- Safe to allow any authenticated read — it exposes no sensitive data.
-- Mutations are admin/service only.
-- ------------------------------------------------------------
CREATE POLICY "class_teachers: authenticated read"
  ON class_teachers FOR SELECT
  USING ( auth.uid() IS NOT NULL );

-- ------------------------------------------------------------
-- clinic_reports  (sensitive — learning diagnostics)
-- student_id present. Teachers access via service-role API only.
-- Clients: student themselves or their registered guardian.
-- ------------------------------------------------------------
CREATE POLICY "clinic_reports: student or guardian"
  ON clinic_reports FOR SELECT
  USING (
    auth_owns_student(student_id)
    OR auth_is_guardian_of(student_id)
  );

-- Writes via service role (report generation + PDF pipeline).

-- ------------------------------------------------------------
-- compass_progress
-- Tracks improvement metrics per student per subject.
-- Teachers benefit from seeing progress, so teacher access is included.
-- ------------------------------------------------------------
CREATE POLICY "compass_progress: student or guardian or teacher"
  ON compass_progress FOR SELECT
  USING (
    auth_owns_student(student_id)
    OR auth_is_guardian_of(student_id)
    OR auth_is_teacher_of_student(student_id)
  );

-- Writes via service role (compass engine updates progress).

-- ------------------------------------------------------------
-- learning_compass_configs
-- Configuration set when a teacher activates the learning compass
-- for a student. Student and guardian read; writes via service role.
-- ------------------------------------------------------------
CREATE POLICY "learning_compass_configs: student or guardian"
  ON learning_compass_configs FOR SELECT
  USING (
    auth_owns_student(student_id)
    OR auth_is_guardian_of(student_id)
  );

-- ------------------------------------------------------------
-- learning_compass_state
-- Session-level adaptive state per student. Same access as configs.
-- ------------------------------------------------------------
CREATE POLICY "learning_compass_state: student or guardian"
  ON learning_compass_state FOR SELECT
  USING (
    auth_owns_student(student_id)
    OR auth_is_guardian_of(student_id)
  );

-- ------------------------------------------------------------
-- learning_moments
-- learner_id is the student's auth UID directly (not students.id).
-- Students interact with compass sessions directly in the browser.
-- ------------------------------------------------------------
CREATE POLICY "learning_moments: own read"
  ON learning_moments FOR SELECT
  USING ( learner_id = auth.uid() );

CREATE POLICY "learning_moments: own insert"
  ON learning_moments FOR INSERT
  WITH CHECK ( learner_id = auth.uid() );

-- ------------------------------------------------------------
-- struggle_patterns
-- Diagnostic data generated per student. Teachers need this to act on
-- alerts; parents need it to understand gaps.
-- ------------------------------------------------------------
CREATE POLICY "struggle_patterns: student or guardian or teacher"
  ON struggle_patterns FOR SELECT
  USING (
    auth_owns_student(student_id)
    OR auth_is_guardian_of(student_id)
    OR auth_is_teacher_of_student(student_id)
  );

-- Writes via service role (analysis pipeline).

-- ------------------------------------------------------------
-- student_guardians
-- guardian_id = auth.uid() of the parent.
-- Students can read their own guardian links.
-- Guardians can read and manage their own link; service role handles
-- deletion to prevent accidental unlinking.
-- ------------------------------------------------------------
CREATE POLICY "student_guardians: own read"
  ON student_guardians FOR SELECT
  USING (
    guardian_id = auth.uid()
    OR auth_owns_student(student_id)
  );

CREATE POLICY "student_guardians: guardian insert"
  ON student_guardians FOR INSERT
  WITH CHECK ( guardian_id = auth.uid() );

COMMIT;
