-- db_security_hardening_phase4_security_invoker_views (prod 20260702141853)
ALTER VIEW public.v_api_careers          SET (security_invoker = on);
ALTER VIEW public.v_api_learning_outcomes SET (security_invoker = on);
ALTER VIEW public.v_api_strands          SET (security_invoker = on);
ALTER VIEW public.v_api_subjects         SET (security_invoker = on);
ALTER VIEW public.v_api_substrands       SET (security_invoker = on);
