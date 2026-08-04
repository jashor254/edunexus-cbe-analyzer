-- Security remediation sprint — Phase 5.
--
-- 35 functions were flagged by the Supabase advisor as
-- "function_search_path_mutable" (no SET search_path config at all).
-- A function with no pinned search_path resolves unqualified object
-- references using whatever search_path the calling session has —
-- which a malicious caller controls (e.g. `SET search_path = evil,
-- public` before calling), letting a same-named object in an
-- attacker-writable schema shadow the intended one. This codebase's own
-- prior hardening migrations (20260702141817_db_security_hardening_
-- phase1_search_path.sql and phase7_remaining_search_paths.sql) already
-- pinned `search_path = public` on the majority of functions using
-- exactly this pattern — this migration closes the remaining gap using
-- the same established convention, verified against live pg_proc state
-- rather than assumed from migration history.
--
-- Priority split, per the sprint's own instruction not to batch-edit
-- functions without reviewing risk:
--   - increment_insights_view: the one SECURITY DEFINER function in this
--     list, and reachable by anon/authenticated (see Phase 2/3's
--     baseline). Highest priority of the 35.
--   - The remaining 34 are SECURITY INVOKER trigger functions
--     (enforce_*_immutability / reject_*_mutation / set_*_updated_at) —
--     they run with the calling role's own privileges, not elevated
--     ones, so a search-path hijack here is bounded by what that role
--     could already do directly. Lower risk, but pinned anyway: it's a
--     single ALTER FUNCTION per function (no body rewrite, no behavior
--     change), fully clears the advisor, and costs nothing.
--
-- ALTER FUNCTION ... SET search_path is used throughout instead of
-- CREATE OR REPLACE — it attaches the config without needing to know or
-- reproduce each function's body, so there is zero risk of accidentally
-- altering trigger logic.

BEGIN;

-- Security definer, anon/authenticated-reachable — the one that matters most.
ALTER FUNCTION public.increment_insights_view(text) SET search_path = public;

-- Trigger functions (all zero-arg) — search_path pinned for advisor
-- completeness; SECURITY INVOKER so risk was already bounded.
ALTER FUNCTION public.enforce_achievement_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_approved_print_run_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_blueprint_action_item_decision_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_blueprint_action_item_history_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_blueprint_action_reviews_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_blueprint_snapshot_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_competition_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_evidence_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_evidence_lifecycle_transition() SET search_path = public;
ALTER FUNCTION public.enforce_innovation_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_leadership_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_learner_project_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_portfolio_item_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_teacher_reflection_immutability() SET search_path = public;
ALTER FUNCTION public.enforce_wellbeing_case_immutability() SET search_path = public;
ALTER FUNCTION public.reject_achievement_history_mutation() SET search_path = public;
ALTER FUNCTION public.reject_competition_history_mutation() SET search_path = public;
ALTER FUNCTION public.reject_innovation_iteration_mutation() SET search_path = public;
ALTER FUNCTION public.reject_innovation_review_history_mutation() SET search_path = public;
ALTER FUNCTION public.reject_leadership_history_mutation() SET search_path = public;
ALTER FUNCTION public.reject_wellbeing_update_mutation() SET search_path = public;
ALTER FUNCTION public.set_blueprint_action_items_updated_at() SET search_path = public;
ALTER FUNCTION public.set_blueprint_compass_deliveries_updated_at() SET search_path = public;
ALTER FUNCTION public.set_class_calendar_events_updated_at() SET search_path = public;
ALTER FUNCTION public.set_class_resources_updated_at() SET search_path = public;
ALTER FUNCTION public.set_learner_achievements_updated_at() SET search_path = public;
ALTER FUNCTION public.set_learner_competitions_updated_at() SET search_path = public;
ALTER FUNCTION public.set_learner_innovations_updated_at() SET search_path = public;
ALTER FUNCTION public.set_learner_leadership_updated_at() SET search_path = public;
ALTER FUNCTION public.set_learner_portfolios_updated_at() SET search_path = public;
ALTER FUNCTION public.set_learner_projects_updated_at() SET search_path = public;
ALTER FUNCTION public.set_learner_wellbeing_cases_updated_at() SET search_path = public;
ALTER FUNCTION public.set_portfolio_items_updated_at() SET search_path = public;
ALTER FUNCTION public.set_teacher_reflections_updated_at() SET search_path = public;

COMMIT;
