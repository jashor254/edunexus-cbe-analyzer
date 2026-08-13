-- School Institutional Entitlement — the destination school payment will later activate.
--
-- WHY NEW COLUMNS RATHER THAN REUSING SOMETHING EXISTING
-- The pre-implementation audit evaluated every candidate already on the live
-- schema and rejected each for a specific reason:
--   * schools.is_active            — means "not deleted" (405/405 true); conflates
--                                    a school existing with a school having paid.
--   * schools.subscription_tier    — no expiry, so it cannot answer "is coverage
--                                    still current", and 405/405 rows read 'free'.
--                                    It is also reachable by the school's own
--                                    creator through the "schools: own update"
--                                    RLS policy (see the guard below).
--   * school_settings.intelligence_enabled — a feature flag with unrelated meaning.
--   * subscriptions                — per-user, no school column; would need one row
--                                    per teacher and would silently miss anyone who
--                                    joins the school later.
-- Two purpose-built columns answer the entitlement question and nothing else.
-- Payment history/finance fields are deliberately NOT here — those belong to a
-- later, separate business record, and gating logic that reads finance fields
-- becomes finance logic.

alter table public.schools
  add column if not exists school_entitlement_status text not null default 'none',
  add column if not exists school_entitlement_expires_at timestamptz;

alter table public.schools
  drop constraint if exists schools_entitlement_status_check;

alter table public.schools
  add constraint schools_entitlement_status_check
  check (school_entitlement_status in ('none', 'active', 'suspended', 'expired'));

comment on column public.schools.school_entitlement_status is
  'Institutional EduNexus entitlement for this school: none | active | suspended | expired. '
  'Active teachers inherit school-covered access through school_users while this is ''active'' '
  'and school_entitlement_expires_at is null or in the future. Mutable ONLY through the '
  'platform-admin service path — enforced by trg_guard_school_entitlement, not by UI.';

comment on column public.schools.school_entitlement_expires_at is
  'When institutional coverage lapses. NULL means no expiry (open-ended coverage).';

-- Entitlement resolution runs on every gated teacher request, so the covered
-- lookup must not seq-scan. Partial: only ''active'' rows are ever joined against.
create index if not exists idx_schools_entitlement_active
  on public.schools (id)
  where school_entitlement_status = 'active';

-- ── Self-grant guard ────────────────────────────────────────────────────────
--
-- THE VULNERABILITY THIS CLOSES
-- `schools` carries the policy "schools: own update" — USING/WITH CHECK
-- (created_by = auth.uid()) — and provision_teacher_school() sets created_by to
-- the provisioning teacher. Without this guard, any auto-provisioned teacher
-- could UPDATE their own school row and grant their school entitlement in a
-- single request. Likewise "schools: own insert" (created_by = auth.uid())
-- would let any authenticated user INSERT a school pre-set to 'active'.
--
-- A trigger rather than column-level GRANTs: column privileges would require
-- revoking table-level UPDATE and re-granting all 18 existing columns, which
-- then silently denies every column added by a future migration. A trigger
-- stays correct as the table grows and fails with an explicit message.
--
-- current_user reflects PostgREST's `SET LOCAL ROLE` — 'anon' or 'authenticated'
-- for browser traffic, 'service_role' for the service client that the
-- platform-admin activation path uses. SECURITY DEFINER functions
-- (provision_teacher_school) run as their owner and are permitted, which is
-- safe: that function does not touch these columns.
create or replace function public.fn_guard_school_entitlement()
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
    if new.school_entitlement_status is distinct from 'none'
       or new.school_entitlement_expires_at is not null then
      raise exception
        'school entitlement cannot be set at creation — it is granted only through the EduNexus platform-admin path'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.school_entitlement_status is distinct from old.school_entitlement_status
     or new.school_entitlement_expires_at is distinct from old.school_entitlement_expires_at then
    raise exception
      'school entitlement is not self-service — only the EduNexus platform-admin path may change it'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_school_entitlement on public.schools;

create trigger trg_guard_school_entitlement
  before insert or update on public.schools
  for each row
  execute function public.fn_guard_school_entitlement();

-- Legitimate school metadata editing (name, county, logo, motto, contacts) is
-- deliberately untouched — the guard fires only when an entitlement column
-- actually changes value.
