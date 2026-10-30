-- Make bridge identity and ownership fields on public.students server-owned
-- (security audit 2026-10-30, F-04 / F-09).
--
-- PROVEN BEFORE THIS MIGRATION (local stack, rolled-back transaction): an
-- ordinary signed-in user could INSERT a students row through PostgREST with
-- any external_id and added_by = 'teacher'. "students: own insert" checks
-- only user_id = auth.uid(), and every column was client-writable.
--
-- Why that matters:
--   external_id   lib/core/academicBridge.ts::ensureBridgedLearner resolved
--                 a Core learner to ANY students row whose external_id
--                 matched. A row planted before the learner's first marked
--                 assessment would have received that learner's marks and
--                 Evidence, readable by the attacker who owns the row.
--   added_by      'teacher' rows are excluded from the parent plan-limit
--                 count (app/api/students/create).
--   teacher_id    a direct teacher link (lib/compass/ownership.ts).
--   school_id     school-staff visibility ("students: school staff manage").
--   parent_user_id  family membership (lib/core/identity.ts).
--   integration_connection_id, capability_profile, capability_computed_at
--                 integration identity and computed intelligence state.
--
-- Every legitimate writer of these fields is server-side and runs as the
-- service role (API routes via createServiceClient, the Core bridge, the
-- integration sync, the capability recompute), which this guard exempts —
-- the same exemption fn_guard_profile_role and fn_guard_school_entitlement
-- use. The one client-side students write in the app
-- (app/dashboard/clinic/page.tsx: curriculum_type, year_level) touches none
-- of them and is unaffected.
--
-- EXISTING ROWS: untouched. A row an attacker may already have planted is
-- not deleted here; the bridge lookups now also require user_id IS NULL
-- (bridge rows are created with no user_id and never acquire one), so such
-- a row can no longer be selected as a learner's bridge — the bridge fails
-- loudly on the unique index instead of attaching to it. The production
-- verification checklist carries the read-only query that lists any.
--
-- ROLLBACK: drop trigger trg_guard_students_server_fields on public.students;
-- drop function public.fn_guard_students_server_fields(). Re-opens F-04/F-09.

create or replace function public.fn_guard_students_server_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.external_id               is not null
       or new.integration_connection_id is not null
       or new.teacher_id             is not null
       or new.school_id              is not null
       or new.parent_user_id         is not null
       or new.capability_profile     is not null
       or new.capability_computed_at is not null
       or coalesce(new.added_by, 'parent') <> 'parent' then
      raise exception 'students: bridge, ownership and computed fields are set server-side only'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.external_id               is distinct from old.external_id
     or new.integration_connection_id is distinct from old.integration_connection_id
     or new.teacher_id             is distinct from old.teacher_id
     or new.school_id              is distinct from old.school_id
     or new.parent_user_id         is distinct from old.parent_user_id
     or new.capability_profile     is distinct from old.capability_profile
     or new.capability_computed_at is distinct from old.capability_computed_at
     or new.added_by               is distinct from old.added_by then
    raise exception 'students: bridge, ownership and computed fields cannot be changed by a client'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_students_server_fields on public.students;
create trigger trg_guard_students_server_fields
  before insert or update on public.students
  for each row execute function public.fn_guard_students_server_fields();
