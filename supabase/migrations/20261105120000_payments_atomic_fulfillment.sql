-- 20261105120000_payments_atomic_fulfillment.sql
--
-- DSA-04 (docs/security/deep-audit-2026-11-04.md): payment success could be
-- recorded without the purchased entitlement being delivered. The application
-- marked the payments row 'success' FIRST and then credited tokens / a
-- subscription in separate statements whose errors were ignored; any failure
-- in between left a paid customer with no access, and because the row was
-- already 'success' no retry would ever repair it. Token crediting was also a
-- read-modify-write that could lose concurrent credits.
--
-- This function does the whole fulfilment as ONE transaction:
--   1. lock the payments row (FOR UPDATE) — concurrent webhook/redirect callers
--      queue here, so the second one sees 'success' and credits nothing;
--   2. serialise entitlement writes for that user (advisory transaction lock);
--   3. credit tokens with an atomic upsert, or extend/create the subscription;
--   4. only then mark the payment 'success'.
-- If any step raises, Postgres rolls back all of it: the payment stays
-- 'pending' with nothing credited, and the webhook retry / reconciliation job
-- completes it later. A 'failed' row may be fulfilled too: the caller only
-- invokes this after Paystack has confirmed success for the exact amount and
-- currency, and an earlier non-final check could have written 'failed'.
--
-- What it does NOT do: verify the payment with Paystack, or decide the token
-- amount / subscription length. Those stay in the application (single source
-- of truth in lib/payments/config.ts) and are passed in as parameters.
--
-- Subscription extension starts from the later of the current expiry and now(),
-- so a lapsed-but-still-'active' row can never shorten the period paid for.
--
-- Additive: creates one function, changes no table and no data.
-- Deploy order: apply this migration BEFORE deploying the application release
-- that calls it (the new code has no fallback to the old non-atomic path).
-- Rollback (reverts to "function missing"; the NEW code would then fail closed
-- with a thrown error, leaving payments pending): 
--   drop function if exists public.fulfill_payment_atomic(uuid, integer, text, integer);

create or replace function public.fulfill_payment_atomic(
  p_payment_id  uuid,
  p_token_grant integer,
  p_plan        text,
  p_months      integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_sub     record;
begin
  if (p_token_grant is null) = (p_plan is null) then
    raise exception 'fulfill_payment_atomic: exactly one of p_token_grant or p_plan is required';
  end if;
  if p_token_grant is not null and p_token_grant <= 0 then
    raise exception 'fulfill_payment_atomic: p_token_grant must be positive';
  end if;
  if p_plan is not null and (p_months is null or p_months <= 0) then
    raise exception 'fulfill_payment_atomic: p_months must be positive for a subscription';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'fulfill_payment_atomic: payment % not found', p_payment_id;
  end if;

  if v_payment.status = 'success' then
    return 'already_processed';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_payment.user_id::text, 0));

  if p_token_grant is not null then
    insert into public.token_balances (user_id, balance, total_ever)
    values (v_payment.user_id, p_token_grant, p_token_grant)
    on conflict (user_id) do update
      set balance    = public.token_balances.balance    + excluded.balance,
          total_ever = public.token_balances.total_ever + excluded.total_ever;
  else
    select id, expires_at into v_sub
    from public.subscriptions
    where user_id = v_payment.user_id and status = 'active'
    order by expires_at desc
    limit 1
    for update;

    if found then
      update public.subscriptions
      set plan       = p_plan,
          status     = 'active',
          expires_at = greatest(v_sub.expires_at, now()) + make_interval(months => p_months),
          payment_id = p_payment_id
      where id = v_sub.id;
    else
      insert into public.subscriptions (user_id, payment_id, plan, status, started_at, expires_at)
      values (v_payment.user_id, p_payment_id, p_plan, 'active', now(), now() + make_interval(months => p_months));
    end if;
  end if;

  update public.payments
  set status = 'success', updated_at = now()
  where id = p_payment_id;

  return 'fulfilled';
end;
$$;

revoke all on function public.fulfill_payment_atomic(uuid, integer, text, integer) from public, anon, authenticated;
grant execute on function public.fulfill_payment_atomic(uuid, integer, text, integer) to service_role;

-- Self-check: abort the migration if a browser role could call it.
do $$
begin
  if has_function_privilege('anon', 'public.fulfill_payment_atomic(uuid, integer, text, integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.fulfill_payment_atomic(uuid, integer, text, integer)', 'EXECUTE') then
    raise exception 'fulfill_payment_atomic is executable by a browser role';
  end if;
end $$;
