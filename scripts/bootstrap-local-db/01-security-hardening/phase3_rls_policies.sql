-- db_security_hardening_phase3_rls_policies (prod 20260702141846)
CREATE POLICY "service_role_only" ON public.ai_call_logs
  FOR ALL TO authenticated USING (false);

CREATE POLICY "service_role_only" ON public.eils_events
  FOR ALL TO authenticated USING (false);

CREATE POLICY "service_role_only" ON public.eils_interventions
  FOR ALL TO authenticated USING (false);

CREATE POLICY "service_role_only" ON public.eils_milestones
  FOR ALL TO authenticated USING (false);

CREATE POLICY "service_role_only" ON public.eils_reasoning_log
  FOR ALL TO authenticated USING (false);

CREATE POLICY "service_role_only" ON public.eils_recommendations
  FOR ALL TO authenticated USING (false);

CREATE POLICY "service_role_only" ON public.user_cleanup_stats
  FOR ALL TO authenticated USING (false);

CREATE POLICY "service_role_only" ON public.webhook_errors
  FOR ALL TO authenticated USING (false);
