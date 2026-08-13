-- Close the subscriptions self-grant privilege escalation.
--
-- PROVEN LIVE BEFORE THIS MIGRATION, with a real authenticated non-admin user
-- against the production PostgREST endpoint:
--
--   1. INSERT own row {plan:'family', status:'active', expires_at:+10y}  → SUCCEEDED
--   2. INSERT own `teachers` row with role:'admin'                       → SUCCEEDED
--   3. …then SELECT another user's subscription                          → SUCCEEDED
--   4. …then UPDATE another user's subscription plan to 'school'         → SUCCEEDED
--
-- (1) is the self-grant: checkFeatureAccess() step 6 accepts any row with
-- status='active' and expires_at in the future, so a forged row buys unlimited
-- subscriber-tier access for free.
--
-- (2)→(4) is the same defect one level up, and is worse than self-grant because
-- it crosses users. `teachers.role` is unconstrained text with an INSERT policy
-- of merely WITH CHECK (user_id = auth.uid()) — nothing stops a user declaring
-- themselves 'admin'. The "Admin full access on subscriptions" policy trusted
-- exactly that self-declared value, so it handed out full read/write over every
-- subscription in the table.
--
-- WHAT REPLACES THEM: nothing. Every legitimate subscription writer in the
-- codebase already uses the service-role client, which bypasses RLS entirely
-- and is unaffected by this migration:
--   lib/payments/fulfillment.ts::creditSubscription  (injected client)
--     ← app/api/payments/callback   createServiceClient()
--     ← app/api/payments/verify     createServiceClient()
--     ← app/api/admin/activate-user createServiceClient()
--   app/api/admin/grant-access                       createServiceClient()
--   app/api/admin/init                               createServiceClient()
-- No route needed either dropped policy. They were pure attack surface.
--
-- SELECT is deliberately preserved: lib/api-protection.ts reads the caller's
-- own subscription through the authenticated client and depends on
-- "subscriptions: own read". Customers may read their subscription; they may
-- not write one.

-- The self-grant.
drop policy if exists "subscriptions: own insert" on public.subscriptions;

-- The self-declared-admin escalation. Admin surfaces use service_role, which
-- does not consult policies, so dropping this removes capability from attackers
-- only.
drop policy if exists "Admin full access on subscriptions" on public.subscriptions;

-- Defense in depth. With both policies gone, RLS already denies these — but the
-- table still carried blanket INSERT/UPDATE/DELETE/TRUNCATE grants to anon and
-- authenticated, so any permissive policy added here in future would silently
-- re-open write access. Removing the grant makes that impossible rather than
-- merely unlikely. TRUNCATE matters especially: it is NOT subject to RLS at
-- all, so a grant is the only thing standing in front of it.
revoke insert, update, delete, truncate on public.subscriptions from anon;
revoke insert, update, delete, truncate on public.subscriptions from authenticated;

-- service_role and postgres retain full privileges — untouched above, and the
-- only paths that legitimately write subscriptions.

comment on table public.subscriptions is
  'Paid subscription state. WRITES ARE SERVICE-ROLE ONLY - there is no INSERT/UPDATE/DELETE policy or grant for anon/authenticated, by design. Mutate only through verified payment fulfilment (lib/payments/fulfillment.ts) or an authorized admin activation route. Clients may SELECT their own row.';
