-- 20261105120100_payments_product_id_check_teacher_tools.sql
--
-- The application sells these products (lib/payments/config.ts →
-- PURCHASABLE_PRODUCTS), but payments_product_id_check only allowed
-- starter / term / family / premium / planning_bundle. A purchase of any
-- teacher tool therefore failed at the INSERT of the pending payment row
-- ("Could not save transaction") — fail-closed (no money taken), but the
-- product could never be bought. Extends the check to the teacher-tool ids.
--
-- Safe on a live database: the check only gets WIDER, so every existing row
-- still satisfies it; the table is tiny. lib/payments/productIdConstraint.test.ts
-- fails if this list and the application's product registry drift apart.
--
-- Rollback (restores the narrower list; only valid while no row uses the new ids):
--   alter table public.payments drop constraint payments_product_id_check;
--   alter table public.payments add constraint payments_product_id_check
--     check (product_id in ('starter','term','family','premium','planning_bundle'));

alter table public.payments drop constraint if exists payments_product_id_check;
alter table public.payments add constraint payments_product_id_check
  check (product_id in (
    'starter', 'term', 'family', 'premium', 'planning_bundle',
    'class_reports', 'insha_pack', 'slides', 'remedial_plan', 'holiday_plan'
  ));
