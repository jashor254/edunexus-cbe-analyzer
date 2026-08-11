-- Fix subscriptions_plan_check drift: 'family' is a canonical subscription
-- product (lib/payments/config.ts SUBSCRIPTION_PLANS.TERMLY_FAMILY.id,
-- lib/payments/fulfillment.ts SUBSCRIPTION_PRODUCTS) but was never added to
-- the live CHECK constraint, which only allowed ('term','premium','school').
-- A valid family-plan payment could succeed at the payments layer and still
-- fail when fulfillPayment()/creditSubscription() tried to credit the
-- subscription row.
--
-- 'term', 'premium', 'school' are preserved unchanged — 'premium' and
-- 'school' both have live rows (7 and 1 respectively); 'school' has no
-- current code writer but is a pre-existing, intentionally-retained value
-- (schema.sql has always allowed it) with a real permanent-grant row, so it
-- is kept rather than removed as part of this narrow repair.
--
-- Recorded live under migration version 20260805065935 on 2026-08-05; this
-- file reconciles the repository with that already-applied change.

ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan = ANY (ARRAY['term'::text, 'premium'::text, 'family'::text, 'school'::text]));
