-- db_security_hardening_phase8_revoke_anon_on_privileged_functions (prod 20260702142321)
-- Verbatim recovered SQL.

REVOKE EXECUTE ON FUNCTION public.handle_new_user()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_ultimate()   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_developer()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_new_user()        FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_marked_users()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_users_for_deletion()    FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_successful_payment_webhook(uuid, text, text, text, integer, numeric, jsonb, text)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.add_tokens(uuid, integer)    FROM anon;
REVOKE EXECUTE ON FUNCTION public.deduct_tokens(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deduct_ai_token(uuid, text)  FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_learner_dashboard_stats(uuid) FROM anon;
