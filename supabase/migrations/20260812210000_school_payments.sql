-- School Payment Record v1 — the durable commercial fact behind school entitlement.
--
-- TWO FACTS, DELIBERATELY SEPARATE
--   school_payments                      → WHY a school was granted access
--   schools.school_entitlement_status    → WHETHER access is allowed right now
--
-- checkFeatureAccess() reads only the second, on every gated teacher request.
-- It must never join to this table: entitlement is a hot-path decision, payment
-- history is an audit record, and merging them would put finance data on the
-- path of every scheme-of-work generation.
--
-- WHY NOT REUSE `payments`
-- That table is `user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE`.
-- A school payment recorded there would be pinned to whichever person happened
-- to be standing nearby, and deleting that person's account would delete the
-- school's payment history with it. Institutional money belongs to the
-- institution — that is the whole point of the entitlement model, where
-- coverage survives staff turnover. It also has no column for school, method,
-- reference, or coverage period, and its product_id CHECK has no school value.
--
-- NOT IN THIS TABLE, ON PURPOSE: currency (every price in this codebase is KES
-- by construction; a column that can only hold one value teaches nothing),
-- invoice numbers, tax fields, line items, provider payloads. This is an
-- operational record for the founder, not accounting software.

create table if not exists public.school_payments (
  id                 uuid primary key default gen_random_uuid(),

  -- RESTRICT, never CASCADE: deleting a school must not silently erase the
  -- evidence that it paid. This is the same reasoning that disqualified the
  -- `payments` table.
  school_id          uuid        not null references public.schools(id) on delete restrict,

  amount             integer     not null,
  payment_method     text        not null,
  payment_reference  text        not null,

  -- When the money moved, which is not when it was recorded. A bank statement
  -- gives you a day, not an instant — storing a time would be false precision.
  payment_date       date        not null,

  coverage_start     date,
  coverage_end       date        not null,

  -- The human platform admin who personally verified the money arrived.
  -- FK to growth_users because that is the identity requireGrowthUser() returns
  -- and the only identity permitted to confirm. V1 is human-confirmed only —
  -- no system/automation actor is invented here; when a provider integration
  -- arrives it will need its own provenance model, and pretending otherwise now
  -- would put a fake user in the audit trail.
  confirmed_by       uuid        not null references public.growth_users(id) on delete restrict,

  status             text        not null default 'confirmed',
  notes              text,

  -- Doubles as confirmed_at: rows are only ever created at confirmation time,
  -- so a separate column could never hold a different value — and two
  -- timestamps that can never differ are two timestamps that eventually
  -- disagree.
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint school_payments_amount_check
    check (amount > 0),

  constraint school_payments_method_check
    check (payment_method in ('mpesa', 'bank_transfer', 'cheque', 'cash', 'other')),

  -- Only two statuses, both earned. 'pending' has no workflow: recording
  -- happens only AFTER the founder has verified money arrived, so a payment is
  -- never pending inside EduNexus. 'refunded'/'void' are distinctions without a
  -- difference at this scale — both mean "this money is no longer ours".
  constraint school_payments_status_check
    check (status in ('confirmed', 'reversed')),

  -- A blank or whitespace-only reference would defeat the idempotency key
  -- below, so it is rejected outright. A payment with no natural reference gets
  -- a deliberate one ('BANK-2026-08-12-KAHUTINI'), which is a decision rather
  -- than a silent gap.
  constraint school_payments_reference_not_blank
    check (length(btrim(payment_reference)) > 0),

  constraint school_payments_coverage_order_check
    check (coverage_start is null or coverage_start <= coverage_end)
);

-- THE IDEMPOTENCY BOUNDARY.
-- M-PESA codes are globally unique, so this is stronger than needed there.
-- Bank references are NOT reliably unique across institutions — but they are
-- effectively unique per school, which is the scope that matters: two different
-- schools may both use 'TRF001', while the same school must not record 'TRF001'
-- twice. Normalised so casing/whitespace cannot smuggle a duplicate past it.
create unique index if not exists school_payments_identity_key
  on public.school_payments (school_id, payment_method, lower(btrim(payment_reference)));

create index if not exists idx_school_payments_school_created
  on public.school_payments (school_id, created_at desc);

comment on table public.school_payments is
  'Institutional payments received from schools OUTSIDE EduNexus (bank transfer, M-PESA, cheque) and confirmed by a platform admin. Explains WHY a school holds entitlement; never consulted for access decisions. Service-role writes only.';

-- ── Security ────────────────────────────────────────────────────────────────
--
-- RLS on with ZERO policies for anon/authenticated: no client read, no client
-- write, at all. All access is through requireGrowthUser()-gated server routes
-- using the service client, which bypasses RLS.
--
-- School-admin visibility of their own payment history is a real future
-- feature, deliberately not built here — it needs a scoped SELECT policy, and
-- every such policy is a new surface to get right. Founder-only is one fewer
-- way for financial data to leak.
alter table public.school_payments enable row level security;

-- Supabase grants these by default on new tables in `public`. Removing them
-- means a future permissive policy cannot silently re-open write access, and
-- TRUNCATE in particular is NOT subject to RLS — a grant is the only thing that
-- would ever stand in front of it.
revoke all on public.school_payments from anon;
revoke all on public.school_payments from authenticated;

-- ── Immutability ────────────────────────────────────────────────────────────
--
-- Confirmed financial history must not be silently rewritten. Same trigger
-- shape as trg_guard_school_entitlement / trg_guard_teacher_role — a BEFORE
-- trigger comparing OLD to NEW, which is the pattern this codebase has settled
-- on for "this column is not yours to change".
--
-- Coverage dates are immutable too, and that is a deliberate product decision:
-- coverage_start/coverage_end record what was PAID FOR, not what access the
-- school currently has. If entitlement dates need correcting, correct them
-- through the entitlement authority (setSchoolEntitlement) — do not rewrite
-- history to move an access date.
--
-- Mutable: notes (reconciliation detail) and status (confirmed → reversed).
create or replace function public.fn_guard_school_payment_immutability()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if new.school_id         is distinct from old.school_id
     or new.amount            is distinct from old.amount
     or new.payment_method    is distinct from old.payment_method
     or new.payment_reference is distinct from old.payment_reference
     or new.payment_date      is distinct from old.payment_date
     or new.coverage_start    is distinct from old.coverage_start
     or new.coverage_end      is distinct from old.coverage_end
     or new.confirmed_by      is distinct from old.confirmed_by
     or new.created_at        is distinct from old.created_at
  then
    raise exception 'school_payments: confirmed financial facts are immutable - record a correcting entry instead of rewriting history'
      using errcode = '42501';
  end if;

  -- A reversal is one-way; a reversed payment is not un-reversed by an UPDATE.
  if old.status = 'reversed' and new.status <> 'reversed' then
    raise exception 'school_payments: a reversed payment cannot be un-reversed'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_school_payment_immutability on public.school_payments;

create trigger trg_guard_school_payment_immutability
  before update on public.school_payments
  for each row execute function public.fn_guard_school_payment_immutability();
