-- =============================================================================
-- EDUNEXUS CBE ANALYZER — FINAL UNIFIED SCHEMA
-- Generated from schema.sql + corrections_patch.sql
-- Corrections are integrated inline; section 7 contains backfill-only statements
-- Safe to re-run — uses DROP … CASCADE + IF EXISTS guards
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- 2. DROP EXISTING OBJECTS (reverse dependency order)
-- =============================================================================

-- Drop RPC / helper functions first
DROP FUNCTION IF EXISTS deduct_tokens(uuid, text, int, jsonb)            CASCADE;
DROP FUNCTION IF EXISTS create_user_with_referral(text, text, text)      CASCADE;
DROP FUNCTION IF EXISTS get_referral_stats(uuid)                         CASCADE;
DROP FUNCTION IF EXISTS use_free_analysis(uuid)                          CASCADE;
DROP FUNCTION IF EXISTS expire_free_analyses()                           CASCADE;
DROP FUNCTION IF EXISTS mark_users_for_deletion()                        CASCADE;
DROP FUNCTION IF EXISTS cleanup_marked_users()                           CASCADE;
DROP FUNCTION IF EXISTS handle_new_user()                                CASCADE;
DROP FUNCTION IF EXISTS fn_set_student_level()                           CASCADE;
DROP FUNCTION IF EXISTS fn_sync_subscription_legacy_cols()               CASCADE;
DROP FUNCTION IF EXISTS fn_sync_user_tokens_from_balance()               CASCADE;
DROP FUNCTION IF EXISTS fn_check_pathway_is_junior()                     CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_created                ON auth.users;

-- Drop tables (leaf → root)
DROP TABLE IF EXISTS compass_messages          CASCADE;
DROP TABLE IF EXISTS compass_sessions          CASCADE;
DROP TABLE IF EXISTS strand_assessments        CASCADE;
DROP TABLE IF EXISTS pathway_analyses          CASCADE;
DROP TABLE IF EXISTS career_match_reports      CASCADE;
DROP TABLE IF EXISTS assessments               CASCADE;
DROP TABLE IF EXISTS student_interests         CASCADE;
DROP TABLE IF EXISTS psychometric_assessments  CASCADE;
DROP TABLE IF EXISTS learner_profiles          CASCADE;
DROP TABLE IF EXISTS students                  CASCADE;
DROP TABLE IF EXISTS subscriptions             CASCADE;
DROP TABLE IF EXISTS token_usage               CASCADE;
DROP TABLE IF EXISTS token_balances            CASCADE;
DROP TABLE IF EXISTS user_tokens               CASCADE;
DROP TABLE IF EXISTS payments                  CASCADE;
DROP TABLE IF EXISTS user_feedback             CASCADE;
DROP TABLE IF EXISTS user_activity_log         CASCADE;
DROP TABLE IF EXISTS ai_usage                  CASCADE;
DROP TABLE IF EXISTS ai_usage_logs             CASCADE;
DROP TABLE IF EXISTS feature_votes             CASCADE;
DROP TABLE IF EXISTS feature_requests          CASCADE;
DROP VIEW  IF EXISTS user_cleanup_stats        CASCADE;
DROP TABLE IF EXISTS user_cleanup_stats        CASCADE;
DROP TABLE IF EXISTS webhook_errors            CASCADE;
DROP TABLE IF EXISTS career_review_queue       CASCADE;
DROP TABLE IF EXISTS dynamic_careers           CASCADE;
DROP TABLE IF EXISTS careers                   CASCADE;
DROP TABLE IF EXISTS career_intelligence       CASCADE;
DROP TABLE IF EXISTS profiles                  CASCADE;
DROP TABLE IF EXISTS users                     CASCADE;


-- =============================================================================
-- 3. CREATE TABLES
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.1  PROFILES  (public mirror of auth.users — one row per Supabase Auth user)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  avatar_url      TEXT,
  role            TEXT        NOT NULL DEFAULT 'parent'
                              CHECK (role IN ('parent','school_admin','teacher','admin')),
  plan_type       TEXT        DEFAULT 'free',
  tokens          INTEGER     NOT NULL DEFAULT 0 CHECK (tokens >= 0),
  is_promoter     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.2  USERS  (extended user data — referrals, onboarding, free analyses)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                     TEXT        NOT NULL UNIQUE,
  full_name                 TEXT,
  referral_code             TEXT        UNIQUE,
  referred_by_code          TEXT,                   -- the code used when this user signed up
  free_analyses             INTEGER     NOT NULL DEFAULT 1 CHECK (free_analyses >= 0),
  free_analyses_used        INTEGER     NOT NULL DEFAULT 0 CHECK (free_analyses_used >= 0),
  free_analyses_expire_at   TIMESTAMPTZ,
  has_seen_onboarding       BOOLEAN     NOT NULL DEFAULT FALSE,
  onboarding_completed_at   TIMESTAMPTZ,
  is_marked_for_deletion    BOOLEAN     NOT NULL DEFAULT FALSE,
  marked_for_deletion_at    TIMESTAMPTZ,
  last_active               TIMESTAMPTZ DEFAULT NOW(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.3  STUDENTS
--      grade restricted to 7–12 (FIX 1: was 4–12)
--      level is auto-set by trg_set_student_level — no manual entry needed
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE students (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  grade               INTEGER     NOT NULL CHECK (grade BETWEEN 7 AND 12),
  date_of_birth       DATE,
  current_pathway     TEXT        CHECK (current_pathway IN ('STEM','Arts & Sports','Social Sciences')),
  level               TEXT        NOT NULL
                                  CHECK (level IN ('Junior School','Senior School')),
  term                INTEGER     CHECK (term BETWEEN 1 AND 3),
  year                INTEGER     CHECK (year >= 2020),
  school              TEXT,
  location_preference JSONB       DEFAULT '[]',
  financial_tier      TEXT        CHECK (financial_tier IN ('low','medium','high')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.4  ASSESSMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE assessments (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id          UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term                INTEGER     NOT NULL CHECK (term BETWEEN 1 AND 3),
  year                INTEGER     NOT NULL CHECK (year >= 2020),
  grade               INTEGER     NOT NULL CHECK (grade BETWEEN 4 AND 12),
  grade_level         TEXT,
  subject_scores      JSONB       NOT NULL DEFAULT '{}',  -- {"subject": 1-4}
  subject_marks       JSONB       DEFAULT '{}',            -- {"subject": {marks, total}}
  mathematics_type    TEXT        CHECK (mathematics_type IN ('core','essential')),
  pathway_electives   JSONB       DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.5  STRAND ASSESSMENTS (topic-level granularity)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE strand_assessments (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id   UUID        NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id      UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject         TEXT        NOT NULL,
  strand          TEXT        NOT NULL,
  topic           TEXT        NOT NULL,
  rating          INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 4),
  marks           NUMERIC,
  total_marks     NUMERIC     DEFAULT 100,
  teacher_notes   TEXT,
  learner_notes   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.6  STUDENT INTERESTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE student_interests (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  interests   JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.7  PSYCHOMETRIC ASSESSMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE psychometric_assessments (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id        UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  personality_type  TEXT,
  holland_codes     JSONB       DEFAULT '[]',
  work_values       JSONB       DEFAULT '[]',
  stress_tolerance  INTEGER     CHECK (stress_tolerance BETWEEN 1 AND 10),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.8  LEARNER PROFILES (AI-generated learning style profiles)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE learner_profiles (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  learning_style  TEXT,
  strengths       JSONB       DEFAULT '[]',
  weaknesses      JSONB       DEFAULT '[]',
  interests       JSONB       DEFAULT '[]',
  profile_data    JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.9  CAREER INTELLIGENCE (AI-enriched career database)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE career_intelligence (
  id                    TEXT        PRIMARY KEY,
  name                  TEXT        NOT NULL,
  category              TEXT        NOT NULL
                                    CHECK (category IN ('traditional','emerging','future','hybrid')),
  description           TEXT,
  kenyan_market         JSONB       DEFAULT '{}',
    -- { sector_growth, entry_barriers, saturation, key_employers, salary_range_kes, rural_vs_urban }
  cbc_mapping           JSONB       DEFAULT '{}',
    -- { junior_focus, senior_pathways, learning_areas, suggested_ccas, portfolio_projects }
  ai_forecast           JSONB       DEFAULT '{}',
    -- { automation_risk 0-100, timeline, human_advantage, pivot_opportunities }
  real_stories          JSONB       DEFAULT '{}',
    -- { success_profile, challenges_faced, advice_for_students }
  verification_status   TEXT        NOT NULL DEFAULT 'ai_generated'
                                    CHECK (verification_status IN ('ai_generated','expert_reviewed','profession_validated')),
  last_updated          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.10  CAREERS (searchable/cached career records)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE careers (
  id                        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                      TEXT        NOT NULL,
  description               TEXT,
  salary_range              TEXT,
  education_path            TEXT,
  education_duration        TEXT,
  outlook                   TEXT,
  demand_in_kenya           TEXT,
  ai_disruption_risk        TEXT,
  required_subjects         JSONB       DEFAULT '[]',
  required_subjects_display TEXT,
  universities_in_kenya     JSONB       DEFAULT '[]',
  tvet_options              JSONB       DEFAULT '[]',
  career_path               TEXT,
  is_ai_generated           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.11  DYNAMIC CAREERS (admin-managed/generated careers)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dynamic_careers (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  description TEXT,
  category    TEXT,
  data        JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.12  CAREER MATCH REPORTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE career_match_reports (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id        UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  career_id         TEXT        REFERENCES career_intelligence(id) ON DELETE SET NULL,
  match_score       NUMERIC     CHECK (match_score BETWEEN 0 AND 100),
  match_dimensions  JSONB       DEFAULT '{}',
  pathway           JSONB       DEFAULT '{}',
  risks             JSONB       DEFAULT '[]',
  alternatives      JSONB       DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, career_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.13  CAREER REVIEW QUEUE (expert review pipeline)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE career_review_queue (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  career_name     TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','in_review','approved','rejected')),
  submitted_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.14  PATHWAY ANALYSES (recommended pathway history — Junior School only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE pathway_analyses (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id            UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommended_pathway   TEXT,
  career_matches        JSONB       DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.15  PAYMENTS  (Paystack transactions)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id  TEXT        NOT NULL UNIQUE,   -- Paystack reference
  amount          INTEGER     NOT NULL,           -- in KES
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','success','failed')),
  product_id      TEXT        NOT NULL
                              CHECK (product_id IN ('starter','term','premium')),
  metadata        JSONB       DEFAULT '{}',
    -- { phone, email, purchase_type, product_label }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.16  TOKEN BALANCES  (current token wallet — primary token system)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE token_balances (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance     INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_ever  INTEGER     NOT NULL DEFAULT 0 CHECK (total_ever >= 0),  -- cumulative purchased
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.17  USER TOKENS  (legacy token allocation rows — kept for compatibility)
--       UNIQUE (user_id) added for upsert support (FIX 4)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_tokens (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_purchased  INTEGER     NOT NULL DEFAULT 0,
  tokens_used       INTEGER     NOT NULL DEFAULT 0,
  tokens_remaining  INTEGER     NOT NULL DEFAULT 0,
  purchase_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.18  TOKEN USAGE  (audit log of every token spend)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE token_usage (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  tokens_used INTEGER     NOT NULL,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.19  SUBSCRIPTIONS
--       plan CHECK excludes 'starter' — it is a token purchase product, not a
--       subscription tier (FIX 2)
--       end_date / plan_type are legacy columns kept in sync by trigger (FIX 3)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan          TEXT        NOT NULL
                            CHECK (plan IN ('term','premium','school')),
  status        TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','expired','cancelled')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  payment_id    UUID        REFERENCES payments(id) ON DELETE SET NULL,
  -- legacy fields (kept for backward compatibility — synced by trigger)
  plan_type     TEXT,
  billing_cycle TEXT        CHECK (billing_cycle IN ('termly','yearly')),
  amount_paid   INTEGER,
  end_date      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.20  COMPASS SESSIONS  (Learning Compass persistent state)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE compass_sessions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_state JSONB       NOT NULL DEFAULT '{"initialized": false}',
  last_subject  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.21  COMPASS MESSAGES  (chat history for pedagogy tracking)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE compass_messages (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID        NOT NULL REFERENCES compass_sessions(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user','assistant')),
  content     TEXT        NOT NULL,
  metadata    JSONB       DEFAULT '{}',
    -- { difficulty, subject, struggled, confidence, visual_provided }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.22  USER FEEDBACK  (NPS + feature ratings)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_feedback (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger         TEXT,                           -- e.g. 'on_cancel', 'after_report'
  rating          TEXT        CHECK (rating IN ('helpful','not_helpful')),
  nps_score       INTEGER     CHECK (nps_score BETWEEN 0 AND 10),
  category        TEXT,                           -- cancel reason bucket
  message         TEXT,
  would_recommend BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.23  USER ACTIVITY LOG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_activity_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type   TEXT        NOT NULL,
  metadata        JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.24  AI USAGE  (monthly counters for rate limiting)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE ai_usage (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature       TEXT        NOT NULL,   -- 'careerAnalysis' | 'learningPlans' | 'chatMessages'
  count         INTEGER     NOT NULL DEFAULT 1,
  metadata      JSONB       DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, feature, created_at)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.25  AI USAGE LOGS  (per-call audit log — used by rate-limit.ts)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE ai_usage_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_type  TEXT        NOT NULL,
    -- 'career_analysis' | 'guardian_tutor' | 'learning_plan' | 'compass_session'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.26  FEATURE REQUESTS  (product feedback board)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE feature_requests (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  feature_title   TEXT        NOT NULL,
  description     TEXT,
  category        TEXT        NOT NULL
                              CHECK (category IN ('marks_tracking','bulk_upload','ai_features','reports','other')),
  votes           INTEGER     NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','reviewing','planned','in_progress','completed','rejected')),
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.27  FEATURE VOTES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE feature_votes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_id  UUID        NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feature_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.28  USER CLEANUP STATS  (GDPR cron job audit)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_cleanup_stats (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_count      INTEGER     NOT NULL DEFAULT 0,
  idle_deleted       INTEGER     NOT NULL DEFAULT 0,
  unverified_deleted INTEGER     NOT NULL DEFAULT 0,
  details            JSONB       DEFAULT '{}'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.29  WEBHOOK ERRORS  (Paystack webhook failure log)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE webhook_errors (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference     TEXT,
  event_type    TEXT,
  error_message TEXT,
  payload       JSONB       DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 4. INDEXES
-- =============================================================================

CREATE INDEX idx_students_user_id              ON students(user_id);
CREATE INDEX idx_assessments_student_id        ON assessments(student_id);
CREATE INDEX idx_assessments_term_year         ON assessments(student_id, term, year);
CREATE INDEX idx_strand_assessments_student    ON strand_assessments(student_id);
CREATE INDEX idx_strand_assessments_assessment ON strand_assessments(assessment_id);
CREATE INDEX idx_pathway_analyses_student      ON pathway_analyses(student_id);
CREATE INDEX idx_pathway_analyses_user         ON pathway_analyses(user_id);
CREATE INDEX idx_career_match_reports_student  ON career_match_reports(student_id);
CREATE INDEX idx_payments_user_id              ON payments(user_id);
CREATE INDEX idx_payments_transaction_id       ON payments(transaction_id);
CREATE INDEX idx_payments_status               ON payments(status);
CREATE INDEX idx_subscriptions_user_id         ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status          ON subscriptions(status, expires_at);
CREATE INDEX idx_token_balances_user_id        ON token_balances(user_id);
CREATE INDEX idx_token_usage_user_id           ON token_usage(user_id);
CREATE INDEX idx_user_tokens_user_id           ON user_tokens(user_id);
CREATE INDEX idx_compass_sessions_learner      ON compass_sessions(learner_id);
CREATE INDEX idx_compass_messages_session      ON compass_messages(session_id);
CREATE INDEX idx_user_feedback_user_id         ON user_feedback(user_id);
CREATE INDEX idx_ai_usage_user_feature         ON ai_usage(user_id, feature);
CREATE INDEX idx_ai_usage_logs_user_id         ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at      ON ai_usage_logs(created_at);
CREATE INDEX idx_user_activity_log_user_id     ON user_activity_log(user_id);
CREATE INDEX idx_users_referral_code           ON users(referral_code);
CREATE INDEX idx_users_email                   ON users(email);


-- =============================================================================
-- 5. TRIGGERS AND FUNCTIONS
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 5.1  handle_new_user — auto-create all per-user rows on Supabase Auth signup
--      Creates: profiles, users, token_balances, user_tokens (FIX 5)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_referral_code TEXT;
BEGIN
  -- Generate unique 8-char referral code
  LOOP
    v_referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE referral_code = v_referral_code);
  END LOOP;

  -- profiles row
  INSERT INTO profiles (id, full_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- users row
  INSERT INTO users (id, email, full_name, referral_code, free_analyses, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    v_referral_code,
    1,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- token_balances row (primary token wallet)
  INSERT INTO token_balances (user_id, balance, total_ever)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- user_tokens row (legacy compatibility wallet)
  INSERT INTO user_tokens (user_id, tokens_purchased, tokens_used, tokens_remaining, purchase_date)
  VALUES (NEW.id, 0, 0, 0, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5.2  fn_set_student_level — auto-assign level from grade (FIX 1)
--      Grade 7–9  → 'Junior School'
--      Grade 10–12 → 'Senior School'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_student_level()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.grade BETWEEN 7 AND 9 THEN
    NEW.level := 'Junior School';
  ELSIF NEW.grade BETWEEN 10 AND 12 THEN
    NEW.level := 'Senior School';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_student_level
  BEFORE INSERT OR UPDATE OF grade ON students
  FOR EACH ROW EXECUTE FUNCTION fn_set_student_level();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5.3  fn_sync_subscription_legacy_cols — keep end_date/plan_type in sync (FIX 3)
--      Canonical columns: expires_at, plan
--      Legacy columns:    end_date,   plan_type
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_subscription_legacy_cols()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.end_date  := NEW.expires_at;
  NEW.plan_type := NEW.plan;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_subscription_legacy_cols
  BEFORE INSERT OR UPDATE OF expires_at, plan ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_sync_subscription_legacy_cols();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5.4  fn_sync_user_tokens_from_balance — mirror token_balances → user_tokens (FIX 4)
--      Ensures legacy reads of user_tokens see the current balance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_user_tokens_from_balance()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_tokens (user_id, tokens_purchased, tokens_used, tokens_remaining, purchase_date)
  VALUES (NEW.user_id, NEW.total_ever, (NEW.total_ever - NEW.balance), NEW.balance, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    tokens_remaining = NEW.balance,
    tokens_used      = (NEW.total_ever - NEW.balance),
    tokens_purchased = NEW.total_ever;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_user_tokens
  AFTER INSERT OR UPDATE OF balance, total_ever ON token_balances
  FOR EACH ROW EXECUTE FUNCTION fn_sync_user_tokens_from_balance();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5.5  fn_check_pathway_is_junior — enforce pathway_analyses = Junior School only (FIX 6)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_check_pathway_is_junior()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_grade INTEGER;
BEGIN
  SELECT grade INTO v_grade FROM students WHERE id = NEW.student_id;

  IF v_grade IS NULL OR v_grade < 7 OR v_grade > 9 THEN
    RAISE EXCEPTION
      'Pathway recommendations are only available for Junior School students (Grade 7–9). Got grade: %', v_grade;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_pathway_is_junior
  BEFORE INSERT ON pathway_analyses
  FOR EACH ROW EXECUTE FUNCTION fn_check_pathway_is_junior();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5.6  deduct_tokens — atomically spend tokens from token_balances
--      Returns TRUE on success, FALSE if balance insufficient
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION deduct_tokens(
  p_user_id  UUID,
  p_action   TEXT,
  p_tokens   INTEGER,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT balance INTO v_balance
  FROM token_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_tokens THEN
    RETURN FALSE;
  END IF;

  UPDATE token_balances
  SET balance    = balance - p_tokens,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO token_usage (user_id, action, tokens_used, metadata)
  VALUES (p_user_id, p_action, p_tokens, p_metadata);

  RETURN TRUE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5.7  create_user_with_referral — wire up referral bonuses on signup
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_user_with_referral(
  p_email            TEXT,
  p_name             TEXT DEFAULT NULL,
  p_referred_by_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id       UUID,
  referral_code TEXT,
  free_analyses INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_referral_code TEXT;
  v_referrer_id   UUID;
  v_bonus_tokens  INTEGER := 3;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for email %', p_email;
  END IF;

  SELECT u.referral_code INTO v_referral_code
  FROM users u WHERE u.id = v_user_id;

  IF p_referred_by_code IS NOT NULL AND p_referred_by_code != '' THEN
    SELECT id INTO v_referrer_id
    FROM users WHERE referral_code = p_referred_by_code LIMIT 1;

    IF v_referrer_id IS NOT NULL THEN
      UPDATE users
      SET referred_by_code = p_referred_by_code
      WHERE id = v_user_id;

      INSERT INTO token_balances (user_id, balance, total_ever)
      VALUES (v_referrer_id, v_bonus_tokens, v_bonus_tokens)
      ON CONFLICT (user_id) DO UPDATE
        SET balance    = token_balances.balance + v_bonus_tokens,
            total_ever = token_balances.total_ever + v_bonus_tokens,
            updated_at = NOW();

      INSERT INTO token_usage (user_id, action, tokens_used, metadata)
      VALUES (v_referrer_id, 'referral_bonus', -v_bonus_tokens,
              jsonb_build_object('referred_user', p_email));
    END IF;
  END IF;

  RETURN QUERY
  SELECT v_user_id,
         v_referral_code,
         (SELECT u.free_analyses FROM users u WHERE u.id = v_user_id);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5.8  get_referral_stats
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_referral_stats(p_user_id UUID)
RETURNS TABLE (
  referral_code       TEXT,
  total_referrals     BIGINT,
  total_tokens_earned BIGINT,
  pending_referrals   BIGINT,
  completed_referrals BIGINT,
  recent_referrals    JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_referral_code TEXT;
BEGIN
  SELECT u.referral_code INTO v_referral_code
  FROM users u WHERE u.id = p_user_id;

  RETURN QUERY
  SELECT
    v_referral_code,
    COUNT(*)                                                   AS total_referrals,
    COUNT(*) * 3                                               AS total_tokens_earned,
    COUNT(*) FILTER (WHERE tu.balance = 0)                     AS pending_referrals,
    COUNT(*) FILTER (WHERE tu.balance > 0)                     AS completed_referrals,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'email', au.email,
          'joined_at', referred.created_at
        ) ORDER BY referred.created_at DESC
      ) FILTER (WHERE referred.id IS NOT NULL),
      '[]'::jsonb
    )                                                          AS recent_referrals
  FROM users referred
  LEFT JOIN auth.users au ON au.id = referred.id
  LEFT JOIN token_balances tu ON tu.user_id = referred.id
  WHERE referred.referred_by_code = v_referral_code;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5.9  use_free_analysis — consume one free analysis slot
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION use_free_analysis(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_free   INTEGER;
  v_expire TIMESTAMPTZ;
BEGIN
  SELECT free_analyses, free_analyses_expire_at
  INTO v_free, v_expire
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_expire IS NOT NULL AND v_expire < NOW() THEN
    UPDATE users SET free_analyses = 0 WHERE id = p_user_id;
    RETURN FALSE;
  END IF;

  IF v_free IS NULL OR v_free <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE users
  SET free_analyses      = free_analyses - 1,
      free_analyses_used = free_analyses_used + 1
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5.10  expire_free_analyses — cron: zero out expired free analyses
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_free_analyses()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET free_analyses = 0
  WHERE free_analyses > 0
    AND free_analyses_expire_at IS NOT NULL
    AND free_analyses_expire_at < NOW();
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5.11  mark_users_for_deletion — cron: flag users inactive > 90 days
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_users_for_deletion()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET is_marked_for_deletion = TRUE,
      marked_for_deletion_at = NOW()
  WHERE is_marked_for_deletion = FALSE
    AND last_active < NOW() - INTERVAL '90 days'
    AND NOT EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.user_id = users.id
        AND s.status = 'active'
        AND s.expires_at > NOW()
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5.12  cleanup_marked_users — cron: delete users marked for 30+ days
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_marked_users()
RETURNS TABLE (
  deleted_count      INTEGER,
  idle_deleted       INTEGER,
  unverified_deleted INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_idle_deleted       INTEGER := 0;
  v_unverified_deleted INTEGER := 0;
BEGIN
  -- Delete long-idle users (marked > 30 days ago)
  WITH deleted AS (
    DELETE FROM auth.users
    WHERE id IN (
      SELECT id FROM users
      WHERE is_marked_for_deletion = TRUE
        AND marked_for_deletion_at < NOW() - INTERVAL '30 days'
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_idle_deleted FROM deleted;

  -- Delete unverified accounts older than 7 days
  WITH deleted AS (
    DELETE FROM auth.users
    WHERE email_confirmed_at IS NULL
      AND created_at < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_unverified_deleted FROM deleted;

  INSERT INTO user_cleanup_stats (deleted_count, idle_deleted, unverified_deleted)
  VALUES (
    v_idle_deleted + v_unverified_deleted,
    v_idle_deleted,
    v_unverified_deleted
  );

  RETURN QUERY SELECT
    v_idle_deleted + v_unverified_deleted,
    v_idle_deleted,
    v_unverified_deleted;
END;
$$;


-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on every user-owned table
ALTER TABLE profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE students                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE strand_assessments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_interests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychometric_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pathway_analyses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_match_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_balances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens              ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE compass_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE compass_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_votes            ENABLE ROW LEVEL SECURITY;

-- Public read-only tables
ALTER TABLE career_intelligence      ENABLE ROW LEVEL SECURITY;
ALTER TABLE careers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_careers          ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────────────────────────────────
CREATE POLICY "profiles: own read"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: own update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── users ─────────────────────────────────────────────────────────────────
CREATE POLICY "users: own read"   ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users: own update" ON users FOR UPDATE USING (auth.uid() = id);

-- ── students ──────────────────────────────────────────────────────────────
CREATE POLICY "students: own read"   ON students FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "students: own insert" ON students FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "students: own update" ON students FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "students: own delete" ON students FOR DELETE USING (auth.uid() = user_id);

-- ── assessments ───────────────────────────────────────────────────────────
CREATE POLICY "assessments: own read" ON assessments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = assessments.student_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "assessments: own insert" ON assessments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = assessments.student_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "assessments: own update" ON assessments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = assessments.student_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "assessments: own delete" ON assessments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = assessments.student_id AND s.user_id = auth.uid()
  ));

-- ── strand_assessments ────────────────────────────────────────────────────
CREATE POLICY "strand_assessments: own read" ON strand_assessments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = strand_assessments.student_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "strand_assessments: own insert" ON strand_assessments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = strand_assessments.student_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "strand_assessments: own update" ON strand_assessments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = strand_assessments.student_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "strand_assessments: own delete" ON strand_assessments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = strand_assessments.student_id AND s.user_id = auth.uid()
  ));

-- ── student_interests ─────────────────────────────────────────────────────
CREATE POLICY "student_interests: own" ON student_interests
  USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = student_interests.student_id AND s.user_id = auth.uid()
  ));

-- ── psychometric_assessments ──────────────────────────────────────────────
CREATE POLICY "psychometric_assessments: own" ON psychometric_assessments
  USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = psychometric_assessments.student_id AND s.user_id = auth.uid()
  ));

-- ── learner_profiles ──────────────────────────────────────────────────────
CREATE POLICY "learner_profiles: own" ON learner_profiles
  USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = learner_profiles.student_id AND s.user_id = auth.uid()
  ));

-- ── pathway_analyses ──────────────────────────────────────────────────────
CREATE POLICY "pathway_analyses: own read"   ON pathway_analyses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pathway_analyses: own insert" ON pathway_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── career_match_reports ──────────────────────────────────────────────────
CREATE POLICY "career_match_reports: own read" ON career_match_reports
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = career_match_reports.student_id AND s.user_id = auth.uid()
  ));

-- ── payments ──────────────────────────────────────────────────────────────
CREATE POLICY "payments: own read" ON payments FOR SELECT USING (auth.uid() = user_id);

-- ── token_balances ────────────────────────────────────────────────────────
CREATE POLICY "token_balances: own read"   ON token_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "token_balances: own update" ON token_balances FOR UPDATE USING (auth.uid() = user_id);

-- ── user_tokens ───────────────────────────────────────────────────────────
CREATE POLICY "user_tokens: own read" ON user_tokens FOR SELECT USING (auth.uid() = user_id);

-- ── token_usage ───────────────────────────────────────────────────────────
CREATE POLICY "token_usage: own read" ON token_usage FOR SELECT USING (auth.uid() = user_id);

-- ── subscriptions ─────────────────────────────────────────────────────────
CREATE POLICY "subscriptions: own read"   ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "subscriptions: own insert" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── compass_sessions ──────────────────────────────────────────────────────
CREATE POLICY "compass_sessions: own read"   ON compass_sessions FOR SELECT USING (auth.uid() = learner_id);
CREATE POLICY "compass_sessions: own insert" ON compass_sessions FOR INSERT WITH CHECK (auth.uid() = learner_id);
CREATE POLICY "compass_sessions: own update" ON compass_sessions FOR UPDATE USING (auth.uid() = learner_id);

-- ── compass_messages ──────────────────────────────────────────────────────
CREATE POLICY "compass_messages: own read" ON compass_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM compass_sessions cs
    WHERE cs.id = compass_messages.session_id AND cs.learner_id = auth.uid()
  ));
CREATE POLICY "compass_messages: own insert" ON compass_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM compass_sessions cs
    WHERE cs.id = compass_messages.session_id AND cs.learner_id = auth.uid()
  ));

-- ── user_feedback ─────────────────────────────────────────────────────────
CREATE POLICY "user_feedback: own insert" ON user_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_feedback: own read"   ON user_feedback FOR SELECT USING (auth.uid() = user_id);

-- ── user_activity_log ─────────────────────────────────────────────────────
CREATE POLICY "user_activity_log: own insert" ON user_activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_activity_log: own read"   ON user_activity_log FOR SELECT USING (auth.uid() = user_id);

-- ── ai_usage ──────────────────────────────────────────────────────────────
CREATE POLICY "ai_usage: own read"   ON ai_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_usage: own insert" ON ai_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_usage: own update" ON ai_usage FOR UPDATE USING (auth.uid() = user_id);

-- ── ai_usage_logs ─────────────────────────────────────────────────────────
CREATE POLICY "ai_usage_logs: own read"   ON ai_usage_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_usage_logs: own insert" ON ai_usage_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── feature_requests ──────────────────────────────────────────────────────
CREATE POLICY "feature_requests: public read"  ON feature_requests FOR SELECT USING (TRUE);
CREATE POLICY "feature_requests: auth insert"  ON feature_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "feature_requests: own update"   ON feature_requests FOR UPDATE USING (auth.uid() = user_id);

-- ── feature_votes ─────────────────────────────────────────────────────────
CREATE POLICY "feature_votes: own read"   ON feature_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "feature_votes: own insert" ON feature_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feature_votes: own delete" ON feature_votes FOR DELETE USING (auth.uid() = user_id);

-- ── career_intelligence / careers / dynamic_careers — public read ─────────
CREATE POLICY "career_intelligence: public read" ON career_intelligence FOR SELECT USING (TRUE);
CREATE POLICY "careers: public read"             ON careers             FOR SELECT USING (TRUE);
CREATE POLICY "dynamic_careers: public read"     ON dynamic_careers     FOR SELECT USING (TRUE);

-- ── Grant RPC execution to authenticated users ────────────────────────────
GRANT EXECUTE ON FUNCTION deduct_tokens(uuid, text, integer, jsonb)   TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_referral(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_referral_stats(uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION use_free_analysis(uuid)                     TO authenticated;


-- =============================================================================
-- 7. CORRECTIONS PATCH — DATA BACKFILLS
--    Structural changes from corrections_patch.sql are already integrated above.
--    These statements reconcile any pre-existing data in a live database.
-- =============================================================================

-- Backfill students.level from grade (FIX 1)
UPDATE students
SET level = CASE
  WHEN grade BETWEEN 7  AND 9  THEN 'Junior School'
  WHEN grade BETWEEN 10 AND 12 THEN 'Senior School'
  ELSE level
END;

-- Backfill subscriptions legacy columns from canonical columns (FIX 3)
UPDATE subscriptions
SET end_date  = expires_at,
    plan_type = plan
WHERE end_date IS NULL OR plan_type IS NULL;

-- Backfill user_tokens from token_balances (FIX 4)
INSERT INTO user_tokens (user_id, tokens_purchased, tokens_used, tokens_remaining, purchase_date)
SELECT
  user_id,
  total_ever             AS tokens_purchased,
  (total_ever - balance) AS tokens_used,
  balance                AS tokens_remaining,
  NOW()                  AS purchase_date
FROM token_balances
ON CONFLICT (user_id)
DO UPDATE SET
  tokens_remaining = EXCLUDED.tokens_remaining,
  tokens_used      = EXCLUDED.tokens_used,
  tokens_purchased = EXCLUDED.tokens_purchased;


-- =============================================================================
-- Done
-- =============================================================================
