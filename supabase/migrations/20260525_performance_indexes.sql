-- 20260525_performance_indexes.sql
--
-- Full sweep of missing indexes, timestamps, and RLS gaps identified by
-- querying the live schema on 2026-05-25.
--
-- What this covers:
--   1. Missing indexes on teacher_id / student_id / sow_id / week_number / status
--      (only columns confirmed to exist on each table; skips what 20260523 already added)
--   2. Missing created_at / updated_at columns on tables that lack them
--   3. RLS audit — tables with no enforcement flagged as comments (no policies written yet)
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_assignments_teacher_id;
--   DROP INDEX IF EXISTS idx_class_invites_teacher_id;
--   DROP INDEX IF EXISTS idx_generation_jobs_teacher_id;
--   DROP INDEX IF EXISTS idx_schemes_of_work_teacher_id;
--   DROP INDEX IF EXISTS idx_academic_reports_student_id;
--   DROP INDEX IF EXISTS idx_class_students_student_id;
--   DROP INDEX IF EXISTS idx_learner_profiles_student_id;
--   DROP INDEX IF EXISTS idx_shared_reports_student_id;
--   DROP INDEX IF EXISTS idx_student_alerts_student_id;
--   DROP INDEX IF EXISTS idx_generation_jobs_sow_id;
--   DROP INDEX IF EXISTS idx_generation_jobs_week_number;
--   DROP INDEX IF EXISTS idx_lesson_plans_week_number;
--   DROP INDEX IF EXISTS idx_assignment_submissions_status;
--   DROP INDEX IF EXISTS idx_assignments_status;
--   DROP INDEX IF EXISTS idx_career_review_queue_status;
--   DROP INDEX IF EXISTS idx_early_access_leads_status;
--   DROP INDEX IF EXISTS idx_feature_requests_status;
--   DROP INDEX IF EXISTS idx_generation_jobs_status;
--   DROP INDEX IF EXISTS idx_lesson_plans_status;
--   DROP INDEX IF EXISTS idx_mpesa_payments_status;
--   DROP INDEX IF EXISTS idx_row_entries_status;
--   DROP INDEX IF EXISTS idx_schemes_of_work_status;
--   DROP INDEX IF EXISTS idx_study_groups_status;
--   -- Timestamp rollbacks omitted (dropping columns with IF EXISTS is destructive;
--   -- restore from backup if needed)

BEGIN;

-- ============================================================
-- SECTION 1: MISSING INDEXES
-- ============================================================

-- ------------------------------------------------------------
-- teacher_id indexes
-- Already covered: class_assessments, class_teachers, learner_marks,
--   lesson_plans, records_of_work, student_alerts (idx_alerts_teacher),
--   teacher_classes, teacher_grade_scales
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id
  ON assignments(teacher_id);

CREATE INDEX IF NOT EXISTS idx_class_invites_teacher_id
  ON class_invites(teacher_id);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_teacher_id
  ON generation_jobs(teacher_id);

CREATE INDEX IF NOT EXISTS idx_schemes_of_work_teacher_id
  ON schemes_of_work(teacher_id);

-- ------------------------------------------------------------
-- student_id indexes
-- Already covered: assessments, assignment_submissions (unique composite),
--   career_match_reports, chat_logs, clinic_reports, compass_progress,
--   learning_compass_configs, learning_compass_state, pathway_analyses,
--   psychometric_assessments, strand_assessments, struggle_patterns,
--   student_guardians (unique leading), student_interests, whatsapp_opt_ins
-- Note: class_students has composite (class_id, student_id) — student_id
--   is the trailing column so student-only lookups won't use it efficiently.
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_academic_reports_student_id
  ON academic_reports(student_id);

CREATE INDEX IF NOT EXISTS idx_class_students_student_id
  ON class_students(student_id);

CREATE INDEX IF NOT EXISTS idx_learner_profiles_student_id
  ON learner_profiles(student_id);

CREATE INDEX IF NOT EXISTS idx_shared_reports_student_id
  ON shared_reports(student_id);

CREATE INDEX IF NOT EXISTS idx_student_alerts_student_id
  ON student_alerts(student_id);

-- ------------------------------------------------------------
-- sow_id indexes
-- Already covered: lesson_plans
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_generation_jobs_sow_id
  ON generation_jobs(sow_id);

-- ------------------------------------------------------------
-- week_number indexes
-- Already covered: none
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_generation_jobs_week_number
  ON generation_jobs(week_number);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_week_number
  ON lesson_plans(week_number);

-- ------------------------------------------------------------
-- status indexes
-- Already covered: payments, subscriptions
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status
  ON assignment_submissions(status);

CREATE INDEX IF NOT EXISTS idx_assignments_status
  ON assignments(status);

CREATE INDEX IF NOT EXISTS idx_career_review_queue_status
  ON career_review_queue(status);

CREATE INDEX IF NOT EXISTS idx_early_access_leads_status
  ON early_access_leads(status);

CREATE INDEX IF NOT EXISTS idx_feature_requests_status
  ON feature_requests(status);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status
  ON generation_jobs(status);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_status
  ON lesson_plans(status);

CREATE INDEX IF NOT EXISTS idx_mpesa_payments_status
  ON mpesa_payments(status);

CREATE INDEX IF NOT EXISTS idx_row_entries_status
  ON row_entries(status);

CREATE INDEX IF NOT EXISTS idx_schemes_of_work_status
  ON schemes_of_work(status);

CREATE INDEX IF NOT EXISTS idx_study_groups_status
  ON study_groups(status);


-- ============================================================
-- SECTION 2: MISSING TIMESTAMPS
-- ============================================================

-- Tables missing BOTH created_at and updated_at
ALTER TABLE career_intelligence
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

ALTER TABLE class_students
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

ALTER TABLE sow_grades
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

ALTER TABLE sow_learning_areas
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

ALTER TABLE sow_levels
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

ALTER TABLE sow_strands
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

ALTER TABLE sow_substrands
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

ALTER TABLE student_guardians
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

ALTER TABLE study_group_members
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

ALTER TABLE user_cleanup_stats
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

-- Tables missing created_at only (already have updated_at)
ALTER TABLE beta_stats
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

ALTER TABLE token_balances
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

-- Tables missing updated_at only (already have created_at)
-- Skipping pure append-only log tables: ai_usage_logs, bulk_upload_logs,
--   chat_logs, chat_messages, compass_messages, notification_log,
--   token_usage, user_activity_log, webhook_errors
ALTER TABLE academic_reports      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE ai_usage              ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE assessments           ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE assignments           ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE career_match_reports  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE career_review_queue   ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE careers               ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE class_invites         ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE class_teachers        ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE classes               ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE curriculum_configs    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE early_access_leads    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE feature_votes         ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE kicd_curriculum_lessons ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE learning_moments      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE lesson_plans          ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE mpesa_payments        ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE parent_profiles       ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE pathway_analyses      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE psychometric_assessments ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE referral_rewards      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE scheme_lessons        ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE schemes_of_work       ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE schools               ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE shared_reports        ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE sow_learning_outcomes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE sow_set_books         ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE sow_templates         ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE struggle_patterns     ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE student_alerts        ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE students              ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE study_group_answers   ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE study_group_challenges ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE study_groups          ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE subscriptions         ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE teacher_classes       ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE teachers              ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE user_feedback         ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE user_tokens           ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE users                 ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE whatsapp_opt_ins      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();


-- ============================================================
-- SECTION 3: RLS AUDIT FLAGS
-- No policies are created here — these need deliberate decisions.
-- ============================================================

-- RLS DISABLED (no enforcement at all — any authenticated user can read/write):
-- TODO: career_review_queue  — admin-only table, should restrict to service role or admin users
-- TODO: classes              — teacher-owned; needs teacher_id = auth.uid() policy
-- TODO: curriculum_configs   — likely read-only public; add SELECT USING (true) at minimum
-- TODO: mpesa_payments       — CRITICAL: payment data; restrict to user_id = auth.uid()
-- TODO: parent_profiles      — BUG: has 1 policy defined but RLS is OFF (policy is dead);
--                              run ALTER TABLE parent_profiles ENABLE ROW LEVEL SECURITY;
-- TODO: schools              — likely read-only reference data; add SELECT USING (true)
-- TODO: user_cleanup_stats   — internal/cron only; restrict to service role
-- TODO: webhook_errors       — internal only; restrict to service role

-- RLS ENABLED but ZERO POLICIES (all non-service-role queries are silently blocked):
-- TODO: academic_reports     — RLS on, 0 policies → all client reads return empty
-- TODO: bulk_upload_logs     — RLS on, 0 policies → all client reads return empty
-- TODO: class_teachers       — RLS on, 0 policies → teacher-class joins broken for clients
-- TODO: clinic_reports       — RLS on, 0 policies → CRITICAL: clinic data inaccessible to clients
-- TODO: compass_progress     — RLS on, 0 policies → compass features broken for clients
-- TODO: learning_compass_configs — RLS on, 0 policies → compass features broken
-- TODO: learning_compass_state   — RLS on, 0 policies → compass features broken
-- TODO: learning_moments     — RLS on, 0 policies → client reads return empty
-- TODO: struggle_patterns    — RLS on, 0 policies → client reads return empty
-- TODO: student_guardians    — RLS on, 0 policies → parent-student links inaccessible to clients

COMMIT;
