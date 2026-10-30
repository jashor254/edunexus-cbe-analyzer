-- Restrict increment_insights_view to the service role (security audit
-- 2026-10-30, P3; Supabase advisor 0028/0029).
--
-- The function is SECURITY DEFINER and was executable by anon and
-- authenticated over /rest/v1/rpc/increment_insights_view, so anyone could
-- inflate any article's view count directly, bypassing the app route. The
-- only caller is lib/insights/articles.ts::incrementViewCount, which uses the
-- service-role client (POST /api/insights/views) and is unaffected.
--
-- Guarded with to_regprocedure so the migration is a no-op on any database
-- that does not have the function.
--
-- ROLLBACK: grant execute on function public.increment_insights_view(text) to anon, authenticated;

do $$
begin
  if to_regprocedure('public.increment_insights_view(text)') is not null then
    revoke all on function public.increment_insights_view(text) from public, anon, authenticated;
    grant execute on function public.increment_insights_view(text) to service_role;
  end if;
end $$;
