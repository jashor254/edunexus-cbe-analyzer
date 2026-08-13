-- Close the self-declared-admin cross-tenant privilege escalation.
--
-- PROVEN LIVE BEFORE THIS MIGRATION, real authenticated non-admin user:
--
--   1. INSERT own `teachers` row with role='admin'          → SUCCEEDED
--   2. UPDATE own `teachers` row 'teacher' → 'admin'        → SUCCEEDED
--   3. UPDATE own `profiles` row role → 'admin'             → SUCCEEDED
--   …then, as a "platform admin", cross-tenant reads of:
--      students (668 rows), token_balances (12), lesson_plans (20),
--      schemes_of_work (5), app_config (1)                  → ALL SUCCEEDED
--
--   (Cross-USER writes to teachers were already correctly blocked:
--    inserting another user's row returns 42501, and updating another
--    user's row matches zero rows. The escalation is entirely self-directed.)
--
-- ROOT CAUSE
-- `teachers.role` and `profiles.role` are both CHECK-constrained — and both
-- CHECK lists include 'admin'. The constraint was never the problem: the
-- problem is that the row is writable by the user it describes, so 'admin' is
-- a value the attacker may legally assign to themselves. Nine RLS policies
-- then used that self-written value as an authorization primitive:
--
--     EXISTS (SELECT 1 FROM teachers
--             WHERE user_id = auth.uid() AND role = 'admin')
--
-- Authorization must never depend on a field the requesting user can assign to
-- themselves. A teacher profile may DESCRIBE someone; it must not GRANT them
-- platform authority.
--
-- TWO-PART FIX
--   Part 1 — stop future self-promotion (triggers below).
--   Part 2 — stop trusting the value at all, so historical or future bad rows
--            are inert. Part 1 alone would leave a fragile design in which one
--            missed write path re-opens everything.

-- ── Part 1: root cause — privileged role is not self-assignable ─────────────
--
-- Triggers rather than tightened WITH CHECK, for a specific reason: a WITH
-- CHECK of (role = 'teacher') on UPDATE would also block the one legitimate
-- existing admin from editing their own name or phone, because WITH CHECK sees
-- only the NEW row and cannot tell "kept role" from "granted role". A trigger
-- compares OLD to NEW and so permits ordinary profile edits while forbidding
-- privilege changes.
--
-- current_user reflects PostgREST's `SET LOCAL ROLE` — 'anon'/'authenticated'
-- for browser traffic, 'service_role' for the server clients that legitimately
-- write these columns (app/auth/callback, app/api/auth/complete-profile — both
-- verified to use createServiceClient()).

create or replace function public.fn_guard_teacher_role()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'teacher' then
      raise exception 'teachers.role may only be set to ''teacher'' by a client - platform roles are granted server-side only'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'teachers.role cannot be changed by a client - platform roles are granted server-side only'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_teacher_role on public.teachers;
create trigger trg_guard_teacher_role
  before insert or update on public.teachers
  for each row execute function public.fn_guard_teacher_role();

-- profiles.role is the same defect with a wider blast radius: it is also read
-- by checkFeatureAccess() step 4, where role='admin' grants a full paid-tier
-- bypass. Ordinary profile fields (full_name, avatar_url, onboarding_completed)
-- stay client-editable; only the role column is frozen.
create or replace function public.fn_guard_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'admin' then
      raise exception 'profiles.role ''admin'' is granted server-side only'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'profiles.role cannot be changed by a client - roles are assigned server-side only'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before insert or update on public.profiles
  for each row execute function public.fn_guard_profile_role();

-- ── Part 2: remove the attacker-controlled predicate from authorization ─────
--
-- These are DROPPED rather than re-expressed against a trusted primitive,
-- because every platform-admin operation in this codebase already runs through
-- the service-role client (app/api/admin/*, lib/payments/fulfillment.ts), which
-- bypasses RLS entirely and is unaffected. Recreating browser-reachable
-- cross-tenant superuser access would rebuild the hazard for a capability the
-- product does not use. Minimum privilege, not policy preservation.
--
-- Each table's legitimate scoped policies (own-row, teacher-scoped,
-- school-staff-scoped, parent-scoped, service-role) are deliberately untouched.

drop policy if exists "Admin full access on students"        on public.students;
drop policy if exists "Admin full access on token_balances"  on public.token_balances;
drop policy if exists "Admin full access on lesson_plans"    on public.lesson_plans;
drop policy if exists "Admin full access on schemes_of_work" on public.schemes_of_work;
drop policy if exists "Admin full access on scheme_lessons"  on public.scheme_lessons;
drop policy if exists "Admin full access on student_alerts"  on public.student_alerts;
drop policy if exists "Admin full access on teacher_classes" on public.teacher_classes;
drop policy if exists "Admin full access on app_config"      on public.app_config;

-- ── Part 3: blanket grants that RLS does not cover ─────────────────────────
--
-- TRUNCATE is NOT subject to row-level security. Every table below carried
-- TRUNCATE to both anon and authenticated (the Supabase default grant), so RLS
-- was never standing in front of it. PostgREST cannot emit TRUNCATE today, so
-- this is latent rather than exploitable — but it is free to remove and there
-- is no client-side use for it.
revoke truncate on public.students,        public.token_balances, public.lesson_plans,
                   public.schemes_of_work, public.scheme_lessons, public.student_alerts,
                   public.teacher_classes, public.app_config,
                   public.teachers,        public.profiles
  from anon, authenticated;

-- token_balances and app_config additionally have no legitimate client-side
-- write path at all: balances move only through creditTokens()/deduct_tokens
-- on the service client, and app_config is read by no application code. The
-- other tables keep their DML grants because teacher-scoped browser writes are
-- real there.
revoke insert, update, delete on public.token_balances from anon, authenticated;
revoke insert, update, delete on public.app_config     from anon, authenticated;

comment on column public.teachers.role is
  'Describes the person. NOT an authorization primitive - no RLS policy may trust it. Client writes are frozen to ''teacher'' by trg_guard_teacher_role; platform roles are granted server-side only.';

comment on column public.profiles.role is
  'Describes the person. Read by checkFeatureAccess() for tier resolution, so it is security-relevant: client writes are frozen by trg_guard_profile_role and it is assigned server-side only.';
