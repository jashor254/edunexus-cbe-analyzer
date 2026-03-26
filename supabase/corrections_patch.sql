-- =============================================================================
-- EDUNEXUS — CORRECTIONS PATCH
-- Append this to the END of schema.sql before executing in Supabase SQL Editor
-- Fixes all mismatches found between the codebase and the schema
-- Safe to re-run — uses DROP/ALTER … CASCADE + IF EXISTS guards
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: students — grade range + level definition
--
-- PROBLEM: Schema allowed grade 4–12, code treated grade <= 9 as Junior School
--          but user confirmed: Junior School = Grade 7–9, Senior School = Grade 10–12
-- FIX:     Restrict grade to 7–12, add auto-level trigger from grade
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_grade_check;

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_level_check;

ALTER TABLE students
  ADD CONSTRAINT students_grade_check
    CHECK (grade BETWEEN 7 AND 12);

ALTER TABLE students
  ADD CONSTRAINT students_level_check
    CHECK (level IN ('Junior School', 'Senior School'));

-- Auto-assign level from grade on every insert/update
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

DROP TRIGGER IF EXISTS trg_set_student_level ON students;
CREATE TRIGGER trg_set_student_level
  BEFORE INSERT OR UPDATE OF grade ON students
  FOR EACH ROW EXECUTE FUNCTION fn_set_student_level();

-- Backfill any existing rows with wrong level
UPDATE students
SET level = CASE
  WHEN grade BETWEEN 7  AND 9  THEN 'Junior School'
  WHEN grade BETWEEN 10 AND 12 THEN 'Senior School'
  ELSE level
END;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: subscriptions — remove 'starter' from plan CHECK
--
-- PROBLEM: 'starter' is a token purchase product, NOT a subscription plan.
--          callback/route.ts never inserts 'starter' into subscriptions.
--          Having it in the CHECK constraint is misleading and wrong.
-- FIX:     Only allow real subscription tiers: term, premium, school
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_plan_check
    CHECK (plan IN ('term', 'premium', 'school'));


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: subscriptions — sync end_date = expires_at and plan_type = plan
--
-- PROBLEM:
--   • callback/route.ts writes ONLY to: plan, status, started_at, expires_at, payment_id
--   • tokens/deduct/route.ts (old) queried:  .gte('end_date', ...)   → always NULL → never found
--   • tokens/check/route.ts (old) returned:  subscriptions[0].plan_type → NULL
--   • Result: token routes ALWAYS thought user had no subscription even after paying
--
-- FIX (SQL side): Trigger keeps end_date and plan_type in sync with the canonical columns.
--                 Code files tokens/deduct and tokens/check have been updated to use
--                 expires_at and plan directly — this trigger is an extra safety net.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_sync_subscription_legacy_cols()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- Keep legacy columns in sync so any old queries still work
  NEW.end_date   := NEW.expires_at;
  NEW.plan_type  := NEW.plan;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_subscription_legacy_cols ON subscriptions;
CREATE TRIGGER trg_sync_subscription_legacy_cols
  BEFORE INSERT OR UPDATE OF expires_at, plan ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_sync_subscription_legacy_cols();

-- Backfill all existing rows
UPDATE subscriptions
SET end_date  = expires_at,
    plan_type = plan
WHERE end_date IS NULL OR plan_type IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 4: token_balances vs user_tokens — row-level sync
--
-- PROBLEM:
--   • deduct_tokens RPC operates on token_balances.balance (correct)
--   • tokens/deduct and tokens/check (old code) read user_tokens.tokens_remaining
--   • After any deduction via RPC, user_tokens is NEVER updated → shows stale balance
--
-- FIX (SQL side): Trigger keeps user_tokens.tokens_remaining in sync with token_balances.
--                 Code files have been updated to read token_balances directly,
--                 but this trigger protects any remaining legacy consumers.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_sync_user_tokens_from_balance()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- Upsert into user_tokens so legacy queries see correct remaining balance
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

-- user_tokens needs a UNIQUE constraint on user_id for the upsert above
ALTER TABLE user_tokens
  DROP CONSTRAINT IF EXISTS user_tokens_user_id_unique;

ALTER TABLE user_tokens
  ADD CONSTRAINT user_tokens_user_id_unique UNIQUE (user_id);

DROP TRIGGER IF EXISTS trg_sync_user_tokens ON token_balances;
CREATE TRIGGER trg_sync_user_tokens
  AFTER INSERT OR UPDATE OF balance, total_ever ON token_balances
  FOR EACH ROW EXECUTE FUNCTION fn_sync_user_tokens_from_balance();

-- Backfill user_tokens from token_balances
INSERT INTO user_tokens (user_id, tokens_purchased, tokens_used, tokens_remaining, purchase_date)
SELECT
  user_id,
  total_ever                  AS tokens_purchased,
  (total_ever - balance)      AS tokens_used,
  balance                     AS tokens_remaining,
  NOW()                       AS purchase_date
FROM token_balances
ON CONFLICT (user_id)
DO UPDATE SET
  tokens_remaining = EXCLUDED.tokens_remaining,
  tokens_used      = EXCLUDED.tokens_used,
  tokens_purchased = EXCLUDED.tokens_purchased;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 5: handle_new_user trigger — also create user_tokens row on signup
--
-- PROBLEM: handle_new_user creates token_balances row but NOT user_tokens row.
--          Any legacy code reading user_tokens finds nothing for new users.
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

-- Re-attach trigger (function replaced above)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 6: pathway_analyses — enforce Junior School only (Grade 7–9)
--
-- PROBLEM: pathway_analyses had no grade constraint — senior students could
--          get pathway recommendations which are only meaningful for Junior School.
-- FIX:     Add a CHECK that the linked student is Grade 7–9 via a trigger.
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

DROP TRIGGER IF EXISTS trg_check_pathway_is_junior ON pathway_analyses;
CREATE TRIGGER trg_check_pathway_is_junior
  BEFORE INSERT ON pathway_analyses
  FOR EACH ROW EXECUTE FUNCTION fn_check_pathway_is_junior();


-- ─────────────────────────────────────────────────────────────────────────────
-- SUMMARY OF ALL FIXES APPLIED
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1. students.grade        → restricted to 7–12 (7–9 = Junior, 10–12 = Senior)
-- 2. students.level        → auto-set by trigger from grade (no manual mistakes)
-- 3. subscriptions.plan    → removed 'starter' (it's a token product, not a sub)
-- 4. subscriptions.end_date / plan_type
--                          → synced with expires_at / plan via trigger + backfilled
-- 5. user_tokens           → synced from token_balances via trigger + backfilled
-- 6. handle_new_user       → now creates BOTH token_balances AND user_tokens rows
-- 7. pathway_analyses      → enforced Junior School only (Grade 7–9) via trigger
--
-- CODE FILES ALSO FIXED (outside SQL):
--   app/api/tokens/deduct/route.ts  → uses expires_at + token_balances (was end_date + user_tokens)
--   app/api/tokens/check/route.ts   → uses expires_at + plan + token_balances (was end_date + plan_type + user_tokens)
--   app/api/clinic/download/route.tsx → isJunior = grade >= 7 && grade <= 9 (was grade <= 9)
-- =============================================================================
