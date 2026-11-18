-- Growth Engine boundary lockdown.
--
-- growth_users membership must only ever be provisioned by the server
-- (GrowthUserRepository.ensure() via the service-role client, behind the
-- founder-identity check in lib/growth/auth.ts). Until now the table was
-- reachable from client roles: authenticated held INSERT/UPDATE/DELETE and the
-- growth_users_insert_own / growth_users_update_own policies let a caller
-- create or alter its own row. Membership is the predicate of every growth_*
-- RLS policy (is_growth_user()) and was trusted by server-side admin checks,
-- so it must not be self-service.
--
-- All application access to growth_* goes through growthRepos
-- (BaseRepository -> createServiceClient(), role service_role, BYPASSRLS).
-- No session-bound (anon/authenticated) client reads or writes these tables,
-- so client roles need no privilege on them.
--
-- DDL only: no rows are read, changed or removed. Idempotent. Targeted
-- rollback: see the release procedure (restores the exact prior ACLs/policies).

-- 1. Membership can never be self-service.
drop policy if exists growth_users_insert_own on public.growth_users;
drop policy if exists growth_users_update_own on public.growth_users;

-- 2. Client roles hold no privileges on the Growth context.
revoke all on public.growth_users      from anon, authenticated;
revoke all on public.growth_schools    from anon, authenticated;
revoke all on public.growth_contacts   from anon, authenticated;
revoke all on public.growth_activities from anon, authenticated;
revoke all on public.growth_follow_ups from anon, authenticated;

-- 3. The membership predicate is not a client-callable RPC.
revoke execute on function public.is_growth_user() from public, anon, authenticated;
grant  execute on function public.is_growth_user() to service_role;

-- 4. Defence in depth: whatever grants or policies a later migration might
--    (re)introduce, only the server can create or change a membership row.
--    Keyed on current_user (the role PostgREST switches to per request), so it
--    does not depend on JWT claim settings.
create or replace function public.growth_users_server_only()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'growth_users membership can only be provisioned by the server'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists growth_users_server_only_trg on public.growth_users;
create trigger growth_users_server_only_trg
  before insert or update or delete on public.growth_users
  for each row execute function public.growth_users_server_only();
