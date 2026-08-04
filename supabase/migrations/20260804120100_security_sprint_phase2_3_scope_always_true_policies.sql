-- Security remediation sprint — Phase 2/3.
--
-- Supabase's security advisor flagged 15 RLS policies as
-- "rls_policy_always_true": USING(true) and/or WITH CHECK(true) with no
-- role restriction on the CREATE POLICY statement. In Postgres, a policy
-- with no explicit `TO` clause applies to PUBLIC — i.e. to *every* role,
-- including `anon` and `authenticated`, not just the service role the
-- policy names/comments imply. Because Postgres OR's every applicable
-- policy together, these always-true policies didn't just fail to add
-- protection — they overrode the narrower owner-scoped policies that
-- exist alongside them on the same tables (e.g. parent_profiles' own
-- "own read"/"own update" policies were made moot by the unrestricted
-- "Service role can do everything" policy sitting next to them).
--
-- Verified live (not just from migration source) via pg_policies that
-- all 15 have roles = {public} and either USING(true), WITH CHECK(true),
-- or both:
--   parent_profiles              "Service role can do everything"   ALL
--   early_access_leads           "early_access: service only"       ALL
--   notification_log             "Service role full access to notification_log" ALL
--   pilot_tracking                "admin_only"                       ALL
--   capability_history            "capability_history_service_insert" INSERT
--   insights_newsletter_subscribers "public_insert_newsletter"       INSERT
--   kicd_curriculum_lessons        "kicd_lessons: service insert"    INSERT
--   sow_grades                    "sow_grades: service insert"       INSERT
--   sow_learning_areas             "sow_la: service insert"           INSERT
--   sow_learning_outcomes          "sow_lo: service insert"           INSERT
--   sow_levels                    "sow_levels: service insert"       INSERT
--   sow_set_books                  "sow_set_books: service insert"   INSERT
--   sow_strands                    "sow_strands: service insert"      INSERT
--   sow_substrands                 "sow_substrands: service insert"  INSERT
--   sow_templates                  "sow_templates: service insert"    INSERT
--
-- Verified every write path into these tables goes through
-- createServiceClient() server-side (app/api/admin/pilot/*,
-- app/api/early-access/register, app/api/admin/activate-user,
-- lib/insights/newsletter.ts, curriculum import tooling,
-- lib/repositories/career.repository.ts /
-- lib/repositories/learner-model.repository.ts for capability_history).
-- No client ever needs anon/authenticated write access to any of these
-- tables, so scoping every one of these 15 policies `TO service_role`
-- closes the hole with zero application impact. This is a policy-role
-- change only (ALTER POLICY ... TO), so USING/WITH CHECK expressions —
-- and the narrower owner-scoped policies that already exist alongside
-- some of these (parent_profiles' own-read/own-write, capability_history's
-- read-own, sow_*'s "public read" and kicd_curriculum_lessons' "public
-- read") — are untouched.
--
-- sow_*/kicd_curriculum_lessons "public read" SELECT policies and
-- insights_newsletter_subscribers having no SELECT policy at all are
-- intentional and left as-is: curriculum reference content is meant to
-- be publicly readable, and newsletter subscriber rows are meant to be
-- write-only from the public's perspective (no policy = no anon/
-- authenticated read, which is correct here and not touched by this
-- migration).

BEGIN;

ALTER POLICY "Service role can do everything" ON public.parent_profiles TO service_role;
ALTER POLICY "early_access: service only" ON public.early_access_leads TO service_role;
ALTER POLICY "Service role full access to notification_log" ON public.notification_log TO service_role;
ALTER POLICY "admin_only" ON public.pilot_tracking TO service_role;
ALTER POLICY "capability_history_service_insert" ON public.capability_history TO service_role;
ALTER POLICY "public_insert_newsletter" ON public.insights_newsletter_subscribers TO service_role;
ALTER POLICY "kicd_lessons: service insert" ON public.kicd_curriculum_lessons TO service_role;
ALTER POLICY "sow_grades: service insert" ON public.sow_grades TO service_role;
ALTER POLICY "sow_la: service insert" ON public.sow_learning_areas TO service_role;
ALTER POLICY "sow_lo: service insert" ON public.sow_learning_outcomes TO service_role;
ALTER POLICY "sow_levels: service insert" ON public.sow_levels TO service_role;
ALTER POLICY "sow_set_books: service insert" ON public.sow_set_books TO service_role;
ALTER POLICY "sow_strands: service insert" ON public.sow_strands TO service_role;
ALTER POLICY "sow_substrands: service insert" ON public.sow_substrands TO service_role;
ALTER POLICY "sow_templates: service insert" ON public.sow_templates TO service_role;

COMMIT;
