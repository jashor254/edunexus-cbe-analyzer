-- Recovered from production migration 20260702072626_eils_intelligence_learning_system
-- (exact statement text). No repo file. Needed by security phase 3.
CREATE TABLE IF NOT EXISTS eils_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid        REFERENCES learners(id) ON DELETE CASCADE,
  event_type   text        NOT NULL,
  source       text        NOT NULL,
  payload      jsonb       NOT NULL DEFAULT '{}',
  processed    boolean     NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eils_events_student_id   ON eils_events(student_id);
CREATE INDEX IF NOT EXISTS idx_eils_events_event_type   ON eils_events(event_type);
CREATE INDEX IF NOT EXISTS idx_eils_events_processed    ON eils_events(processed) WHERE NOT processed;
CREATE INDEX IF NOT EXISTS idx_eils_events_created_at   ON eils_events(created_at DESC);

CREATE TABLE IF NOT EXISTS eils_recommendations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  action_type     text        NOT NULL,
  priority        integer     NOT NULL DEFAULT 50,
  confidence      numeric(4,3) NOT NULL DEFAULT 0.5,
  reasoning       text        NOT NULL,
  evidence        jsonb       NOT NULL DEFAULT '{}',
  expected_impact text        NOT NULL,
  subject         text,
  substrand       text,
  source_system   text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending',
  actioned_at     timestamptz,
  outcome         text,
  outcome_note    text,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eils_recs_student_status ON eils_recommendations(student_id, status);
CREATE INDEX IF NOT EXISTS idx_eils_recs_priority       ON eils_recommendations(student_id, priority) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS eils_interventions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  risk_flag_type    text        NOT NULL,
  subject           text,
  substrand         text,
  intervention_type text        NOT NULL,
  intervention_ref  text,
  teacher_id        uuid,
  started_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  outcome           text,
  outcome_evidence  jsonb,
  consecutive_weeks_before integer,
  was_effective     boolean,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eils_interventions_student  ON eils_interventions(student_id);
CREATE INDEX IF NOT EXISTS idx_eils_interventions_teacher  ON eils_interventions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_eils_interventions_outcome  ON eils_interventions(outcome) WHERE outcome IS NULL;

CREATE TABLE IF NOT EXISTS eils_reasoning_log (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id              uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  reasoning_type          text        NOT NULL,
  question                text        NOT NULL,
  conclusion              text        NOT NULL,
  confidence              numeric(4,3) NOT NULL DEFAULT 0.5,
  evidence                jsonb       NOT NULL DEFAULT '{}',
  kg_evidence             jsonb,
  learner_history_evidence jsonb,
  career_evidence         jsonb,
  recommendation_id       uuid        REFERENCES eils_recommendations(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eils_reasoning_student    ON eils_reasoning_log(student_id);
CREATE INDEX IF NOT EXISTS idx_eils_reasoning_type       ON eils_reasoning_log(reasoning_type);
CREATE INDEX IF NOT EXISTS idx_eils_reasoning_created    ON eils_reasoning_log(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS eils_milestones (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  milestone_type text        NOT NULL,
  title          text        NOT NULL,
  description    text        NOT NULL,
  evidence       jsonb       NOT NULL DEFAULT '{}',
  celebrated     boolean     NOT NULL DEFAULT false,
  notified_teacher boolean   NOT NULL DEFAULT false,
  notified_parent  boolean   NOT NULL DEFAULT false,
  achieved_at    timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eils_milestones_student    ON eils_milestones(student_id);
CREATE INDEX IF NOT EXISTS idx_eils_milestones_celebrated ON eils_milestones(celebrated) WHERE NOT celebrated;

ALTER TABLE eils_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE eils_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE eils_interventions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE eils_reasoning_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE eils_milestones      ENABLE ROW LEVEL SECURITY;


-- Recovered from production migration 20260604065832_career_reality_engine_rebuild
-- (exact statement text). No repo file. Needed by security phase 4-prereq (v_api_careers).
DROP TABLE IF EXISTS careers CASCADE;
DROP TABLE IF EXISTS student_career_interests CASCADE;
DROP TABLE IF EXISTS student_career_matches CASCADE;

CREATE TABLE careers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  ai_impact JSONB,
  ai_impact_level TEXT CHECK (ai_impact_level IN ('low','medium','high','transforming')),
  kenya_market_outlook TEXT NOT NULL,
  salary_range_kes JSONB,
  pathways JSONB NOT NULL,
  pathway TEXT,
  required_subjects JSONB NOT NULL,
  skill_timeline JSONB NOT NULL,
  future_skills JSONB NOT NULL,
  obsolete_skills JSONB,
  kenya_examples JSONB,
  doors JSONB,
  subject_importance JSONB,
  disclaimer TEXT,
  source TEXT,
  search_count INTEGER,
  university_courses JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- NOTE: ai_impact recovered here as jsonb (matches production's CURRENT
-- live shape, confirmed via information_schema + pg_get_viewdef on
-- v_api_careers 2026-08-15) even though the historical
-- career_reality_engine_rebuild statement text defines it as TEXT NOT
-- NULL. Production evidently ALTERed this column in a later,
-- unrecovered migration. pathway/doors/subject_importance/disclaimer/
-- source/search_count/university_courses are the same class of gap —
-- present in live production, absent from every tracked migration.

CREATE TABLE student_career_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  career_id UUID REFERENCES careers(id),
  career_slug TEXT,
  interest_level INTEGER CHECK (interest_level BETWEEN 1 AND 5) DEFAULT 3,
  notes TEXT,
  explored_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_career_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  career_id UUID NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  match_score INTEGER CHECK (match_score BETWEEN 0 AND 100),
  match_reasoning TEXT,
  subject_gaps JSONB,
  skill_gaps JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, career_id)
);

ALTER TABLE careers ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_career_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_career_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "careers_public_read" ON careers FOR SELECT TO authenticated USING (true);
CREATE POLICY "career_interests_own" ON student_career_interests FOR ALL TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "career_matches_own" ON student_career_matches FOR ALL TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE INDEX idx_careers_category ON careers(category);
CREATE INDEX idx_careers_slug ON careers(slug);
CREATE INDEX idx_career_interests_student ON student_career_interests(student_id);
CREATE INDEX idx_career_matches_student ON student_career_matches(student_id);
CREATE INDEX idx_career_matches_career ON student_career_matches(career_id);


-- Recovered current live function definitions (pg_get_functiondef) for every
-- function referenced by security-hardening phases 8-11 with no origin in
-- any tracked migration or loose file. These are the CURRENT (already
-- search_path-hardened) definitions, not a separately-reconstructed
-- pre-hardening form — phases 1/7 (search_path) will simply no-op against
-- them, which is safe; phases 8-11 (REVOKE/GRANT) apply to the function
-- signature regardless of body content.

CREATE OR REPLACE FUNCTION public.add_tokens(p_user_id uuid, p_tokens integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE profiles SET tokens = tokens + p_tokens, updated_at = NOW() WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_subscription_active(p_user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  user_plan TEXT;
  sub_end TIMESTAMPTZ;
BEGIN
  SELECT plan_type, subscription_end INTO user_plan, sub_end FROM profiles WHERE id = p_user_id;
  IF user_plan = 'lifetime' THEN RETURN TRUE; END IF;
  IF user_plan = 'termly' AND sub_end > NOW() THEN RETURN TRUE; END IF;
  RETURN EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id AND tokens > 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_marked_users()
 RETURNS TABLE(deleted_count integer, idle_deleted integer, unverified_deleted integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_idle_deleted       INTEGER := 0;
  v_unverified_deleted INTEGER := 0;
BEGIN
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

  WITH deleted AS (
    DELETE FROM auth.users
    WHERE email_confirmed_at IS NULL
      AND created_at < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_unverified_deleted FROM deleted;

  INSERT INTO user_cleanup_stats (deleted_count, idle_deleted, unverified_deleted)
  VALUES (v_idle_deleted + v_unverified_deleted, v_idle_deleted, v_unverified_deleted);

  RETURN QUERY SELECT v_idle_deleted + v_unverified_deleted, v_idle_deleted, v_unverified_deleted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_user_with_referral(p_email text, p_name text DEFAULT NULL::text, p_referred_by_code text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, referral_code text, free_analyses integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  SELECT u.referral_code INTO v_referral_code FROM users u WHERE u.id = v_user_id;
  IF p_referred_by_code IS NOT NULL AND p_referred_by_code != '' THEN
    SELECT id INTO v_referrer_id FROM users WHERE referral_code = p_referred_by_code LIMIT 1;
    IF v_referrer_id IS NOT NULL THEN
      UPDATE users SET referred_by_code = p_referred_by_code WHERE id = v_user_id;
      INSERT INTO token_balances (user_id, balance, total_ever)
      VALUES (v_referrer_id, v_bonus_tokens, v_bonus_tokens)
      ON CONFLICT (user_id) DO UPDATE
        SET balance    = token_balances.balance + v_bonus_tokens,
            total_ever = token_balances.total_ever + v_bonus_tokens,
            updated_at = NOW();
      INSERT INTO token_usage (user_id, action, tokens_used, metadata)
      VALUES (v_referrer_id, 'referral_bonus', -v_bonus_tokens, jsonb_build_object('referred_user', p_email));
    END IF;
  END IF;
  RETURN QUERY
  SELECT v_user_id, v_referral_code, (SELECT u.free_analyses FROM users u WHERE u.id = v_user_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_ai_token(p_user_id text, p_feature text)
 RETURNS boolean LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription_id UUID;
  v_tokens_remaining INTEGER;
BEGIN
  SELECT id, ai_tokens_remaining INTO v_subscription_id, v_tokens_remaining
  FROM subscriptions
  WHERE user_id = p_user_id AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC LIMIT 1;
  IF v_subscription_id IS NULL THEN RETURN FALSE; END IF;
  IF v_tokens_remaining <= 0 THEN RETURN FALSE; END IF;
  UPDATE subscriptions SET ai_tokens_remaining = ai_tokens_remaining - 1, updated_at = NOW()
  WHERE id = v_subscription_id;
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_ai_token(p_user_id uuid, p_feature text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription_id UUID;
BEGIN
  UPDATE subscriptions
  SET ai_tokens_remaining = ai_tokens_remaining - 1
  WHERE user_id = p_user_id AND status = 'active' AND ai_tokens_remaining > 0
  RETURNING id INTO v_subscription_id;
  IF v_subscription_id IS NULL THEN RETURN FALSE; END IF;
  INSERT INTO token_usage_log (user_id, action, tokens_consumed, metadata)
  VALUES (p_user_id, p_feature, 1, jsonb_build_object('subscription_id', v_subscription_id));
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_tokens(p_user_id uuid, p_tokens integer)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  current_tokens INTEGER;
BEGIN
  SELECT tokens INTO current_tokens FROM profiles WHERE id = p_user_id;
  IF current_tokens >= p_tokens THEN
    UPDATE profiles SET tokens = tokens - p_tokens, updated_at = NOW() WHERE id = p_user_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_tokens(p_user_id uuid, p_action text, p_tokens integer, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT balance INTO v_balance FROM token_balances WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_tokens THEN RETURN FALSE; END IF;
  UPDATE token_balances SET balance = balance - p_tokens, updated_at = NOW() WHERE user_id = p_user_id;
  INSERT INTO token_usage (user_id, action, tokens_used, metadata) VALUES (p_user_id, p_action, p_tokens, p_metadata);
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_free_analyses()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE users SET free_analyses = 0
  WHERE free_analyses > 0 AND free_analyses_expire_at IS NOT NULL AND free_analyses_expire_at < NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_grade_topics(p_min_grade integer, p_grade integer, p_subject text)
 RETURNS TABLE(title text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT ss.title
  FROM sow_substrands ss
  JOIN sow_strands        st ON st.id = ss.strand_id
  JOIN sow_learning_areas la ON la.id = st.learning_area_id
  JOIN sow_grades          g ON  g.id = la.grade_id
  WHERE g.numeric_grade BETWEEN p_min_grade AND p_grade
    AND la.name ILIKE '%' || p_subject || '%'
  ORDER BY g.numeric_grade, st.order_index, ss.order_index
  LIMIT 5;
$function$;

CREATE OR REPLACE FUNCTION public.get_learner_dashboard_stats(p_learner_id uuid)
 RETURNS TABLE(streak_days integer, concepts_mastered integer, avg_cognitive_load text, last_session_quality integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 5::INTEGER, COUNT(id)::INTEGER, 'optimal'::TEXT, 85::INTEGER
    FROM public.chat_messages
    WHERE session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = p_learner_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id uuid)
 RETURNS TABLE(referral_code text, total_referrals bigint, total_tokens_earned bigint, pending_referrals bigint, completed_referrals bigint, recent_referrals jsonb)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_referral_code TEXT;
BEGIN
  SELECT u.referral_code INTO v_referral_code FROM users u WHERE u.id = p_user_id;
  RETURN QUERY
  SELECT
    v_referral_code,
    COUNT(*)                                     AS total_referrals,
    COUNT(*) * 3                                 AS total_tokens_earned,
    COUNT(*) FILTER (WHERE tu.balance = 0)       AS pending_referrals,
    COUNT(*) FILTER (WHERE tu.balance > 0)       AS completed_referrals,
    COALESCE(
      jsonb_agg(
        jsonb_build_object('email', au.email, 'joined_at', referred.created_at)
        ORDER BY referred.created_at DESC
      ) FILTER (WHERE referred.id IS NOT NULL),
      '[]'::jsonb
    )                                             AS recent_referrals
  FROM users referred
  LEFT JOIN auth.users au ON au.id = referred.id
  LEFT JOIN token_balances tu ON tu.user_id = referred.id
  WHERE referred.referred_by_code = v_referral_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_ultimate()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, user_type)
  VALUES (
    new.id, new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url', 'learner'
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  INSERT INTO public.parent_profiles (id, subscription_tier)
  VALUES (new.id, 'trial') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_tokens (user_id, balance, lifetime_earned)
  VALUES (new.id, 10, 10) ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_successful_payment_webhook(p_user_id uuid, p_transaction_id text, p_product_id text, p_payment_type text, p_tokens_to_add integer, p_amount numeric, p_metadata jsonb, p_customer_email text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE payments SET status = 'success', updated_at = NOW(), metadata = p_metadata WHERE transaction_id = p_transaction_id;
  IF p_payment_type = 'subscription' THEN
    UPDATE profiles SET subscription_status = 'active', plan_type = 'termly', expiry_date = NOW() + INTERVAL '4 months', updated_at = NOW()
    WHERE id = p_user_id;
  END IF;
  IF p_payment_type = 'bundle' THEN
    UPDATE profiles SET total_tokens = COALESCE(total_tokens, 0) + p_tokens_to_add, updated_at = NOW() WHERE id = p_user_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_beta_teacher_count()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE beta_stats SET value = value + 1, updated_at = NOW() WHERE key = 'teacher_signups'
  RETURNING value INTO new_count;
  RETURN new_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, user_type)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'learner')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.learner_profiles (id, grade)
    VALUES (new.id, 1) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_tokens (user_id, balance)
    VALUES (new.id, 5) ON CONFLICT (user_id) DO NOTHING;

    RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_users_for_deletion()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE users
  SET is_marked_for_deletion = TRUE, marked_for_deletion_at = NOW()
  WHERE is_marked_for_deletion = FALSE
    AND last_active < NOW() - INTERVAL '90 days'
    AND NOT EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.user_id = users.id AND s.status = 'active' AND s.expires_at > NOW()
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.upgrade_to_termly(p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE profiles SET plan_type = 'termly', tokens = 999999, subscription_end = NOW() + INTERVAL '3 months', updated_at = NOW()
  WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.use_free_analysis(p_user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_free   INTEGER;
  v_expire TIMESTAMPTZ;
BEGIN
  SELECT free_analyses, free_analyses_expire_at INTO v_free, v_expire FROM users WHERE id = p_user_id FOR UPDATE;
  IF v_expire IS NOT NULL AND v_expire < NOW() THEN
    UPDATE users SET free_analyses = 0 WHERE id = p_user_id;
    RETURN FALSE;
  END IF;
  IF v_free IS NULL OR v_free <= 0 THEN RETURN FALSE; END IF;
  UPDATE users SET free_analyses = free_analyses - 1, free_analyses_used = free_analyses_used + 1 WHERE id = p_user_id;
  RETURN TRUE;
END;
$function$;

-- handle_new_user() already exists (final_schema.sql) — not redefined here.
