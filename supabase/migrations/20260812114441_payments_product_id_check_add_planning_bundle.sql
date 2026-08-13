-- Widen payments_product_id_check to allow the Solo Teacher planning bundle.
--
-- 'planning_bundle' is the canonical Solo Teacher product introduced by the
-- pricing convergence (lib/payments/config.ts TEACHER_PLANNING_BUNDLE,
-- PURCHASABLE_PRODUCTS, TOKEN_GRANTS). Both payment entry points
-- (app/api/payments/initialize, app/api/payments/mobile-init) now resolve it
-- and price it server-side at KES 100, but the live CHECK constraint still
-- only allowed ('starter','term','family','premium'). A legitimate KES 100
-- purchase therefore failed at the INSERT into payments, before Paystack was
-- ever called — the product was unsellable.
--
-- Every existing value is preserved:
--   'starter'  — retired from public sale, but historical rows must remain
--                valid and must still fulfil (lib/payments/config.ts
--                TOKEN_GRANTS keeps its 10-token grant alive). Retiring a
--                product from sale must never strand a payment.
--   'term'     — Term Plan, still sold.
--   'family'   — Family Plan, still sold.
--   'premium'  — pre-existing, no current code writer, retained rather than
--                removed as part of this narrow repair (same reasoning as
--                20260805065935_fix_subscriptions_plan_check_add_family.sql
--                applied to 'school').
--
-- Additive only: no rows are read, updated, deleted or inserted, no columns
-- change, and no other table is touched.
--
-- Applied live as migration version 20260812114441 on 2026-08-12.

ALTER TABLE public.payments DROP CONSTRAINT payments_product_id_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_product_id_check
  CHECK (product_id = ANY (ARRAY[
    'starter'::text,
    'term'::text,
    'family'::text,
    'premium'::text,
    'planning_bundle'::text
  ]));
