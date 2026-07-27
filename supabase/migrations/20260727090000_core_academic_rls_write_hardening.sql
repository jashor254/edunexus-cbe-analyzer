-- Phase 1.6: Core Academic RLS Write Hardening.
--
-- Discovered by the exhaustive completeness sweep in
-- docs/architecture/school-users-rls-regression-audit.md §9.1 (Phase 1.5):
-- the same defect shape already found and fixed on `school_users` itself
-- (20260726090000_fix_school_users_self_escalation.sql) — a `FOR ALL`
-- policy with no explicit `WITH CHECK`, so Postgres silently reuses the
-- (permissive) `USING` clause for writes too — recurs verbatim across 11
-- Core academic tables, plus one further table (`learner_projections`,
-- Learner Intelligence domain, not "Core Academic" by name but the
-- identical defect shape) found during this phase's own completeness
-- re-check. All 12 are fixed here together.
--
-- The correction is uniform and was verified safe by a full-codebase
-- search before writing this migration: EVERY real write to all 12 tables
-- already goes exclusively through the service-role client
-- (`lib/repositories/school.repository.ts`, `teacher.repository.ts`,
-- `learner.repository.ts`, `assessment.repository.ts`,
-- `attendance.repository.ts`, `lib/core/guardianInvites.ts`,
-- `lib/projection/recompute.ts`) — never a request-scoped client. No
-- legitimate application functionality depends on a direct-client
-- (`authenticated`/`anon`) write to any of these 12 tables, for any role.
-- This is the same conclusion that justified restricting `school_users`,
-- `blueprint_action_items`, and `blueprint_snapshots` to read-only RLS —
-- applied here to the remaining tables that still had it wrong.
--
-- Per table, only the READ scope required judgment (write is uniformly
-- removed for every table below):
--   - academic_years, terms, streams, grade_subjects, class_subjects:
--     non-sensitive structural/config data — broad read (any active
--     school_users member) is preserved unchanged; only write is removed.
--   - learner_enrollments: matches `learners_school_staff`'s existing,
--     already-correct role gate (admin-tier + teacher, parent excluded —
--     no parent policy existed for this table before either).
--   - term_subject_summaries, school_report_cards: read narrowed from
--     "any active member" to admin-tier + teacher — the existing
--     `..._parent_own_child` / `..._parent_published` policies (own child
--     only, unchanged) already exist and remain the only parent path,
--     matching the pattern immediately above/below them in the same
--     original migration. Before this fix, ANY parent could read every
--     OTHER learner's grades/report cards at the same school, not just
--     their own child's — a real per-learner data exposure bug, not just
--     an escalation risk.
--   - attendance_sessions, attendance_records: read narrowed to
--     admin-tier + teacher, matching the ORIGINAL migration's own stated
--     intent ("parent visibility... is a future, separately-gated...
--     integration, not this sprint's scope" — the SQL admitted parents
--     anyway; this fix makes the code match the documented intent).
--   - core_guardian_invites: read narrowed to admin-tier only — this
--     table's `token` column is a bearer credential for claiming a
--     guardian link (same class of secret as a password-reset token);
--     "any active member including parent" being able to SELECT every
--     pending invite token at the school was a live token-theft /
--     account-takeover vector, not just an over-broad grant.
--   - learner_projections: read unchanged (teacher for their own
--     students, parent for their own child — the table's own two
--     existing branches), write removed. This is the Projection Engine's
--     own derived/computed cache
--     (supabase/migrations/20260707_learner_projections.sql: "the
--     current computed output of that projector... always fully
--     reconstructible from Evidence alone") — a parent being able to
--     directly INSERT/UPDATE/DELETE their own child's computed
--     confidence/risk/growth values was a data-integrity issue as much as
--     a security one.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Non-sensitive structural/config tables — broad read preserved, write removed
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "academic_years_school_users" ON academic_years;
CREATE POLICY "academic_years_school_staff_read"
  ON academic_years FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = academic_years.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

DROP POLICY IF EXISTS "terms_school_users" ON terms;
CREATE POLICY "terms_school_staff_read"
  ON terms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = terms.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

DROP POLICY IF EXISTS "streams_school_users" ON streams;
CREATE POLICY "streams_school_staff_read"
  ON streams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = streams.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

DROP POLICY IF EXISTS "grade_subjects_school_users" ON grade_subjects;
CREATE POLICY "grade_subjects_school_staff_read"
  ON grade_subjects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = grade_subjects.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

DROP POLICY IF EXISTS "class_subjects_school_users" ON class_subjects;
CREATE POLICY "class_subjects_school_staff_read"
  ON class_subjects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = class_subjects.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. learner_enrollments — narrowed to staff (admin-tier + teacher), matching
--    `learners_school_staff`'s existing, already-correct role gate.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "learner_enrollments_school_staff" ON learner_enrollments;
CREATE POLICY "learner_enrollments_school_staff_read"
  ON learner_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_enrollments.school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
        AND su.is_active = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. term_subject_summaries — read narrowed to staff; the existing
--    parent-own-child SELECT policy is untouched (not the recursive/
--    escalation-prone one, never needed a fix).
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "term_subject_summaries_school_staff" ON term_subject_summaries;
CREATE POLICY "term_subject_summaries_school_staff_read"
  ON term_subject_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = term_subject_summaries.school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
        AND su.is_active = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. school_report_cards — read narrowed to staff; the existing
--    parent-published SELECT policy is untouched.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "school_report_cards_staff" ON school_report_cards;
CREATE POLICY "school_report_cards_staff_read"
  ON school_report_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = school_report_cards.school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
        AND su.is_active = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. attendance_sessions / attendance_records — read narrowed to staff,
--    matching the original migration's own documented (but not actually
--    implemented until now) intent that parent visibility is separate,
--    future-gated work.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "attendance_sessions_school_staff" ON attendance_sessions;
CREATE POLICY "attendance_sessions_school_staff_read"
  ON attendance_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = attendance_sessions.school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
        AND su.is_active = true
    )
  );

DROP POLICY IF EXISTS "attendance_records_school_staff" ON attendance_records;
CREATE POLICY "attendance_records_school_staff_read"
  ON attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM attendance_sessions ats
      JOIN school_users su ON su.school_id = ats.school_id
      WHERE ats.id = attendance_records.attendance_session_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
        AND su.is_active = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. core_guardian_invites — read narrowed to admin-tier only. `token` is a
--    bearer credential; broad readability was a live token-theft vector,
--    not just an over-broad grant.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "core_guardian_invites_school_users" ON core_guardian_invites;
CREATE POLICY "core_guardian_invites_admin_read"
  ON core_guardian_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = core_guardian_invites.school_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher')
        AND su.is_active = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. learner_projections (Learner Intelligence domain, not "Core Academic"
--    by name — included because it matches the identical defect shape,
--    found during this phase's completeness sweep).
--
-- A SECOND, independent defect was found while fixing this one: the
-- ORIGINAL policy's `EXISTS (SELECT 1 FROM students s WHERE ...)` clauses
-- are themselves subject to `students`' own RLS (a plain in-policy
-- subquery, not a SECURITY DEFINER call) — and `students`' own policies
-- (`supabase/migrations/20260525_rls_policies.sql`) grant SELECT only to
-- the student's own self-service account or a legacy `teachers.role =
-- 'admin'` row, NOT to a teacher-of-record or a parent. Verified
-- empirically: a real teacher/parent session querying `learner_projections`
-- under the ORIGINAL policy got zero rows even for a learner they
-- genuinely owned — the policy never actually worked for a real session,
-- only for the service-role client (which bypasses RLS on `students` too,
-- masking the bug). This was not introduced by this migration; the
-- original policy is being corrected here rather than "unchanged," because
-- leaving a non-functional read policy in place while claiming to
-- preserve it would be documenting something false.
--
-- Fixed by reusing the exact canonical, already-correct, already-
-- SECURITY-DEFINER teacher/parent ownership functions `learner_evidence`'s
-- own (working) policy already uses
-- (`supabase/migrations/20260720130000_sprint1_evidence_rls_bypass_fix.sql`)
-- — not a new, one-off, hand-rolled check. This also brings
-- `learner_projections` into line with the platform-wide rule that
-- `teacher_id` is attribution, never an access gate, and current class
-- membership (`class_students`, via `auth_is_teacher_of_student`) is what
-- actually governs teacher access — the same principle Phase 0 applied to
-- `canViewLearner`.
DROP POLICY IF EXISTS "learner_projections_own_students" ON learner_projections;
CREATE POLICY "learner_projections_own_students_read"
  ON learner_projections FOR SELECT
  USING (
    auth_is_direct_teacher_of_student(learner_id)
    OR auth_is_teacher_of_student(learner_id)
    OR auth_is_parent_of_student(learner_id)
  );

-- No INSERT/UPDATE/DELETE policy for `authenticated`/`anon` on any of the
-- 12 tables above — every write already goes through the service-role
-- client exclusively (verified per-table before this migration was
-- written); RLS's default-deny now applies to writes for any role subject
-- to RLS, matching the `school_users` precedent exactly.

-- Rollback (NOT recommended for the sensitive tables — reintroduces real
-- data-exposure/token-theft/write-integrity issues, not just the original
-- over-broad-role convenience):
--   -- Structural tables (low-risk to roll back — read/write scope reverts
--   -- to "any active member", same as before this migration):
--   DROP POLICY IF EXISTS "academic_years_school_staff_read" ON academic_years;
--   CREATE POLICY "academic_years_school_users" ON academic_years FOR ALL USING (EXISTS (SELECT 1 FROM school_users su WHERE su.school_id = academic_years.school_id AND su.user_id = auth.uid() AND su.is_active = true));
--   -- (same pattern for terms/streams/grade_subjects/class_subjects)
--   -- Sensitive tables — rolling back re-opens real exposure, do not do
--   -- this without a specific reason:
--   DROP POLICY IF EXISTS "learner_enrollments_school_staff_read" ON learner_enrollments;
--   CREATE POLICY "learner_enrollments_school_staff" ON learner_enrollments FOR ALL USING (EXISTS (SELECT 1 FROM school_users su WHERE su.school_id = learner_enrollments.school_id AND su.user_id = auth.uid() AND su.is_active = true));
--   DROP POLICY IF EXISTS "term_subject_summaries_school_staff_read" ON term_subject_summaries;
--   CREATE POLICY "term_subject_summaries_school_staff" ON term_subject_summaries FOR ALL USING (EXISTS (SELECT 1 FROM school_users su WHERE su.school_id = term_subject_summaries.school_id AND su.user_id = auth.uid() AND su.is_active = true));
--   DROP POLICY IF EXISTS "school_report_cards_staff_read" ON school_report_cards;
--   CREATE POLICY "school_report_cards_staff" ON school_report_cards FOR ALL USING (EXISTS (SELECT 1 FROM school_users su WHERE su.school_id = school_report_cards.school_id AND su.user_id = auth.uid() AND su.is_active = true));
--   DROP POLICY IF EXISTS "attendance_sessions_school_staff_read" ON attendance_sessions;
--   CREATE POLICY "attendance_sessions_school_staff" ON attendance_sessions FOR ALL USING (EXISTS (SELECT 1 FROM school_users su WHERE su.school_id = attendance_sessions.school_id AND su.user_id = auth.uid() AND su.is_active = true));
--   DROP POLICY IF EXISTS "attendance_records_school_staff_read" ON attendance_records;
--   CREATE POLICY "attendance_records_school_staff" ON attendance_records FOR ALL USING (EXISTS (SELECT 1 FROM attendance_sessions ats JOIN school_users su ON su.school_id = ats.school_id WHERE ats.id = attendance_records.attendance_session_id AND su.user_id = auth.uid() AND su.is_active = true));
--   DROP POLICY IF EXISTS "core_guardian_invites_admin_read" ON core_guardian_invites;
--   CREATE POLICY "core_guardian_invites_school_users" ON core_guardian_invites FOR ALL USING (EXISTS (SELECT 1 FROM school_users su WHERE su.school_id = core_guardian_invites.school_id AND su.user_id = auth.uid() AND su.is_active = true));
--   DROP POLICY IF EXISTS "learner_projections_own_students_read" ON learner_projections;
--   CREATE POLICY "learner_projections_own_students" ON learner_projections FOR ALL USING (EXISTS (SELECT 1 FROM students s WHERE s.id = learner_projections.learner_id AND s.teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())) OR EXISTS (SELECT 1 FROM students s WHERE s.id = learner_projections.learner_id AND s.parent_user_id = auth.uid()));
