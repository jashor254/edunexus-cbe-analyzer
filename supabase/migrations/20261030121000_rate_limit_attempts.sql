-- Shared, database-backed attempt limiter (security audit 2026-10-30,
-- F-02 / F-07). One primitive used by every caller that must bound an
-- abusable action across serverless instances:
--
--   rate_limit_reserve(bucket, subject, limit, since) → uuid | null
--     Atomically: lock (bucket, subject), prune that pair's rows older than
--     `since`, count the rest, and insert ONE reservation row only if the
--     count is below `limit`. Returns the reservation id, or NULL when the
--     limit is reached. The advisory lock is what makes it concurrency-safe:
--     N parallel callers at count = limit-1 cannot all pass — exactly one
--     gets the last slot. (A count-then-insert from the application could
--     not guarantee that.)
--
--   rate_limit_release(id)
--     Refunds one reservation. Callers choose what counts: the class-join
--     limiter refunds SUCCESSFUL joins, so only failed guesses accumulate.
--
-- Access: service role only. The table has RLS on with a policy for
-- service_role alone, table privileges are revoked from anon/authenticated,
-- and EXECUTE on both functions is revoked from PUBLIC/anon/authenticated —
-- a client can neither read, forge, nor reset another subject's counter.
-- SECURITY INVOKER: the functions run with the caller's (service role's)
-- rights, never elevated ones.
--
-- Window semantics are the caller's: `since` is "now - 1 hour" for a rolling
-- window, or "today 00:00 UTC" for a calendar-day cap. One bucket uses one
-- window shape by convention, so pruning by `since` never deletes rows
-- another caller of the same bucket still counts.
--
-- ROLLBACK: drop the two functions and the table. No other object depends
-- on them; callers fail closed (the limiter reports unavailable) rather
-- than silently unlimited.

create table if not exists public.rate_limit_attempts (
  id         uuid        primary key default gen_random_uuid(),
  bucket     text        not null check (length(bucket)  between 1 and 100),
  subject    text        not null check (length(subject) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_attempts_bucket_subject_created
  on public.rate_limit_attempts (bucket, subject, created_at);

alter table public.rate_limit_attempts enable row level security;

drop policy if exists "rate_limit_attempts: service role only" on public.rate_limit_attempts;
create policy "rate_limit_attempts: service role only"
  on public.rate_limit_attempts for all
  to service_role
  using (true) with check (true);

revoke all on public.rate_limit_attempts from anon, authenticated;

create or replace function public.rate_limit_reserve(
  p_bucket  text,
  p_subject text,
  p_limit   integer,
  p_since   timestamptz
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
  v_id    uuid;
begin
  if p_bucket is null or length(p_bucket) = 0 or p_subject is null or length(p_subject) = 0 then
    raise exception 'rate_limit_reserve: bucket and subject are required';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'rate_limit_reserve: limit must be at least 1';
  end if;
  if p_since is null or p_since > now() then
    raise exception 'rate_limit_reserve: since must be a past timestamp';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_bucket || chr(31) || p_subject, 0));

  delete from public.rate_limit_attempts
   where bucket = p_bucket and subject = p_subject and created_at < p_since;

  select count(*) into v_count
    from public.rate_limit_attempts
   where bucket = p_bucket and subject = p_subject and created_at >= p_since;

  if v_count >= p_limit then
    return null;
  end if;

  insert into public.rate_limit_attempts (bucket, subject)
  values (p_bucket, p_subject)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.rate_limit_release(p_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.rate_limit_attempts where id = p_id;
$$;

revoke all on function public.rate_limit_reserve(text, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.rate_limit_release(uuid) from public, anon, authenticated;
grant execute on function public.rate_limit_reserve(text, text, integer, timestamptz) to service_role;
grant execute on function public.rate_limit_release(uuid) to service_role;
